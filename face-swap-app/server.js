require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = Number(process.env.PORT) || 3000;

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const swapRoute = require('./routes/swap');
app.use('/api', swapRoute);

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'face-swap-app' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(port, () => {
  console.log(`Face Swap App running on http://localhost:${port}`);
});
