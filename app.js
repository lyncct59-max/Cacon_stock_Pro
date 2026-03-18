const App = {
  state: {
    user: null,
    trades: [],
    watchlists: [],
    patterns: [],
    market: { distDays: 0, sentiment: '', leaders: '', note: '' },
    selectedTradeId: null,
    editingTradeId: null,
    editingWatchlistId: null,
    editingPatternId: null,
    loginVisible: false
  },

  init() {
    this.bindUI();
    this.initLanding();
    this.watchAuth();
    this.renderAll();
    lucide.createIcons();
  },

  bindUI() {
    document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => this.switchTab(btn.dataset.tab)));
    document.querySelectorAll('[data-tab-jump]').forEach(btn => btn.addEventListener('click', () => this.switchTab(btn.dataset.tabJump)));
    document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => this.hideModal(btn.dataset.close)));

    document.getElementById('landing-login').addEventListener('click', () => { this.hideLanding(); this.openLogin(); });
    document.getElementById('landing-demo').addEventListener('click', () => { this.hideLanding(); this.closeLogin(); this.setSyncStatus('Đang xem giao diện demo'); });
    document.getElementById('btn-open-login').addEventListener('click', () => this.openLogin());
    document.getElementById('close-login').addEventListener('click', () => this.closeLogin());
    document.getElementById('btn-login').addEventListener('click', () => this.handleLogin());
    document.getElementById('btn-logout').addEventListener('click', () => auth.signOut());
    document.getElementById('toggle-password').addEventListener('click', () => this.togglePassword());

    document.getElementById('btn-add-trade').addEventListener('click', () => this.openTradeModal());
    document.getElementById('btn-save-trade').addEventListener('click', () => this.saveTrade());
    document.getElementById('btn-add-watchlist').addEventListener('click', () => this.openWatchlistModal());
    document.getElementById('btn-add-watchlist-2').addEventListener('click', () => this.openWatchlistModal());
    document.getElementById('btn-save-watchlist').addEventListener('click', () => this.saveWatchlist());
    document.getElementById('btn-add-pattern').addEventListener('click', () => this.openPatternModal());
    document.getElementById('btn-save-pattern').addEventListener('click', () => this.savePattern());
    document.getElementById('btn-save-market').addEventListener('click', () => this.saveMarket());

    ['trade-setup','trade-checklist','trade-market-pulse','trade-entry','trade-stop','trade-risk-pct','trade-mistake','trade-note','trade-result'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.refreshTradeQualityUI());
      document.getElementById(id).addEventListener('change', () => this.refreshTradeQualityUI());
    });
    document.getElementById('trade-result').addEventListener('change', () => this.syncCloseState());

    ['filter-search','filter-result','filter-close'].forEach(id => document.getElementById(id).addEventListener('input', () => this.renderJournal()));
  },

  initLanding() {
    const canvas = document.getElementById('landing-canvas');
    const ctx = canvas.getContext('2d');
    const colors = ['#34d399', '#60a5fa', '#f59e0b', '#ef4444', '#22c55e'];
    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, active: false };
    const particles = Array.from({ length: 75 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * .8,
      vy: (Math.random() - 0.5) * .8,
      r: 1.5 + Math.random() * 2.8,
      c: colors[Math.floor(Math.random() * colors.length)]
    }));
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; });
    canvas.addEventListener('mouseleave', () => { mouse.active = false; });
    const frame = () => {
      if (document.getElementById('landing-screen').classList.contains('hidden')) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        if (mouse.active) {
          const dx = mouse.x - p.x, dy = mouse.y - p.y, d = Math.hypot(dx, dy);
          if (d < 120) { p.x -= dx * 0.006; p.y -= dy * 0.006; }
        }
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j], d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < 130) {
            ctx.strokeStyle = `rgba(255,255,255,${0.12 - d / 1450})`;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        if (mouse.active) {
          const dm = Math.hypot(mouse.x - p.x, mouse.y - p.y);
          if (dm < 155) {
            ctx.strokeStyle = 'rgba(255,255,255,.10)';
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
          }
        }
        ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      });
      requestAnimationFrame(frame);
    };
    frame();
  },

  hideLanding() { document.getElementById('landing-screen').classList.add('hidden'); },
  openLogin() { document.getElementById('login-modal').classList.remove('hidden'); this.state.loginVisible = true; },
  closeLogin() { document.getElementById('login-modal').classList.add('hidden'); this.state.loginVisible = false; },
  hideModal(id) { document.getElementById(id).classList.add('hidden'); },
  openModal(id) { document.getElementById(id).classList.remove('hidden'); },
  togglePassword() {
    const el = document.getElementById('login-pass');
    el.type = el.type === 'password' ? 'text' : 'password';
  },

  watchAuth() {
    auth.onAuthStateChanged(async user => {
      this.state.user = user || null;
      if (!user) {
        document.getElementById('btn-logout').classList.add('hidden');
        document.getElementById('btn-open-login').classList.remove('hidden');
        document.getElementById('user-name').textContent = 'Guest demo';
        this.setSyncStatus('Chưa đăng nhập');
        this.renderAll();
        return;
      }
      this.closeLogin();
      document.getElementById('btn-logout').classList.remove('hidden');
      document.getElementById('btn-open-login').classList.add('hidden');
      document.getElementById('user-name').textContent = user.email;
      this.setSyncStatus('Đang đồng bộ Firebase...');
      this.subscribeCollections();
    });
  },

  async handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-pass').value;
    const msg = document.getElementById('login-message');
    msg.textContent = '';
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      msg.textContent = error.message || 'Không đăng nhập được.';
    }
  },

  subscribeCollections() {
    if (!this.state.user) return;
    const uid = this.state.user.uid;
    db.collection('journal').where('userId', '==', uid).orderBy('date', 'desc').onSnapshot(snap => {
      this.state.trades = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.renderAll();
      this.setSyncStatus('Đã đồng bộ Firebase');
    });
    db.collection('watchlists').where('userId', '==', uid).orderBy('createdAt', 'desc').onSnapshot(snap => {
      this.state.watchlists = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.renderAll();
    });
    db.collection('patterns').where('userId', '==', uid).orderBy('createdAt', 'desc').onSnapshot(snap => {
      this.state.patterns = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.renderAll();
    });
    db.collection('settings').doc(uid + '_market').onSnapshot(doc => {
      this.state.market = doc.exists ? doc.data() : { distDays: 0, sentiment: '', leaders: '', note: '' };
      this.renderMarket();
    });
  },

  switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('tab-' + tab).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  },

  setSyncStatus(text) { document.getElementById('sync-status').textContent = text; },
  fmtMoney(v) { return `${Math.round(v || 0).toLocaleString('vi-VN')}đ`; },

  tradePnl(trade) {
    if (!trade.exit || !trade.entry || !trade.qty) return 0;
    return (Number(trade.exit) - Number(trade.entry)) * Number(trade.qty);
  },

  calculateTradeQuality(values) {
    const checklist = (values.checklist || '').split('\n').map(s => s.trim()).filter(Boolean);
    let tqSetup = 0, tqMarket = 0, tqRisk = 0, tqExecution = 0, tqDiscipline = 0;
    if (values.setup) tqSetup += 10;
    if (checklist.length >= 2) tqSetup += 10;
    if (checklist.length >= 4) tqSetup += 10;
    tqSetup = Math.min(30, tqSetup);

    const market = String(values.marketPulse || '').toLowerCase();
    if (market.includes('tích cực')) tqMarket = 18;
    else if (market.includes('trung tính') || market.includes('bình thường')) tqMarket = 12;
    else tqMarket = 6;

    const entry = Number(values.entry || 0);
    const stop = Number(values.stop || 0);
    const riskPct = Number(values.riskPct || 0);
    if (entry > 0 && stop > 0 && stop < entry) tqRisk += 10;
    if (riskPct > 0 && riskPct <= 1.25) tqRisk += 10;
    tqRisk = Math.min(20, tqRisk);

    tqExecution = 10;
    if (String(values.note || '').trim().length >= 20) tqExecution += 5;
    if (values.mistake === 'Không') tqExecution += 5;
    if (values.mistake === 'FOMO') tqExecution -= 4;
    tqExecution = Math.max(0, Math.min(20, tqExecution));

    if (values.mistake === 'Không') tqDiscipline = 10;
    else if (values.mistake === 'Bán non') tqDiscipline = 6;
    else if (values.mistake === 'FOMO') tqDiscipline = 4;
    else if (values.mistake === 'Gồng lỗ') tqDiscipline = 2;
    else tqDiscipline = 5;

    const total = tqSetup + tqMarket + tqRisk + tqExecution + tqDiscipline;
    const rank = total >= 90 ? 'Elite' : total >= 80 ? 'A' : total >= 70 ? 'B' : total >= 60 ? 'C' : 'D';
    return { tqSetup, tqMarket, tqRisk, tqExecution, tqDiscipline, total, rank };
  },

  currentTradeFormValues() {
    return {
      setup: document.getElementById('trade-setup').value.trim(),
      checklist: document.getElementById('trade-checklist').value,
      marketPulse: document.getElementById('trade-market-pulse').value.trim(),
      entry: document.getElementById('trade-entry').value,
      stop: document.getElementById('trade-stop').value,
      riskPct: document.getElementById('trade-risk-pct').value,
      mistake: document.getElementById('trade-mistake').value,
      note: document.getElementById('trade-note').value
    };
  },

  refreshTradeQualityUI() {
    const q = this.calculateTradeQuality(this.currentTradeFormValues());
    document.getElementById('tq-setup').textContent = `${q.tqSetup}/30`;
    document.getElementById('tq-market').textContent = `${q.tqMarket}/20`;
    document.getElementById('tq-risk').textContent = `${q.tqRisk}/20`;
    document.getElementById('tq-execution').textContent = `${q.tqExecution}/20`;
    document.getElementById('tq-discipline').textContent = `${q.tqDiscipline}/10`;
    document.getElementById('tq-total').textContent = `${q.total}/100`;
    document.getElementById('tq-rank').textContent = q.rank;
    return q;
  },

  syncCloseState() {
    const result = document.getElementById('trade-result').value;
    if (result === 'open') {
      document.getElementById('trade-exit').value = '';
    }
  },

  openTradeModal(trade = null) {
    this.state.editingTradeId = trade?.id || null;
    document.getElementById('trade-modal-title').textContent = trade ? 'Chỉnh sửa lệnh' : 'Thêm lệnh';
    document.getElementById('trade-date').value = trade?.date || new Date().toISOString().slice(0, 10);
    document.getElementById('trade-ticker').value = trade?.ticker || '';
    document.getElementById('trade-strategy').value = trade?.strategy || '';
    document.getElementById('trade-setup').value = trade?.setup || '';
    document.getElementById('trade-entry').value = trade?.entry || '';
    document.getElementById('trade-stop').value = trade?.stop || '';
    document.getElementById('trade-exit').value = trade?.exit || '';
    document.getElementById('trade-qty').value = trade?.qty || '';
    document.getElementById('trade-market-pulse').value = trade?.marketPulse || '';
    document.getElementById('trade-risk-pct').value = trade?.riskPct || 1;
    document.getElementById('trade-result').value = trade?.result || 'open';
    document.getElementById('trade-mistake').value = trade?.mistake || 'Không';
    document.getElementById('trade-checklist').value = Array.isArray(trade?.checklist) ? trade.checklist.join('\n') : '';
    document.getElementById('trade-note').value = trade?.note || '';
    this.refreshTradeQualityUI();
    this.openModal('trade-modal');
  },

  async saveTrade() {
    if (!this.state.user) return alert('Bạn cần đăng nhập để lưu dữ liệu lên Firebase.');
    const q = this.refreshTradeQualityUI();
    const payload = {
      userId: this.state.user.uid,
      date: document.getElementById('trade-date').value,
      ticker: document.getElementById('trade-ticker').value.trim().toUpperCase(),
      strategy: document.getElementById('trade-strategy').value.trim(),
      setup: document.getElementById('trade-setup').value.trim(),
      entry: Number(document.getElementById('trade-entry').value || 0),
      stop: Number(document.getElementById('trade-stop').value || 0),
      exit: document.getElementById('trade-exit').value ? Number(document.getElementById('trade-exit').value) : null,
      qty: Number(document.getElementById('trade-qty').value || 0),
      marketPulse: document.getElementById('trade-market-pulse').value.trim(),
      riskPct: Number(document.getElementById('trade-risk-pct').value || 0),
      result: document.getElementById('trade-result').value,
      status: document.getElementById('trade-result').value === 'open' ? 'open' : 'closed',
      mistake: document.getElementById('trade-mistake').value,
      checklist: document.getElementById('trade-checklist').value.split('\n').map(s => s.trim()).filter(Boolean),
      note: document.getElementById('trade-note').value.trim(),
      pnl: 0,
      score: q.total,
      qualityRank: q.rank,
      tqSetup: q.tqSetup,
      tqMarket: q.tqMarket,
      tqRisk: q.tqRisk,
      tqExecution: q.tqExecution,
      tqDiscipline: q.tqDiscipline,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    payload.pnl = this.tradePnl(payload);
    if (this.state.editingTradeId) {
      await db.collection('journal').doc(this.state.editingTradeId).set(payload, { merge: true });
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('journal').add(payload);
    }
    this.hideModal('trade-modal');
  },

  openWatchlistModal(item = null) {
    this.state.editingWatchlistId = item?.id || null;
    document.getElementById('watchlist-modal-title').textContent = item ? 'Chỉnh sửa Watchlist' : 'Thêm Watchlist';
    document.getElementById('watch-ticker').value = item?.ticker || '';
    document.getElementById('watch-group').value = item?.group || 'near';
    document.getElementById('watch-pattern').value = item?.pattern || '';
    document.getElementById('watch-status').value = item?.status || '';
    document.getElementById('watch-plan').value = item?.plan || '';
    this.openModal('watchlist-modal');
  },

  async saveWatchlist() {
    if (!this.state.user) return alert('Bạn cần đăng nhập để lưu Watchlist.');
    const payload = {
      userId: this.state.user.uid,
      ticker: document.getElementById('watch-ticker').value.trim().toUpperCase(),
      group: document.getElementById('watch-group').value,
      pattern: document.getElementById('watch-pattern').value.trim(),
      status: document.getElementById('watch-status').value.trim(),
      plan: document.getElementById('watch-plan').value.trim(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (this.state.editingWatchlistId) await db.collection('watchlists').doc(this.state.editingWatchlistId).set(payload, { merge: true });
    else await db.collection('watchlists').add(payload);
    this.hideModal('watchlist-modal');
  },

  openPatternModal(item = null) {
    this.state.editingPatternId = item?.id || null;
    document.getElementById('pattern-modal-title').textContent = item ? 'Chỉnh sửa mẫu hình' : 'Tạo mẫu hình';
    document.getElementById('pattern-name').value = item?.name || '';
    document.getElementById('pattern-strategy').value = item?.strategy || '';
    document.getElementById('pattern-description').value = item?.description || '';
    document.getElementById('pattern-conditions').value = Array.isArray(item?.conditions) ? item.conditions.join('\n') : '';
    document.getElementById('pattern-triggers').value = Array.isArray(item?.triggers) ? item.triggers.join('\n') : '';
    this.openModal('pattern-modal');
  },

  async savePattern() {
    if (!this.state.user) return alert('Bạn cần đăng nhập để lưu Mẫu hình.');
    const payload = {
      userId: this.state.user.uid,
      name: document.getElementById('pattern-name').value.trim(),
      strategy: document.getElementById('pattern-strategy').value.trim(),
      description: document.getElementById('pattern-description').value.trim(),
      conditions: document.getElementById('pattern-conditions').value.split('\n').map(s => s.trim()).filter(Boolean),
      triggers: document.getElementById('pattern-triggers').value.split('\n').map(s => s.trim()).filter(Boolean),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (this.state.editingPatternId) await db.collection('patterns').doc(this.state.editingPatternId).set(payload, { merge: true });
    else await db.collection('patterns').add(payload);
    this.hideModal('pattern-modal');
  },

  async saveMarket() {
    if (!this.state.user) return alert('Bạn cần đăng nhập để lưu Thị trường.');
    await db.collection('settings').doc(this.state.user.uid + '_market').set({
      userId: this.state.user.uid,
      distDays: Number(document.getElementById('market-dist-days').value || 0),
      sentiment: document.getElementById('market-sentiment').value.trim(),
      leaders: document.getElementById('market-leaders').value.trim(),
      note: document.getElementById('market-note').value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    alert('Đã lưu dữ liệu thị trường lên Firebase.');
  },

  filteredTrades() {
    const q = document.getElementById('filter-search').value.trim().toLowerCase();
    const result = document.getElementById('filter-result').value;
    const closeFilter = document.getElementById('filter-close').value;
    return this.state.trades.filter(t => {
      const hitQ = !q || `${t.ticker} ${t.setup} ${t.strategy}`.toLowerCase().includes(q);
      const hitResult = result === 'all' || t.result === result;
      const hitClose = closeFilter === 'all'
        || (closeFilter === 'open' && t.status === 'open')
        || (closeFilter === 'closed' && t.status === 'closed')
        || (closeFilter === 'takeprofit' && t.result === 'win')
        || (closeFilter === 'stoploss' && t.result === 'loss');
      return hitQ && hitResult && hitClose;
    });
  },

  renderDashboard() {
    const trades = this.state.trades;
    const openTrades = trades.filter(t => t.status === 'open').length;
    const totalPnl = trades.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
    const avgQuality = trades.length ? Math.round(trades.reduce((sum, t) => sum + Number(t.score || 0), 0) / trades.length) : 0;
    document.getElementById('kpi-trades').textContent = trades.length;
    document.getElementById('kpi-open').textContent = openTrades;
    document.getElementById('kpi-pnl').textContent = this.fmtMoney(totalPnl);
    document.getElementById('kpi-quality').textContent = avgQuality;

    document.getElementById('dashboard-watchlist').innerHTML = this.state.watchlists.slice(0, 4).map(item => `
      <div class="watch-card panel">
        <div class="flex items-start justify-between gap-3">
          <div><div class="text-lg font-black">${item.ticker}</div><div class="text-sm text-slate-400">${item.pattern || 'Chưa gán pattern'}</div></div>
          <span class="tag tag-sky">${item.group}</span>
        </div>
        <div class="text-sm text-slate-300 mt-3">${item.plan || 'Chưa có kế hoạch.'}</div>
      </div>
    `).join('') || '<div class="text-sm text-slate-400">Chưa có watchlist.</div>';

    document.getElementById('dashboard-quality').innerHTML = trades.slice(0, 4).map(t => `
      <div class="quality-row">
        <span>${t.ticker} · ${t.setup || '—'}</span>
        <strong>${t.score || 0}/100 · ${t.qualityRank || 'D'}</strong>
      </div>
    `).join('') || '<div class="text-sm text-slate-400">Chưa có lệnh để chấm điểm.</div>';
  },

  renderJournal() {
    const body = document.getElementById('journal-body');
    body.innerHTML = this.filteredTrades().map(t => `
      <tr>
        <td>${t.date || ''}</td>
        <td class="font-bold">${t.ticker || ''}</td>
        <td>${t.setup || ''}</td>
        <td>${t.entry || ''}</td>
        <td>${t.stop || ''}</td>
        <td>${t.exit ?? ''}</td>
        <td>${this.resultTag(t)}</td>
        <td><span class="tag ${t.score >= 80 ? 'tag-green' : t.score >= 60 ? 'tag-amber' : 'tag-rose'}">${t.score || 0} · ${t.qualityRank || 'D'}</span></td>
        <td class="${Number(t.pnl) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${this.fmtMoney(t.pnl)}</td>
        <td><button class="btn btn-secondary !px-3 !py-2" onclick="App.openTradeModalById('${t.id}')">Sửa</button></td>
      </tr>
    `).join('') || '<tr><td colspan="10" class="text-center text-slate-400 py-6">Chưa có dữ liệu.</td></tr>';
  },

  resultTag(t) {
    if (t.result === 'win') return '<span class="tag tag-green">Lãi</span>';
    if (t.result === 'loss') return '<span class="tag tag-rose">Lỗ</span>';
    return '<span class="tag tag-sky">Đang mở</span>';
  },

  openTradeModalById(id) {
    const trade = this.state.trades.find(t => t.id === id);
    this.state.selectedTradeId = id;
    this.openTradeModal(trade);
  },

  renderWatchlist() {
    document.getElementById('watchlist-grid').innerHTML = this.state.watchlists.map(item => `
      <div class="watch-card panel">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div><div class="text-xl font-black">${item.ticker}</div><div class="text-sm text-slate-400">${item.pattern || 'Không có pattern'}</div></div>
          <span class="tag tag-sky">${item.group}</span>
        </div>
        <div class="text-sm text-slate-300 mb-3">${item.status || 'Chưa có trạng thái'}</div>
        <div class="text-sm text-slate-400 mb-4">${item.plan || 'Chưa có kế hoạch.'}</div>
        <button class="btn btn-secondary" onclick="App.openWatchlistModalById('${item.id}')">Sửa</button>
      </div>
    `).join('') || '<div class="text-sm text-slate-400">Chưa có watchlist.</div>';
  },

  openWatchlistModalById(id) { this.openWatchlistModal(this.state.watchlists.find(x => x.id === id)); },

  renderPatterns() {
    document.getElementById('patterns-grid').innerHTML = this.state.patterns.map(item => `
      <div class="pattern-card panel">
        <div class="text-xl font-black mb-2">${item.name}</div>
        <div class="text-sm text-emerald-300 mb-3">${item.strategy || ''}</div>
        <div class="text-sm text-slate-300 mb-3">${item.description || ''}</div>
        <div class="text-xs text-slate-400 mb-4">${(item.conditions || []).join(' • ')}</div>
        <button class="btn btn-secondary" onclick="App.openPatternModalById('${item.id}')">Sửa</button>
      </div>
    `).join('') || '<div class="text-sm text-slate-400">Chưa có mẫu hình.</div>';
  },

  openPatternModalById(id) { this.openPatternModal(this.state.patterns.find(x => x.id === id)); },

  renderQuality() {
    const t = this.state.selectedTradeId ? this.state.trades.find(x => x.id === this.state.selectedTradeId) : this.state.trades[0];
    const box = document.getElementById('quality-current');
    if (!t) {
      box.innerHTML = '<div class="text-sm text-slate-400">Chọn hoặc tạo một lệnh trong Nhật ký để xem Trade Quality.</div>';
      return;
    }
    this.state.selectedTradeId = t.id;
    box.innerHTML = `
      <div class="panel p-4">
        <div class="flex items-start justify-between gap-3 mb-3"><div><div class="text-2xl font-black">${t.ticker}</div><div class="text-sm text-slate-400">${t.strategy || ''} · ${t.setup || ''}</div></div><span class="tag ${t.score >= 80 ? 'tag-green' : t.score >= 60 ? 'tag-amber' : 'tag-rose'}">${t.score || 0}/100 · ${t.qualityRank || 'D'}</span></div>
        <div class="space-y-3">
          ${[['Setup', t.tqSetup || 0, 30], ['Market', t.tqMarket || 0, 20], ['Risk', t.tqRisk || 0, 20], ['Execution', t.tqExecution || 0, 20], ['Discipline', t.tqDiscipline || 0, 10]].map(([label, val, max]) => `
            <div>
              <div class="flex justify-between text-sm mb-1"><span>${label}</span><strong>${val}/${max}</strong></div>
              <div class="h-2 rounded-full bg-slate-800 overflow-hidden"><div class="h-full bg-emerald-500 rounded-full" style="width:${(val/max)*100}%"></div></div>
            </div>`).join('')}
        </div>
      </div>
      <div class="hint-box">${t.result === 'win' ? 'Lệnh này có lãi, nhưng vẫn cần nhìn vào điểm quality để biết nó có thực sự đúng hệ thống hay chỉ do may mắn.' : t.result === 'loss' ? 'Lệnh lỗ chưa chắc là lệnh xấu. Hãy nhìn breakdown để biết lỗ do market hay do vi phạm kỷ luật.' : 'Lệnh đang mở: dùng Trade Quality để xem có đáng tiếp tục giữ lệnh theo plan hay không.'}</div>
    `;
  },

  renderMarket() {
    document.getElementById('market-dist-days').value = this.state.market.distDays || 0;
    document.getElementById('market-sentiment').value = this.state.market.sentiment || '';
    document.getElementById('market-leaders').value = this.state.market.leaders || '';
    document.getElementById('market-note').value = this.state.market.note || '';
  },

  renderAll() {
    this.renderDashboard();
    this.renderJournal();
    this.renderWatchlist();
    this.renderPatterns();
    this.renderQuality();
    this.renderMarket();
    lucide.createIcons();
  }
};

window.App = App;
window.addEventListener('DOMContentLoaded', () => App.init());
