
const App = {
  sb: null, user: null, authMode: 'login',
  editingTradeId: null, editingWatchId: null, editingPatternId: null,
  tradeTheoryUrl: '', tradeActualUrl: '', patternImageUrl: '',
  data: { trades: [], watchlists: [], patterns: [], market: { dist_days:0, sentiment:'Trung tính', sectors:'', note:'' }, mindset: [], reviews: {} },

  init() {
    this.sb = window.supabaseClient || null;
    this.bindUI();
    this.switchTab('dashboard');
    this.setToday();
    this.updateRangeValues();
    if (!this.sb) return this.toast('Hãy cấu hình Supabase trong supabase.js', true);
    this.sb.auth.onAuthStateChange(async (_e, session) => { await this.handleSession(session); });
    this.sb.auth.getSession().then(({data}) => this.handleSession(data.session));
  },

  bindUI() {
    document.getElementById('auth-tab-login').onclick = () => this.setAuthMode('login');
    document.getElementById('auth-tab-register').onclick = () => this.setAuthMode('register');
    document.getElementById('auth-submit-btn').onclick = () => this.submitAuth();
    document.getElementById('auth-reset-btn').onclick = () => this.resetPassword();
    document.getElementById('logout-btn').onclick = () => this.sb.auth.signOut();
    document.querySelectorAll('.side-btn').forEach(btn => btn.onclick = () => this.switchTab(btn.dataset.tab));
    document.querySelectorAll('[data-go]').forEach(btn => btn.onclick = () => this.switchTab(btn.dataset.go));
    ['btn-open-trade','btn-open-trade-2'].forEach(id => document.getElementById(id).onclick = () => this.openTradeModal());
    document.getElementById('close-trade-modal').onclick = document.getElementById('cancel-trade-modal').onclick = () => this.closeTradeModal();
    document.getElementById('save-trade-modal').onclick = () => this.saveTrade();
    document.getElementById('btn-open-watch').onclick = () => this.openWatchModal();
    document.getElementById('close-watch-modal').onclick = document.getElementById('cancel-watch-modal').onclick = () => this.closeWatchModal();
    document.getElementById('save-watch-modal').onclick = () => this.saveWatchlist();
    document.getElementById('btn-open-pattern').onclick = () => this.openPatternModal();
    document.getElementById('close-pattern-modal').onclick = document.getElementById('cancel-pattern-modal').onclick = () => this.closePatternModal();
    document.getElementById('save-pattern-modal').onclick = () => this.savePattern();
    document.getElementById('btn-save-market').onclick = () => this.saveMarket();
    document.getElementById('btn-calc-sizing').onclick = () => this.calcSizing();
    document.getElementById('btn-save-mindset').onclick = () => this.saveMindset();
    document.getElementById('btn-save-review').onclick = () => this.saveReview();
    ['energy-input','calm-input','fomo-input','confidence-input'].forEach(id => document.getElementById(id).oninput = () => this.updateRangeValues());
    ['filter-status','filter-result','filter-quality','filter-tag','global-search'].forEach(id => document.getElementById(id).oninput = () => this.renderJournal());
    document.getElementById('trade-theory-file').onchange = e => this.previewFile(e, 'trade-theory-preview');
    document.getElementById('trade-actual-file').onchange = e => this.previewFile(e, 'trade-actual-preview');
    document.getElementById('pattern-image-file').onchange = e => this.previewFile(e, 'pattern-image-preview');
  },

  toast(msg, isError = false) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `fixed top-4 right-4 z-[100] rounded-2xl border px-4 py-3 text-sm font-medium shadow-soft ${isError ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-white text-brand-700 border-brand-200'}`;
    el.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.add('hidden'), 2500);
  },

  setAuthMode(mode) {
    this.authMode = mode;
    document.getElementById('auth-name-wrap').classList.toggle('hidden', mode !== 'register');
    document.getElementById('auth-tab-login').classList.toggle('active', mode === 'login');
    document.getElementById('auth-tab-register').classList.toggle('active', mode === 'register');
    document.getElementById('auth-submit-btn').textContent = mode === 'login' ? 'Vào hệ thống' : 'Tạo tài khoản';
    this.setAuthMessage('');
  },
  setAuthMessage(msg, isError = false) {
    const el = document.getElementById('auth-message');
    el.textContent = msg || '';
    el.className = isError ? 'mt-4 min-h-[20px] text-sm text-rose-600' : 'mt-4 min-h-[20px] text-sm text-slate-500';
  },
  async submitAuth() {
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const pass = document.getElementById('login-pass').value.trim();
    const name = document.getElementById('auth-name').value.trim();
    try {
      if (!email || !pass) throw new Error('Vui lòng nhập email và mật khẩu.');
      if (this.authMode === 'register') {
        const { error } = await this.sb.auth.signUp({ email, password: pass, options: { data: { full_name: name || email.split('@')[0] } } });
        if (error) throw error;
        this.setAuthMessage('Đã tạo tài khoản. Kiểm tra email nếu dự án bật xác minh email.');
      } else {
        const { error } = await this.sb.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
      }
    } catch (e) { this.setAuthMessage(e.message || 'Không thể thực hiện thao tác.', true); }
  },
  async resetPassword() {
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    if (!email) return this.setAuthMessage('Nhập email để đặt lại mật khẩu.', true);
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
    if (error) this.setAuthMessage(error.message, true); else this.setAuthMessage('Đã gửi email đặt lại mật khẩu.');
  },
  async handleSession(session) {
    if (!session?.user) {
      this.user = null;
      document.getElementById('login-modal').classList.remove('hidden');
      document.getElementById('sync-status').textContent = 'Chưa đăng nhập';
      return;
    }
    this.user = session.user;
    document.getElementById('login-modal').classList.add('hidden');
    document.getElementById('sidebar-user-name').textContent = this.user.user_metadata?.full_name || this.user.email.split('@')[0];
    document.getElementById('sync-status').textContent = 'Đang đồng bộ...';
    await this.ensureProfile();
    await this.ensureSeedData();
    await this.loadAll();
    document.getElementById('sync-status').textContent = 'Đã đồng bộ';
  },

  async ensureProfile() {
    await this.sb.from('profiles').upsert({ id: this.user.id, email: this.user.email, name: this.user.user_metadata?.full_name || this.user.email.split('@')[0], role: 'user' }, { onConflict: 'id' });
  },

  async ensureSeedData() {
    const patterns = await this.sb.from('patterns').select('id,name').eq('user_id', this.user.id);
    if (!patterns.data?.length) {
      await this.sb.from('patterns').insert([
        { user_id: this.user.id, name:'VCP', strategy:'Mark Minervini', description:'Mẫu hình co hẹp biên độ sau nhịp tăng tốt.', conditions:'Xu hướng trước đó tăng mạnh\nBiên độ co hẹp dần\nVolume giảm dần trong nền', triggers:'Breakout khỏi nền\nVolume xác nhận', image_url:'' },
        { user_id: this.user.id, name:'Tight Flag', strategy:'CANSLIM', description:'Nghỉ ngắn, cờ hẹp, khối lượng co lại trước khi tiếp diễn.', conditions:'Có thrust mạnh trước đó\nLá cờ hẹp\nKhông gãy MA ngắn hạn', triggers:'Vượt đỉnh lá cờ\nVolume cải thiện', image_url:'' }
      ]);
    }
    const watchCount = await this.sb.from('watchlists').select('id', {count:'exact', head:true}).eq('user_id', this.user.id);
    if (!watchCount.count) {
      const pats = (await this.sb.from('patterns').select('*').eq('user_id', this.user.id)).data || [];
      const vcp = pats.find(x=>x.name==='VCP'); const tight = pats.find(x=>x.name==='Tight Flag');
      await this.sb.from('watchlists').insert([
        { user_id:this.user.id, symbol:'MWG', group_name:'near', buy_zone:'61.5 - 62.2', risk:'Thấp', pattern_id:vcp?.id || null, pattern_name:'VCP', status:'Gần điểm mua', plan:'Canh breakout với volume xác nhận.' },
        { user_id:this.user.id, symbol:'CTR', group_name:'watch', buy_zone:'96.0 - 97.5', risk:'Trung bình', pattern_id:tight?.id || null, pattern_name:'Tight Flag', status:'Theo dõi', plan:'Chờ tích lũy thêm trước khi vào lệnh.' },
        { user_id:this.user.id, symbol:'FPT', group_name:'long', buy_zone:'128 - 132', risk:'Thấp', pattern_id:vcp?.id || null, pattern_name:'VCP', status:'Giữ nền dài hạn', plan:'Ưu tiên canh gia tăng khi nền đủ chặt.' }
      ]);
    }
    const tradeCount = await this.sb.from('trades').select('id', {count:'exact', head:true}).eq('user_id', this.user.id);
    if (!tradeCount.count) {
      await this.sb.from('trades').insert([
        { user_id:this.user.id, ticker:'SSI', date:'2026-03-11', strategy:'Wyckoff', setup:'Cốc tay cầm', sector:'Chứng khoán', entry:39.6, stop:37.9, pnl:7.07, r:1.65, quality:'A+', execution:'Planned', result:'win', status:'closed', mistake:'Không', note:'Lệnh đúng kế hoạch.' },
        { user_id:this.user.id, ticker:'DGC', date:'2026-03-07', strategy:'CANSLIM', setup:'Tight Flag', sector:'Hóa chất', entry:112, stop:108.5, pnl:0, r:0, quality:'B', execution:'Tracking', result:'open', status:'open', mistake:'Bán non', note:'Đang theo dõi thêm.' },
        { user_id:this.user.id, ticker:'HPG', date:'2026-03-05', strategy:'Price Action', setup:'Breakout nền giá', sector:'Thép', entry:31.2, stop:29.8, pnl:-3.53, r:-0.79, quality:'C', execution:'Deviation', result:'loss', status:'closed', mistake:'Gồng lỗ', note:'Vào lệnh hơi sớm.' }
      ]);
    }
    const market = await this.sb.from('settings').select('*').eq('user_id', this.user.id).maybeSingle();
    if (!market.data) await this.sb.from('settings').insert({ user_id:this.user.id, dist_days:4, sentiment:'Trung tính', sectors:'Chứng khoán, Công nghệ', note:'Giảm margin nhẹ, ưu tiên setup rõ ràng.' });
    const mindset = await this.sb.from('mindset').select('id', {count:'exact', head:true}).eq('user_id', this.user.id);
    if (!mindset.count) await this.sb.from('mindset').insert({ user_id:this.user.id, energy:7, calm:8, fomo:4, confidence:6, note:'Chỉ chọn A/B setup. Không mua đuổi quá 2%.' });
    const review = await this.sb.from('reviews').select('*').eq('user_id', this.user.id).maybeSingle();
    if (!review.data) await this.sb.from('reviews').insert({ user_id:this.user.id, weekly_note:'Tuần này điểm mạnh là kiên nhẫn chờ setup.', monthly_note:'Tháng này A-setup cho hiệu quả tốt nhất.' });
  },

  async loadAll() {
    this.data.patterns = (await this.sb.from('patterns').select('*').eq('user_id', this.user.id).order('created_at',{ascending:false})).data || [];
    this.data.watchlists = (await this.sb.from('watchlists').select('*').eq('user_id', this.user.id).order('created_at',{ascending:false})).data || [];
    this.data.trades = (await this.sb.from('trades').select('*').eq('user_id', this.user.id).order('date',{ascending:false})).data || [];
    this.data.market = (await this.sb.from('settings').select('*').eq('user_id', this.user.id).maybeSingle()).data || {dist_days:0,sentiment:'Trung tính',sectors:'',note:''};
    this.data.mindset = (await this.sb.from('mindset').select('*').eq('user_id', this.user.id).order('created_at',{ascending:false}).limit(10)).data || [];
    this.data.reviews = (await this.sb.from('reviews').select('*').eq('user_id', this.user.id).maybeSingle()).data || {};
    this.fillPatternSelectors(); this.renderDashboard(); this.renderWatchlists(); this.renderJournal(); this.renderPatterns(); this.renderMarket(); this.renderMindsetHistory(); this.renderReview();
  },

  fillPatternSelectors() {
    const opts = ['<option value="">Chưa liên kết</option>'].concat(this.data.patterns.map(p=>`<option value="${p.id}">${p.name}</option>`));
    document.getElementById('trade-pattern-id').innerHTML = opts.join('');
    document.getElementById('watch-pattern-id').innerHTML = opts.join('');
  },

  previewFile(e, targetId) {
    const file = e.target.files?.[0]; const box = document.getElementById(targetId);
    if (!file) return box.innerHTML = 'Chưa chọn ảnh';
    box.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="preview">`;
  },
  async uploadFile(file, folder) {
    if (!file) return '';
    const ext = file.name.split('.').pop();
    const path = `${this.user.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await this.sb.storage.from(window.SUPABASE_BUCKET).upload(path, file);
    if (error) throw error;
    return this.sb.storage.from(window.SUPABASE_BUCKET).getPublicUrl(path).data.publicUrl;
  },

  switchTab(tabId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    document.querySelector(`[data-screen="${tabId}"]`).classList.remove('hidden');
    document.querySelectorAll('.side-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
  },
  setToday() { document.getElementById('trade-entry-date').value = new Date().toISOString().slice(0,10); },
  updateRangeValues() { ['energy','calm','fomo','confidence'].forEach(k => document.getElementById(`${k}-value`).textContent = `${document.getElementById(`${k}-input`).value}/10`); },

  stockExposure(){ return Math.min(100, this.data.trades.filter(t=>t.status==='open').length*25); },
  topMistake(){ const f={}; this.data.trades.forEach(t=>{const k=(t.mistake||'').trim(); if(!k||k==='Không') return; f[k]=(f[k]||0)+1;}); return Object.entries(f).sort((a,b)=>b[1]-a[1])[0]?.[0]||''; },
  bestSector(){ const f={}; this.data.trades.filter(t=>t.result==='win').forEach(t=>{const k=t.sector||'Khác'; f[k]=(f[k]||0)+Number(t.pnl||0);}); return Object.entries(f).sort((a,b)=>b[1]-a[1])[0]?.[0]||''; },
  expectancy(){ const c=this.data.trades.filter(t=>t.result!=='open'); if(!c.length)return 0; const wins=c.filter(t=>t.result==='win'), losses=c.filter(t=>t.result==='loss'); const w=wins.length/c.length, l=losses.length/c.length; const avgW=wins.length?wins.reduce((s,t)=>s+Number(t.r||0),0)/wins.length:0; const avgL=losses.length?Math.abs(losses.reduce((s,t)=>s+Number(t.r||0),0)/losses.length):0; return (w*avgW)-(l*avgL); },
  bestDay(){ const f={}; this.data.trades.forEach(t=>{if(!t.date)return; const d=new Date(t.date).toLocaleDateString('vi-VN',{weekday:'long'}); f[d]=(f[d]||0)+Number(t.pnl||0);}); return Object.entries(f).sort((a,b)=>b[1]-a[1])[0]?.[0]||''; },
  marketMode(days){ days=Number(days||0); if(days<=2)return 'Bình thường'; if(days===3)return 'Giảm margin'; if(days===4)return 'Giảm tỷ trọng'; return 'Ưu tiên tiền mặt'; },
  marketActionText(days){ days=Number(days||0); if(days<=2)return 'Có thể hành động bình thường với setup đạt tiêu chuẩn.'; if(days===3)return 'Giảm margin, chọn lọc kỹ setup.'; if(days===4)return 'Giảm tỷ trọng, ưu tiên cổ phiếu mạnh nhất.'; return 'Tập trung phòng thủ, hạn chế mở vị thế mới.'; },
  buildAlerts(){ const a=[]; if((this.data.market.dist_days||0)>=5)a.push('Số ngày phân phối cao, ưu tiên tiền mặt và giảm tần suất giao dịch.'); const m=this.topMistake(); if(m)a.push(`Sai lầm lặp lại: ${m}. Cần đưa vào rule quản trị.`); if(this.data.trades.filter(t=>t.status==='open').length>3)a.push('Số lệnh mở đang cao, cần kiểm soát tổng mức rủi ro.'); return a; },
  qualityBadgeClass(q){ if(q==='A+'||q==='A')return 'qA'; if(q==='B')return 'qB'; return 'qC'; },
  watchGroupLabel(g){ return g==='near'?'Near Entry':g==='watch'?'Tracking':'Position / Swing'; },
  toLines(text){ return (text||'').split('\n').map(x=>x.trim()).filter(Boolean); },

  renderDashboard() {
    const trades=this.data.trades, closed=trades.filter(t=>t.result!=='open'), wins=closed.filter(t=>t.result==='win');
    const totalPnlPct=trades.reduce((s,t)=>s+Number(t.pnl||0),0), avgR=closed.length?closed.reduce((s,t)=>s+Number(t.r||0),0)/closed.length:0;
    const qMap={'A+':4,'A':3,'B':2,'C':1}; const qAvg=trades.length?trades.reduce((s,t)=>s+(qMap[t.quality]||0),0)/trades.length:0;
    const avgQuality=qAvg>=3.5?'A+':qAvg>=2.5?'A':qAvg>=1.5?'B':'C'; const mode=this.marketMode(this.data.market.dist_days);
    document.getElementById('sidebar-market-mode').textContent=mode;
    const kpis=[
      {label:'Market Pulse',value:`Tỷ cổ phiếu ${this.stockExposure()}%`,sub:`${this.data.market.dist_days||0} ngày phân phối · ${this.data.market.sectors||'—'}`},
      {label:'Watchlist khả dụng',value:String(this.data.watchlists.filter(x=>x.group_name==='near').length).padStart(2,'0'),sub:'Cơ hội gần điểm mua hôm nay'},
      {label:'Win rate',value:`${closed.length?((wins.length/closed.length)*100).toFixed(1):'0'}%`,sub:`${wins.length} thắng / ${closed.filter(t=>t.result==='loss').length} thua / ${trades.filter(t=>t.result==='open').length} đang mở`},
      {label:'Trade Quality',value:avgQuality,sub:'Điểm trung bình quality score'},
      {label:'Risk cảnh báo',value:String(this.buildAlerts().length).padStart(2,'0'),sub:'Lệnh có dấu hiệu lệch kế hoạch'},
      {label:'Average R',value:`${avgR.toFixed(2)}R`,sub:`Tổng P/L ${totalPnlPct.toFixed(2)}%`}
    ];
    document.getElementById('dashboard-kpis').innerHTML = kpis.map(k=>`<div class="kpi-card"><div class="kpi-label">${k.label}</div><div class="kpi-value">${k.value}</div><div class="kpi-sub">${k.sub}</div></div>`).join('');
    this.renderMiniList('dash-near-list', this.data.watchlists.filter(x=>x.group_name==='near'));
    this.renderMiniList('dash-watch-list', this.data.watchlists.filter(x=>x.group_name==='watch'));
    this.renderMiniList('dash-long-list', this.data.watchlists.filter(x=>x.group_name==='long'));
    document.getElementById('dash-count-near').textContent=this.data.watchlists.filter(x=>x.group_name==='near').length;
    document.getElementById('dash-count-watch').textContent=this.data.watchlists.filter(x=>x.group_name==='watch').length;
    document.getElementById('dash-count-long').textContent=this.data.watchlists.filter(x=>x.group_name==='long').length;
    document.getElementById('dashboard-insights').innerHTML=[
      {label:'Sai lầm lặp lại',value:this.topMistake()||'Không',extra:'Lỗi cần ưu tiên chặn bằng rule'},
      {label:'Nhóm ngành tốt nhất',value:this.bestSector()||'Chưa đủ dữ liệu',extra:'Nhóm có tổng P/L cao nhất'},
      {label:'Expectancy',value:this.expectancy().toFixed(2),extra:'Kỳ vọng trung bình theo R'},
      {label:'Market mode',value:mode,extra:this.marketActionText(this.data.market.dist_days)}
    ].map(i=>`<div class="insight-card"><div class="label">${i.label}</div><div class="value">${i.value}</div><div class="text-sm text-slate-500 mt-2">${i.extra}</div></div>`).join('');
    document.getElementById('dashboard-alerts').innerHTML=this.buildAlerts().map(a=>`<div class="mini-row"><span>${a}</span></div>`).join('')||'<div class="text-sm text-slate-500">Không có cảnh báo đáng chú ý.</div>';
  },
  renderMiniList(target, rows){document.getElementById(target).innerHTML=rows.slice(0,4).map(r=>`<div class="mini-row"><span>${r.symbol} · ${r.buy_zone||'—'}</span><strong>${r.risk||'—'}</strong></div>`).join('')||'<div class="text-sm text-slate-500">Không có dữ liệu.</div>';},
  renderWatchlists(){const g={near:this.data.watchlists.filter(x=>x.group_name==='near'),watch:this.data.watchlists.filter(x=>x.group_name==='watch'),long:this.data.watchlists.filter(x=>x.group_name==='long')}; document.getElementById('scan-count-near').textContent=g.near.length; document.getElementById('scan-count-watch').textContent=g.watch.length; document.getElementById('scan-count-long').textContent=g.long.length; this.renderWatchGroup('scan-near-list',g.near); this.renderWatchGroup('scan-watch-list',g.watch); this.renderWatchGroup('scan-long-list',g.long);},
  renderWatchGroup(target, rows){document.getElementById(target).innerHTML=rows.map(w=>`<div class="watch-card"><div class="flex items-start justify-between gap-3 mb-3"><div><div class="text-3xl font-black">${w.symbol}</div><div class="text-sm text-slate-500">${w.pattern_name||'Chưa liên kết setup'}</div></div><span class="badge ${w.group_name}">${this.watchGroupLabel(w.group_name)}</span></div><div class="grid gap-2 text-sm"><div class="mini-row"><span>Buy zone</span><strong>${w.buy_zone||'—'}</strong></div><div class="mini-row"><span>Risk</span><strong>${w.risk||'—'}</strong></div><div class="mini-row"><span>Trạng thái</span><strong>${w.status||'—'}</strong></div></div><div class="mt-3 text-sm text-slate-600">${w.plan||'—'}</div><div class="mt-4 flex flex-wrap gap-2"><button class="btn btn-primary" onclick="App.openTradeFromWatchlist('${w.id}')">Tạo lệnh</button><button class="btn btn-secondary" onclick="App.editWatchlist('${w.id}')">Sửa</button><button class="btn btn-secondary" onclick="App.deleteWatchlist('${w.id}')">Xóa</button></div></div>`).join('')||'<div class="text-sm text-slate-500">Không có mã trong nhóm này.</div>';},
  openTradeFromWatchlist(id){const item=this.data.watchlists.find(x=>x.id===id); if(!item)return; this.openTradeModal(); document.getElementById('trade-symbol').value=item.symbol||''; document.getElementById('trade-setup').value=item.pattern_name||''; document.getElementById('trade-pattern-id').value=item.pattern_id||''; document.getElementById('trade-note').value=item.plan||''; this.switchTab('journal');},
  renderJournal(){const status=document.getElementById('filter-status').value, result=document.getElementById('filter-result').value, quality=document.getElementById('filter-quality').value, tag=document.getElementById('filter-tag').value.trim().toLowerCase(), gs=document.getElementById('global-search').value.trim().toLowerCase(); const rows=this.data.trades.filter(t=>{const txt=[t.ticker,t.setup,t.strategy,t.sector,t.execution,t.mistake].join(' ').toLowerCase(); return (status==='all'||t.status===status)&&(result==='all'||t.result===result)&&(quality==='all'||t.quality===quality)&&(!tag||txt.includes(tag))&&(!gs||txt.includes(gs));}); document.getElementById('journal-table-body').innerHTML=rows.map(t=>`<tr><td class="font-bold">${t.ticker||''}</td><td>${t.date||''}</td><td>${t.strategy||''}</td><td>${t.setup||''}</td><td>${t.sector||''}</td><td>${t.entry??''}</td><td>${t.stop??''}</td><td class="${Number(t.pnl||0)>=0?'text-brand-700':'text-rose-600'}">${Number(t.pnl||0).toFixed(2)}%</td><td>${Number(t.r||0).toFixed(2)}R</td><td><span class="badge ${this.qualityBadgeClass(t.quality)}">${t.quality||'—'}</span></td><td>${t.execution||'—'}</td><td><span class="badge ${t.result||'open'}">${t.result||'open'}</span></td><td>${t.mistake||'Không'}</td><td>${t.theory_chart_url||t.actual_chart_url?'<span class="text-brand-700 font-semibold">Có ảnh</span>':'<span class="text-slate-400">—</span>'}</td><td><button class="btn btn-secondary" onclick="App.editTrade('${t.id}')">Sửa</button><button class="btn btn-secondary ml-2" onclick="App.deleteTrade('${t.id}')">Xóa</button></td></tr>`).join('')||'<tr><td colspan="15" class="text-slate-500">Chưa có dữ liệu giao dịch.</td></tr>';},
  renderPatterns(){document.getElementById('pattern-grid').innerHTML=this.data.patterns.map(p=>`<div class="pattern-card"><div class="flex items-start justify-between gap-3 mb-4"><div><div class="text-3xl font-black">${p.name}</div><div class="text-sm text-slate-500">${p.strategy}</div></div><div class="flex gap-2"><button class="btn btn-secondary" onclick="App.editPattern('${p.id}')">Sửa</button><button class="btn btn-secondary" onclick="App.deletePattern('${p.id}')">Xóa</button></div></div>${p.image_url?`<div class="mb-4 rounded-2xl overflow-hidden border border-slate-200"><img src="${p.image_url}" class="w-full h-48 object-cover"></div>`:''}<div class="text-slate-700 mb-4">${p.description||'—'}</div><div class="sub-head"><span>Điều kiện nền</span></div><div class="stack-sm">${this.toLines(p.conditions).map(line=>`<div class="mini-row"><span>${line}</span><strong>Đạt</strong></div>`).join('')||'<div class="text-sm text-slate-500">Chưa có điều kiện.</div>'}</div><div class="sub-head mt-5"><span>Điều kiện kích hoạt</span></div><div class="stack-sm">${this.toLines(p.triggers).map(line=>`<div class="mini-row"><span>${line}</span><strong>Check</strong></div>`).join('')||'<div class="text-sm text-slate-500">Chưa có trigger.</div>'}</div></div>`).join('')||'<div class="text-sm text-slate-500">Chưa có setup playbook.</div>';},
  renderMarket(){document.getElementById('market-dist-input').value=this.data.market.dist_days??0; document.getElementById('market-sentiment-input').value=this.data.market.sentiment||'Trung tính'; document.getElementById('market-sectors-input').value=this.data.market.sectors||''; document.getElementById('market-note-input').value=this.data.market.note||''; const mode=this.marketMode(this.data.market.dist_days); document.getElementById('sidebar-market-mode').textContent=mode; document.getElementById('market-state-box').innerHTML=`<div class="mini-row"><span>Số ngày phân phối</span><strong>${this.data.market.dist_days??0}</strong></div><div class="mini-row"><span>Tâm lý thị trường</span><strong>${this.data.market.sentiment||'—'}</strong></div><div class="mini-row"><span>Ngành dẫn dắt</span><strong>${this.data.market.sectors||'—'}</strong></div><div class="mini-row"><span>Hành động</span><strong>${mode}</strong></div><div class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">${this.marketActionText(this.data.market.dist_days)}</div>`;},
  renderMindsetHistory(){document.getElementById('mindset-history').innerHTML=this.data.mindset.map(m=>`<div class="mini-row"><div><div class="font-bold">${new Date(m.created_at).toLocaleString('vi-VN')}</div><div class="text-sm text-slate-500">Năng lượng ${m.energy}/10 · Bình tĩnh ${m.calm}/10 · FOMO ${m.fomo}/10 · Tự tin ${m.confidence}/10</div></div></div>`).join('')||'<div class="text-sm text-slate-500">Chưa có dữ liệu check-in.</div>';},
  renderReview(){const closed=this.data.trades.filter(t=>t.result!=='open'); const totalPnl=closed.reduce((s,t)=>s+Number(t.pnl||0),0); document.getElementById('review-summary').innerHTML=[{label:'Tổng lệnh đã đóng',value:`${closed.length} lệnh`,extra:`${closed.filter(x=>x.result==='win').length} thắng / ${closed.filter(x=>x.result==='loss').length} thua`},{label:'Lợi nhuận ròng',value:`${totalPnl.toFixed(2)}%`,extra:'Tổng hợp từ nhật ký'},{label:'Ngày giao dịch hiệu quả',value:this.bestDay()||'—',extra:'Ngày có expectancy tốt nhất'},{label:'Nhóm ngành tốt nhất',value:this.bestSector()||'—',extra:'Nhóm có tổng P/L cao nhất'},{label:'Sai lầm lặp lại',value:this.topMistake()||'Không',extra:'Cần viết rule chặn lỗi'},{label:'Lệnh mở hiện tại',value:`${this.data.trades.filter(t=>t.status==='open').length} lệnh`,extra:'Ưu tiên follow-up theo kế hoạch'}].map(x=>`<div class="insight-card"><div class="label">${x.label}</div><div class="value">${x.value}</div><div class="text-sm text-slate-500 mt-2">${x.extra}</div></div>`).join(''); document.getElementById('weekly-review-note').value=this.data.reviews.weekly_note||''; document.getElementById('monthly-review-note').value=this.data.reviews.monthly_note||''; const losses=[...closed].filter(t=>t.result==='loss').sort((a,b)=>Number(a.pnl)-Number(b.pnl)).slice(0,3); document.getElementById('postmortem-list').innerHTML=losses.map(t=>`<div class="watch-card"><div class="flex items-center justify-between gap-3 mb-2"><div class="text-2xl font-black">${t.ticker}</div><span class="badge loss">Lỗ</span></div><div class="text-sm text-slate-600">${t.strategy} · ${t.setup}</div><div class="mt-2 text-sm">P/L: <strong>${Number(t.pnl).toFixed(2)}%</strong> · Sai lầm: <strong>${t.mistake||'Không'}</strong></div></div>`).join('')||'<div class="text-sm text-slate-500">Chưa có dữ liệu hậu kiểm.</div>';},
  calcSizing(){const acc=Number(document.getElementById('sizing-account').value||0), riskPct=Number(document.getElementById('sizing-risk').value||0), entry=Number(document.getElementById('sizing-entry').value||0), stop=Number(document.getElementById('sizing-stop').value||0), riskAmount=acc*(riskPct/100), perShare=Math.abs(entry-stop), qty=perShare>0?Math.floor(riskAmount/perShare):0, pos=qty*entry; document.getElementById('sizing-result').innerHTML=`<div class="mini-row"><span>Rủi ro tối đa</span><strong>${riskAmount.toLocaleString('vi-VN')}đ</strong></div><div class="mini-row"><span>Rủi ro / cổ phiếu</span><strong>${perShare.toLocaleString('vi-VN')}</strong></div><div class="mini-row"><span>Số lượng tối đa</span><strong>${qty.toLocaleString('vi-VN')}</strong></div><div class="mini-row"><span>Giá trị vị thế</span><strong>${pos.toLocaleString('vi-VN')}đ</strong></div><div class="mini-row"><span>% vốn sử dụng</span><strong>${acc?((pos/acc)*100).toFixed(1):0}%</strong></div>`;},
  async saveMarket(){await this.sb.from('settings').upsert({user_id:this.user.id,dist_days:Number(document.getElementById('market-dist-input').value||0),sentiment:document.getElementById('market-sentiment-input').value,sectors:document.getElementById('market-sectors-input').value.trim(),note:document.getElementById('market-note-input').value.trim()},{onConflict:'user_id'}); await this.loadAll(); this.toast('Đã lưu đánh giá thị trường.');},
  async saveMindset(){await this.sb.from('mindset').insert({user_id:this.user.id,energy:Number(document.getElementById('energy-input').value||0),calm:Number(document.getElementById('calm-input').value||0),fomo:Number(document.getElementById('fomo-input').value||0),confidence:Number(document.getElementById('confidence-input').value||0),note:document.getElementById('preflight-note').value.trim()}); await this.loadAll(); this.toast('Đã lưu check-in tâm lý.');},
  async saveReview(){await this.sb.from('reviews').upsert({user_id:this.user.id,weekly_note:document.getElementById('weekly-review-note').value.trim(),monthly_note:document.getElementById('monthly-review-note').value.trim()},{onConflict:'user_id'}); await this.loadAll(); this.toast('Đã lưu review.');},
  openTradeModal(){this.editingTradeId=null; this.tradeTheoryUrl=''; this.tradeActualUrl=''; document.getElementById('trade-modal-title').textContent='Tạo lệnh mới'; ['trade-symbol','trade-sector','trade-strategy','trade-setup','trade-entry','trade-stop','trade-pl','trade-r','trade-mistake','trade-note'].forEach(id=>document.getElementById(id).value=''); document.getElementById('trade-entry-date').value=new Date().toISOString().slice(0,10); document.getElementById('trade-status').value='open'; document.getElementById('trade-result').value='open'; document.getElementById('trade-quality').value='A'; document.getElementById('trade-execution').value='Planned'; document.getElementById('trade-pattern-id').value=''; document.getElementById('trade-theory-file').value=''; document.getElementById('trade-actual-file').value=''; document.getElementById('trade-theory-preview').innerHTML='Chưa chọn ảnh'; document.getElementById('trade-actual-preview').innerHTML='Chưa chọn ảnh'; document.getElementById('trade-modal').classList.remove('hidden');},
  closeTradeModal(){document.getElementById('trade-modal').classList.add('hidden'); this.editingTradeId=null;},
  editTrade(id){const t=this.data.trades.find(x=>x.id===id); if(!t)return; this.editingTradeId=id; this.tradeTheoryUrl=t.theory_chart_url||''; this.tradeActualUrl=t.actual_chart_url||''; document.getElementById('trade-modal-title').textContent='Chỉnh sửa lệnh'; document.getElementById('trade-symbol').value=t.ticker||''; document.getElementById('trade-sector').value=t.sector||''; document.getElementById('trade-entry-date').value=t.date||''; document.getElementById('trade-strategy').value=t.strategy||''; document.getElementById('trade-setup').value=t.setup||''; document.getElementById('trade-pattern-id').value=t.pattern_id||''; document.getElementById('trade-entry').value=t.entry??''; document.getElementById('trade-stop').value=t.stop??''; document.getElementById('trade-pl').value=t.pnl??''; document.getElementById('trade-r').value=t.r??''; document.getElementById('trade-status').value=t.status||'open'; document.getElementById('trade-result').value=t.result||'open'; document.getElementById('trade-quality').value=t.quality||'A'; document.getElementById('trade-execution').value=t.execution||'Planned'; document.getElementById('trade-mistake').value=t.mistake||''; document.getElementById('trade-note').value=t.note||''; document.getElementById('trade-theory-preview').innerHTML=t.theory_chart_url?`<img src="${t.theory_chart_url}">`:'Chưa có ảnh'; document.getElementById('trade-actual-preview').innerHTML=t.actual_chart_url?`<img src="${t.actual_chart_url}">`:'Chưa có ảnh'; document.getElementById('trade-modal').classList.remove('hidden');},
  async saveTrade(){try{const theory=document.getElementById('trade-theory-file').files?.[0], actual=document.getElementById('trade-actual-file').files?.[0]; if(theory)this.tradeTheoryUrl=await this.uploadFile(theory,'trade-theory'); if(actual)this.tradeActualUrl=await this.uploadFile(actual,'trade-actual'); const patternId=document.getElementById('trade-pattern-id').value, linked=this.data.patterns.find(p=>p.id===patternId); const payload={user_id:this.user.id,ticker:document.getElementById('trade-symbol').value.trim().toUpperCase(),sector:document.getElementById('trade-sector').value.trim(),date:document.getElementById('trade-entry-date').value,strategy:document.getElementById('trade-strategy').value.trim(),setup:document.getElementById('trade-setup').value.trim()||linked?.name||'',pattern_id:patternId||null,entry:Number(document.getElementById('trade-entry').value||0),stop:Number(document.getElementById('trade-stop').value||0),pnl:Number(document.getElementById('trade-pl').value||0),r:Number(document.getElementById('trade-r').value||0),status:document.getElementById('trade-status').value,result:document.getElementById('trade-result').value,quality:document.getElementById('trade-quality').value,execution:document.getElementById('trade-execution').value,mistake:document.getElementById('trade-mistake').value.trim()||'Không',note:document.getElementById('trade-note').value.trim(),theory_chart_url:this.tradeTheoryUrl||'',actual_chart_url:this.tradeActualUrl||''}; if(this.editingTradeId) await this.sb.from('trades').update(payload).eq('id',this.editingTradeId); else await this.sb.from('trades').insert(payload); await this.loadAll(); this.closeTradeModal(); this.toast(this.editingTradeId?'Đã cập nhật lệnh.':'Đã lưu lệnh.');}catch(e){this.toast(e.message||'Không lưu được lệnh.',true);}},
  async deleteTrade(id){if(!confirm('Xóa lệnh này?'))return; await this.sb.from('trades').delete().eq('id',id); await this.loadAll(); this.toast('Đã xóa lệnh.');},
  openWatchModal(){this.editingWatchId=null; document.getElementById('watchlist-modal-title').textContent='Thêm watchlist'; ['watch-symbol','watch-buy-zone','watch-status','watch-plan'].forEach(id=>document.getElementById(id).value=''); document.getElementById('watch-group').value='near'; document.getElementById('watch-risk').value='Thấp'; document.getElementById('watch-pattern-id').value=''; document.getElementById('watchlist-modal').classList.remove('hidden');},
  closeWatchModal(){document.getElementById('watchlist-modal').classList.add('hidden'); this.editingWatchId=null;},
  editWatchlist(id){const w=this.data.watchlists.find(x=>x.id===id); if(!w)return; this.editingWatchId=id; document.getElementById('watchlist-modal-title').textContent='Chỉnh sửa watchlist'; document.getElementById('watch-symbol').value=w.symbol||''; document.getElementById('watch-group').value=w.group_name||'near'; document.getElementById('watch-buy-zone').value=w.buy_zone||''; document.getElementById('watch-risk').value=w.risk||'Thấp'; document.getElementById('watch-pattern-id').value=w.pattern_id||''; document.getElementById('watch-status').value=w.status||''; document.getElementById('watch-plan').value=w.plan||''; document.getElementById('watchlist-modal').classList.remove('hidden');},
  async saveWatchlist(){const patternId=document.getElementById('watch-pattern-id').value, linked=this.data.patterns.find(p=>p.id===patternId); const payload={user_id:this.user.id,symbol:document.getElementById('watch-symbol').value.trim().toUpperCase(),group_name:document.getElementById('watch-group').value,buy_zone:document.getElementById('watch-buy-zone').value.trim(),risk:document.getElementById('watch-risk').value,pattern_id:patternId||null,pattern_name:linked?.name||'',status:document.getElementById('watch-status').value.trim(),plan:document.getElementById('watch-plan').value.trim()}; if(this.editingWatchId) await this.sb.from('watchlists').update(payload).eq('id',this.editingWatchId); else await this.sb.from('watchlists').insert(payload); await this.loadAll(); this.closeWatchModal(); this.toast(this.editingWatchId?'Đã cập nhật watchlist.':'Đã lưu watchlist.');},
  async deleteWatchlist(id){if(!confirm('Xóa mã này khỏi watchlist?'))return; await this.sb.from('watchlists').delete().eq('id',id); await this.loadAll(); this.toast('Đã xóa mã khỏi watchlist.');},
  openPatternModal(){this.editingPatternId=null; this.patternImageUrl=''; document.getElementById('pattern-modal-title').textContent='Thêm setup'; ['pattern-name','pattern-strategy','pattern-description','pattern-conditions','pattern-triggers'].forEach(id=>document.getElementById(id).value=''); document.getElementById('pattern-image-file').value=''; document.getElementById('pattern-image-preview').innerHTML='Chưa chọn ảnh'; document.getElementById('pattern-modal').classList.remove('hidden');},
  closePatternModal(){document.getElementById('pattern-modal').classList.add('hidden'); this.editingPatternId=null;},
  editPattern(id){const p=this.data.patterns.find(x=>x.id===id); if(!p)return; this.editingPatternId=id; this.patternImageUrl=p.image_url||''; document.getElementById('pattern-modal-title').textContent='Chỉnh sửa setup'; document.getElementById('pattern-name').value=p.name||''; document.getElementById('pattern-strategy').value=p.strategy||''; document.getElementById('pattern-description').value=p.description||''; document.getElementById('pattern-conditions').value=p.conditions||''; document.getElementById('pattern-triggers').value=p.triggers||''; document.getElementById('pattern-image-preview').innerHTML=p.image_url?`<img src="${p.image_url}">`:'Chưa có ảnh'; document.getElementById('pattern-modal').classList.remove('hidden');},
  async savePattern(){try{const img=document.getElementById('pattern-image-file').files?.[0]; if(img)this.patternImageUrl=await this.uploadFile(img,'patterns'); const payload={user_id:this.user.id,name:document.getElementById('pattern-name').value.trim(),strategy:document.getElementById('pattern-strategy').value.trim(),description:document.getElementById('pattern-description').value.trim(),conditions:document.getElementById('pattern-conditions').value.trim(),triggers:document.getElementById('pattern-triggers').value.trim(),image_url:this.patternImageUrl||''}; if(this.editingPatternId) await this.sb.from('patterns').update(payload).eq('id',this.editingPatternId); else await this.sb.from('patterns').insert(payload); await this.loadAll(); this.closePatternModal(); this.toast(this.editingPatternId?'Đã cập nhật setup.':'Đã lưu setup.');}catch(e){this.toast(e.message||'Không lưu được setup.',true);}},
  async deletePattern(id){if(!confirm('Xóa setup này?'))return; await this.sb.from('patterns').delete().eq('id',id); await this.loadAll(); this.toast('Đã xóa setup.');}
};
window.onload = () => App.init();
