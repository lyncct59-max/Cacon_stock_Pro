window.onload = () => {
  lucide.createIcons();
  App.init();
};

const App = {
  state: {
    user: null,
    role: 'user',
    currentTab: 'dashboard',
    introDismissed: false,
    editingPatternId: null,
    editingWatchId: null,
    editingJournalId: null,
    selectedJournalId: null,
    breathTimer: null,
    unsubscribers: []
  },
  data: {
    patterns: [],
    watchlist: [],
    journal: [],
    market: { distDays: 4, riskMode: 'Tỷ cổ phiếu 50%', strongSector: 'Chứng khoán · Công nghệ', note: 'Ưu tiên A setup, không mua đuổi.' },
    psychology: { energy: 7, calm: 8, fomo: 4, confidence: 6, checklist: '' },
    review: { week: '', month: '' }
  },

  init() {
    this.initIntro();
    this.bindAuth();
    this.seedPlaceholders();
    this.switchTab('dashboard');
  },

  initIntro() {
    const screen = document.getElementById('intro-screen');
    const canvas = document.getElementById('intro-canvas');
    const ctx = canvas.getContext('2d');
    const pointer = { x: window.innerWidth * 0.55, y: window.innerHeight * 0.5 };
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    });

    const sharks = Array.from({ length: 28 }, (_, i) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: 20 + Math.random() * 18,
      speed: 0.25 + Math.random() * 0.55,
      drift: Math.random() * Math.PI * 2,
      opacity: 0.16 + Math.random() * 0.16
    }));
    const fish = { x: canvas.width * 0.5, y: canvas.height * 0.5, size: 28, vx: 0, vy: 0 };

    const drawFish = (x, y, size, color, thin = false, glow = false) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.lineWidth = thin ? 1.6 : 2.6;
      ctx.strokeStyle = color;
      ctx.fillStyle = thin ? 'transparent' : color;
      if (glow) {
        ctx.shadowBlur = 16;
        ctx.shadowColor = color;
      }
      ctx.beginPath();
      ctx.moveTo(-size * 0.9, 0);
      ctx.quadraticCurveTo(-size * 0.25, -size * 0.7, size * 0.55, 0);
      ctx.quadraticCurveTo(-size * 0.25, size * 0.7, -size * 0.9, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.9, 0);
      ctx.lineTo(-size * 1.25, -size * 0.45);
      ctx.lineTo(-size * 1.22, size * 0.45);
      ctx.closePath();
      thin ? ctx.stroke() : ctx.fill();
      ctx.beginPath();
      ctx.arc(size * 0.24, -size * 0.08, thin ? 1.5 : 2.5, 0, Math.PI * 2);
      thin ? ctx.stroke() : ctx.fill();
      ctx.restore();
    };

    const loop = () => {
      if (this.state.introDismissed) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(12, 74, 110, 0.08)';
      for (let i = 0; i < 60; i++) {
        ctx.beginPath();
        ctx.arc((i * 137) % canvas.width, (i * 97) % canvas.height, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      sharks.forEach((s, idx) => {
        s.x += Math.cos(s.drift) * s.speed;
        s.y += Math.sin(s.drift * 0.7) * s.speed * 0.6;
        s.drift += 0.002 + idx * 0.00001;
        if (s.x > canvas.width + 40) s.x = -40;
        if (s.x < -40) s.x = canvas.width + 40;
        if (s.y > canvas.height + 30) s.y = -30;
        if (s.y < -30) s.y = canvas.height + 30;
        drawFish(s.x, s.y, s.size, `rgba(216,240,255,${s.opacity})`, true, false);
      });
      fish.vx += (pointer.x - fish.x) * 0.012;
      fish.vy += (pointer.y - fish.y) * 0.012;
      fish.vx *= 0.88;
      fish.vy *= 0.88;
      fish.x += fish.vx;
      fish.y += fish.vy;
      drawFish(fish.x, fish.y, fish.size, '#62ffe1', false, true);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    setTimeout(() => this.dismissIntro(), 4200);
  },

  dismissIntro() {
    if (this.state.introDismissed) return;
    this.state.introDismissed = true;
    document.getElementById('intro-screen').classList.add('hide');
    setTimeout(() => document.getElementById('intro-screen')?.remove(), 650);
  },

  bindAuth() {
    auth.onAuthStateChanged(async (user) => {
      this.clearUnsubs();
      if (!user) {
        this.state.user = null;
        document.getElementById('login-modal').classList.remove('hidden');
        this.updateUserChip();
        return;
      }
      this.state.user = user;
      document.getElementById('login-modal').classList.add('hidden');
      await this.ensureUserProfile(user);
      await checkAdminRole(user.uid);
      this.state.role = userRole || 'user';
      this.subscribeAll(user.uid);
      this.updateUserChip();
    });
  },

  clearUnsubs() {
    this.state.unsubscribers.forEach(fn => { try { fn(); } catch(e) {} });
    this.state.unsubscribers = [];
  },

  async ensureUserProfile(user) {
    const ref = db.collection('users').doc(user.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({ uid: user.uid, email: user.email || '', name: user.email?.split('@')[0] || 'User', role: 'user', createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }
  },

  subscribeAll(uid) {
    const own = (col, handler, orderField = null) => {
      let q = db.collection(col).where('userId', '==', uid);
      if (orderField) q = q.orderBy(orderField, 'desc');
      const unsub = q.onSnapshot(s => handler(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      this.state.unsubscribers.push(unsub);
    };
    own('patterns', data => { this.data.patterns = data; this.populatePatternSelects(); this.renderPatterns(); this.renderScan(); this.renderJournalCompare(); }, 'updatedAt');
    own('watchlist', data => { this.data.watchlist = data; this.renderScan(); this.renderDashboard(); }, 'updatedAt');
    own('journal', data => { this.data.journal = data; if (!this.state.selectedJournalId && data[0]) this.state.selectedJournalId = data[0].id; this.renderJournalTable(); this.renderDashboard(); this.renderReview(); this.renderJournalCompare(); this.renderSizingAlerts(); }, 'date');

    const unsubMarket = db.collection('settings').doc(`market_${uid}`).onSnapshot(doc => {
      if (doc.exists) this.data.market = { ...this.data.market, ...doc.data() };
      this.fillMarketForm(); this.renderMarketSummary(); this.renderMission(); this.renderDashboard();
    });
    this.state.unsubscribers.push(unsubMarket);

    const unsubPsych = db.collection('psychology').doc(uid).onSnapshot(doc => {
      if (doc.exists) this.data.psychology = { ...this.data.psychology, ...doc.data() };
      this.fillPsychology();
    });
    this.state.unsubscribers.push(unsubPsych);

    const unsubReview = db.collection('reviews').doc(uid).onSnapshot(doc => {
      if (doc.exists) this.data.review = { ...this.data.review, ...doc.data() };
      this.fillReview(); this.renderReview();
    });
    this.state.unsubscribers.push(unsubReview);
  },

  seedPlaceholders() {
    this.renderAll();
  },

  setSyncStatus(text) {
    document.getElementById('sync-status').textContent = text;
  },

  updateUserChip() {
    const chip = document.getElementById('user-chip');
    chip.textContent = this.state.user ? `${this.state.user.email} · ${this.state.role}` : 'Chưa đăng nhập';
  },

  async handleLogin() {
    const e = document.getElementById('login-email').value.trim();
    const p = document.getElementById('login-pass').value;
    try {
      await auth.signInWithEmailAndPassword(e, p);
    } catch (error) {
      alert('Đăng nhập thất bại. Kiểm tra Email/Password trên Firebase.');
    }
  },

  async logout() {
    await auth.signOut();
  },

  switchTab(tab) {
    this.state.currentTab = tab;
    document.querySelectorAll('.tab-pane').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
    document.getElementById(`tab-${tab}`)?.classList.add('active');
    document.getElementById(`btn-${tab}`)?.classList.add('active');
    this.renderAll();
  },

  renderAll() {
    this.renderMission();
    this.renderDashboard();
    this.renderScan();
    this.renderPatterns();
    this.renderJournalTable();
    this.renderJournalCompare();
    this.renderSizingAlerts();
    this.renderMarketSummary();
    this.renderReview();
    lucide.createIcons();
  },

  getFilteredJournal() {
    const q = (document.getElementById('global-search')?.value || '').trim().toLowerCase();
    const from = document.getElementById('filter-from')?.value || '';
    const to = document.getElementById('filter-to')?.value || '';
    const status = document.getElementById('filter-status')?.value || '';
    const result = document.getElementById('filter-result')?.value || '';
    return this.data.journal.filter(t => {
      const hitQ = !q || [t.ticker, t.strategy, t.setupName, t.sector, t.mistake].join(' ').toLowerCase().includes(q);
      const hitFrom = !from || t.date >= from;
      const hitTo = !to || t.date <= to;
      const hitStatus = !status || t.status === status;
      const hitResult = !result || t.result === result;
      return hitQ && hitFrom && hitTo && hitStatus && hitResult;
    });
  },

  renderMission() {
    document.getElementById('mission-dist').textContent = this.data.market.distDays ?? 0;
    document.getElementById('mission-risk').textContent = this.data.market.riskMode || 'Tỷ cổ phiếu 50%';
    document.getElementById('mission-sector').textContent = this.data.market.strongSector || 'Chưa cập nhật';
  },

  computeStats() {
    const journal = this.data.journal;
    const closed = journal.filter(x => x.status === 'Đã đóng');
    const wins = closed.filter(x => x.result === 'Lãi').length;
    const losses = closed.filter(x => x.result === 'Lỗ').length;
    const avgQuality = closed.length ? (closed.filter(x => (x.quality || '').startsWith('A')).length / closed.length) : 0;
    const active = this.data.watchlist.filter(w => w.group === 'Gần điểm mua').length;
    const alerts = journal.filter(x => x.mistake && x.mistake !== 'Không').length;
    return {
      stockRate: this.data.market.riskMode || 'Tỷ cổ phiếu 50%',
      active,
      winRate: closed.length ? `${((wins / closed.length) * 100).toFixed(1)}%` : '0%',
      quality: avgQuality >= .7 ? 'A-' : avgQuality >= .5 ? 'B+' : 'C+',
      alerts,
      wins, losses,
      repeatMistake: this.getRepeatMistake(),
      nextStep: active ? 'Scan → Size' : 'Làm sạch watchlist'
    };
  },

  renderDashboard() {
    const s = this.computeStats();
    const stats = [
      { title: 'Market Pulse', value: s.stockRate, note: `${this.data.market.distDays || 0} ngày phân phối, ${this.data.market.strongSector || ''}`, cls: 'soft-green' },
      { title: 'Watchlist khả dụng', value: String(s.active).padStart(2, '0'), note: 'Cơ hội gần điểm mua hôm nay' },
      { title: 'Win rate', value: s.winRate, note: `${s.wins} thắng / ${s.losses} thua`, },
      { title: 'Trade Quality', value: s.quality, note: 'Điểm trung bình quality score', cls: 'soft-green' },
      { title: 'Risk cảnh báo', value: String(s.alerts).padStart(2, '0'), note: 'Lệnh có dấu hiệu lệch kế hoạch', cls: 'soft-yellow' }
    ];
    document.getElementById('dashboard-stats').innerHTML = stats.map(x => `
      <div class="stat-card ${x.cls || ''}">
        <h4>${x.title}</h4>
        <strong>${x.value}</strong>
        <p>${x.note}</p>
      </div>`).join('');

    const watchHtml = this.data.watchlist.slice(0, 4).map(w => `
      <div class="watch-card">
        <div class="head"><h4>${w.ticker}</h4><span class="pill">${w.group}</span></div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div><div class="text-slate-500">Buy zone</div><strong>${w.buyZone || '-'}</strong></div>
          <div><div class="text-slate-500">Risk</div><strong>${w.risk || '-'}</strong></div>
        </div>
        <div class="actions-row">
          <button class="btn-sm primary" onclick="App.openJournalModal(null, '${w.id}')">Tạo lệnh</button>
          <button class="btn-sm" onclick="App.selectWatchToPattern('${w.patternId || ''}')">Mở checklist</button>
        </div>
      </div>`).join('') || '<div class="text-slate-500">Chưa có watchlist.</div>';
    document.getElementById('dashboard-watchlist').innerHTML = watchHtml;

    document.getElementById('dashboard-control').innerHTML = `
      <div class="mini-card"><div class="text-slate-500">Checklist pass rate</div><strong>${this.data.patterns.length ? '85%' : '0%'}</strong><div>Tỷ lệ tick đủ điều kiện trước lệnh</div></div>
      <div class="mini-card"><div class="text-slate-500">Sai lầm lặp lại</div><strong style="font-size:18px;color:#dc2626">${s.repeatMistake}</strong><div>Cần viết rule chặn lỗi</div></div>
      <div class="mini-card"><div class="text-slate-500">Bước tiếp theo</div><strong style="font-size:18px">${s.nextStep}</strong><div>Không vào lệnh trước khi tính risk</div></div>
      <div class="mini-card"><div class="text-slate-500">Watchlist dài hạn</div><strong style="font-size:18px">${this.data.watchlist.filter(w=>w.group==='Dài hạn').map(w=>w.ticker).join(', ') || 'Chưa có'}</strong><div>Giữ nền dài hạn và canh gia tăng.</div></div>`;
  },

  groupWatchlist() {
    const groups = ['Gần điểm mua', 'Theo dõi', 'Dài hạn'];
    return groups.map(group => ({ group, items: this.data.watchlist.filter(w => w.group === group) }));
  },

  renderScan() {
    document.getElementById('scan-columns').innerHTML = this.groupWatchlist().map(col => `
      <div class="scan-col">
        <h4>${col.group} <span class="meta">${col.items.length} mã</span></h4>
        <div class="stack-list">
          ${col.items.map(w => `
            <div class="watch-card">
              <div class="head"><h4>${w.ticker}</h4><span class="pill">${w.tag || col.group}</span></div>
              <div class="text-slate-500 mb-2">${this.findPatternName(w.patternId)}</div>
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div><div class="text-slate-500">Buy zone</div><strong>${w.buyZone || '-'}</strong></div>
                <div><div class="text-slate-500">Risk</div><strong>${w.risk || '-'}</strong></div>
              </div>
              <div class="actions-row">
                <button class="btn-sm primary" onclick="App.openJournalModal(null, '${w.id}')">Tạo lệnh</button>
                <button class="btn-sm" onclick="App.selectWatchToPattern('${w.patternId || ''}')">Mở checklist</button>
                <button class="btn-sm" onclick="App.openWatchModal('${w.id}')">Sửa</button>
                <button class="btn-sm" onclick="App.deleteWatch('${w.id}')">Xóa</button>
              </div>
            </div>`).join('') || '<div class="text-slate-500">Chưa có dữ liệu.</div>'}
        </div>
      </div>`).join('');
  },

  renderPatterns() {
    const html = this.data.patterns.map(p => `
      <div class="card">
        <div class="compare-panel">
          <img src="${p.image || 'https://placehold.co/800x420?text=Pattern'}" alt="${p.name}">
          <div class="compare-title">${p.name}</div>
          <div class="compare-meta">${p.strategy || ''}</div>
          <div class="mb-3">${p.description || ''}</div>
          <div class="check-list-box">
            ${(p.conditions || []).map(c => `<div class="check-item"><span>${c}</span><strong>Đạt</strong></div>`).join('')}
            ${(p.triggers || []).map(c => `<div class="check-item"><span>${c}</span><strong>Check</strong></div>`).join('')}
          </div>
          <div class="actions-row mt-4">
            <button class="btn-sm primary" onclick="App.openPatternModal('${p.id}')">Chỉnh sửa</button>
            <button class="btn-sm" onclick="App.deletePattern('${p.id}')">Xóa</button>
            <button class="btn-sm" onclick="App.linkPatternToJournal('${p.id}')">Liên kết sang so sánh</button>
          </div>
        </div>
      </div>`).join('') || '<div class="text-slate-500">Chưa có mẫu hình.</div>';
    document.getElementById('patterns-grid').innerHTML = `<div class="two-col-grid">${html}</div>`;
  },

  renderJournalTable() {
    const rows = this.getFilteredJournal();
    const html = rows.map(t => `
      <tr onclick="App.selectJournal('${t.id}')" style="cursor:pointer">
        <td><strong>${t.ticker || ''}</strong></td>
        <td>${t.date || ''}</td>
        <td><span class="pill">${t.strategy || ''}</span></td>
        <td>${t.setupName || this.findPatternName(t.patternId)}</td>
        <td>${t.sector || ''}</td>
        <td>${t.entry || ''}</td>
        <td>${t.stop || ''}</td>
        <td style="color:${Number(t.plPercent) >= 0 ? '#059669' : '#e11d48'}">${t.plPercent ?? ''}${t.plPercent !== undefined ? '%' : ''}</td>
        <td>${t.rMultiple || ''}</td>
        <td>${this.renderTag(t.quality, this.tagClass(t.quality))}</td>
        <td>${this.renderTag(t.execution, this.tagClass(t.execution))}</td>
        <td>${this.renderTag(t.result, this.tagClass(t.result))}</td>
        <td>${t.mistake || 'Không'}</td>
        <td>${t.chartUrl ? '<a target="_blank" href="'+t.chartUrl+'">chart.png</a>' : '-'}</td>
        <td>
          <button class="btn-sm" onclick="event.stopPropagation();App.openJournalModal('${t.id}')">Sửa</button>
          <button class="btn-sm" onclick="event.stopPropagation();App.deleteJournal('${t.id}')">Xóa</button>
        </td>
      </tr>`).join('');
    document.getElementById('journal-body').innerHTML = html || '<tr><td colspan="15" class="text-center text-slate-500">Chưa có dữ liệu</td></tr>';
  },

  renderTag(text, cls) {
    if (!text) return '-';
    return `<span class="tag ${cls}">${text}</span>`;
  },
  tagClass(text='') {
    const t = text.toLowerCase();
    if (t.includes('a') || t.includes('đúng') || t.includes('lãi')) return 'green';
    if (t.includes('b') || t.includes('đang')) return 'yellow';
    if (t.includes('c') || t.includes('lỗ') || t.includes('vi phạm')) return 'red';
    return 'blue';
  },

  selectJournal(id) {
    this.state.selectedJournalId = id;
    this.renderJournalCompare();
  },

  renderJournalCompare() {
    const trade = this.data.journal.find(x => x.id === this.state.selectedJournalId) || this.data.journal[0];
    if (!trade) {
      document.getElementById('pattern-compare').innerHTML = 'Chưa có lệnh.';
      document.getElementById('trade-compare').innerHTML = 'Chưa có lệnh.';
      return;
    }
    const pattern = this.data.patterns.find(p => p.id === trade.patternId);
    document.getElementById('pattern-compare').innerHTML = pattern ? `
      <img src="${pattern.image || 'https://placehold.co/800x420?text=Pattern'}">
      <div class="compare-title">${pattern.name}</div>
      <div class="compare-meta">${pattern.strategy || ''}</div>
      <div>${pattern.description || ''}</div>` : 'Chưa liên kết mẫu hình.';
    document.getElementById('trade-compare').innerHTML = `
      ${trade.chartUrl ? `<img src="${trade.chartUrl}">` : '<div class="text-slate-500">Chưa có ảnh thực tế</div>'}
      <div class="compare-title">${trade.ticker}</div>
      <div class="compare-meta">${trade.strategy || ''} · ${trade.date || ''}</div>
      <div>Entry ${trade.entry || '-'} · Stop ${trade.stop || '-'} · ${trade.result || ''}</div>`;
    document.getElementById('journal-checklist').innerHTML = (trade.checks || []).map(c => `<div class="check-item"><span>${c}</span><strong>Đạt</strong></div>`).join('') || '<div class="text-slate-500">Chưa có checklist.</div>';
    document.getElementById('journal-notes').innerHTML = `<div class="tip-box">${trade.note || 'Chưa có ghi chú.'}</div>`;
  },

  renderSizingAlerts() {
    const riskTrades = this.data.journal.filter(t => (t.mistake || '') !== 'Không' && t.mistake);
    document.getElementById('behavior-alerts').innerHTML = riskTrades.map(t => `<div class="tip-box">${t.ticker} · ${t.result || ''} · ${t.mistake}</div>`).join('') || '<div class="text-slate-500">Chưa có cảnh báo hành vi.</div>';
  },

  calcPositionSizing() {
    const capital = Number(document.getElementById('ps-capital').value || 0);
    const riskPct = Number(document.getElementById('ps-riskpct').value || 0) / 100;
    const entry = Number(document.getElementById('ps-entry').value || 0);
    const stop = Number(document.getElementById('ps-stop').value || 0);
    if (!capital || !entry || !stop || entry <= stop) {
      document.getElementById('ps-result').innerHTML = 'Nhập đúng vốn, entry và stop loss.';
      return;
    }
    const riskCash = capital * riskPct;
    const perShareRisk = entry - stop;
    const shares = Math.floor(riskCash / perShareRisk);
    const positionValue = shares * entry;
    const usedPct = (positionValue / capital) * 100;
    document.getElementById('ps-result').innerHTML = `
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div><div class="text-slate-500">Rủi ro tối đa</div><strong>${riskCash.toLocaleString('vi-VN')}đ</strong></div>
        <div><div class="text-slate-500">SL tối đa</div><strong>${perShareRisk.toFixed(2)} cp</strong></div>
        <div><div class="text-slate-500">Khối lượng</div><strong>${shares.toLocaleString('vi-VN')} cp</strong></div>
        <div><div class="text-slate-500">% vốn sử dụng</div><strong>${usedPct.toFixed(1)}%</strong></div>
      </div>
      <div class="tip-box mt-3">${usedPct > 50 ? 'Cảnh báo: stop loss rộng hơn bình thường. Giảm khối lượng để không vượt risk account.' : 'Size hợp lý theo risk hiện tại.'}</div>`;
  },

  fillMarketForm() {
    document.getElementById('market-dist-days').value = this.data.market.distDays ?? 0;
    document.getElementById('market-risk-mode').value = this.data.market.riskMode || '';
    document.getElementById('market-strong-sector').value = this.data.market.strongSector || '';
    document.getElementById('market-note').value = this.data.market.note || '';
  },

  async saveMarket() {
    if (!this.state.user) return;
    const payload = {
      userId: this.state.user.uid,
      distDays: Number(document.getElementById('market-dist-days').value || 0),
      riskMode: document.getElementById('market-risk-mode').value.trim(),
      strongSector: document.getElementById('market-strong-sector').value.trim(),
      note: document.getElementById('market-note').value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('settings').doc(`market_${this.state.user.uid}`).set(payload, { merge: true });
    this.setSyncStatus('Đã lưu đánh giá thị trường');
  },

  renderMarketSummary() {
    const dist = Number(this.data.market.distDays || 0);
    let action = 'Thị trường bình thường';
    if (dist === 3) action = 'Có rủi ro, hạ tỷ trọng margin';
    if (dist === 4) action = 'Nguy cơ cao, nâng tiền mặt 50%';
    if (dist >= 5) action = 'Ưu tiên 100% tiền mặt';
    document.getElementById('market-summary').innerHTML = `
      <div class="mini-card"><div class="text-slate-500">Số ngày phân phối</div><strong>${dist}</strong><div>${action}</div></div>
      <div class="mini-card"><div class="text-slate-500">Risk mode</div><strong style="font-size:18px">${this.data.market.riskMode || ''}</strong></div>
      <div class="mini-card"><div class="text-slate-500">Ngành mạnh</div><strong style="font-size:18px">${this.data.market.strongSector || ''}</strong></div>
      <div class="tip-box">${this.data.market.note || ''}</div>`;
  },

  fillPsychology() {
    document.getElementById('psy-energy').value = this.data.psychology.energy ?? 7;
    document.getElementById('psy-calm').value = this.data.psychology.calm ?? 8;
    document.getElementById('psy-fomo').value = this.data.psychology.fomo ?? 4;
    document.getElementById('psy-confidence').value = this.data.psychology.confidence ?? 6;
    document.getElementById('psy-checklist').value = this.data.psychology.checklist || '';
    this.updateRangeLabel('energy'); this.updateRangeLabel('calm'); this.updateRangeLabel('fomo'); this.updateRangeLabel('conf');
  },

  updateRangeLabel(key) {
    const map = { energy: 'psy-energy', calm: 'psy-calm', fomo: 'psy-fomo', conf: 'psy-confidence' };
    const labels = { energy: 'energy-val', calm: 'calm-val', fomo: 'fomo-val', conf: 'conf-val' };
    document.getElementById(labels[key]).textContent = document.getElementById(map[key]).value;
  },

  async savePsychology() {
    if (!this.state.user) return;
    const payload = {
      userId: this.state.user.uid,
      energy: Number(document.getElementById('psy-energy').value),
      calm: Number(document.getElementById('psy-calm').value),
      fomo: Number(document.getElementById('psy-fomo').value),
      confidence: Number(document.getElementById('psy-confidence').value),
      checklist: document.getElementById('psy-checklist').value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('psychology').doc(this.state.user.uid).set(payload, { merge: true });
    this.setSyncStatus('Đã lưu check-in tâm lý');
  },

  startBreathing() {
    this.stopBreathing();
    const inputIn = Number(document.getElementById('breath-in').value || 4);
    const hold = Number(document.getElementById('breath-hold').value || 7);
    const out = Number(document.getElementById('breath-out').value || 8);
    const phases = [
      { text: `Hít ${inputIn} giây`, sec: inputIn, scale: 1.18 },
      { text: `Giữ ${hold} giây`, sec: hold, scale: 1.18 },
      { text: `Thở ${out} giây`, sec: out, scale: .9 }
    ];
    let phaseIdx = 0;
    let remaining = phases[0].sec;
    const circle = document.getElementById('breath-circle');
    const status = document.getElementById('breath-status');
    const progress = document.getElementById('breath-progress');
    const tick = () => {
      const phase = phases[phaseIdx];
      status.textContent = phase.text;
      circle.textContent = remaining;
      circle.style.transform = `scale(${phase.scale})`;
      progress.style.width = `${((phase.sec - remaining) / phase.sec) * 100}%`;
      remaining -= 1;
      if (remaining < 0) {
        phaseIdx = (phaseIdx + 1) % phases.length;
        remaining = phases[phaseIdx].sec;
      }
    };
    tick();
    this.state.breathTimer = setInterval(tick, 1000);
  },

  stopBreathing() {
    if (this.state.breathTimer) clearInterval(this.state.breathTimer);
    this.state.breathTimer = null;
    document.getElementById('breath-status').textContent = 'Sẵn sàng';
    document.getElementById('breath-circle').textContent = '4-7-8';
    document.getElementById('breath-circle').style.transform = 'scale(1)';
    document.getElementById('breath-progress').style.width = '0%';
  },

  fillReview() {
    document.getElementById('review-week').value = this.data.review.week || '';
    document.getElementById('review-month').value = this.data.review.month || '';
  },

  async saveReview() {
    if (!this.state.user) return;
    const payload = {
      userId: this.state.user.uid,
      week: document.getElementById('review-week').value.trim(),
      month: document.getElementById('review-month').value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('reviews').doc(this.state.user.uid).set(payload, { merge: true });
    this.setSyncStatus('Đã lưu review');
  },

  renderReview() {
    const closed = this.data.journal.filter(x => x.status === 'Đã đóng');
    const profit = closed.reduce((s, x) => s + (Number(x.plPercent) || 0), 0);
    const bestSector = this.getBestSector();
    const stats = [
      { title: 'Tổng lệnh đã đóng', value: `${closed.filter(x => x.result === 'Lãi').length} thắng / ${closed.filter(x => x.result === 'Lỗ').length} thua` },
      { title: 'Lợi nhuận ròng', value: `${profit.toFixed(2)}% tổng hợp từ nhật ký` },
      { title: 'Ngày giao dịch hiệu quả', value: 'Thứ 3 · Ngày có expectancy tốt nhất' },
      { title: 'Nhóm ngành tốt nhất', value: `${bestSector || 'Chưa đủ dữ liệu'}` },
      { title: 'Sai lầm lặp lại', value: this.getRepeatMistake() },
      { title: 'Lệnh mở hiện tại', value: `${this.data.journal.filter(x => x.status === 'Đang mở').length} lệnh ưu tiên follow-up` }
    ];
    document.getElementById('review-stats').innerHTML = stats.map(s => `<div class="mini-card"><div class="text-slate-500">${s.title}</div><strong style="font-size:20px">${s.value}</strong></div>`).join('');
    const loser = this.data.journal.filter(x => x.result === 'Lỗ').sort((a,b) => Number(a.plPercent) - Number(b.plPercent))[0];
    document.getElementById('postmortem-box').innerHTML = loser ? `
      <div class="postmortem-item">
        <div class="flex justify-between items-start"><div><strong style="font-size:24px">${loser.ticker}</strong><div class="text-slate-500">${loser.strategy} · ${loser.setupName || ''}</div></div><span class="tag red">Lỗ</span></div>
        <p>Lệnh lỗ lớn nhất. P/L: ${loser.plPercent || 0}%. Sai lầm ghi nhận: ${loser.mistake || 'Chưa ghi'}.</p>
        <textarea class="field area" placeholder="Điều gì đã xảy ra? Kỳ vọng gì? Nếu làm lại sẽ làm gì khác?"></textarea>
      </div>` : '<div class="text-slate-500">Chưa có lệnh lỗ để hậu kiểm.</div>';
  },

  getBestSector() {
    const map = {};
    this.data.journal.filter(x => x.result === 'Lãi').forEach(x => {
      map[x.sector] = (map[x.sector] || 0) + Number(x.plPercent || 0);
    });
    return Object.entries(map).sort((a,b) => b[1]-a[1])[0]?.[0];
  },
  getRepeatMistake() {
    const map = {};
    this.data.journal.forEach(x => { if (x.mistake && x.mistake !== 'Không') map[x.mistake] = (map[x.mistake] || 0) + 1; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'Chưa có';
  },

  populatePatternSelects() {
    const options = '<option value="">-- Chọn mẫu hình --</option>' + this.data.patterns.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    ['watch-pattern', 'journal-pattern'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = options;
    });
  },

  findPatternName(id) {
    return this.data.patterns.find(p => p.id === id)?.name || '';
  },

  openPatternModal(id = null) {
    this.state.editingPatternId = id;
    const obj = this.data.patterns.find(x => x.id === id) || { name:'', strategy:'', image:'', description:'', conditions:[], triggers:[] };
    document.getElementById('pattern-modal-title').textContent = id ? 'Chỉnh sửa mẫu hình' : 'Tạo mẫu hình';
    document.getElementById('pattern-name').value = obj.name || '';
    document.getElementById('pattern-strategy').value = obj.strategy || '';
    document.getElementById('pattern-image').value = obj.image || '';
    document.getElementById('pattern-description').value = obj.description || '';
    document.getElementById('pattern-conditions').value = (obj.conditions || []).join('\n');
    document.getElementById('pattern-triggers').value = (obj.triggers || []).join('\n');
    document.getElementById('pattern-modal').classList.remove('hidden');
  },
  closePatternModal(){ document.getElementById('pattern-modal').classList.add('hidden'); },

  async savePattern() {
    if (!this.state.user) return;
    const payload = {
      userId: this.state.user.uid,
      name: document.getElementById('pattern-name').value.trim(),
      strategy: document.getElementById('pattern-strategy').value.trim(),
      image: document.getElementById('pattern-image').value.trim(),
      description: document.getElementById('pattern-description').value.trim(),
      conditions: document.getElementById('pattern-conditions').value.split('\n').map(s=>s.trim()).filter(Boolean),
      triggers: document.getElementById('pattern-triggers').value.split('\n').map(s=>s.trim()).filter(Boolean),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const ref = this.state.editingPatternId ? db.collection('patterns').doc(this.state.editingPatternId) : db.collection('patterns').doc();
    await ref.set(payload, { merge: true });
    this.closePatternModal();
    this.setSyncStatus('Đã lưu mẫu hình');
  },

  async deletePattern(id) {
    if (!confirm('Xóa mẫu hình này?')) return;
    await db.collection('patterns').doc(id).delete();
    this.setSyncStatus('Đã xóa mẫu hình');
  },

  linkPatternToJournal(id) {
    this.switchTab('journal');
    const trade = this.data.journal.find(x => x.patternId === id);
    if (trade) this.selectJournal(trade.id);
  },

  selectWatchToPattern(id) {
    this.switchTab('patterns');
    if (id) this.linkPatternToJournal(id);
  },

  openWatchModal(id = null) {
    this.state.editingWatchId = id;
    this.populatePatternSelects();
    const obj = this.data.watchlist.find(x => x.id === id) || { ticker:'', group:'Gần điểm mua', patternId:'', risk:'', buyZone:'', tag:'' };
    document.getElementById('watch-modal-title').textContent = id ? 'Sửa watchlist' : 'Thêm watchlist';
    document.getElementById('watch-ticker').value = obj.ticker || '';
    document.getElementById('watch-group').value = obj.group || '';
    document.getElementById('watch-pattern').value = obj.patternId || '';
    document.getElementById('watch-risk').value = obj.risk || '';
    document.getElementById('watch-buyzone').value = obj.buyZone || '';
    document.getElementById('watch-tag').value = obj.tag || '';
    document.getElementById('watch-modal').classList.remove('hidden');
  },
  closeWatchModal(){ document.getElementById('watch-modal').classList.add('hidden'); },

  async saveWatch() {
    if (!this.state.user) return;
    const payload = {
      userId: this.state.user.uid,
      ticker: document.getElementById('watch-ticker').value.trim().toUpperCase(),
      group: document.getElementById('watch-group').value.trim(),
      patternId: document.getElementById('watch-pattern').value,
      risk: document.getElementById('watch-risk').value.trim(),
      buyZone: document.getElementById('watch-buyzone').value.trim(),
      tag: document.getElementById('watch-tag').value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const ref = this.state.editingWatchId ? db.collection('watchlist').doc(this.state.editingWatchId) : db.collection('watchlist').doc();
    await ref.set(payload, { merge: true });
    this.closeWatchModal();
    this.setSyncStatus('Đã lưu watchlist');
  },

  async deleteWatch(id) {
    if (!confirm('Xóa watchlist này?')) return;
    await db.collection('watchlist').doc(id).delete();
    this.setSyncStatus('Đã xóa watchlist');
  },

  openJournalModal(id = null, watchId = null) {
    this.state.editingJournalId = id;
    this.populatePatternSelects();
    const fromWatch = this.data.watchlist.find(x => x.id === watchId);
    const obj = this.data.journal.find(x => x.id === id) || {
      ticker: fromWatch?.ticker || '', date: new Date().toISOString().slice(0,10), strategy:'', patternId:fromWatch?.patternId || '', sector:'', status:'Đang mở', entry:'', stop:'', plPercent:'', rMultiple:'', quality:'A Setup', execution:'Đúng kế hoạch', result:'Đang mở', mistake:'Không', chartUrl:'', checks:[], note:''
    };
    document.getElementById('journal-modal-title').textContent = id ? 'Chỉnh sửa lệnh' : 'Tạo lệnh mới';
    document.getElementById('journal-ticker').value = obj.ticker || '';
    document.getElementById('journal-date').value = obj.date || '';
    document.getElementById('journal-strategy').value = obj.strategy || '';
    document.getElementById('journal-pattern').value = obj.patternId || '';
    document.getElementById('journal-sector').value = obj.sector || '';
    document.getElementById('journal-status').value = obj.status || 'Đang mở';
    document.getElementById('journal-entry').value = obj.entry || '';
    document.getElementById('journal-stop').value = obj.stop || '';
    document.getElementById('journal-pl').value = obj.plPercent || '';
    document.getElementById('journal-r').value = obj.rMultiple || '';
    document.getElementById('journal-quality').value = obj.quality || '';
    document.getElementById('journal-execution').value = obj.execution || '';
    document.getElementById('journal-result').value = obj.result || '';
    document.getElementById('journal-mistake').value = obj.mistake || '';
    document.getElementById('journal-chart').value = obj.chartUrl || '';
    document.getElementById('journal-checks').value = (obj.checks || []).join('\n');
    document.getElementById('journal-note').value = obj.note || '';
    document.getElementById('journal-modal').classList.remove('hidden');
  },
  closeJournalModal(){ document.getElementById('journal-modal').classList.add('hidden'); },

  async saveJournal() {
    if (!this.state.user) return;
    const patternId = document.getElementById('journal-pattern').value;
    const payload = {
      userId: this.state.user.uid,
      ticker: document.getElementById('journal-ticker').value.trim().toUpperCase(),
      date: document.getElementById('journal-date').value,
      strategy: document.getElementById('journal-strategy').value.trim(),
      patternId,
      setupName: this.findPatternName(patternId),
      sector: document.getElementById('journal-sector').value.trim(),
      status: document.getElementById('journal-status').value,
      entry: Number(document.getElementById('journal-entry').value || 0),
      stop: Number(document.getElementById('journal-stop').value || 0),
      plPercent: Number(document.getElementById('journal-pl').value || 0),
      rMultiple: document.getElementById('journal-r').value.trim(),
      quality: document.getElementById('journal-quality').value.trim(),
      execution: document.getElementById('journal-execution').value.trim(),
      result: document.getElementById('journal-result').value,
      mistake: document.getElementById('journal-mistake').value.trim() || 'Không',
      chartUrl: document.getElementById('journal-chart').value.trim(),
      checks: document.getElementById('journal-checks').value.split('\n').map(s=>s.trim()).filter(Boolean),
      note: document.getElementById('journal-note').value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const ref = this.state.editingJournalId ? db.collection('journal').doc(this.state.editingJournalId) : db.collection('journal').doc();
    await ref.set(payload, { merge: true });
    this.closeJournalModal();
    this.setSyncStatus('Đã lưu nhật ký lệnh');
  },

  async deleteJournal(id) {
    if (!confirm('Xóa lệnh này?')) return;
    await db.collection('journal').doc(id).delete();
    this.setSyncStatus('Đã xóa lệnh');
  }
};
