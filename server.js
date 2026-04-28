const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Middleware =====
app.use(compression());
app.use(express.json({ limit: '1kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));

// ===== JSON File Database (In-Memory Cache) =====
const DATA_FILE = path.join(__dirname, 'data.json');

let memoryData = { ratings: [] };
let isDirty = false;

// Load data into memory at startup
try {
  memoryData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  console.log(`Loaded ${memoryData.ratings.length} ratings into memory`);
} catch {
  memoryData = { ratings: [] };
  fs.writeFileSync(DATA_FILE, JSON.stringify(memoryData));
}

// Flush dirty data to disk every 5 seconds
const FLUSH_INTERVAL = 5000;
const flushTimer = setInterval(() => {
  if (isDirty) {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(memoryData));
      isDirty = false;
    } catch (err) {
      console.error('Failed to flush data:', err);
    }
  }
}, FLUSH_INTERVAL);

function flushSync() {
  if (isDirty) {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(memoryData));
      isDirty = false;
      console.log('Data flushed to disk');
    } catch (err) {
      console.error('Failed to flush data on shutdown:', err);
    }
  }
}

// Graceful shutdown
process.on('SIGTERM', () => { flushSync(); process.exit(0); });
process.on('SIGINT', () => { flushSync(); process.exit(0); });

// ===== Cached Photo List =====
const PHOTOS_DIR = path.join(__dirname, 'public', 'photos');
let cachedPhotos = [];
try {
  cachedPhotos = fs.readdirSync(PHOTOS_DIR)
    .filter(f => /\.(jpg|jpeg|png|webp|svg)$/i.test(f))
    .sort();
  console.log(`Cached ${cachedPhotos.length} photos`);
} catch {
  cachedPhotos = [];
}
const photoSet = new Set(cachedPhotos);

// ===== Results & Stats Cache (TTL-based) =====
const CACHE_TTL = 3000; // 3 seconds
let resultsCache = { data: null, ts: 0 };
let statsCache = { data: null, ts: 0 };

function invalidateResultsCache() {
  resultsCache.ts = 0;
  statsCache.ts = 0;
}

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

function computeResults() {
  const complete = getCompleteSessions(memoryData.ratings);
  const buckets = {};
  const sessions = { M: new Set(), F: new Set() };

  memoryData.ratings.forEach(r => {
    if (!complete.has(r.sessionId)) return;
    if (!buckets[r.photoId]) {
      buckets[r.photoId] = { M: { total: 0, count: 0 }, F: { total: 0, count: 0 } };
    }
    const b = buckets[r.photoId][r.gender];
    if (b) { b.total += r.score; b.count += 1; }
    if (sessions[r.gender]) sessions[r.gender].add(r.sessionId);
  });

  const results = {};
  for (const [photo, g] of Object.entries(buckets)) {
    results[photo] = {
      M: { avg: g.M.count ? +(g.M.total / g.M.count).toFixed(1) : 0, count: g.M.count },
      F: { avg: g.F.count ? +(g.F.total / g.F.count).toFixed(1) : 0, count: g.F.count }
    };
  }

  const stats = [];
  if (sessions.M.size > 0) stats.push({ gender: 'M', users: sessions.M.size });
  if (sessions.F.size > 0) stats.push({ gender: 'F', users: sessions.F.size });

  return { results, stats };
}

function isValidSessionId(id) {
  return typeof id === 'string' && /^[a-f0-9-]{30,40}$/i.test(id);
}

// ===== API Routes =====

// Get list of photos (cached, no disk read)
app.get('/api/photos', (req, res) => {
  res.json(cachedPhotos);
});

// Submit a rating (in-memory, no disk read/write per request)
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

  if (!photoSet.has(photoId)) {
    return res.status(400).json({ error: '照片不存在' });
  }

  const idx = memoryData.ratings.findIndex(r => r.photoId === photoId && r.sessionId === sessionId);
  const entry = { photoId, gender, score, sessionId, createdAt: new Date().toISOString() };

  if (idx >= 0) {
    memoryData.ratings[idx] = entry;
  } else {
    memoryData.ratings.push(entry);
  }

  isDirty = true;
  invalidateResultsCache();
  res.json({ success: true });
});

// Get aggregated results (cached)
app.get('/api/results', (req, res) => {
  const now = Date.now();
  if (!resultsCache.data || now - resultsCache.ts > CACHE_TTL) {
    const computed = computeResults();
    resultsCache = { data: computed.results, ts: now };
    statsCache = { data: computed.stats, ts: now };
  }
  res.json(resultsCache.data);
});

// Get participation stats (cached, computed together with results)
app.get('/api/stats', (req, res) => {
  const now = Date.now();
  if (!statsCache.data || now - statsCache.ts > CACHE_TTL) {
    const computed = computeResults();
    resultsCache = { data: computed.results, ts: now };
    statsCache = { data: computed.stats, ts: now };
  }
  res.json(statsCache.data);
});

// Export full data.json for backup (from memory)
app.get('/api/export', (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="data.json"');
  res.json(memoryData);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 顏值審美大調查 running at http://localhost:${PORT}`);
  console.log(`   ${memoryData.ratings.length} ratings in memory | ${cachedPhotos.length} photos cached`);
});
