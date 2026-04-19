// ===== State =====
const state = {
  view: 'welcome',
  gender: null,
  sessionId: localStorage.getItem('fr_session') || generateId(),
  photos: [],
  currentIndex: 0,
  myRatings: {}
};

if (!localStorage.getItem('fr_session')) {
  localStorage.setItem('fr_session', state.sessionId);
}

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ===== API =====
async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ===== View Switching =====
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`${name}-view`).classList.add('active');
  state.view = name;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  // Gender buttons
  document.querySelectorAll('.gender-btn').forEach(btn => {
    btn.addEventListener('click', () => startRating(btn.dataset.gender));
  });

  // View results without rating
  document.getElementById('view-results-btn').addEventListener('click', showResults);

  // Rate again
  document.getElementById('rate-again-btn').addEventListener('click', () => {
    state.sessionId = generateId();
    localStorage.setItem('fr_session', state.sessionId);
    state.myRatings = {};
    state.currentIndex = 0;
    switchView('welcome');
    loadStats();
  });

  // Back home
  document.getElementById('back-home-btn').addEventListener('click', () => {
    switchView('welcome');
    loadStats();
  });

  // Keyboard shortcuts during rating
  document.addEventListener('keydown', e => {
    if (state.view !== 'rating') return;
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 9) submitRating(num);
    if (e.key === '0') submitRating(10);
  });

  // Generate score buttons
  const container = document.getElementById('score-buttons');
  for (let i = 1; i <= 10; i++) {
    const btn = document.createElement('button');
    btn.className = 'score-btn';
    btn.textContent = i;
    btn.addEventListener('click', () => submitRating(i));
    container.appendChild(btn);
  }

  loadStats();
});

// ===== Welcome =====
async function loadStats() {
  try {
    const stats = await api('/stats');
    const el = document.getElementById('stats-preview');
    if (stats.length > 0) {
      const m = stats.find(s => s.gender === 'M');
      const f = stats.find(s => s.gender === 'F');
      el.textContent = `已有 ${m ? m.users : 0} 位男生和 ${f ? f.users : 0} 位女生參與評分`;
    }
  } catch { /* ignore */ }
}

// ===== Rating Flow =====
async function startRating(gender) {
  state.gender = gender;
  state.currentIndex = 0;
  state.myRatings = {};

  try {
    state.photos = await api('/photos');
  } catch {
    alert('無法載入照片，請確認伺服器正在運行');
    return;
  }

  if (state.photos.length === 0) {
    alert('目前沒有照片！請先執行 npm run setup 生成佔位圖片，或在 public/photos/ 中放入照片。');
    return;
  }

  switchView('rating');
  showPhoto(0);
}

function showPhoto(index) {
  const photo = state.photos[index];
  const img = document.getElementById('current-photo');

  // Fade out
  img.style.opacity = '0';
  setTimeout(() => {
    img.src = `/photos/${encodeURIComponent(photo)}`;
    img.onload = () => { img.style.opacity = '1'; };
    img.onerror = () => { img.style.opacity = '1'; };
  }, 150);

  // Progress
  const pct = (index / state.photos.length) * 100;
  document.getElementById('progress-fill').style.width = `${pct}%`;
  document.getElementById('progress-text').textContent = `${index + 1} / ${state.photos.length}`;

  // Reset score highlights
  document.querySelectorAll('.score-btn').forEach(b => b.classList.remove('selected'));
}

let ratingLock = false;

async function submitRating(score) {
  if (ratingLock) return;
  ratingLock = true;

  const photo = state.photos[state.currentIndex];
  state.myRatings[photo] = score;

  // Visual feedback
  const btns = document.querySelectorAll('.score-btn');
  btns[score - 1].classList.add('selected');

  // Send to server (non-blocking)
  api('/rate', {
    method: 'POST',
    body: JSON.stringify({
      photoId: photo,
      gender: state.gender,
      score,
      sessionId: state.sessionId
    })
  }).catch(() => {});

  // Next photo
  setTimeout(() => {
    state.currentIndex++;
    if (state.currentIndex >= state.photos.length) {
      showResults();
    } else {
      showPhoto(state.currentIndex);
    }
    ratingLock = false;
  }, 280);
}

// ===== Results =====
async function showResults() {
  if (state.photos.length === 0) {
    try { state.photos = await api('/photos'); } catch { /* ignore */ }
  }

  let results, stats;
  try {
    [results, stats] = await Promise.all([api('/results'), api('/stats')]);
  } catch {
    alert('無法載入結果');
    return;
  }

  switchView('results');
  renderResults(results, stats);
}

