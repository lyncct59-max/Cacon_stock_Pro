let currentUser = null;
const state = {
  activeTab: 'dashboard',
  trades: [],
  watchlists: [],
  patterns: [],
  market: { distDays: 0, tone: 'Tích cực', note: '' },
  editingTradeId: null,
  editingWatchId: null,
  editingPatternId: null
};

const refs = {
  landing: document.getElementById('landing-screen'),
  loginModal: document.getElementById('login-modal'),
  loginError: document.getElementById('login-error'),
  logoutBtn: document.getElementById('logout-btn'),
  userChip: document.getElementById('user-chip')
};

window.addEventListener('load', () => {
  initLanding();
  bindUI();
  lucide.createIcons();
  computeQualityGuide();
});

auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  if (user) {
    refs.loginModal.classList.add('hidden');
    refs.userChip.textContent = user.email;
    refs.logoutBtn.classList.remove('hidden');
    await Promise.all([loadTrades(), loadWatchlists(), loadPatterns(), loadMarket()]);
    renderAll();
  } else {
    refs.userChip.textContent = 'Chưa đăng nhập';
    refs.logoutBtn.classList.add('hidden');
    state.trades = []; state.watchlists = []; state.patterns = []; state.market = { distDays: 0, tone: 'Tích cực', note: '' };
    renderAll();
  }
});

function bindUI() {
  document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  document.getElementById('open-login-btn').onclick = () => refs.loginModal.classList.remove('hidden');
  document.getElementById('skip-intro-btn').onclick = () => refs.landing.classList.add('hidden');
  document.getElementById('close-login-btn').onclick = () => refs.loginModal.classList.add('hidden');
  document.getElementById('login-btn').onclick = handleLogin;
  refs.logoutBtn.onclick = () => auth.signOut();
  document.getElementById('toggle-login-pass').onclick = () => togglePassword('login-pass');
  document.getElementById('new-trade-btn').onclick = () => openTradeModal();
  document.getElementById('new-watchlist-btn').onclick = () => openWatchModal();
  document.getElementById('new-pattern-btn').onclick = () => openPatternModal();
  document.getElementById('save-trade-btn').onclick = saveTrade;
  document.getElementById('save-watchlist-btn').onclick = saveWatchlist;
  document.getElementById('save-pattern-btn').onclick = savePattern;
  document.getElementById('save-market-btn').onclick = saveMarket;
  document.querySelectorAll('[data-close]').forEach(btn => btn.onclick = () => document.getElementById(btn.dataset.close).classList.add('hidden'));

  ['trade-setup','trade-checklist','trade-market-pulse','trade-entry','trade-stop','trade-risk','trade-emotion','trade-mistake','trade-note'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', renderTradeQualityBreakdown);
    el.addEventListener('change', renderTradeQualityBreakdown);
  });
  document.getElementById('trade-result').addEventListener('change', syncTradeStatusWithResult);
  document.getElementById('trade-status').addEventListener('change', syncTradeResultWithStatus);

  ['journal-search','journal-status-filter','journal-result-filter'].forEach(id => document.getElementById(id).addEventListener('input', renderJournalTable));
  ['quality-checklist-count','quality-market','quality-risk','quality-execution','quality-discipline'].forEach(id => document.getElementById(id).addEventListener('input', computeQualityGuide));
}

