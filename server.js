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

app.post('/submit', async (req, res) => {
  console.log('Form hit /submit with data:', req.body);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('ERROR: Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in Render');
    return res.status(500).json({ success: false });
  }

  const fields = Object.entries(req.body)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  const telegramUrl = 'https://telegram.org' + token + '/sendMessage';

  try {
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `New Form Submission:\n\n${fields || 'Empty form data'}`
      })
    });

    const data = await response.json();
    console.log('Telegram API response:', data);

    if (!data.ok) {
      return res.status(502).json({ success: false, error: data.description });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ success: false });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
