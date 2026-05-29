// Express server: serves the static site AND exposes POST /api/contact
// which appends submissions to a Google Sheet.

const path = require('path');
const express = require('express');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '32kb' }));
app.use(express.static(__dirname, { extensions: ['html'] }));

// --- Google Sheets client (service account) ---
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, process.env.GOOGLE_KEY_FILE || 'service-account.json'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

const SHEET_ID = process.env.SHEET_ID;
const SHEET_RANGE = process.env.SHEET_RANGE || 'Sheet1!A:D';

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/contact', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim();
    const message = String(req.body.message || '').trim();

    if (!name || name.length > 120) return res.status(400).json({ error: 'invalid_name' });
    if (!emailRe.test(email) || email.length > 200) return res.status(400).json({ error: 'invalid_email' });
    if (!message || message.length > 2000) return res.status(400).json({ error: 'invalid_message' });

    if (!SHEET_ID) {
      console.error('SHEET_ID is not set in .env');
      return res.status(500).json({ error: 'server_misconfigured' });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[new Date().toISOString(), name, email, message]],
      },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('contact submit failed:', err.message);
    res.status(500).json({ error: 'append_failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Tester.io running on http://localhost:${PORT}`);
});
