/**
 * CACON STOCK PRO - HỆ ĐIỀU HÀNH GIAO DỊCH CHUYÊN NGHIỆP
 * Nâng cấp: Supabase, Scoring 100, Radar 5 Blocks
 */

const STORAGE_KEY = 'cacon-trading-supabase-cache';

const SupabaseService = {
  get ready() {
    return !!window.supabase;
  },

  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async register(name, email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    });
    if (error) throw error;
    return data;
  },

  async logout() {
    await supabase.auth.signOut();
  },

  async loadJournal(uid) {
    const { data, error } = await supabase
      .from('trading_journals')
      .select('payload')
      .eq('id', uid)
      .single();
    if (error && error.code !== 'PGRST116') console.error('Lỗi tải dữ liệu:', error);
    return data ? data.payload : null;
  },

  async saveJournal(uid, payload) {
    const { error } = await supabase
      .from('trading_journals')
      .upsert({ id: uid, payload, updated_at: new Date() });
    if (error) throw error;
  },

  async uploadFile(uid, file, folder) {
    if (!file) return '';
    const fileExt = file.name.split('.').pop();
    const fileName = `${uid}/${folder}/${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from('trading-images')
      .upload(fileName, file);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('trading-images').getPublicUrl(fileName);
    return urlData.publicUrl;
  }
};

const App = {
  state: {
    theme: localStorage.getItem('cacon-theme') || 'dark',
    activeTab: 'dashboard',
    selectedTradeId: null,
    user: null,
    saveTimer: null,
    isSaving: false,
    breathing: { timer: null },
    charts: {}
  },

  // DỮ LIỆU MẪU CHUẨN CHUYÊN GIA
  demo() {
    return {
      accountSize: 1000000000,
      riskPercent: 1,
      patterns: [
        { id: 'p-vcp', name: 'VCP', strategy: 'Minervini', description: 'Co hẹp biên độ nến.', conditions: ['Rủ bỏ cạn vol', 'Độ siết chặt nến'], triggers: ['Pivot xác nhận'], image: 'https://i.imgur.com/K7MvL1s.png' },
        { id: 'p-cup', name: 'Cốc tay cầm', strategy: 'Wyckoff', description: 'Rủ bỏ đáy tròn.', conditions: ['Tay cầm nông vol thấp', 'RS duy trì tốt'], triggers: ['Vượt pivot tay cầm'], image: 'https://i.imgur.com/8WAnwX.png' }
      ],
      watchlists: [
        { ticker: 'SSI', group_name: 'Near Buy', setup_type: 'VCP', buy_point: 40.0, current_price: 39.2, action_status: 'ready', next_trigger: 'Vượt 40.5 vol lớn', thesis: 'Siết chặt quanh MA20', rs_score: 85, volume_score: 90, tightness_score: 80, trend_score: 95, setup_score: 90, market_score: 80, distance_to_buy_pct: -2.0 },
        { ticker: 'MWG', group_name: 'Ưu tiên cao', setup_type: 'Cốc tay cầm', buy_point: 62.0, current_price: 63.8, action_status: 'breakout', next_trigger: 'Gia tăng test đỉnh', thesis: 'Vol bùng nổ x2', rs_score: 92, volume_score: 95, tightness_score: 85, trend_score: 90, setup_score: 95, market_score: 85, distance_to_buy_pct: 2.9 },
        { ticker: 'DGC', group_name: 'Theo dõi', setup_type: 'Nền tuần', buy_point: 115.0, current_price: 108.0, action_status: 'watching', next_trigger: 'Chờ hẹp biên độ', thesis: 'Leader hóa chất', rs_score: 88, volume_score: 70, tightness_score: 60, trend_score: 95, setup_score: 75, market_score: 80, distance_to_buy_pct: -6.0 }
      ],
      trades: [
        { id: 't1', symbol: 'FPT', sector: 'Công nghệ', strategy: 'CANSLIM', setup: 'VCP', entryDate: '2026-03-01', entry: 128.5, stop: 123, exit: 145.0, qty: 1000, status: 'closed', result: 'win', score: 92, note: 'Lệnh lãi lớn nhất tháng', actualImage: '' },
        { id: 't2', symbol: 'CTR', sector: 'Công nghệ', strategy: 'Minervini', setup: 'Tight Flag', entryDate: '2026-03-10', entry: 142.0, stop: 138, exit: null, qty: 500, status: 'open', result: 'open', score: 85, note: 'Đang giữ theo trend', actualImage: '' }
      ],
      market: { distDays: 4, sentiment: 'Thận trọng', sectors: 'Công nghệ, Viễn thông', note: 'Hạ tỷ trọng margin' },
      mindset: { energy: 8, calm: 9, fomo: 2, confidence: 8, breathIn: 4, breathHold: 7, breathOut: 8 },
      review: { weekly: 'Duy trì kỷ luật tốt', monthly: 'Tăng quy mô lệnh A setup' }
    };
  },

  async init() {
    this.data = this.loadLocalCache();
    this.applyTheme(this.state.theme);
    this.bindEvents();
    this.initCharts();
    
    if (SupabaseService.ready) {
      supabase.auth.onAuthStateChange(async (event, session) => {
        const user = session?.user;
        this.state.user = user || null;
        if (!user) {
          this.lockApp(true);
          this.setSyncStatus('Chưa đăng nhập');
        } else {
          this.lockApp(false);
          this.setUserInfo(user);
          this.setSyncStatus('Đang tải dữ liệu...');
          const cloudData = await SupabaseService.loadJournal(user.id);
          this.data = cloudData || this.demo();
          this.recomputeTrades();
          this.renderAll();
          this.setSyncStatus('Đã đồng bộ');
        }
      });
    }
    lucide.createIcons();
  },

  // --- LOGIC CHẤM ĐIỂM 100 ĐIỂM ---
  calculateScore(w) {
    const rs = (w.rs_score || 0) * 0.20;
    const vol = (w.volume_score || 0) * 0.15;
    const tight = (w.tightness_score || 0) * 0.15;
    const trend = (w.trend_score || 0) * 0.15;
    const setup = (w.setup_score || 0) * 0.20;
    const market = (w.market_score || 0) * 0.15;
    return Math.round(rs + vol + tight + trend + setup + market);
  },

  getRank(score) {
    if (score >= 85) return { label: 'Ưu tiên A', class: 'green' };
    if (score >= 70) return { label: 'Ưu tiên B', class: 'amber' };
    return { label: 'Theo dõi', class: 'blue' };
  },

  // --- LOGIC RADAR 5 KHỐI ---
  renderRadar() {
    const containers = {
      near: document.getElementById('radar-near-buy'),
      breakout: document.getElementById('radar-breakout'),
      watch: document.getElementById('radar-watching'),
      failed: document.getElementById('radar-failed'),
      long: document.getElementById('radar-longterm')
    };

    Object.values(containers).forEach(c => c && (c.innerHTML = ''));

    this.data.watchlists.forEach(w => {
      const score = this.calculateScore(w);
      const dist = w.distance_to_buy_pct;
      const cardHtml = `
        <div class="stat-box p-4 space-y-3 border-l-4 ${score >= 85 ? 'border-brand-500' : 'border-zinc-300'} dark:bg-zinc-900/50">
          <div class="flex justify-between font-black">
            <span class="text-lg">${w.ticker}</span>
            <span class="text-xs text-zinc-500">${score} PTS</span>
          </div>
          <div class="text-[10px] text-zinc-500 uppercase">${w.setup_type} · ${w.action_status}</div>
          <div class="grid grid-cols-2 text-xs font-mono">
            <div>Buy: ${w.buy_point}</div>
            <div class="${dist > 0 ? 'text-rose-500' : 'text-brand-600'}">${dist}%</div>
          </div>
          <div class="text-[10px] italic text-zinc-400">Next: ${w.next_trigger}</div>
        </div>`;

      if (w.action_status === 'failed') containers.failed.innerHTML += cardHtml;
      else if (w.action_status === 'breakout') containers.breakout.innerHTML += cardHtml;
      else if (w.group_name === 'Dài hạn') containers.long.innerHTML += cardHtml;
      else if (dist >= -3 && dist <= 2) containers.near.innerHTML += cardHtml;
      else containers.watch.innerHTML += cardHtml;
    });
  },

  renderWatchlistTable() {
    const tbody = document.getElementById('watchlist-table-body');
    if (!tbody) return;
    tbody.innerHTML = this.data.watchlists.map(w => {
      const score = this.calculateScore(w);
      const rank = this.getRank(score);
      return `
        <tr class="hover:bg-zinc-100 dark:hover:bg-zinc-900 transition">
          <td class="font-bold">${w.ticker}</td>
          <td class="text-xs muted">${w.group_name}</td>
          <td><span class="table-chip gray">${w.setup_type}</span></td>
          <td class="font-mono">${w.buy_point}</td>
          <td class="font-mono">${w.current_price}</td>
          <td class="font-mono ${Math.abs(w.distance_to_buy_pct) < 2 ? 'text-brand-600' : ''}">${w.distance_to_buy_pct}%</td>
          <td class="font-bold text-${rank.class}-600">${score}</td>
          <td><span class="badge-soft ${rank.class}">${w.action_status}</span></td>
          <td class="text-xs italic">${w.next_trigger}</td>
        </tr>`;
    }).join('');
  },

  renderDashboard() {
    const closed = this.data.trades.filter(t => t.status === 'closed');
    const wins = closed.filter(t => (t.exit - t.entry) > 0).length;
    const winRate = closed.length ? Math.round((wins / closed.length) * 100) : 0;
    
    document.getElementById('dash-balance').textContent = this.fmtMoney(this.data.accountSize);
    document.getElementById('dash-winrate').textContent = `${winRate}%`;
    document.getElementById('dash-holding').textContent = this.data.trades.filter(t => t.status === 'open').length;
    document.getElementById('dash-priority-a').textContent = this.data.watchlists.filter(w => this.calculateScore(w) >= 85).length;
    
    this.renderRadar();
    this.renderWatchlistTable();
  },

  // HÀM HELPER VÀ ĐỒNG BỘ
  recomputeTrades() {
    // Tự động tính PnL từ danh sách trades
    const closedPnL = this.data.trades
      .filter(t => t.status === 'closed')
      .reduce((sum, t) => sum + (t.exit - t.entry) * t.qty, 0);
    this.data.currentPnL = closedPnL;
  },

  persist() {
    this.saveLocalCache();
    if (this.state.user) {
      clearTimeout(this.state.saveTimer);
      this.setSyncStatus('Chờ lưu...');
      this.state.saveTimer = setTimeout(async () => {
        try {
          await SupabaseService.saveJournal(this.state.user.id, this.data);
          this.setSyncStatus('Đã lưu Cloud');
        } catch (e) { this.setSyncStatus('Lỗi lưu'); }
      }, 1000);
    }
  },

  // COMMON UTILS
  fmtMoney(v) { return `${Math.round(v || 0).toLocaleString('vi-VN')}đ`; },
  loadLocalCache() { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : this.demo(); } catch { return this.demo(); } },
  saveLocalCache() { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); },
  lockApp(locked) { document.querySelector('.app-shell').classList.toggle('app-locked', locked); document.getElementById('auth-overlay').classList.toggle('hidden', !locked); },
  setUserInfo(user) { document.getElementById('sidebar-user-name').textContent = user.user_metadata?.full_name || 'Trader'; document.getElementById('sidebar-user-email').textContent = user.email; },
  setSyncStatus(text) { document.getElementById('sync-status').innerHTML = `<i data-lucide="cloud"></i> ${text}`; lucide.createIcons(); },
  switchTab(tab) {
    this.state.activeTab = tab;
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    const target = document.querySelector(`[data-screen="${tab}"]`);
    if(target) target.classList.remove('hidden');
    document.querySelectorAll('.side-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    document.getElementById('tab-title').textContent = tab.toUpperCase();
    lucide.createIcons();
  },

  bindEvents() {
    document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => this.switchTab(btn.dataset.tab)));
  },

  initCharts() {
    const ctx = document.getElementById('equity-chart-dash')?.getContext('2d');
    if (!ctx) return;
    this.state.charts.equity = new Chart(ctx, {
      type: 'line',
      data: { labels: ['T1', 'T2', 'T3'], datasets: [{ data: [100, 115, 128], borderColor: '#10b981', fill: true, backgroundColor: 'rgba(16,185,129,0.1)' }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
  },

  renderAll() {
    this.renderDashboard();
    this.renderRadar();
    this.renderWatchlistTable();
  }
};

const AuthUI = {
  switch(mode) {
    App.state.authMode = mode;
    document.getElementById('auth-tab-login').classList.toggle('active', mode === 'login');
    document.getElementById('auth-tab-register').classList.toggle('active', mode === 'register');
    document.getElementById('auth-name-wrap').style.display = mode === 'register' ? 'grid' : 'none';
  },
  async submit() {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name').value;
    try {
      if(App.state.authMode === 'register') await SupabaseService.register(name, email, pass);
      else await SupabaseService.login(email, pass);
    } catch(e) { alert(e.message); }
  }
};

window.App = App;
window.AuthUI = AuthUI;
window.addEventListener('DOMContentLoaded', () => App.init());