function initLanding() {
  const canvas = document.getElementById('landing-canvas');
  const ctx = canvas.getContext('2d');
  let w, h, particles = [], mouse = { x: null, y: null, active: false };
  const colors = ['#34d399', '#60a5fa', '#f59e0b', '#ef4444', '#22c55e'];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    particles = Array.from({ length: Math.min(95, Math.max(55, Math.floor(w / 24))) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - .5) * .7,
      vy: (Math.random() - .5) * .7,
      r: Math.random() * 2.4 + 1.6,
      c: colors[Math.floor(Math.random() * colors.length)]
    }));
  }

  function tick() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      if (mouse.active) {
        const dx = mouse.x - p.x, dy = mouse.y - p.y, dist = Math.hypot(dx, dy);
        if (dist < 140) {
          p.x -= dx * 0.004;
          p.y -= dy * 0.004;
        }
      }
      ctx.beginPath(); ctx.fillStyle = p.c; ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < 120) {
          ctx.strokeStyle = `rgba(148,163,184,${(1 - dist / 120) * 0.18})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      if (mouse.active) {
        const p = particles[i];
        const dist = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (dist < 150) {
          ctx.strokeStyle = `rgba(255,255,255,${(1 - dist / 150) * 0.22})`;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; });
  window.addEventListener('mouseleave', () => mouse.active = false);
  resize(); tick();
}

function togglePassword(id) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  refs.loginError.classList.add('hidden');
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    refs.landing.classList.add('hidden');
  } catch (err) {
    refs.loginError.textContent = mapFirebaseError(err.code || err.message);
    refs.loginError.classList.remove('hidden');
  }
}

function mapFirebaseError(code) {
  const m = {
    'auth/invalid-login-credentials': 'Sai email hoặc mật khẩu.',
    'auth/user-not-found': 'Không tìm thấy tài khoản.',
    'auth/wrong-password': 'Mật khẩu không đúng.',
    'auth/invalid-email': 'Email không hợp lệ.'
  };
  return m[code] || code || 'Đăng nhập thất bại.';
}

function requireAuth() {
  if (!currentUser) {
    refs.loginModal.classList.remove('hidden');
    throw new Error('Bạn cần đăng nhập trước.');
  }
}

function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById('tab-' + tabId).classList.remove('hidden');
  document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
}

async function loadTrades() {
  requireAuth();
  const snap = await db.collection('journal').where('userId', '==', currentUser.uid).orderBy('date', 'desc').get();
  state.trades = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
async function loadWatchlists() {
  requireAuth();
  const snap = await db.collection('watchlists').where('userId', '==', currentUser.uid).orderBy('createdAt', 'desc').get();
  state.watchlists = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
async function loadPatterns() {
  requireAuth();
  const snap = await db.collection('patterns').where('userId', '==', currentUser.uid).orderBy('createdAt', 'desc').get();
  state.patterns = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
async function loadMarket() {
  requireAuth();
  const doc = await db.collection('settings').doc(currentUser.uid + '_market').get();
  if (doc.exists) state.market = doc.data();
  document.getElementById('market-dist-days').value = state.market.distDays || 0;
  document.getElementById('market-tone').value = state.market.tone || 'Tích cực';
  document.getElementById('market-note').value = state.market.note || '';
}

function renderAll() {
  renderDashboard();
  renderJournalTable();
  renderWatchlists();
  renderPatterns();
  computeQualityGuide();
  lucide.createIcons();
}

function renderDashboard() {
  const closedTrades = state.trades.filter(t => t.status === 'closed');
  const pnl = closedTrades.reduce((s, t) => s + Number(t.pnl || 0), 0);
  const avgQ = state.trades.length ? Math.round(state.trades.reduce((s, t) => s + Number(t.tradeQuality || 0), 0) / state.trades.length) : 0;
  document.getElementById('kpi-trades').textContent = state.trades.length;
  document.getElementById('kpi-open').textContent = state.trades.filter(t => t.status === 'open').length;
  document.getElementById('kpi-pnl').textContent = formatCurrency(pnl);
  document.getElementById('kpi-quality').textContent = avgQ;
  document.getElementById('dashboard-trade-list').innerHTML = state.trades.slice(0, 5).map(t => `
    <div class="doc-line">
      <div>
        <div class="font-bold text-white">${escapeHtml(t.ticker || '-')} <span class="text-slate-400 font-medium">· ${escapeHtml(t.setup || '-')}</span></div>
        <div class="text-xs text-slate-400 mt-1">${escapeHtml(t.date || '')} · ${renderResultLabel(t.result)}</div>
      </div>
      <div class="text-right">
        <div class="font-black ${Number(t.pnl) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${formatCurrency(Number(t.pnl || 0))}</div>
        <div class="text-xs text-slate-400">TQ ${t.tradeQuality || 0}</div>
      </div>
    </div>
  `).join('') || `<div class="text-slate-400 text-sm">Chưa có dữ liệu giao dịch.</div>`;
}

function renderJournalTable() {
  const q = document.getElementById('journal-search').value.trim().toLowerCase();
  const statusFilter = document.getElementById('journal-status-filter').value;
  const resultFilter = document.getElementById('journal-result-filter').value;
  const rows = state.trades.filter(t => {
    const matchesQ = !q || [t.ticker, t.setup, t.note].some(v => (v || '').toLowerCase().includes(q));
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesResult = resultFilter === 'all' || t.result === resultFilter;
    return matchesQ && matchesStatus && matchesResult;
  });
  document.getElementById('journal-body').innerHTML = rows.map(t => `
    <tr>
      <td class="p-4">${escapeHtml(t.date || '')}</td>
      <td class="p-4 font-black text-white">${escapeHtml(t.ticker || '')}</td>
      <td class="p-4">${escapeHtml(t.setup || '')}</td>
      <td class="p-4">${renderStatusLabel(t.status)}</td>
      <td class="p-4">${renderResultLabel(t.result)}</td>
      <td class="p-4 text-right font-black ${Number(t.pnl) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${formatCurrency(Number(t.pnl || 0))}</td>
      <td class="p-4 text-center"><span class="table-chip ${rankColor(t.tradeQuality || 0)}">${t.tradeQuality || 0}</span></td>
      <td class="p-4">
        <div class="flex justify-end gap-2">
          <button class="action-mini" onclick="openTradeModal('${t.id}')"><i data-lucide="pencil"></i></button>
          <button class="action-mini" onclick="removeTrade('${t.id}')"><i data-lucide="trash-2"></i></button>
        </div>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="8" class="p-6 text-center text-slate-400">Chưa có lệnh nào.</td></tr>`;
  lucide.createIcons();
}

function renderWatchlists() {
  document.getElementById('watchlist-grid').innerHTML = state.watchlists.map(w => `
    <div class="watch-card">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-xl font-black text-white">${escapeHtml(w.symbol || '')}</div>
          <div class="text-xs text-slate-400 mt-1">${escapeHtml(w.group || '')} · ${escapeHtml(w.setup || '')}</div>
        </div>
        <div class="flex gap-2">
          <button class="action-mini" onclick="openWatchModal('${w.id}')"><i data-lucide="pencil"></i></button>
          <button class="action-mini" onclick="removeWatchlist('${w.id}')"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
      <div class="mt-4 text-sm text-slate-300">Buy zone: <b>${escapeHtml(w.zone || '-')}</b></div>
      <div class="mt-2 text-sm text-slate-400">${escapeHtml(w.plan || '')}</div>
    </div>
  `).join('') || `<div class="text-slate-400 text-sm">Chưa có mã theo dõi.</div>`;
  lucide.createIcons();
}

function renderPatterns() {
  document.getElementById('pattern-grid').innerHTML = state.patterns.map(p => `
    <div class="pattern-card">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-lg font-black text-white">${escapeHtml(p.name || '')}</div>
          <div class="text-xs text-slate-400 mt-1">${escapeHtml(p.strategy || '')}</div>
        </div>
        <div class="flex gap-2">
          <button class="action-mini" onclick="openPatternModal('${p.id}')"><i data-lucide="pencil"></i></button>
          <button class="action-mini" onclick="removePattern('${p.id}')"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
      <div class="mt-3 text-sm text-slate-300">${escapeHtml(p.description || '')}</div>
      <div class="mt-4 text-xs text-slate-400">Nền: ${(p.conditions || []).length} điều kiện · Trigger: ${(p.triggers || []).length} điều kiện</div>
    </div>
  `).join('') || `<div class="text-slate-400 text-sm">Chưa có mẫu hình.</div>`;
  lucide.createIcons();
}

function openTradeModal(id = null) {
  state.editingTradeId = id;
  document.getElementById('trade-modal-title').textContent = id ? 'Chỉnh sửa lệnh' : 'Tạo lệnh mới';
  const t = state.trades.find(x => x.id === id) || { date: new Date().toISOString().slice(0,10), status:'open', result:'open', marketPulse:'Tích cực', emotion:'Tự tin', mistake:'Không', riskPct:1 };
  setValue('trade-ticker', t.ticker || '');
  setValue('trade-date', t.date || new Date().toISOString().slice(0,10));
  setValue('trade-setup', t.setup || '');
  setValue('trade-entry', t.entry || '');
  setValue('trade-stop', t.stop || '');
  setValue('trade-exit', t.exit || '');
  setValue('trade-qty', t.qty || '');
  setValue('trade-status', t.status || 'open');
  setValue('trade-result', t.result || 'open');
  setValue('trade-market-pulse', t.marketPulse || 'Tích cực');
  setValue('trade-emotion', t.emotion || 'Tự tin');
  setValue('trade-mistake', t.mistake || 'Không');
  setValue('trade-risk', t.riskPct || 1);
  setValue('trade-checklist', (t.checklist || []).join('\n'));
  setValue('trade-note', t.note || '');
  renderTradeQualityBreakdown();
  document.getElementById('trade-modal').classList.remove('hidden');
}

function openWatchModal(id = null) {
  state.editingWatchId = id;
  document.getElementById('watchlist-modal-title').textContent = id ? 'Chỉnh sửa mã theo dõi' : 'Thêm mã theo dõi';
  const w = state.watchlists.find(x => x.id === id) || { group: 'near' };
  setValue('watch-symbol', w.symbol || '');
  setValue('watch-group', w.group || 'near');
  setValue('watch-setup', w.setup || '');
  setValue('watch-zone', w.zone || '');
  setValue('watch-plan', w.plan || '');
  document.getElementById('watchlist-modal').classList.remove('hidden');
}

function openPatternModal(id = null) {
  state.editingPatternId = id;
  document.getElementById('pattern-modal-title').textContent = id ? 'Chỉnh sửa mẫu hình' : 'Thêm mẫu hình';
  const p = state.patterns.find(x => x.id === id) || {};
  setValue('pattern-name', p.name || '');
  setValue('pattern-strategy', p.strategy || '');
  setValue('pattern-description', p.description || '');
  setValue('pattern-conditions', (p.conditions || []).join('\n'));
  setValue('pattern-triggers', (p.triggers || []).join('\n'));
  document.getElementById('pattern-modal').classList.remove('hidden');
}

async function saveTrade() {
  try {
    requireAuth();
    syncTradeStatusWithResult();
    const q = calculateTradeQualityFromForm();
    const payload = {
      userId: currentUser.uid,
      date: getValue('trade-date'),
      ticker: getValue('trade-ticker').toUpperCase(),
      setup: getValue('trade-setup'),
      entry: num('trade-entry'),
      stop: num('trade-stop'),
      exit: nullableNum('trade-exit'),
      qty: num('trade-qty'),
      status: getValue('trade-status'),
      result: getValue('trade-result'),
      marketPulse: getValue('trade-market-pulse'),
      emotion: getValue('trade-emotion'),
      mistake: getValue('trade-mistake'),
      riskPct: num('trade-risk'),
      checklist: getValue('trade-checklist').split('\n').map(s => s.trim()).filter(Boolean),
      note: getValue('trade-note'),
      ...q,
      pnl: calcPnl(num('trade-entry'), nullableNum('trade-exit'), num('trade-qty'), getValue('trade-status')),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (state.editingTradeId) {
      await db.collection('journal').doc(state.editingTradeId).set(payload, { merge: true });
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('journal').add(payload);
    }
    await loadTrades();
    renderAll();
    document.getElementById('trade-modal').classList.add('hidden');
  } catch (e) {
    alert(e.message || 'Không lưu được lệnh.');
  }
}

async function saveWatchlist() {
  try {
    requireAuth();
    const payload = {
      userId: currentUser.uid,
      symbol: getValue('watch-symbol').toUpperCase(),
      group: getValue('watch-group'),
      setup: getValue('watch-setup'),
      zone: getValue('watch-zone'),
      plan: getValue('watch-plan'),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (state.editingWatchId) await db.collection('watchlists').doc(state.editingWatchId).set(payload, { merge: true });
    else { payload.createdAt = firebase.firestore.FieldValue.serverTimestamp(); await db.collection('watchlists').add(payload); }
    await loadWatchlists(); renderWatchlists(); document.getElementById('watchlist-modal').classList.add('hidden');
  } catch (e) { alert(e.message || 'Không lưu được watchlist.'); }
}

async function savePattern() {
  try {
    requireAuth();
    const payload = {
      userId: currentUser.uid,
      name: getValue('pattern-name'),
      strategy: getValue('pattern-strategy'),
      description: getValue('pattern-description'),
      conditions: getValue('pattern-conditions').split('\n').map(s => s.trim()).filter(Boolean),
      triggers: getValue('pattern-triggers').split('\n').map(s => s.trim()).filter(Boolean),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (state.editingPatternId) await db.collection('patterns').doc(state.editingPatternId).set(payload, { merge: true });
    else { payload.createdAt = firebase.firestore.FieldValue.serverTimestamp(); await db.collection('patterns').add(payload); }
    await loadPatterns(); renderPatterns(); document.getElementById('pattern-modal').classList.add('hidden');
  } catch (e) { alert(e.message || 'Không lưu được mẫu hình.'); }
}

async function saveMarket() {
  try {
    requireAuth();
    state.market = { distDays: num('market-dist-days'), tone: getValue('market-tone'), note: getValue('market-note'), userId: currentUser.uid, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    await db.collection('settings').doc(currentUser.uid + '_market').set(state.market, { merge: true });
    alert('Đã lưu dữ liệu thị trường.');
  } catch (e) { alert(e.message || 'Không lưu được dữ liệu thị trường.'); }
}

async function removeTrade(id) { if (confirm('Xóa lệnh này?')) { await db.collection('journal').doc(id).delete(); await loadTrades(); renderAll(); } }
async function removeWatchlist(id) { if (confirm('Xóa mã này?')) { await db.collection('watchlists').doc(id).delete(); await loadWatchlists(); renderWatchlists(); } }
async function removePattern(id) { if (confirm('Xóa mẫu hình này?')) { await db.collection('patterns').doc(id).delete(); await loadPatterns(); renderPatterns(); } }

function calculateTradeQualityFromForm() {
  const setup = getValue('trade-setup');
  const checklist = getValue('trade-checklist').split('\n').map(s => s.trim()).filter(Boolean);
  const marketPulse = getValue('trade-market-pulse').toLowerCase();
  const entry = num('trade-entry');
  const stop = num('trade-stop');
  const riskPct = num('trade-risk');
  const emotion = getValue('trade-emotion');
  const mistake = getValue('trade-mistake');
  const note = getValue('trade-note');

  let tqSetup = 0, tqMarket = 0, tqRisk = 0, tqExecution = 0, tqDiscipline = 0;
  if (setup) tqSetup += 10;
  if (checklist.length >= 2) tqSetup += 10;
  if (checklist.length >= 4) tqSetup += 10;
  if (marketPulse.includes('tích cực')) tqMarket = 18; else if (marketPulse.includes('trung tính')) tqMarket = 12; else tqMarket = 5;
  if (entry > 0 && stop > 0 && stop < entry) tqRisk += 10;
  if (riskPct > 0 && riskPct <= 1.25) tqRisk += 10;
  tqExecution = 10;
  if (note.length >= 20) tqExecution += 5;
  if (mistake === 'Không') tqExecution += 5;
  if (mistake === 'FOMO') tqExecution -= 4;
  tqExecution = clamp(tqExecution, 0, 20);
  if (mistake === 'Không') tqDiscipline = 10;
  else if (mistake === 'Bán non') tqDiscipline = 6;
  else if (mistake === 'FOMO') tqDiscipline = 4;
  else if (mistake === 'Gồng lỗ') tqDiscipline = 2;
  else tqDiscipline = 5;
  if (emotion === 'Sợ hãi' || emotion === 'Tham lam') tqDiscipline = Math.max(0, tqDiscipline - 1);
  const total = tqSetup + tqMarket + tqRisk + tqExecution + tqDiscipline;
  return { tqSetup, tqMarket, tqRisk, tqExecution, tqDiscipline, tradeQuality: total, qualityRank: rankLabel(total) };
}

function renderTradeQualityBreakdown() {
  const q = calculateTradeQualityFromForm();
  document.getElementById('trade-quality-breakdown').innerHTML = [
    ['Setup', q.tqSetup, 30],
    ['Market', q.tqMarket, 20],
    ['Risk', q.tqRisk, 20],
    ['Execution', q.tqExecution, 20],
    ['Discipline', q.tqDiscipline, 10],
  ].map(([label, score, max]) => `<div class="break-row"><span>${label}</span><b>${score}/${max}</b></div>`).join('');
  document.getElementById('trade-quality-total').textContent = q.tradeQuality;
  document.getElementById('trade-quality-rank').textContent = q.qualityRank;
  document.getElementById('trade-quality-rank').className = `table-chip ${rankColor(q.tradeQuality)}`;
}

function computeQualityGuide() {
  const checklist = Math.max(0, Math.min(5, Number(document.getElementById('quality-checklist-count')?.value || 0)));
  const market = document.getElementById('quality-market')?.value || 'positive';
  const risk = document.getElementById('quality-risk')?.value || 'good';
  const execution = document.getElementById('quality-execution')?.value || 'great';
  const discipline = document.getElementById('quality-discipline')?.value || 'great';
  const setupScore = checklist >= 4 ? 28 : checklist >= 3 ? 22 : checklist >= 2 ? 16 : 8;
  const marketScore = market === 'positive' ? 18 : market === 'neutral' ? 12 : 5;
  const riskScore = risk === 'good' ? 18 : risk === 'ok' ? 12 : 5;
  const executionScore = execution === 'great' ? 18 : execution === 'ok' ? 12 : 5;
  const disciplineScore = discipline === 'great' ? 9 : discipline === 'ok' ? 6 : 2;
  const total = setupScore + marketScore + riskScore + executionScore + disciplineScore;
  const box = document.getElementById('quality-result-box');
  if (!box) return;
  box.innerHTML = `
    <div class="space-y-2 text-sm">
      <div class="break-row"><span>Setup</span><b>${setupScore}/30</b></div>
      <div class="break-row"><span>Market</span><b>${marketScore}/20</b></div>
      <div class="break-row"><span>Risk</span><b>${riskScore}/20</b></div>
      <div class="break-row"><span>Execution</span><b>${executionScore}/20</b></div>
      <div class="break-row"><span>Discipline</span><b>${disciplineScore}/10</b></div>
      <div class="mt-3 flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
        <div><div class="text-xs uppercase text-slate-400">Tổng điểm</div><div class="text-3xl font-black">${total}</div></div>
        <div class="table-chip ${rankColor(total)}">${rankLabel(total)}</div>
      </div>
    </div>
  `;
}

function syncTradeStatusWithResult() {
  const result = getValue('trade-result');
  if (result === 'win' || result === 'loss') setValue('trade-status', 'closed');
  if (result === 'open') { setValue('trade-status', 'open'); setValue('trade-exit', ''); }
}
function syncTradeResultWithStatus() {
  const status = getValue('trade-status');
  if (status === 'open') { setValue('trade-result', 'open'); setValue('trade-exit', ''); }
}

function renderStatusLabel(v) { return `<span class="table-chip ${v === 'open' ? 'amber' : 'gray'}">${v === 'open' ? 'Đang mở' : 'Đã đóng'}</span>`; }
function renderResultLabel(v) { if (v === 'win') return '<span class="table-chip green">Lãi</span>'; if (v === 'loss') return '<span class="table-chip rose">Lỗ</span>'; return '<span class="table-chip amber">Đang mở</span>'; }
function rankLabel(score) { if (score >= 90) return 'Elite'; if (score >= 80) return 'A'; if (score >= 70) return 'B'; if (score >= 60) return 'C'; return 'D'; }
function rankColor(score) { if (score >= 90) return 'green'; if (score >= 80) return 'sky'; if (score >= 70) return 'amber'; if (score >= 60) return 'gray'; return 'rose'; }
function calcPnl(entry, exit, qty, status) { if (status !== 'closed' || !exit) return 0; return Math.round((exit - entry) * qty); }
function formatCurrency(v) { return `${Number(v || 0).toLocaleString('vi-VN')}đ`; }
function escapeHtml(s) { return String(s || '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
function setValue(id, val) { document.getElementById(id).value = val ?? ''; }
function getValue(id) { return document.getElementById(id).value.trim(); }
function num(id) { return Number(document.getElementById(id).value || 0); }
function nullableNum(id) { const v = document.getElementById(id).value; return v === '' ? null : Number(v); }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

window.openTradeModal = openTradeModal;
window.openWatchModal = openWatchModal;
window.openPatternModal = openPatternModal;
window.removeTrade = removeTrade;
window.removeWatchlist = removeWatchlist;
window.removePattern = removePattern;