function renderResults(results, stats) {
  const summaryEl = document.getElementById('results-summary');
  const gridEl = document.getElementById('results-grid');

  // Build photo data
  const photoData = state.photos.map(photo => {
    const r = results[photo] || { M: { avg: 0, count: 0 }, F: { avg: 0, count: 0 } };
    return {
      photo,
      maleAvg: r.M.avg || 0,
      femaleAvg: r.F.avg || 0,
      maleCount: r.M.count || 0,
      femaleCount: r.F.count || 0,
      diff: Math.abs((r.M.avg || 0) - (r.F.avg || 0)),
      myScore: state.myRatings[photo] || null
    };
  });

  // ----- Summary -----
  const maleUsers = stats.find(s => s.gender === 'M')?.users || 0;
  const femaleUsers = stats.find(s => s.gender === 'F')?.users || 0;

  const withBoth = photoData.filter(d => d.maleCount > 0 && d.femaleCount > 0);
  const avgDiff = withBoth.length
    ? (withBoth.reduce((s, d) => s + d.diff, 0) / withBoth.length)
    : 0;
  const biggest = [...withBoth].sort((a, b) => b.diff - a.diff)[0];

  let html = `<div class="summary-stats">
    <div class="stat"><span class="stat-num">${maleUsers}</span><span class="stat-label">👨 男生參與</span></div>
    <div class="stat"><span class="stat-num">${femaleUsers}</span><span class="stat-label">👩 女生參與</span></div>
    <div class="stat"><span class="stat-num">${avgDiff.toFixed(1)}</span><span class="stat-label">📏 平均差異</span></div>
  </div>`;

  if (biggest && biggest.diff > 0) {
    const idx = state.photos.indexOf(biggest.photo) + 1;
    const who = biggest.maleAvg > biggest.femaleAvg ? '男生覺得比女生帥' : '女生覺得比男生帥';
    html += `<div class="biggest-gap">💔 差異最大：<strong>照片 #${idx}</strong>（差 ${biggest.diff.toFixed(1)} 分）<br>${who}</div>`;
  }

  if (maleUsers === 0 && femaleUsers === 0) {
    html += `<div class="no-data">目前還沒有人評分，快來當第一個！</div>`;
  }

  summaryEl.innerHTML = html;

  // ----- Grid -----
  let sorted = [...photoData];

  gridEl.innerHTML = `
    <div class="sort-controls">
      <button class="sort-btn active" data-sort="order">依照片排序</button>
      <button class="sort-btn" data-sort="diff">依差異排序</button>
    </div>
    <div class="cards-container">${renderCards(sorted)}</div>
  `;

  gridEl.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      gridEl.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (btn.dataset.sort === 'diff') {
        sorted = [...photoData].sort((a, b) => b.diff - a.diff);
      } else {
        sorted = [...photoData];
      }

      gridEl.querySelector('.cards-container').innerHTML = renderCards(sorted);
    });
  });
}

function renderCards(data) {
  if (data.length === 0) return '<div class="no-data">沒有照片</div>';

  return data.map((d, i) => {
    const num = state.photos.indexOf(d.photo) + 1;
    const mW = (d.maleAvg / 10) * 100;
    const fW = (d.femaleAvg / 10) * 100;
    const delay = Math.min(i * 0.04, 0.8);

    // Tag
    let tag = '';
    if (d.maleCount > 0 && d.femaleCount > 0) {
      if (d.maleAvg >= 7 && d.femaleAvg >= 7) tag = '<span class="tag hot">🔥 公認帥哥</span>';
      else if (d.diff >= 3) tag = '<span class="tag disagree">💔 差異超大</span>';
      else if (d.diff < 1) tag = '<span class="tag agree">🤝 意見一致</span>';
    }

    const myHTML = d.myScore !== null
      ? `<div class="my-score">你的評分：<strong>${d.myScore}</strong></div>`
      : '';

    return `
      <div class="result-card" style="animation-delay:${delay}s">
        <div class="result-photo">
          <img src="/photos/${encodeURIComponent(d.photo)}" alt="照片 ${num}" loading="lazy">
          <span class="photo-num">#${num}</span>
        </div>
        <div class="result-data">
          ${tag}
          <div class="bar-group">
            <div class="bar-row">
              <span class="bar-label">👨 男生</span>
              <div class="bar-track"><div class="bar-fill male" style="width:${mW}%"></div></div>
              <span class="bar-value">${d.maleAvg ? d.maleAvg.toFixed(1) : '—'}</span>
              <span class="bar-count">(${d.maleCount}人)</span>
            </div>
            <div class="bar-row">
              <span class="bar-label">👩 女生</span>
              <div class="bar-track"><div class="bar-fill female" style="width:${fW}%"></div></div>
              <span class="bar-value">${d.femaleAvg ? d.femaleAvg.toFixed(1) : '—'}</span>
              <span class="bar-count">(${d.femaleCount}人)</span>
            </div>
          </div>
          ${myHTML}
        </div>
      </div>`;
  }).join('');
}
