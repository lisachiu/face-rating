const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '1kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ===== JSON File Database =====
const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { ratings: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data));
}

if (!fs.existsSync(DATA_FILE)) saveData({ ratings: [] });

// Helpers
const PHOTOS_DIR = path.join(__dirname, 'public', 'photos');

function getValidPhotos() {
  if (!fs.existsSync(PHOTOS_DIR)) return [];
  return fs.readdirSync(PHOTOS_DIR)
    .filter(f => /\.(jpg|jpeg|png|webp|svg)$/i.test(f))
    .sort();
}

function isValidSessionId(id) {
  return typeof id === 'string' && /^[a-f0-9-]{30,40}$/i.test(id);
}

// ===== API Routes =====

// Get list of photos
app.get('/api/photos', (req, res) => {
  res.json(getValidPhotos());
});

// Submit a rating
app.post('/api/rate', (req, res) => {
  const { photoId, gender, score, sessionId } = req.body;

  if (!photoId || !gender || !score || !sessionId) {
    return res.status(400).json({ error: '缺少必要欄位' });
  }
  if (!['M', 'F'].includes(gender)) {
    return res.status(400).json({ error: '性別無效' });
  }
  if (!Number.isInteger(score) || score < 1 || score > 10) {
    return res.status(400).json({ error: '分數必須為 1-10 的整數' });
  }
  if (!isValidSessionId(sessionId)) {
    return res.status(400).json({ error: '無效的 session' });
  }

  // Validate photoId exists
  const validPhotos = getValidPhotos();
  if (!validPhotos.includes(photoId)) {
    return res.status(400).json({ error: '照片不存在' });
  }

  const data = loadData();
  const idx = data.ratings.findIndex(r => r.photoId === photoId && r.sessionId === sessionId);
  const entry = { photoId, gender, score, sessionId, createdAt: new Date().toISOString() };

  if (idx >= 0) {
    data.ratings[idx] = entry;
  } else {
    data.ratings.push(entry);
  }

  saveData(data);
  res.json({ success: true });
});

// Only count sessions that rated all photos
function getCompleteSessions(ratings) {
  const sessionPhotos = {};
  ratings.forEach(r => {
    if (!sessionPhotos[r.sessionId]) sessionPhotos[r.sessionId] = new Set();
    sessionPhotos[r.sessionId].add(r.photoId);
  });
  const complete = new Set();
  for (const [sid, photos] of Object.entries(sessionPhotos)) {
    if (photos.size >= 15) complete.add(sid);
  }
  return complete;
}

// Get aggregated results
app.get('/api/results', (req, res) => {
  const data = loadData();
  const complete = getCompleteSessions(data.ratings);
  const buckets = {};

  data.ratings.forEach(r => {
    if (!complete.has(r.sessionId)) return;
    if (!buckets[r.photoId]) {
      buckets[r.photoId] = { M: { total: 0, count: 0 }, F: { total: 0, count: 0 } };
    }
    const b = buckets[r.photoId][r.gender];
    if (b) { b.total += r.score; b.count += 1; }
  });

  const results = {};
  for (const [photo, g] of Object.entries(buckets)) {
    results[photo] = {
      M: { avg: g.M.count ? +(g.M.total / g.M.count).toFixed(1) : 0, count: g.M.count },
      F: { avg: g.F.count ? +(g.F.total / g.F.count).toFixed(1) : 0, count: g.F.count }
    };
  }
  res.json(results);
});

// Get participation stats (only complete sessions)
app.get('/api/stats', (req, res) => {
  const data = loadData();
  const complete = getCompleteSessions(data.ratings);
  const sessions = { M: new Set(), F: new Set() };

  data.ratings.forEach(r => {
    if (!complete.has(r.sessionId)) return;
    if (sessions[r.gender]) sessions[r.gender].add(r.sessionId);
  });

  const stats = [];
  if (sessions.M.size > 0) stats.push({ gender: 'M', users: sessions.M.size });
  if (sessions.F.size > 0) stats.push({ gender: 'F', users: sessions.F.size });
  res.json(stats);
});

// Export full data.json for backup
app.get('/api/export', (req, res) => {
  const data = loadData();
  res.setHeader('Content-Disposition', 'attachment; filename="data.json"');
  res.json(data);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 顏值審美大調查 running at http://localhost:${PORT}`);
});
