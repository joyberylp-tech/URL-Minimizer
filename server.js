const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'urls.json');

// --- tiny JSON-file store: { code: { url, clicks, createdAt } } ---
let db = {};
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (_) {}
const save = () => fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), () => {});

const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode(len = 6) {
  let code;
  do {
    code = Array.from(crypto.randomBytes(len), b => ALPHABET[b % ALPHABET.length]).join('');
  } while (db[code]);
  return code;
}

function normalize(input) {
  try {
    const u = new URL(/^https?:\/\//i.test(input) ? input : 'https://' + input);
    return ['http:', 'https:'].includes(u.protocol) && u.hostname.includes('.') ? u.href : null;
  } catch (_) { return null; }
}

app.use(express.json());
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Create a short link
app.post('/api/shorten', (req, res) => {
  const url = normalize(String(req.body.url || '').trim());
  if (!url) return res.status(400).json({ error: 'Please enter a valid URL.' });

  let code = String(req.body.alias || '').trim();
  if (code) {
    if (!/^[A-Za-z0-9_-]{3,32}$/.test(code) || code === 'api')
      return res.status(400).json({ error: 'Alias must be 3-32 letters, numbers, - or _.' });
    if (db[code]) return res.status(409).json({ error: 'That alias is taken.' });
  } else {
    code = makeCode();
  }

  db[code] = { url, clicks: 0, createdAt: new Date().toISOString() };
  save();
  res.status(201).json({ code, shortUrl: `${req.protocol}://${req.get('host')}/${code}`, url });
});

// Stats for a link
app.get('/api/stats/:code', (req, res) => {
  const entry = db[req.params.code];
  if (!entry) return res.status(404).json({ error: 'Not found' });
  res.json({ code: req.params.code, ...entry });
});

// Redirect
app.get('/:code', (req, res) => {
  const entry = db[req.params.code];
  if (!entry) return res.status(404).send('Link not found');
  entry.clicks++;
  save();
  res.redirect(entry.url);
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
