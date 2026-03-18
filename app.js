const STORAGE_KEY = 'cacon-trading-firebase-cache';

const FirebaseService = {
  get ready() {
    return !!(window.firebase && window.auth && window.db && window.storage);
  },

  async login(email, password) {
    return auth.signInWithEmailAndPassword(email, password);
  },

  async register(name, email, password) {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    if (name) await cred.user.updateProfile({ displayName: name });
    await db.collection('users').doc(cred.user.uid).set({
      uid: cred.user.uid,
      name: name || cred.user.displayName || email.split('@')[0],
      email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return cred;
  },

  async resetPassword(email) {
    return auth.sendPasswordResetEmail(email);
  },

  async logout() {
    return auth.signOut();
  },

  async ensureProfile(user) {
    if (!user) return;
    await db.collection('users').doc(user.uid).set({
      uid: user.uid,
      name: user.displayName || user.email?.split('@')[0] || 'Trader',
      email: user.email || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  },

  async loadJournal(uid) {
    const snap = await db.collection('trading_journals').doc(uid).get();
    return snap.exists ? snap.data()?.payload : null;
  },

  async saveJournal(uid, payload) {
    return db.collection('trading_journals').doc(uid).set({
      uid,
      payload,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  },

  async uploadFile(uid, file, folder) {
    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const ref = storage.ref(`users/${uid}/${folder}/${safeName}`);
    await ref.put(file);
    return ref.getDownloadURL();
  }
};

const App = {
  state: {
    theme: localStorage.getItem('cacon-theme') || 'light',
    activeTab: 'dashboard',
    selectedTradeId: null,
    editingTradeId: null,
    editingWatchlistId: null,
    editingPatternId: null,
    authMode: 'login',
    user: null,
    saveTimer: null,
    isSaving: false,
    breathing: { timer: null }
  },

  demo() {
    return {
      accountSize: 200000000,
      riskPercent: 1,
      patterns: [
        {
          id: 'p-vcp',
          name: 'VCP',
          strategy: 'Mark Minervini',
          description: 'Mẫu hình co hẹp biên độ sau xu hướng tăng tốt, volume giảm dần rồi breakout.',
          conditions: ['Xu hướng trước đó tăng mạnh', 'Biên độ co hẹp dần', 'Volume giảm dần trong nền'],
          triggers: ['Breakout khỏi nền', 'Volume xác nhận', 'Thị trường ủng hộ'],
          image: ''
        },
        {
          id: 'p-tightflag',
          name: 'Tight Flag',
          strategy: 'CANSLIM',
          description: 'Sau nhịp tăng mạnh, giá nghỉ ngắn với cờ hẹp và thanh khoản giảm.',
          conditions: ['Có thrust mạnh trước đó', 'Lá cờ hẹp', 'Không gãy MA ngắn hạn'],
          triggers: ['Vượt đỉnh lá cờ', 'Volume cải thiện', 'Nhóm ngành đồng thuận'],
          image: ''
        }
      ],
      watchlists: [
        { id: 'w1', symbol: 'FPT', group: 'near', patternId: 'p-vcp', buyZone: '128 - 132', risk: 'Thấp', status: 'Gần điểm mua', plan: 'Canh breakout nền chặt với volume xác nhận.', sector: 'Công nghệ' },
        { id: 'w2', symbol: 'DGC', group: 'long', patternId: 'p-tightflag', buyZone: '108 - 112', risk: 'Trung bình', status: 'Dài hạn', plan: 'Theo dõi nền tuần và gia tăng ở nhịp co hẹp.', sector: 'Hóa chất' },
        { id: 'w3', symbol: 'SSI', group: 'watch', patternId: 'p-vcp', buyZone: '39 - 40', risk: 'Trung bình', status: 'Theo dõi', plan: 'Chờ thêm xác nhận từ thị trường chung.', sector: 'Chứng khoán' }
      ],
      trades: [
        {
          id: 't1', symbol: 'FPT', sector: 'Công nghệ', strategy: 'Mark Minervini', setup: 'VCP', patternId: 'p-vcp',
          entryDate: '2026-03-03', exitDate: '2026-03-10', entry: 128.5, stop: 123, exit: 137.8, qty: 500, riskPct: 1,
          status: 'closed', result: 'win', emotion: 'Tự tin', mistake: 'Không', score: 89, marketPulse: 'Tích cực',
          note: 'Breakout đẹp, volume tăng, nhóm công nghệ dẫn dắt.', checklist: ['Xu hướng nền chặt', 'Volume bùng nổ', 'RS mạnh'], theoryImage: '', actualImage: ''
        },
        {
          id: 't2', symbol: 'HPG', sector: 'Thép', strategy: 'Price Action', setup: 'Breakout nền giá', patternId: '',
          entryDate: '2026-03-05', exitDate: '2026-03-12', entry: 31.2, stop: 29.8, exit: 30.1, qty: 2000, riskPct: 1,
          status: 'closed', result: 'loss', emotion: 'Tham lam', mistake: 'Gồng lỗ', score: 54, marketPulse: 'Trung tính',
          note: 'Mua sớm khi thị trường chưa xác nhận.', checklist: ['Có nền giá', 'Chưa đủ volume'], theoryImage: '', actualImage: ''
        },
        {
          id: 't3', symbol: 'DGC', sector: 'Hóa chất', strategy: 'CANSLIM', setup: 'Tight Flag', patternId: 'p-tightflag',
          entryDate: '2026-03-07', exitDate: '', entry: 112, stop: 108.5, exit: null, qty: 400, riskPct: 0.8,
          status: 'open', result: 'open', emotion: 'Sợ hãi', mistake: 'Bán non', score: 76, marketPulse: 'Tích cực',
          note: 'Đang giữ, theo dõi phản ứng quanh MA10.', checklist: ['Nền chặt', 'Giữ stop rõ ràng'], theoryImage: '', actualImage: ''
        }
      ],
      market: { distDays: 2, sentiment: 'Tích cực', sectors: 'Chứng khoán, Công nghệ', note: 'Có thể giải ngân thăm dò với setup mạnh.' },
      mindset: { energy: 7, calm: 8, fomo: 4, confidence: 6, preflight: 'Kiểm tra market pulse, chỉ chọn A/B setup, không mua đuổi quá 2%.', breathIn: 4, breathHold: 7, breathOut: 8 },
      review: { weekly: 'Tuần này kiên nhẫn chờ setup tốt hơn.', monthly: 'Tháng này cần giảm số lệnh vào sớm.' }
    };
  },

  async init() {
    this.data = this.loadLocalCache();
    this.recomputeTrades();
    this.applyTheme(this.state.theme);
    this.bindEvents();
    this.renderAll();
    AuthUI.switch('login');
    this.setSyncStatus('Chưa đăng nhập');
    this.lockApp(true);

    if (FirebaseService.ready) {
      auth.onAuthStateChanged(async (user) => {
        try {
          this.state.user = user || null;
          if (!user) {
            this.lockApp(true);
            this.setUserInfo(null);
            this.setSyncStatus('Chưa đăng nhập');
            return;
          }
          this.lockApp(false);
          this.setUserInfo(user);
          this.setSyncStatus('Đang tải Firebase...');
          await FirebaseService.ensureProfile(user);
          const cloudData = await FirebaseService.loadJournal(user.uid);
          this.data = cloudData || this.demo();
          this.recomputeTrades();
          this.saveLocalCache();
          this.renderAll();
          this.setSyncStatus('Đã đồng bộ Firebase');
        } catch (error) {
          console.error(error);
          this.showAuthMessage(error.message || 'Không tải được dữ liệu Firebase.', true);
          this.setSyncStatus('Lỗi đồng bộ');
        }
      });
    } else {
      this.showAuthMessage('Firebase chưa được khởi tạo đúng trong firebase.js.', true);
    }

    lucide.createIcons();
  },

  bindEvents() {
    document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => this.switchTab(btn.dataset.tab)));
    document.getElementById('theme-toggle').addEventListener('click', () => this.applyTheme(this.state.theme === 'dark' ? 'light' : 'dark'));
    document.getElementById('global-search').addEventListener('input', () => this.renderJournalTable());
    ['filter-start','filter-end','filter-status','filter-result'].forEach(id => document.getElementById(id).addEventListener('input', () => this.renderJournalTable()));
    ['energy-input','calm-input','fomo-input','confidence-input'].forEach(id => document.getElementById(id).addEventListener('input', () => this.updateMindsetValues()));
    ['breath-in','breath-hold','breath-out'].forEach(id => document.getElementById(id).addEventListener('input', () => this.updateBreathSummary()));
    ['trade-theory-file','trade-actual-file','pattern-image-file'].forEach(id => document.getElementById(id).addEventListener('change', (e) => this.handleFilePreview(e)));
  },

  lockApp(locked) {
    document.querySelector('.app-shell').classList.toggle('app-locked', locked);
    document.getElementById('auth-overlay').classList.toggle('hidden', !locked);
  },

  showAuthMessage(message, isError = false) {
    const el = document.getElementById('auth-message');
    el.textContent = message;
    el.classList.toggle('error', isError);
  },

  setUserInfo(user) {
    document.getElementById('sidebar-user-name').textContent = user?.displayName || user?.email?.split('@')[0] || 'Chưa đăng nhập';
    document.getElementById('sidebar-user-email').textContent = user?.email || '—';
  },

  setSyncStatus(text) {
    document.getElementById('sync-status').textContent = text;
  },

  loadLocalCache() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : this.demo();
    } catch {
      return this.demo();
    }
  },

  saveLocalCache() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  },

  persist() {
    this.saveLocalCache();
    this.queueCloudSave();
  },

  queueCloudSave() {
    if (!this.state.user) return;
    clearTimeout(this.state.saveTimer);
    this.setSyncStatus('Đang chờ lưu...');
    this.state.saveTimer = setTimeout(() => this.saveCloudNow(), 500);
  },

  async saveCloudNow() {
    if (!this.state.user || this.state.isSaving) return;
    this.state.isSaving = true;
    try {
      this.setSyncStatus('Đang lưu Firebase...');
      await FirebaseService.saveJournal(this.state.user.uid, this.data);
      this.setSyncStatus('Đã lưu lên Firebase');
    } catch (error) {
      console.error(error);
      this.setSyncStatus('Lưu thất bại');
      alert('Không lưu được lên Firebase: ' + (error.message || error));
    } finally {
      this.state.isSaving = false;
    }
  },

  async login(email, password) { return FirebaseService.login(email, password); },
  async register(name, email, password) { return FirebaseService.register(name, email, password); },
  async resetPassword(email) { return FirebaseService.resetPassword(email); },
  async logout() { return FirebaseService.logout(); },

  resolveImage(path) {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('./') || path.startsWith('/')) return path;
    return path;
  },

  getTradeById(id) { return this.data.trades.find(t => t.id === id) || this.data.trades[0]; },
  getPatternById(id) { return this.data.patterns.find(p => p.id === id) || null; },
  patternName(id) { return this.getPatternById(id)?.name || 'Chưa chọn'; },
  fmtMoney(v) { return `${Math.round(v || 0).toLocaleString('vi-VN')}đ`; },
  fmtNum(v, d = 1) { return v == null || Number.isNaN(v) ? '—' : Number(v).toFixed(d).replace(/\.0$/, ''); },

  applyTheme(theme) {
    this.state.theme = theme;
    localStorage.setItem('cacon-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    const label = document.querySelector('#theme-toggle span');
    if (label) label.textContent = theme === 'dark' ? 'Light' : 'Dark';
    const icon = document.querySelector('#theme-toggle i');
    if (icon) icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
    lucide.createIcons();
  },

  switchTab(tab) {
    this.state.activeTab = tab;
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    document.querySelector(`[data-screen="${tab}"]`).classList.remove('hidden');
    document.querySelectorAll('.side-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  },

  calcTradePnl(t) {
    if (t.exit == null || !t.qty) return 0;
    return (t.exit - t.entry) * t.qty;
  },

  recomputeTrades() {
    this.data.trades = this.data.trades.map(t => {
      const pnl = this.calcTradePnl(t);
      const pnlPct = t.exit != null && t.entry ? ((t.exit - t.entry) / t.entry) * 100 : null;
      const r = t.exit != null && t.entry && t.stop ? ((t.exit - t.entry) / Math.abs(t.entry - t.stop)) : null;
      const execution = t.score >= 85 ? 'Đúng kế hoạch' : t.score >= 70 ? 'Đang theo dõi' : 'Vi phạm kế hoạch';
      return { ...t, pnl, pnlPct, r, execution };
    });
    if (!this.state.selectedTradeId && this.data.trades[0]) this.state.selectedTradeId = this.data.trades[0].id;
  },

  renderAll() {
    this.refreshSelects();
    this.renderDashboard();
    this.renderScan();
    this.renderJournalTable();
    this.renderTradeDetail();
    this.renderSizingCard('position-sizing-card');
    this.renderSizingCard('sizing-standalone');
    this.renderBehaviorCard();
    this.renderPatterns();
    this.renderMarket();
    this.renderMindset();
    this.renderReview();
    this.updateMission();
    lucide.createIcons();
  },

  marketStateLabel() {
    const d = Number(this.data.market.distDays || 0);
    if (d <= 2) return { title: 'Thị trường bình thường', action: 'Có thể giao dịch bình thường, ưu tiên setup chuẩn.' };
    if (d === 3) return { title: 'Giảm Margin', action: 'Thị trường có rủi ro, giảm sử dụng margin.' };
    if (d === 4) return { title: 'Tỷ trọng 50%', action: 'Hạ tỷ trọng cổ phiếu xuống khoảng 50%.' };
    return { title: 'Ưu tiên tiền mặt', action: '5-6 ngày phân phối, ưu tiên giữ tiền mặt và chỉ theo dõi leader dài hạn.' };
  },

  leadingSectors() {
    return (this.data.market.sectors || '').split(',').map(s => s.trim()).filter(Boolean);
  },

  leadingSectorText() {
    return this.leadingSectors().slice(0, 2).join(' · ') || 'Không có';
  },

  computePassRate() {
    const total = this.data.trades.reduce((sum, t) => sum + (t.checklist?.length || 0), 0);
    const mistakes = this.data.trades.filter(t => t.mistake && t.mistake !== 'Không').length;
    return total ? Math.max(0, Math.min(100, Math.round(((total - mistakes) / total) * 100))) : 0;
  },

  bestSector() {
    const map = {};
    this.data.trades.filter(t => t.result !== 'open').forEach(t => { map[t.sector] = (map[t.sector] || 0) + (t.pnl || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  },

  bestWeekday() {
    const names = ['CN','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
    const map = {};
    this.data.trades.filter(t => t.result !== 'open').forEach(t => {
      const key = names[new Date(t.entryDate).getDay()];
      map[key] = (map[key] || 0) + (t.pnl || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  },

  topMistake() {
    const map = {};
    this.data.trades.filter(t => t.mistake && t.mistake !== 'Không').forEach(t => { map[t.mistake] = (map[t.mistake] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Không';
  },

  scoreLetter(score) { return score >= 85 ? 'A-' : score >= 70 ? 'B+' : 'C'; },
  qualityChip(score) { return `<span class="table-chip ${score >= 85 ? 'green' : score >= 70 ? 'amber' : 'rose'}">${score >= 85 ? 'A Setup' : score >= 70 ? 'B Setup' : 'C Setup'}</span>`; },
  executionChip(v) { return `<span class="table-chip ${v === 'Đúng kế hoạch' ? 'green' : v === 'Đang theo dõi' ? 'amber' : 'rose'}">${v}</span>`; },
  resultChip(v) { return `<span class="table-chip ${v === 'win' ? 'green' : v === 'loss' ? 'rose' : 'sky'}">${v === 'win' ? 'Lãi' : v === 'loss' ? 'Lỗ' : 'Đang mở'}</span>`; },
  emotionChip(v) { return `<span class="table-chip ${v === 'Tự tin' ? 'green' : v === 'Sợ hãi' ? 'sky' : 'amber'}">${v}</span>`; },
  mistakeChip(v) { return `<span class="table-chip ${v === 'Không' ? 'gray' : 'rose'}">${v}</span>`; },
  marketChip(v) { return `<span class="table-chip green">${v}</span>`; },

  renderDashboard() {
    const trades = this.data.trades;
    const closed = trades.filter(t => t.status === 'closed');
    const wins = closed.filter(t => t.result === 'win').length;
    const winRate = closed.length ? (wins / closed.length) * 100 : 0;
    const avgScore = trades.length ? trades.reduce((sum, t) => sum + Number(t.score || 0), 0) / trades.length : 0;
    const groups = {
      near: this.data.watchlists.filter(w => w.group === 'near'),
      watch: this.data.watchlists.filter(w => w.group === 'watch'),
      long: this.data.watchlists.filter(w => w.group === 'long')
    };

    document.getElementById('dashboard-kpis').innerHTML = [
      ['Market Pulse', this.marketStateLabel().title, `${this.data.market.distDays} ngày phân phối`, 'activity'],
      ['Watchlist', groups.near.length + groups.watch.length + groups.long.length, 'Tổng cơ hội đang theo dõi', 'bookmark-check'],
      ['Win rate', `${this.fmtNum(winRate, 1)}%`, `${wins}/${closed.length || 0} lệnh đóng`, 'target'],
      ['Trade Quality', this.scoreLetter(avgScore), 'Điểm chất lượng trung bình', 'gauge'],
      ['Cảnh báo', this.topMistake(), 'Sai lầm lặp lại nhiều nhất', 'siren']
    ].map(([title, val, desc, icon]) => `
      <div class="card p-5">
        <div class="flex items-start justify-between gap-4">
          <div><div class="text-sm text-zinc-500 dark:text-zinc-400">${title}</div><div class="text-4xl font-semibold mt-2">${val}</div><div class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">${desc}</div></div>
          <div class="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center"><i data-lucide="${icon}" class="w-6 h-6"></i></div>
        </div>
      </div>`).join('');

    document.getElementById('dashboard-actions').innerHTML = [
      ['Scan cơ hội', 'scan-search', 'scan'],
      ['Tạo lệnh mới', 'plus', 'trade'],
      ['Đánh giá thị trường', 'newspaper', 'market'],
      ['Review tuần', 'clipboard-list', 'review']
    ].map(([title, icon, action]) => `
      <button class="card p-5 text-left" onclick="${action === 'trade' ? 'App.openTradeModal()' : `App.switchTab('${action}')`}">
        <div class="flex items-start justify-between gap-3"><div><div class="text-xl font-semibold">${title}</div></div><div class="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center"><i data-lucide="${icon}" class="w-5 h-5"></i></div></div>
      </button>`).join('');

    this.renderWatchCards('dash-near-list', groups.near, true);
    this.renderWatchCards('dash-watch-list', groups.watch, true);
    this.renderWatchCards('dash-long-list', groups.long, true);
    document.getElementById('count-near').textContent = `${groups.near.length} mã`;
    document.getElementById('count-watch').textContent = `${groups.watch.length} mã`;
    document.getElementById('count-long').textContent = `${groups.long.length} mã`;
    document.getElementById('pass-rate').textContent = `${this.computePassRate()}%`;
    document.getElementById('top-mistake').textContent = this.topMistake();
    document.getElementById('next-step').textContent = this.marketStateLabel().action;
    document.getElementById('longterm-summary').innerHTML = groups.long.map(w => `
      <div class="watch-card">
        <div class="topline"><div><div class="title">${w.symbol}</div><div class="muted text-sm">${this.patternName(w.patternId)} · ${w.sector || ''}</div></div><span class="status-pill">${w.status}</span></div>
        <div class="grid grid-cols-2 gap-3 text-sm mb-3"><div><div class="muted">Buy zone</div><strong>${w.buyZone}</strong></div><div><div class="muted">Risk</div><strong>${w.risk}</strong></div></div>
        <div class="text-sm text-zinc-600 dark:text-zinc-300">${w.plan || ''}</div>
      </div>`).join('') || '<div class="text-sm muted">Chưa có dữ liệu.</div>';
  },

  renderWatchCards(targetId, items, compact = false) {
    document.getElementById(targetId).innerHTML = items.map(w => `
      <div class="watch-card">
        <div class="topline"><div><div class="title">${w.symbol}</div><div class="muted text-sm">${this.patternName(w.patternId)}</div></div><span class="status-pill">${w.status}</span></div>
        <div class="grid grid-cols-2 gap-3 text-sm mb-3"><div><div class="muted">Buy zone</div><strong>${w.buyZone}</strong></div><div><div class="muted">Risk</div><strong>${w.risk}</strong></div></div>
        <div class="flex gap-2 flex-wrap">
          <button class="btn-primary !py-2 !px-4" onclick="App.prefillTradeFromWatchlist('${w.id}')">Tạo lệnh</button>
          <button class="btn-secondary !py-2 !px-4" onclick="App.openPatternFromWatchlist('${w.id}')">Mở checklist</button>
          ${compact ? '' : `<button class="btn-secondary !py-2 !px-4" onclick="App.openWatchlistModal('${w.id}')">Sửa</button><button class="btn-secondary !py-2 !px-4" onclick="App.deleteWatchlist('${w.id}')">Xóa</button>`}
        </div>
      </div>`).join('') || '<div class="text-sm muted">Chưa có dữ liệu.</div>';
  },

  renderScan() {
    const groups = {
      near: this.data.watchlists.filter(w => w.group === 'near'),
      watch: this.data.watchlists.filter(w => w.group === 'watch'),
      long: this.data.watchlists.filter(w => w.group === 'long')
    };
    this.renderWatchCards('scan-near-list', groups.near);
    this.renderWatchCards('scan-watch-list', groups.watch);
    this.renderWatchCards('scan-long-list', groups.long);
    document.getElementById('scan-count-near').textContent = `${groups.near.length} mã`;
    document.getElementById('scan-count-watch').textContent = `${groups.watch.length} mã`;
    document.getElementById('scan-count-long').textContent = `${groups.long.length} mã`;
  },

  journalFilteredTrades() {
    const q = document.getElementById('global-search').value.trim().toLowerCase();
    const start = document.getElementById('filter-start').value;
    const end = document.getElementById('filter-end').value;
    const status = document.getElementById('filter-status').value;
    const result = document.getElementById('filter-result').value;
    return this.data.trades.filter(t => {
      const hitQ = !q || [t.symbol, t.strategy, t.setup, t.sector, t.mistake].join(' ').toLowerCase().includes(q);
      const hitStart = !start || t.entryDate >= start;
      const hitEnd = !end || t.entryDate <= end;
      const hitStatus = status === 'all' || t.status === status;
      const hitResult = result === 'all' || t.result === result;
      return hitQ && hitStart && hitEnd && hitStatus && hitResult;
    }).sort((a, b) => b.entryDate.localeCompare(a.entryDate));
  },

  renderJournalTable() {
    document.getElementById('journal-table-body').innerHTML = this.journalFilteredTrades().map(t => `
      <tr class="clickable" onclick="App.selectTrade('${t.id}')">
        <td class="font-semibold">${t.symbol}</td><td>${t.entryDate}</td><td>${t.strategy}</td><td>${t.setup}</td><td>${t.sector}</td>
        <td>${this.fmtNum(t.entry, 1)}</td><td>${this.fmtNum(t.stop, 1)}</td>
        <td class="${(t.pnlPct || 0) >= 0 ? 'text-brand-600 dark:text-brand-300' : 'text-rose-600 dark:text-rose-300'}">${t.pnlPct == null ? '—' : this.fmtNum(t.pnlPct, 2) + '%'}</td>
        <td class="${(t.r || 0) >= 0 ? 'text-brand-600 dark:text-brand-300' : 'text-rose-600 dark:text-rose-300'}">${t.r == null ? '—' : this.fmtNum(t.r, 2) + 'R'}</td>
        <td>${this.qualityChip(t.score)}</td><td>${this.executionChip(t.execution)}</td><td>${this.resultChip(t.result)}</td><td>${t.mistake}</td><td><span class="table-chip gray">chart</span></td>
      </tr>`).join('');
  },

  selectTrade(id) {
    this.state.selectedTradeId = id;
    this.renderTradeDetail();
    this.renderBehaviorCard();
    this.renderSizingCard('position-sizing-card');
  },

  renderTradeDetail() {
    const t = this.getTradeById(this.state.selectedTradeId);
    const p = this.getPatternById(t?.patternId);
    const card = document.getElementById('trade-detail-card');
    if (!t) {
      card.innerHTML = '<div>Chưa có lệnh.</div>';
      return;
    }
    card.innerHTML = `
      <div class="section-head"><div><h2>Chi tiết lệnh: ${t.symbol}</h2><p>${t.strategy} · ${t.setup} · ${t.sector}</p></div><div class="flex gap-2">${this.marketChip(t.marketPulse)}${this.qualityChip(t.score)}</div></div>
      <div class="grid md:grid-cols-4 gap-4 mb-4">${[['Entry', t.entry], ['Stop', t.stop], ['Exit', t.exit ?? '—'], ['Quantity', t.qty]].map(([k, v]) => `<div class="trade-kv"><div class="text-xs muted">${k}</div><div class="text-2xl font-semibold mt-2">${v}</div></div>`).join('')}</div>
      <div class="grid lg:grid-cols-2 gap-4 mb-4">
        <div class="trade-kv"><div class="font-semibold mb-3">Biểu đồ lý thuyết</div><div class="image-preview-box !aspect-[4/2.7]" onclick="App.zoomImage('${this.resolveImage(t.theoryImage || p?.image || '')}')">${(t.theoryImage || p?.image) ? `<img src="${this.resolveImage(t.theoryImage || p?.image)}">` : '<div class="muted text-sm">Chưa có ảnh</div>'}</div></div>
        <div class="trade-kv"><div class="font-semibold mb-3">Biểu đồ vào lệnh thực tế</div><div class="image-preview-box !aspect-[4/2.7]" onclick="App.zoomImage('${this.resolveImage(t.actualImage || '')}')">${t.actualImage ? `<img src="${this.resolveImage(t.actualImage)}">` : '<div class="muted text-sm">Chưa có ảnh</div>'}</div></div>
      </div>
      <div class="grid lg:grid-cols-2 gap-4">
        <div class="trade-kv"><div class="font-semibold mb-3">Checklist trước lệnh</div><div class="space-y-2">${(t.checklist || p?.conditions || []).map(c => `<div class="mini-row"><span>${c}</span><strong>Check</strong></div>`).join('') || '<div class="text-sm muted">Chưa có checklist.</div>'}</div></div>
        <div class="trade-kv"><div class="font-semibold mb-3">Ghi chú & cảm xúc</div><div class="text-sm leading-6 text-zinc-600 dark:text-zinc-300 mb-4">${t.note || ''}</div><div class="flex flex-wrap gap-2 mb-4">${this.emotionChip(t.emotion)}${this.mistakeChip(t.mistake)}</div><div class="flex gap-2"><button class="btn-primary" onclick="App.openTradeModal('${t.id}')">Sửa lệnh</button><button class="btn-secondary" onclick="App.switchTab('review')">Review</button></div></div>
      </div>`;
  },

  computeSizing(account, riskPct, entry, stop) {
    const riskAmount = account * (riskPct / 100);
    const perShare = Math.abs(entry - stop);
    const shares = perShare > 0 ? Math.floor(riskAmount / perShare) : 0;
    const capitalNeeded = shares * entry;
    const capitalPercent = account ? (capitalNeeded / account) * 100 : 0;
    const warning = perShare <= 0 ? 'Stop loss phải khác điểm mua.' : capitalPercent > 35 ? 'Cảnh báo: stop loss rộng hơn bình thường, cân nhắc giảm vị thế.' : 'Vị thế ở vùng an toàn, vẫn cần tuân thủ stop loss.';
    return { riskAmount, shares, capitalNeeded, capitalPercent, warning };
  },

  renderSizingCard(targetId) {
    const t = this.getTradeById(this.state.selectedTradeId) || {};
    const res = this.computeSizing(this.data.accountSize, this.data.riskPercent, Number(t.entry || 0), Number(t.stop || 0));
    document.getElementById(targetId).innerHTML = `
      <div class="section-head"><div><h2>Position Sizing</h2><p>Tự tính khối lượng tối đa theo risk account.</p></div></div>
      <div class="grid md:grid-cols-2 gap-4 mb-4">
        <label class="field-block"><span>Tài khoản</span><input id="${targetId}-account" type="number" class="field-input" value="${this.data.accountSize}"></label>
        <label class="field-block"><span>Risk % / lệnh</span><input id="${targetId}-risk" type="number" step="0.1" class="field-input" value="${this.data.riskPercent}"></label>
        <label class="field-block"><span>Điểm mua</span><input id="${targetId}-entry" type="number" step="0.01" class="field-input" value="${t.entry || ''}"></label>
        <label class="field-block"><span>Stop loss</span><input id="${targetId}-stop" type="number" step="0.01" class="field-input" value="${t.stop || ''}"></label>
      </div>
      <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 mb-4">
        <div class="grid md:grid-cols-2 gap-4 text-sm">
          <div><div class="muted">Rủi ro tối đa</div><div class="font-semibold mt-1">${this.fmtMoney(res.riskAmount)}</div></div>
          <div><div class="muted">SL tối đa</div><div class="font-semibold mt-1">${res.shares.toLocaleString('vi-VN')} cp</div></div>
          <div><div class="muted">Giá trị vị thế</div><div class="font-semibold mt-1">${this.fmtMoney(res.capitalNeeded)}</div></div>
          <div><div class="muted">% vốn sử dụng</div><div class="font-semibold mt-1">${this.fmtNum(res.capitalPercent, 1)}%</div></div>
        </div>
      </div>
      <div class="rounded-2xl p-4 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-100 mb-4">${res.warning}</div>
      <button class="btn-primary w-full" onclick="App.lockSizing('${targetId}')">Khóa size</button>`;

    ['account','risk','entry','stop'].forEach(key => {
      document.getElementById(`${targetId}-${key}`).addEventListener('input', () => this.liveSizing(targetId));
    });
  },

  liveSizing(targetId) {
    this.data.accountSize = Number(document.getElementById(`${targetId}-account`).value || 0);
    this.data.riskPercent = Number(document.getElementById(`${targetId}-risk`).value || 0);
    this.persist();
    this.renderSizingCard(targetId);
    if (targetId === 'position-sizing-card') this.renderSizingCard('sizing-standalone');
    if (targetId === 'sizing-standalone') this.renderSizingCard('position-sizing-card');
  },

  lockSizing() {
    alert('Đã cập nhật cấu hình position sizing.');
  },

  renderBehaviorCard() {
    const issues = this.data.trades.filter(t => t.mistake !== 'Không').slice(0, 2);
    document.getElementById('behavior-card').innerHTML = `
      <div class="section-head"><div><h2>Cảnh báo hành vi</h2><p>Giúp chặn lỗi trước khi lặp lại.</p></div></div>
      <div class="space-y-3">${issues.map(i => `<div class="rounded-2xl bg-rose-50 p-4 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">${i.symbol}: ${i.mistake}. Cảm xúc: ${i.emotion}.</div>`).join('') || '<div class="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900/70">Chưa có lỗi hành vi nổi bật.</div>'}</div>`;
  },

  renderPatterns() {
    document.getElementById('pattern-grid').innerHTML = this.data.patterns.map(p => `
      <div class="pattern-card">
        <div class="image-preview-box !aspect-[16/9] mb-4" onclick="App.zoomImage('${this.resolveImage(p.image || '')}')">${p.image ? `<img src="${this.resolveImage(p.image)}">` : '<div class="muted text-sm">Chưa có ảnh</div>'}</div>
        <div class="flex justify-between items-start gap-3 mb-2"><div><div class="text-2xl font-semibold">${p.name}</div><div class="muted text-sm">${p.strategy}</div></div><button class="btn-secondary !py-2 !px-3" onclick="App.comparePattern('${p.id}')">So sánh</button></div>
        <p class="text-sm leading-6 text-zinc-600 dark:text-zinc-300 mb-4">${p.description || ''}</p>
        <div class="grid gap-3 mb-4"><div><div class="text-sm font-semibold mb-2">Điều kiện nền</div>${(p.conditions || []).map(c => `<div class="mini-row mb-2"><span>${c}</span><strong>Đạt</strong></div>`).join('')}</div><div><div class="text-sm font-semibold mb-2">Điều kiện kích hoạt</div>${(p.triggers || []).map(c => `<div class="mini-row mb-2"><span>${c}</span><strong>Check</strong></div>`).join('')}</div></div>
        <div class="flex gap-2 flex-wrap"><button class="btn-primary !py-2 !px-4" onclick="App.openPatternModal('${p.id}')">Chỉnh sửa</button><button class="btn-secondary !py-2 !px-4" onclick="App.deletePattern('${p.id}')">Xóa</button></div>
      </div>`).join('');
  },

  renderMarket() {
    const m = this.data.market;
    document.getElementById('market-dist-input').value = m.distDays;
    document.getElementById('market-sentiment-input').value = m.sentiment;
    document.getElementById('market-sectors-input').value = m.sectors;
    document.getElementById('market-note-input').value = m.note;
    document.getElementById('market-dist-view').textContent = m.distDays;
    document.getElementById('market-state-view').textContent = this.marketStateLabel().title;
    document.getElementById('market-sentiment-view').textContent = m.sentiment;
    document.getElementById('market-sector-tags').innerHTML = this.leadingSectors().map(s => `<span class="table-chip gray">${s}</span>`).join('');
    document.getElementById('market-guidance').textContent = `${this.marketStateLabel().title}: ${this.marketStateLabel().action} ${m.note || ''}`;
    document.getElementById('market-action-text').textContent = this.marketStateLabel().action;
  },

  saveMarket() {
    this.data.market = {
      distDays: Number(document.getElementById('market-dist-input').value || 0),
      sentiment: document.getElementById('market-sentiment-input').value,
      sectors: document.getElementById('market-sectors-input').value,
      note: document.getElementById('market-note-input').value
    };
    this.persist();
    this.renderMarket();
    this.renderDashboard();
    this.updateMission();
  },

  renderMindset() {
    const m = this.data.mindset;
    document.getElementById('energy-input').value = m.energy;
    document.getElementById('calm-input').value = m.calm;
    document.getElementById('fomo-input').value = m.fomo;
    document.getElementById('confidence-input').value = m.confidence;
    document.getElementById('preflight-note').value = m.preflight;
    document.getElementById('breath-in').value = m.breathIn;
    document.getElementById('breath-hold').value = m.breathHold;
    document.getElementById('breath-out').value = m.breathOut;
    this.updateMindsetValues();
    this.updateBreathSummary();
  },

  updateMindsetValues() {
    ['energy','calm','fomo','confidence'].forEach(k => {
      document.getElementById(`${k}-value`).textContent = document.getElementById(`${k}-input`).value + '/10';
    });
  },

  saveMindset() {
    this.data.mindset = {
      energy: Number(document.getElementById('energy-input').value || 0),
      calm: Number(document.getElementById('calm-input').value || 0),
      fomo: Number(document.getElementById('fomo-input').value || 0),
      confidence: Number(document.getElementById('confidence-input').value || 0),
      preflight: document.getElementById('preflight-note').value,
      breathIn: Number(document.getElementById('breath-in').value || 4),
      breathHold: Number(document.getElementById('breath-hold').value || 7),
      breathOut: Number(document.getElementById('breath-out').value || 8)
    };
    this.persist();
    this.updateBreathSummary();
    this.updateMission();
    alert('Đã lưu check-in tâm lý.');
  },

  updateBreathSummary() {
    const i = Number(document.getElementById('breath-in').value || 4);
    const h = Number(document.getElementById('breath-hold').value || 7);
    const o = Number(document.getElementById('breath-out').value || 8);
    document.getElementById('breath-summary').textContent = `Nhịp hiện tại: Hít ${i} giây — Giữ ${h} giây — Thở ${o} giây.`;
  },

  startBreathing() {
    this.stopBreathing();
    const phases = [
      { label: 'Hít vào', cls: 'expand', sec: Number(document.getElementById('breath-in').value || 4) },
      { label: 'Giữ', cls: 'hold', sec: Number(document.getElementById('breath-hold').value || 7) },
      { label: 'Thở ra', cls: 'release', sec: Number(document.getElementById('breath-out').value || 8) }
    ];
    let total = 0;
    let phaseIndex = 0;
    let remaining = phases[0].sec;
    const totalTarget = 300;
    const stage = document.getElementById('breathing-stage');
    const circle = document.getElementById('breath-circle');
    const timer = document.getElementById('breath-timer');
    const progress = document.getElementById('breath-progress');
    const tick = () => {
      const phase = phases[phaseIndex];
      stage.textContent = phase.label;
      circle.className = `mx-auto mt-5 breath-circle ${phase.cls}`;
      timer.textContent = remaining;
      progress.style.width = `${Math.min(100, (total / totalTarget) * 100)}%`;
      remaining -= 1;
      total += 1;
      if (remaining < 0) {
        phaseIndex = (phaseIndex + 1) % phases.length;
        remaining = phases[phaseIndex].sec;
      }
      if (total > totalTarget) {
        this.stopBreathing();
        stage.textContent = 'Hoàn thành';
        timer.textContent = '✓';
        progress.style.width = '100%';
      }
    };
    tick();
    this.state.breathing.timer = setInterval(tick, 1000);
  },

  stopBreathing() {
    if (this.state.breathing.timer) clearInterval(this.state.breathing.timer);
    this.state.breathing.timer = null;
  },

  renderReview() {
    const closed = this.data.trades.filter(t => t.status === 'closed');
    const wins = closed.filter(t => t.result === 'win');
    const losses = closed.filter(t => t.result === 'loss');
    document.getElementById('review-summary').innerHTML = `
      <div class="grid md:grid-cols-2 gap-4">
        <div class="stat-box"><div>Tổng lệnh đã đóng</div><strong>${closed.length}</strong><span>${wins.length} thắng / ${losses.length} thua</span></div>
        <div class="stat-box"><div>Lợi nhuận ròng</div><strong>${this.fmtMoney(closed.reduce((a, b) => a + (b.pnl || 0), 0))}</strong><span>Tự tổng hợp từ nhật ký</span></div>
        <div class="stat-box"><div>Ngày giao dịch hiệu quả</div><strong>${this.bestWeekday()}</strong><span>Ngày có expectancy tốt nhất</span></div>
        <div class="stat-box"><div>Nhóm ngành tốt nhất</div><strong>${this.bestSector()}</strong><span>Nhóm có tổng P/L cao nhất</span></div>
      </div>`;
    document.getElementById('weekly-review-note').value = this.data.review.weekly || '';
    document.getElementById('monthly-review-note').value = this.data.review.monthly || '';
    document.getElementById('postmortem-list').innerHTML = losses.slice(0, 3).map(t => `
      <div class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div class="flex justify-between gap-3 mb-3"><div><div class="text-xl font-semibold">${t.symbol}</div><div class="muted text-sm">${t.strategy} · ${t.setup}</div></div>${this.resultChip(t.result)}</div>
        <div class="text-sm text-zinc-600 dark:text-zinc-300">P/L: ${this.fmtMoney(t.pnl)} · Sai lầm: ${t.mistake} · Cảm xúc: ${t.emotion}</div>
      </div>`).join('') || '<div class="text-sm muted">Chưa có lệnh lỗ để hậu kiểm.</div>';
  },

  saveReview() {
    this.data.review.weekly = document.getElementById('weekly-review-note').value;
    this.data.review.monthly = document.getElementById('monthly-review-note').value;
    this.persist();
    alert('Đã lưu review tuần / tháng.');
  },

  refreshSelects() {
    const options = ['<option value="">Chưa chọn</option>'].concat(this.data.patterns.map(p => `<option value="${p.id}">${p.name}</option>`)).join('');
    ['trade-pattern-id', 'watch-pattern-id'].forEach(id => { document.getElementById(id).innerHTML = options; });
  },

  updateMission() {
    document.getElementById('mission-dist').textContent = this.data.market.distDays;
    document.getElementById('mission-risk').textContent = this.marketStateLabel().title;
    document.getElementById('mission-sectors').textContent = this.leadingSectorText();
    document.getElementById('sidebar-breath-bar').style.width = `${Math.max(15, this.data.mindset.calm * 10)}%`;
  },

  prefillTradeFromWatchlist(id) {
    const w = this.data.watchlists.find(x => x.id === id);
    if (!w) return;
    const p = this.getPatternById(w.patternId);
    this.openTradeModal(null, {
      symbol: w.symbol,
      sector: w.sector || '',
      setup: p?.name || '',
      strategy: p?.strategy || '',
      patternId: w.patternId || '',
      note: w.plan || '',
      checklist: (p?.triggers || []).join('\n'),
      marketPulse: this.marketStateLabel().title,
      theoryImage: p?.image || ''
    });
  },

  openPatternFromWatchlist(id) {
    const w = this.data.watchlists.find(x => x.id === id);
    if (!w) return;
    this.switchTab('patterns');
  },

  comparePattern(id) {
    const trade = this.data.trades.find(t => t.patternId === id);
    if (trade) this.state.selectedTradeId = trade.id;
    this.switchTab('journal');
    this.renderTradeDetail();
  },

  openTradeModal(id = null, prefill = {}) {
    this.state.editingTradeId = id;
    const base = id ? this.getTradeById(id) : {
      entryDate: new Date().toISOString().slice(0, 10),
      riskPct: this.data.riskPercent,
      score: 80,
      status: 'open',
      result: 'open',
      emotion: 'Tự tin',
      mistake: 'Không',
      marketPulse: this.marketStateLabel().title
    };
    const src = { ...base, ...prefill };
    const set = (id, v = '') => { document.getElementById(id).value = v ?? ''; };
    set('trade-symbol', src.symbol);
    set('trade-sector', src.sector);
    set('trade-entry-date', src.entryDate);
    set('trade-exit-date', src.exitDate);
    set('trade-strategy', src.strategy);
    set('trade-setup', src.setup);
    set('trade-entry', src.entry);
    set('trade-stop', src.stop);
    set('trade-exit', src.exit);
    set('trade-qty', src.qty);
    set('trade-risk', src.riskPct);
    set('trade-score', src.score);
    set('trade-status', src.status);
    set('trade-result', src.result);
    set('trade-emotion', src.emotion);
    set('trade-mistake', src.mistake);
    set('trade-market-pulse', src.marketPulse);
    set('trade-pattern-id', src.patternId);
    set('trade-checklist', Array.isArray(src.checklist) ? src.checklist.join('\n') : (src.checklist || ''));
    set('trade-note', src.note);
    set('trade-theory-url', src.theoryImage || '');
    set('trade-actual-url', src.actualImage || '');
    document.getElementById('trade-theory-preview').src = this.resolveImage(src.theoryImage || '');
    document.getElementById('trade-actual-preview').src = this.resolveImage(src.actualImage || '');
    document.getElementById('trade-theory-file').value = '';
    document.getElementById('trade-actual-file').value = '';
    document.getElementById('trade-modal-title').textContent = id ? 'Chỉnh sửa lệnh' : 'Tạo lệnh mới';
    document.getElementById('trade-modal').classList.remove('hidden');
  },

  closeTradeModal() { document.getElementById('trade-modal').classList.add('hidden'); },

  async saveTrade() {
    try {
      let theoryImage = document.getElementById('trade-theory-url').value || document.getElementById('trade-theory-preview').src || '';
      let actualImage = document.getElementById('trade-actual-url').value || document.getElementById('trade-actual-preview').src || '';
      const theoryFile = document.getElementById('trade-theory-file').files?.[0];
      const actualFile = document.getElementById('trade-actual-file').files?.[0];
      if (theoryFile) theoryImage = await FirebaseService.uploadFile(this.state.user.uid, theoryFile, 'trades/theory');
      if (actualFile) actualImage = await FirebaseService.uploadFile(this.state.user.uid, actualFile, 'trades/actual');

      const obj = {
        id: this.state.editingTradeId || 't' + Date.now(),
        symbol: document.getElementById('trade-symbol').value.trim(),
        sector: document.getElementById('trade-sector').value.trim(),
        entryDate: document.getElementById('trade-entry-date').value,
        exitDate: document.getElementById('trade-exit-date').value,
        strategy: document.getElementById('trade-strategy').value.trim(),
        setup: document.getElementById('trade-setup').value.trim(),
        entry: Number(document.getElementById('trade-entry').value || 0),
        stop: Number(document.getElementById('trade-stop').value || 0),
        exit: document.getElementById('trade-exit').value ? Number(document.getElementById('trade-exit').value) : null,
        qty: Number(document.getElementById('trade-qty').value || 0),
        riskPct: Number(document.getElementById('trade-risk').value || 0),
        score: Number(document.getElementById('trade-score').value || 0),
        status: document.getElementById('trade-status').value,
        result: document.getElementById('trade-result').value,
        emotion: document.getElementById('trade-emotion').value,
        mistake: document.getElementById('trade-mistake').value,
        marketPulse: document.getElementById('trade-market-pulse').value,
        patternId: document.getElementById('trade-pattern-id').value,
        checklist: document.getElementById('trade-checklist').value.split('\n').map(s => s.trim()).filter(Boolean),
        note: document.getElementById('trade-note').value,
        theoryImage,
        actualImage
      };
      const idx = this.data.trades.findIndex(x => x.id === obj.id);
      if (idx >= 0) this.data.trades[idx] = obj; else this.data.trades.unshift(obj);
      this.recomputeTrades();
      this.persist();
      this.state.selectedTradeId = obj.id;
      this.closeTradeModal();
      this.renderAll();
    } catch (error) {
      console.error(error);
      alert('Không lưu được lệnh: ' + (error.message || error));
    }
  },

  openWatchlistModal(id = null) {
    this.state.editingWatchlistId = id;
    const w = id ? this.data.watchlists.find(x => x.id === id) : { group: 'near', risk: 'Thấp' };
    const set = (id, v = '') => { document.getElementById(id).value = v ?? ''; };
    set('watch-symbol', w.symbol);
    set('watch-group', w.group);
    set('watch-pattern-id', w.patternId);
    set('watch-buy-zone', w.buyZone);
    set('watch-risk', w.risk);
    set('watch-status', w.status);
    set('watch-plan', w.plan);
    document.getElementById('watchlist-modal-title').textContent = id ? 'Chỉnh sửa watchlist' : 'Thêm watchlist';
    document.getElementById('watchlist-modal').classList.remove('hidden');
  },

  closeWatchlistModal() { document.getElementById('watchlist-modal').classList.add('hidden'); },

  saveWatchlist() {
    const patternId = document.getElementById('watch-pattern-id').value;
    const obj = {
      id: this.state.editingWatchlistId || 'w' + Date.now(),
      symbol: document.getElementById('watch-symbol').value.trim(),
      group: document.getElementById('watch-group').value,
      patternId,
      buyZone: document.getElementById('watch-buy-zone').value,
      risk: document.getElementById('watch-risk').value,
      status: document.getElementById('watch-status').value,
      plan: document.getElementById('watch-plan').value,
      sector: this.data.trades.find(t => t.patternId === patternId)?.sector || ''
    };
    const idx = this.data.watchlists.findIndex(x => x.id === obj.id);
    if (idx >= 0) this.data.watchlists[idx] = obj; else this.data.watchlists.unshift(obj);
    this.persist();
    this.closeWatchlistModal();
    this.renderAll();
  },

  deleteWatchlist(id) {
    if (!confirm('Xóa watchlist này?')) return;
    this.data.watchlists = this.data.watchlists.filter(x => x.id !== id);
    this.persist();
    this.renderAll();
  },

  openPatternModal(id = null) {
    this.state.editingPatternId = id;
    const p = id ? this.getPatternById(id) : {};
    const set = (id, v = '') => { document.getElementById(id).value = v ?? ''; };
    set('pattern-name', p?.name);
    set('pattern-strategy', p?.strategy);
    set('pattern-description', p?.description);
    set('pattern-conditions', Array.isArray(p?.conditions) ? p.conditions.join('\n') : '');
    set('pattern-triggers', Array.isArray(p?.triggers) ? p.triggers.join('\n') : '');
    set('pattern-image-url', p?.image);
    document.getElementById('pattern-image-preview').src = this.resolveImage(p?.image || '');
    document.getElementById('pattern-image-file').value = '';
    document.getElementById('pattern-modal-title').textContent = id ? 'Chỉnh sửa mẫu hình' : 'Tạo mẫu hình';
    document.getElementById('pattern-modal').classList.remove('hidden');
  },

  closePatternModal() { document.getElementById('pattern-modal').classList.add('hidden'); },

  async savePattern() {
    try {
      if (!this.state.user) {
        alert('Bạn chưa đăng nhập.');
        return;
      }

      if (!this.data) this.data = this.demo();
      if (!Array.isArray(this.data.patterns)) this.data.patterns = [];

      let patternImage = document.getElementById('pattern-image-url').value?.trim() || document.getElementById('pattern-image-preview').src || '';
      const patternFile = document.getElementById('pattern-image-file').files?.[0];
      if (patternFile) {
        patternImage = await FirebaseService.uploadFile(this.state.user.uid, patternFile, 'patterns');
      }

      const name = document.getElementById('pattern-name').value.trim();
      if (!name) {
        alert('Bạn chưa nhập tên mẫu hình.');
        return;
      }

      const obj = {
        id: this.state.editingPatternId || 'p' + Date.now(),
        name,
        strategy: document.getElementById('pattern-strategy').value.trim(),
        description: document.getElementById('pattern-description').value.trim(),
        conditions: document.getElementById('pattern-conditions').value.split('\n').map(s => s.trim()).filter(Boolean),
        triggers: document.getElementById('pattern-triggers').value.split('\n').map(s => s.trim()).filter(Boolean),
        image: patternImage
      };

      const idx = this.data.patterns.findIndex(x => x.id === obj.id);
      if (idx >= 0) {
        this.data.patterns[idx] = obj;
      } else {
        this.data.patterns.unshift(obj);
      }

      this.saveLocalCache();
      await FirebaseService.saveJournal(this.state.user.uid, this.data);

      this.setSyncStatus('Đã lưu mẫu hình lên Firebase');
      this.closePatternModal();
      this.renderAll();
    } catch (error) {
      console.error(error);
      alert('Không lưu được mẫu hình: ' + (error.message || error));
    }
  },

  async deletePattern(id) {
    if (!confirm('Xóa mẫu hình này?')) return;

    try {
      if (!this.state.user) {
        alert('Bạn chưa đăng nhập.');
        return;
      }

      if (!Array.isArray(this.data.patterns)) this.data.patterns = [];
      this.data.patterns = this.data.patterns.filter(x => x.id !== id);
      this.data.watchlists = this.data.watchlists.map(w => w.patternId === id ? { ...w, patternId: '' } : w);
      this.data.trades = this.data.trades.map(t => t.patternId === id ? { ...t, patternId: '' } : t);

      this.saveLocalCache();
      await FirebaseService.saveJournal(this.state.user.uid, this.data);

      this.setSyncStatus('Đã xóa mẫu hình');
      this.renderAll();
    } catch (error) {
      console.error(error);
      alert('Không xóa được mẫu hình: ' + (error.message || error));
    }
  },

  togglePatternZoom() {
    const src = document.getElementById('pattern-image-preview').src;
    if (src) this.zoomImage(src);
  },

  zoomImage(src) {
    if (!src) return;
    document.getElementById('zoomed-image').src = src;
    document.getElementById('image-zoom-modal').classList.remove('hidden');
  },

  closeImageZoom(e) {
    if (e.target.id === 'image-zoom-modal') document.getElementById('image-zoom-modal').classList.add('hidden');
  },

  handleFilePreview(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (e.target.id === 'trade-theory-file') document.getElementById('trade-theory-preview').src = reader.result;
      if (e.target.id === 'trade-actual-file') document.getElementById('trade-actual-preview').src = reader.result;
      if (e.target.id === 'pattern-image-file') document.getElementById('pattern-image-preview').src = reader.result;
    };
    reader.readAsDataURL(file);
  }
};

const AuthUI = {
  switch(mode) {
    App.state.authMode = mode;
    document.getElementById('auth-tab-login').classList.toggle('active', mode === 'login');
    document.getElementById('auth-tab-register').classList.toggle('active', mode === 'register');
    document.getElementById('auth-name-wrap').style.display = mode === 'register' ? 'grid' : 'none';
    App.showAuthMessage(mode === 'login' ? 'Đăng nhập để đồng bộ dữ liệu cá nhân, ảnh và nhật ký lên Firebase.' : 'Tạo tài khoản mới để mỗi người có dữ liệu riêng trên Firebase.');
  },

  async submit() {
    const name = document.getElementById('auth-name').value.trim();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    try {
      if (!email || !password) throw new Error('Vui lòng nhập email và mật khẩu.');
      if (App.state.authMode === 'register') {
        await App.register(name, email, password);
        App.showAuthMessage('Tạo tài khoản thành công.');
      } else {
        await App.login(email, password);
        App.showAuthMessage('Đăng nhập thành công.');
      }
    } catch (error) {
      console.error(error);
      App.showAuthMessage(error.message || 'Thao tác thất bại.', true);
    }
  },

  async resetPassword() {
    const email = document.getElementById('auth-email').value.trim();
    try {
      if (!email) throw new Error('Vui lòng nhập email để đặt lại mật khẩu.');
      await App.resetPassword(email);
      App.showAuthMessage('Đã gửi email đặt lại mật khẩu.');
    } catch (error) {
      App.showAuthMessage(error.message || 'Không gửi được email đặt lại mật khẩu.', true);
    }
  }
};

window.App = App;
window.AuthUI = AuthUI;
window.addEventListener('DOMContentLoaded', () => App.init());
