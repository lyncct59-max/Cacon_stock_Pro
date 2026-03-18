const App = {
  state: {
    user: null,
    isAdmin: false,
    activeTab: 'dashboard',
    trades: [],
    watchlist: [],
    patterns: [],
    pendingRegistrations: []
  },

  init() {
    this.cacheDom();
    this.bindEvents();
    this.initLanding();
    this.bindAuthState();
    this.setTodayDefault();
    this.renderAll();
  },

  cacheDom() {
    this.dom = {
      landingScreen: document.getElementById('landingScreen'),
      networkCanvas: document.getElementById('networkCanvas'),
      appRoot: document.getElementById('appRoot'),
      pageTitle: document.getElementById('pageTitle'),
      syncStatus: document.getElementById('syncStatus'),
      sidebarUserName: document.getElementById('sidebarUserName'),
      sidebarUserEmail: document.getElementById('sidebarUserEmail'),
      sidebarUserRole: document.getElementById('sidebarUserRole'),
      authModal: document.getElementById('authModal'),
      authMessage: document.getElementById('authMessage'),
      journalTableBody: document.getElementById('journalTableBody'),
      watchlistList: document.getElementById('watchlistList'),
      patternsList: document.getElementById('patternsList'),
      pendingTableBody: document.getElementById('pendingTableBody'),
      recentTrades: document.getElementById('recentTrades'),
      recentWatchlist: document.getElementById('recentWatchlist'),
      kpiTrades: document.getElementById('kpiTrades'),
      kpiPnl: document.getElementById('kpiPnl'),
      kpiWinRate: document.getElementById('kpiWinRate'),
      kpiWatchlist: document.getElementById('kpiWatchlist')
    };
  },

  bindEvents() {
    document.getElementById('openAuthBtn').addEventListener('click', () => this.openAuth());
    document.getElementById('exploreBtn').addEventListener('click', () => this.previewApp());
    document.getElementById('openAuthTopBtn').addEventListener('click', () => this.openAuth());
    document.getElementById('closeAuthBtn').addEventListener('click', () => this.closeAuth());
    document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
    document.getElementById('resetPasswordBtn').addEventListener('click', () => this.resetPassword());

    document.querySelectorAll('.side-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    document.querySelectorAll('[data-switch-tab]').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.switchTab));
    });

    document.querySelectorAll('.auth-tab').forEach(btn => {
      btn.addEventListener('click', () => this.switchAuthTab(btn.dataset.authTab));
    });

    document.querySelectorAll('.toggle-pass').forEach(btn => {
      btn.addEventListener('click', () => this.togglePassword(btn));
    });

    document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
    document.getElementById('requestForm').addEventListener('submit', (e) => this.handleRequestRegistration(e));
    document.getElementById('createAccountForm').addEventListener('submit', (e) => this.handleCreateAccount(e));
    document.getElementById('journalForm').addEventListener('submit', (e) => this.handleSaveTrade(e));
    document.getElementById('watchlistForm').addEventListener('submit', (e) => this.handleSaveWatch(e));
    document.getElementById('patternForm').addEventListener('submit', (e) => this.handleSavePattern(e));
  },

  initLanding() {
    const canvas = this.dom.networkCanvas;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let mouse = { x: null, y: null };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = Array.from({ length: Math.min(90, Math.max(50, Math.floor(window.innerWidth / 22))) }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7,
        r: Math.random() * 2 + 1,
        color: ['#4285F4', '#EA4335', '#34A853', '#FBBC05'][Math.floor(Math.random() * 4)]
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      });

      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(203,213,225,${1 - dist / 130})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        if (mouse.x !== null) {
          const dxm = a.x - mouse.x;
          const dym = a.y - mouse.y;
          const distm = Math.sqrt(dxm * dxm + dym * dym);
          if (distm < 150) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(34,197,94,${1 - distm / 150})`;
            ctx.lineWidth = 1;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }

      particles.forEach(p => {
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(draw);
    };

    window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
    window.addEventListener('mouseleave', () => { mouse.x = null; mouse.y = null; });
    window.addEventListener('resize', resize);
    resize();
    draw();
  },

  bindAuthState() {
    auth.onAuthStateChanged(async (user) => {
      this.state.user = user;
      if (user) {
        this.setSyncStatus('Đang kiểm tra quyền...');
        this.previewApp();
        this.closeAuth();
        this.state.isAdmin = await this.checkAdmin(user);
        await this.ensureUserProfile(user);
        await this.loadPrivateData();
      } else {
        this.state.isAdmin = false;
        this.state.trades = [];
        this.state.watchlist = [];
        this.state.patterns = [];
        this.state.pendingRegistrations = [];
        this.renderAll();
        this.setSyncStatus('Chưa đăng nhập');
        this.updateUserInfo();
      }
    });
  },

  setTodayDefault() {
    const dateInput = document.getElementById('tradeDate');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  },

  openAuth() {
    this.dom.authModal.classList.remove('hidden');
  },

  closeAuth() {
    this.dom.authModal.classList.add('hidden');
  },

  previewApp() {
    this.dom.landingScreen.classList.add('hidden');
  },

  switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.authTab === tab));
    document.querySelectorAll('.auth-pane').forEach(pane => pane.classList.toggle('active', pane.dataset.authPane === tab));
    this.setAuthMessage(tab === 'request'
      ? 'Người dùng gửi yêu cầu, admin duyệt email, sau đó mới tạo tài khoản Firebase.'
      : tab === 'create'
      ? 'Chỉ email đã được duyệt mới tạo được tài khoản.'
      : 'Chỉ email đã được admin duyệt mới đăng nhập thành công.', false);
  },

  togglePassword(button) {
    const targetId = button.dataset.target;
    const input = document.getElementById(targetId);
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    button.textContent = isPassword ? 'Ẩn' : 'Hiện';
  },

  async handleRequestRegistration(e) {
    e.preventDefault();
    const fullName = document.getElementById('requestName').value.trim();
    const email = document.getElementById('requestEmail').value.trim().toLowerCase();
    const password = document.getElementById('requestPassword').value;

    if (password.length < 6) return this.setAuthMessage('Mật khẩu tối thiểu 6 ký tự.', true);

    try {
      this.setAuthMessage('Đang gửi yêu cầu phê duyệt...', false);
      const ref = db.collection('pending_registrations').doc(email);
      const existing = await ref.get();
      await ref.set({
        fullName,
        email,
        password,
        status: existing.exists ? (existing.data().status || 'pending') : 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      e.target.reset();
      this.setAuthMessage('Đã gửi yêu cầu. Admin sẽ phê duyệt email trước khi bạn tạo tài khoản.', false);
    } catch (error) {
      console.error(error);
      this.setAuthMessage('Không gửi được yêu cầu: ' + error.message, true);
    }
  },

  async handleCreateAccount(e) {
    e.preventDefault();
    const email = document.getElementById('createEmail').value.trim().toLowerCase();
    const password = document.getElementById('createPassword').value;

    try {
      this.setAuthMessage('Đang kiểm tra email đã duyệt...', false);
      const approvedRef = await db.collection('approved_emails').doc(email).get();
      if (!approvedRef.exists || approvedRef.data().status !== 'approved') {
        return this.setAuthMessage('Email này chưa được admin duyệt.', true);
      }

      const pendingRef = await db.collection('pending_registrations').doc(email).get();
      const pending = pendingRef.exists ? pendingRef.data() : null;
      if (pending && pending.password !== password) {
        return this.setAuthMessage('Mật khẩu không khớp với mật khẩu đã đăng ký gửi admin.', true);
      }

      const credential = await auth.createUserWithEmailAndPassword(email, password);
      await db.collection('users').doc(credential.user.uid).set({
        uid: credential.user.uid,
        fullName: approvedRef.data().fullName || pending?.fullName || email,
        email,
        role: approvedRef.data().role || 'user',
        approved: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      if (pendingRef.exists) {
        await pendingRef.ref.set({ firebaseCreated: true, updatedAt: serverTimestamp() }, { merge: true });
      }

      this.setAuthMessage('Tạo tài khoản thành công. Hệ thống đã tự đăng nhập.', false);
      e.target.reset();
    } catch (error) {
      console.error(error);
      this.setAuthMessage('Không tạo được tài khoản: ' + error.message, true);
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;

    try {
      this.setAuthMessage('Đang kiểm tra email...', false);
      const allowed = await this.isEmailAllowed(email);
      if (!allowed) return this.setAuthMessage('Email chưa được admin phê duyệt nên chưa thể đăng nhập.', true);
      await auth.signInWithEmailAndPassword(email, password);
      this.setAuthMessage('Đăng nhập thành công.', false);
      e.target.reset();
    } catch (error) {
      console.error(error);
      this.setAuthMessage('Đăng nhập thất bại: ' + error.message, true);
    }
  },

  async resetPassword() {
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    if (!email) return this.setAuthMessage('Nhập email ở tab Đăng nhập trước khi bấm quên mật khẩu.', true);
    try {
      await auth.sendPasswordResetEmail(email);
      this.setAuthMessage('Đã gửi email đặt lại mật khẩu.', false);
    } catch (error) {
      console.error(error);
      this.setAuthMessage('Không gửi được email đặt lại mật khẩu: ' + error.message, true);
    }
  },

  async logout() {
    try {
      await auth.signOut();
      this.openAuth();
    } catch (error) {
      alert('Không đăng xuất được: ' + error.message);
    }
  },

  async isEmailAllowed(email) {
    const adminDoc = await db.collection('admin_emails').doc(email).get();
    if (adminDoc.exists) return true;
    const approvedDoc = await db.collection('approved_emails').doc(email).get();
    return approvedDoc.exists && approvedDoc.data().status === 'approved';
  },

  async checkAdmin(user) {
    const byEmail = await db.collection('admin_emails').doc(user.email.toLowerCase()).get();
    if (byEmail.exists) return true;
    const userDoc = await db.collection('users').doc(user.uid).get();
    return userDoc.exists && userDoc.data().role === 'admin';
  },

  async ensureUserProfile(user) {
    const userRef = db.collection('users').doc(user.uid);
    const doc = await userRef.get();
    if (!doc.exists) {
      await userRef.set({
        uid: user.uid,
        email: user.email,
        fullName: user.displayName || user.email,
        role: this.state.isAdmin ? 'admin' : 'user',
        approved: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  },

  async loadPrivateData() {
    if (!this.state.user) return;
    try {
      this.setSyncStatus('Đang đồng bộ dữ liệu...');
      const uid = this.state.user.uid;
      const [tradesSnap, watchSnap, patternsSnap] = await Promise.all([
        db.collection('journal').where('userId', '==', uid).orderBy('date', 'desc').get().catch(() => db.collection('journal').where('userId', '==', uid).get()),
        db.collection('watchlist').where('userId', '==', uid).get(),
        db.collection('patterns').where('userId', '==', uid).get()
      ]);

      this.state.trades = tradesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.state.watchlist = watchSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.state.patterns = patternsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (this.state.isAdmin) {
        const pendingSnap = await db.collection('pending_registrations').orderBy('updatedAt', 'desc').get().catch(() => db.collection('pending_registrations').get());
        this.state.pendingRegistrations = pendingSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else {
        this.state.pendingRegistrations = [];
      }

      this.updateUserInfo();
      this.renderAll();
      this.setSyncStatus('Đồng bộ Firebase thành công');
    } catch (error) {
      console.error(error);
      this.setSyncStatus('Lỗi đồng bộ');
      alert('Không tải được dữ liệu Firebase: ' + error.message);
    }
  },

  updateUserInfo() {
    const user = this.state.user;
    this.dom.sidebarUserName.textContent = user ? (user.displayName || user.email) : 'Chưa đăng nhập';
    this.dom.sidebarUserEmail.textContent = user ? user.email : '—';
    this.dom.sidebarUserRole.textContent = user ? (this.state.isAdmin ? 'Admin' : 'User') : 'Khách';
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !this.state.isAdmin));
  },

  setSyncStatus(text) {
    this.dom.syncStatus.textContent = text;
  },

  setAuthMessage(message, isError) {
    this.dom.authMessage.textContent = message;
    this.dom.authMessage.classList.toggle('error', !!isError);
  },

  switchTab(tab) {
    this.state.activeTab = tab;
    document.querySelectorAll('.side-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    document.querySelectorAll('.tab-screen').forEach(screen => screen.classList.toggle('active', screen.dataset.screen === tab));
    this.dom.pageTitle.textContent = document.querySelector(`.side-btn[data-tab="${tab}"]`)?.textContent || 'Dashboard';
  },

  async handleSaveTrade(e) {
    e.preventDefault();
    if (!this.requireLogin()) return;
    const payload = {
      userId: this.state.user.uid,
      email: this.state.user.email,
      date: document.getElementById('tradeDate').value,
      symbol: document.getElementById('tradeSymbol').value.trim().toUpperCase(),
      setup: document.getElementById('tradeSetup').value.trim(),
      strategy: document.getElementById('tradeStrategy').value.trim(),
      entryPrice: this.numberOrNull('tradeEntryPrice'),
      exitPrice: this.numberOrNull('tradeExitPrice'),
      quantity: this.numberOrNull('tradeQuantity'),
      pnl: this.numberOrNull('tradePnl') || 0,
      emotion: document.getElementById('tradeEmotion').value.trim(),
      marketPulse: document.getElementById('tradeMarket').value.trim(),
      imageUrl: document.getElementById('tradeImageUrl').value.trim(),
      note: document.getElementById('tradeNote').value.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await db.collection('journal').add(payload);
      e.target.reset();
      this.setTodayDefault();
      await this.loadPrivateData();
      this.switchTab('journal');
    } catch (error) {
      console.error(error);
      alert('Không lưu được lệnh: ' + error.message);
    }
  },

  async handleSaveWatch(e) {
    e.preventDefault();
    if (!this.requireLogin()) return;
    const payload = {
      userId: this.state.user.uid,
      email: this.state.user.email,
      symbol: document.getElementById('watchSymbol').value.trim().toUpperCase(),
      sector: document.getElementById('watchSector').value.trim(),
      buyZone: document.getElementById('watchBuyZone').value.trim(),
      status: document.getElementById('watchStatus').value.trim(),
      note: document.getElementById('watchNote').value.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    try {
      await db.collection('watchlist').add(payload);
      e.target.reset();
      await this.loadPrivateData();
    } catch (error) {
      console.error(error);
      alert('Không lưu được watchlist: ' + error.message);
    }
  },

  async handleSavePattern(e) {
    e.preventDefault();
    if (!this.requireLogin()) return;
    const payload = {
      userId: this.state.user.uid,
      email: this.state.user.email,
      name: document.getElementById('patternName').value.trim(),
      strategy: document.getElementById('patternStrategy').value.trim(),
      imageUrl: document.getElementById('patternImageUrl').value.trim(),
      description: document.getElementById('patternDescription').value.trim(),
      conditions: document.getElementById('patternConditions').value.trim(),
      trigger: document.getElementById('patternTrigger').value.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    try {
      await db.collection('patterns').add(payload);
      e.target.reset();
      await this.loadPrivateData();
    } catch (error) {
      console.error(error);
      alert('Không lưu được mẫu hình: ' + error.message);
    }
  },

  async approveRegistration(email) {
    if (!this.state.isAdmin) return;
    try {
      const pendingRef = db.collection('pending_registrations').doc(email);
      const doc = await pendingRef.get();
      if (!doc.exists) return;
      const data = doc.data();
      await db.collection('approved_emails').doc(email).set({
        email,
        fullName: data.fullName,
        status: 'approved',
        role: 'user',
        approvedBy: this.state.user.email,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      await pendingRef.set({ status: 'approved', updatedAt: serverTimestamp() }, { merge: true });
      await this.loadPrivateData();
    } catch (error) {
      console.error(error);
      alert('Không duyệt được email: ' + error.message);
    }
  },

  async rejectRegistration(email) {
    if (!this.state.isAdmin) return;
    try {
      await db.collection('pending_registrations').doc(email).set({
        status: 'rejected',
        rejectedBy: this.state.user.email,
        updatedAt: serverTimestamp()
      }, { merge: true });
      await db.collection('approved_emails').doc(email).delete().catch(() => {});
      await this.loadPrivateData();
    } catch (error) {
      console.error(error);
      alert('Không từ chối được email: ' + error.message);
    }
  },

  async deleteDoc(collectionName, id) {
    if (!this.requireLogin()) return;
    if (!confirm('Bạn chắc chắn muốn xóa?')) return;
    try {
      await db.collection(collectionName).doc(id).delete();
      await this.loadPrivateData();
    } catch (error) {
      console.error(error);
      alert('Xóa thất bại: ' + error.message);
    }
  },

  renderAll() {
    this.renderKpis();
    this.renderTrades();
    this.renderWatchlist();
    this.renderPatterns();
    this.renderPending();
  },

  renderKpis() {
    const trades = this.state.trades;
    const totalPnl = trades.reduce((sum, item) => sum + (Number(item.pnl) || 0), 0);
    const wins = trades.filter(item => Number(item.pnl) > 0).length;
    const winRate = trades.length ? Math.round((wins / trades.length) * 100) : 0;
    this.dom.kpiTrades.textContent = trades.length;
    this.dom.kpiPnl.textContent = this.formatNumber(totalPnl);
    this.dom.kpiWinRate.textContent = `${winRate}%`;
    this.dom.kpiWatchlist.textContent = this.state.watchlist.length;

    const recentTrades = [...trades].slice(0, 5);
    this.dom.recentTrades.innerHTML = recentTrades.length
      ? recentTrades.map(item => `
          <div class="list-item">
            <div class="list-item-title">${item.symbol || '—'} · ${item.setup || ''}</div>
            <div class="list-item-meta">${item.date || ''} · PnL: ${this.formatNumber(item.pnl || 0)}</div>
          </div>
        `).join('')
      : '<div class="empty-note">Chưa có lệnh nào.</div>';

    const recentWatch = [...this.state.watchlist].slice(0, 5);
    this.dom.recentWatchlist.innerHTML = recentWatch.length
      ? recentWatch.map(item => `
          <div class="list-item">
            <div class="list-item-title">${item.symbol || '—'} · ${item.status || ''}</div>
            <div class="list-item-meta">${item.sector || '—'} · ${item.buyZone || ''}</div>
          </div>
        `).join('')
      : '<div class="empty-note">Chưa có mã nào trong watchlist.</div>';
  },

  renderTrades() {
    this.dom.journalTableBody.innerHTML = this.state.trades.length
      ? this.state.trades.map(item => `
          <tr>
            <td>${item.date || ''}</td>
            <td>${item.symbol || ''}</td>
            <td>${item.setup || ''}</td>
            <td>${this.displayMaybeNumber(item.entryPrice)}</td>
            <td>${this.displayMaybeNumber(item.exitPrice)}</td>
            <td>${this.formatNumber(item.pnl || 0)}</td>
            <td>${item.note || ''}</td>
            <td><button class="row-btn" onclick="App.deleteDoc('journal','${item.id}')">Xóa</button></td>
          </tr>
        `).join('')
      : '<tr><td colspan="8" class="note-small">Chưa có lệnh nào cho tài khoản này.</td></tr>';
  },

  renderWatchlist() {
    this.dom.watchlistList.innerHTML = this.state.watchlist.length
      ? this.state.watchlist.map(item => `
          <article class="watch-card">
            <div class="list-item-title">${item.symbol || ''}</div>
            <div class="list-item-meta">${item.sector || '—'} · ${item.status || '—'}</div>
            <p class="note-small" style="margin:10px 0 0;">Buy zone: ${item.buyZone || '—'}</p>
            <p class="note-small" style="margin:6px 0 12px;">${item.note || ''}</p>
            <button class="row-btn" onclick="App.deleteDoc('watchlist','${item.id}')">Xóa</button>
          </article>
        `).join('')
      : '<div class="empty-note">Chưa có mã theo dõi.</div>';
  },

  renderPatterns() {
    this.dom.patternsList.innerHTML = this.state.patterns.length
      ? this.state.patterns.map(item => `
          <article class="pattern-card">
            ${item.imageUrl ? `<img class="image-thumb" src="${item.imageUrl}" alt="${item.name}">` : ''}
            <div class="list-item-title">${item.name || ''}</div>
            <div class="list-item-meta">${item.strategy || '—'}</div>
            <p class="note-small" style="margin:10px 0; white-space:pre-line;">${item.description || ''}</p>
            <button class="row-btn" onclick="App.deleteDoc('patterns','${item.id}')">Xóa</button>
          </article>
        `).join('')
      : '<div class="empty-note">Chưa có mẫu hình nào.</div>';
  },

  renderPending() {
    this.dom.pendingTableBody.innerHTML = this.state.pendingRegistrations.length
      ? this.state.pendingRegistrations.map(item => `
          <tr>
            <td>${item.fullName || ''}</td>
            <td>${item.email || ''}</td>
            <td>${item.password || ''}</td>
            <td><span class="chip ${item.status || 'pending'}">${item.status || 'pending'}</span></td>
            <td>${this.formatDateField(item.createdAt)}</td>
            <td>
              <div class="row-actions">
                <button class="row-btn approve" onclick="App.approveRegistration('${item.email}')">Duyệt</button>
                <button class="row-btn reject" onclick="App.rejectRegistration('${item.email}')">Từ chối</button>
              </div>
            </td>
          </tr>
        `).join('')
      : '<tr><td colspan="6" class="note-small">Chưa có yêu cầu đăng ký nào.</td></tr>';
  },

  requireLogin() {
    if (!this.state.user) {
      alert('Bạn cần đăng nhập trước.');
      this.openAuth();
      return false;
    }
    return true;
  },

  numberOrNull(id) {
    const value = document.getElementById(id).value;
    return value === '' ? null : Number(value);
  },

  formatNumber(value) {
    return Number(value || 0).toLocaleString('vi-VN');
  },

  displayMaybeNumber(value) {
    return value === null || value === undefined || value === '' ? '—' : this.formatNumber(value);
  },

  formatDateField(value) {
    if (!value) return '—';
    if (typeof value === 'string') return value;
    if (value.toDate) return value.toDate().toLocaleString('vi-VN');
    return '—';
  }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
