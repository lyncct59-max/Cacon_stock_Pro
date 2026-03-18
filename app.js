// app.js
const App = {
  state: {
    currentTradeId: null,
    currentPatternId: null,
    tradesUnsub: null,
    marketUnsub: null,
    patternsUnsub: null,
    approvalsUnsub: null,
    activeAuthTab: 'login'
  },

  init() {
    this.bindUI();
    this.initLanding();
    this.initAuthState();
    this.renderEmptyPatternState();
    this.renderEmptyJournal();
    lucide.createIcons();
  },

  bindUI() {
    document.querySelectorAll('[data-auth-tab]').forEach(btn => {
      btn.addEventListener('click', () => this.switchAuthTab(btn.dataset.authTab));
    });

    document.querySelectorAll('.password-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = document.querySelector(btn.dataset.toggle);
        if (!target) return;
        target.type = target.type === 'password' ? 'text' : 'password';
        const icon = btn.querySelector('i');
        if (icon) icon.setAttribute('data-lucide', target.type === 'password' ? 'eye' : 'eye-off');
        lucide.createIcons();
      });
    });

    document.getElementById('open-auth-btn').addEventListener('click', () => this.openAuthModal());
    document.getElementById('skip-preview-btn').addEventListener('click', () => this.hideLanding());
    document.getElementById('close-auth-btn').addEventListener('click', () => this.closeAuthModal());
    document.getElementById('filter-result').addEventListener('change', () => this.renderJournalRows(this.cachedTrades || []));
    document.getElementById('trade-image-file').addEventListener('change', (e) => this.handlePreview(e, 'trade-image-preview'));
    document.getElementById('pattern-image-file').addEventListener('change', (e) => this.handlePreview(e, 'pattern-image-preview'));
  },

  initLanding() {
    const screen = document.getElementById('landing-screen');
    const canvas = document.getElementById('network-canvas');
    if (!screen || !canvas) return;

    const ctx = canvas.getContext('2d');
    const pointer = { x: null, y: null };
    let particles = [];
    const colors = ['#4285f4', '#34a853', '#fbbc05', '#ea4335'];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = Array.from({ length: window.innerWidth < 768 ? 52 : 92 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        r: Math.random() * 2.2 + 1.4,
        c: colors[Math.floor(Math.random() * colors.length)]
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(148, 163, 184, ${0.18 - dist / 900})`;
            ctx.lineWidth = 1;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }

        if (pointer.x !== null) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 170) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(17, 24, 39, ${0.28 - dist / 800})`;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();
          }
        }
      });
      requestAnimationFrame(draw);
    };

    window.addEventListener('mousemove', (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    });
    window.addEventListener('mouseleave', () => { pointer.x = null; pointer.y = null; });
    window.addEventListener('resize', resize);
    resize();
    draw();
  },

  hideLanding() {
    document.getElementById('landing-screen')?.classList.add('hidden');
  },

  openAuthModal() {
    this.hideLanding();
    document.getElementById('login-modal').classList.remove('hidden');
  },

  closeAuthModal() {
    if (!currentUser) return;
    document.getElementById('login-modal').classList.add('hidden');
  },

  switchAuthTab(tab) {
    this.state.activeAuthTab = tab;
    document.querySelectorAll('[data-auth-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.authTab === tab));
    document.querySelectorAll('.auth-panel').forEach(panel => panel.classList.add('hidden'));
    document.getElementById(`auth-panel-${tab}`).classList.remove('hidden');
    const messages = {
      login: 'Đăng nhập chỉ cho email đã được admin phê duyệt.',
      request: 'Gửi yêu cầu để admin xét duyệt email, tên và mật khẩu đề xuất.',
      create: 'Sau khi được duyệt, bạn mới có thể tạo tài khoản Firebase.'
    };
    this.setAuthMessage(messages[tab]);
  },

  setAuthMessage(message, isError = false) {
    const box = document.getElementById('auth-message');
    box.textContent = message;
    box.classList.toggle('error', isError);
  },

  initAuthState() {
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        currentUser = null;
        userRole = 'user';
        document.body.classList.remove('is-admin');
        document.getElementById('login-modal').classList.remove('hidden');
        document.getElementById('user-name').textContent = 'Chưa đăng nhập';
        document.getElementById('user-email').textContent = '—';
        document.getElementById('user-role').textContent = 'user';
        this.renderEmptyJournal();
        return;
      }

      try {
        const approved = await isEmailApproved(user.email);
        if (!approved) {
          await auth.signOut();
          this.setAuthMessage('Email này chưa được admin phê duyệt.', true);
          return;
        }

        currentUser = user;
        await checkAdminRole(user);
        await db.collection('users').doc(user.uid).set({
          uid: user.uid,
          email: user.email || '',
          name: user.displayName || user.email?.split('@')[0] || 'User',
          role: userRole,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        document.getElementById('login-modal').classList.add('hidden');
        this.hideLanding();
        document.getElementById('user-name').textContent = user.displayName || user.email?.split('@')[0] || 'User';
        document.getElementById('user-email').textContent = user.email || '—';
        document.getElementById('user-role').textContent = userRole;
        this.setAuthMessage('Đăng nhập thành công. Dữ liệu của bạn được tách riêng theo userId.');

        this.subscribeJournal();
        this.subscribePatterns();
        this.subscribeMarket();
        if (userRole === 'admin') this.loadApprovalRequests();
      } catch (error) {
        console.error(error);
        this.setAuthMessage(error.message || 'Không thể khởi tạo phiên đăng nhập.', true);
      }
    });
  },

  async handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-pass').value.trim();
    try {
      if (!email || !password) throw new Error('Vui lòng nhập email và mật khẩu.');
      const approved = await isEmailApproved(email);
      if (!approved) throw new Error('Email chưa được admin phê duyệt.');
      await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      this.setAuthMessage(error.message || 'Đăng nhập thất bại.', true);
    }
  },

  async resetPassword() {
    const email = document.getElementById('login-email').value.trim();
    try {
      if (!email) throw new Error('Vui lòng nhập email để lấy lại mật khẩu.');
      await auth.sendPasswordResetEmail(email);
      this.setAuthMessage('Đã gửi email đặt lại mật khẩu.');
    } catch (error) {
      this.setAuthMessage(error.message || 'Không gửi được email đặt lại mật khẩu.', true);
    }
  },

  async submitApprovalRequest() {
    const name = document.getElementById('request-name').value.trim();
    const email = normalizeEmail(document.getElementById('request-email').value);
    const password = document.getElementById('request-pass').value.trim();
    try {
      if (!name || !email || !password) throw new Error('Vui lòng nhập đầy đủ họ tên, email và mật khẩu.');
      await db.collection(PENDING_REG_COLLECTION).doc(email).set({
        name,
        email,
        password,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      this.setAuthMessage('Đã gửi yêu cầu phê duyệt cho admin.');
      this.switchAuthTab('login');
    } catch (error) {
      this.setAuthMessage(error.message || 'Không gửi được yêu cầu phê duyệt.', true);
    }
  },

  async createApprovedAccount() {
    const name = document.getElementById('create-name').value.trim();
    const email = normalizeEmail(document.getElementById('create-email').value);
    const password = document.getElementById('create-pass').value.trim();
    try {
      if (!name || !email || !password) throw new Error('Vui lòng nhập đủ họ tên, email, mật khẩu.');
      const approvedDoc = await db.collection(APPROVED_EMAILS_COLLECTION).doc(email).get();
      if (!approvedDoc.exists) throw new Error('Email này chưa được admin phê duyệt.');
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: name });
      await db.collection('users').doc(cred.user.uid).set({
        uid: cred.user.uid,
        email,
        name,
        role: approvedDoc.data().role || 'user',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      this.setAuthMessage('Tạo tài khoản thành công. Bạn có thể đăng nhập ngay.');
      this.switchAuthTab('login');
    } catch (error) {
      this.setAuthMessage(error.message || 'Không tạo được tài khoản.', true);
    }
  },

  async handleLogout() {
    try {
      await auth.signOut();
      this.setAuthMessage('Đã đăng xuất.');
    } catch (error) {
      this.setAuthMessage(error.message || 'Không đăng xuất được.', true);
    }
  },

  subscribeJournal() {
    if (!currentUser) return;
    if (this.state.tradesUnsub) this.state.tradesUnsub();
    this.state.tradesUnsub = db.collection('journal')
      .where('userId', '==', currentUser.uid)
      .orderBy('date', 'desc')
      .onSnapshot((snap) => {
        this.cachedTrades = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        this.renderJournalRows(this.cachedTrades);
        this.renderDashboardStats(this.cachedTrades);
      }, (error) => {
        console.error(error);
        this.renderEmptyJournal('Lỗi tải nhật ký. Kiểm tra rules Firestore và index.');
      });
  },

  renderJournalRows(rows) {
    const filter = document.getElementById('filter-result').value;
    const filtered = rows.filter((t) => {
      if (filter === 'all') return true;
      if (filter === 'open') return t.status === 'open';
      if (filter === 'closed') return t.status === 'closed';
      return t.result === filter;
    });

    const body = document.getElementById('journal-body');
    if (!filtered.length) {
      body.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">Chưa có lệnh phù hợp bộ lọc.</td></tr>`;
      return;
    }

    body.innerHTML = filtered.map(t => `
      <tr class="border-b border-white/5">
        <td class="p-4 font-mono">${this.escapeHtml(t.date || '')}</td>
        <td class="p-4 font-black text-white">${this.escapeHtml(t.ticker || '')}</td>
        <td class="p-4">${this.escapeHtml(t.setup || '')}</td>
        <td class="p-4"><span class="status-chip ${t.status === 'open' ? 'status-open' : 'status-closed'}">${t.status === 'open' ? 'Đang mở' : 'Đóng'}</span></td>
        <td class="p-4"><span class="status-chip ${t.result === 'win' ? 'status-win' : t.result === 'loss' ? 'status-loss' : 'status-open'}">${t.result === 'win' ? 'Lãi' : t.result === 'loss' ? 'Lỗ' : 'Đang mở'}</span></td>
        <td class="p-4 text-right font-mono ${Number(t.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${Number(t.pnl || 0).toLocaleString('vi-VN')}đ</td>
        <td class="p-4 text-right">${t.imageUrl ? `<a href="${t.imageUrl}" target="_blank" class="text-emerald-400 underline">Xem ảnh</a>` : '<span class="text-slate-500">—</span>'}</td>
      </tr>`).join('');
  },

  renderDashboardStats(rows) {
    const closed = rows.filter(t => t.status === 'closed');
    const totalPnl = closed.reduce((sum, item) => sum + Number(item.pnl || 0), 0);
    document.getElementById('dash-trades').textContent = rows.length.toLocaleString('vi-VN');
    document.getElementById('dash-pnl').textContent = `${totalPnl.toLocaleString('vi-VN')}đ`;
  },

  renderEmptyJournal(message = 'Chưa có dữ liệu nhật ký.') {
    document.getElementById('journal-body').innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">${message}</td></tr>`;
    document.getElementById('dash-trades').textContent = '0';
    document.getElementById('dash-pnl').textContent = '0đ';
  },

  openTradeModal(id = null) {
    if (!currentUser) return this.openAuthModal();
    this.state.currentTradeId = id;
    const src = this.cachedTrades?.find(x => x.id === id) || {};
    document.getElementById('trade-date').value = src.date || new Date().toISOString().slice(0, 10);
    document.getElementById('trade-ticker').value = src.ticker || '';
    document.getElementById('trade-setup').value = src.setup || '';
    document.getElementById('trade-status').value = src.status || 'open';
    document.getElementById('trade-result').value = src.result || 'open';
    document.getElementById('trade-pnl').value = src.pnl ?? '';
    document.getElementById('trade-note').value = src.note || '';
    document.getElementById('trade-image-url').value = src.imageUrl || '';
    document.getElementById('trade-image-preview').src = src.imageUrl || '';
    document.getElementById('trade-image-file').value = '';
    document.getElementById('trade-modal').classList.remove('hidden');
    document.getElementById('trade-modal').classList.add('flex');
  },

  closeTradeModal() {
    document.getElementById('trade-modal').classList.add('hidden');
    document.getElementById('trade-modal').classList.remove('flex');
  },

  async saveTrade() {
    if (!currentUser) return this.openAuthModal();
    try {
      let imageUrl = document.getElementById('trade-image-url').value.trim();
      const file = document.getElementById('trade-image-file').files?.[0];
      if (file) imageUrl = await this.uploadFile(file, `users/${currentUser.uid}/journal`);

      const payload = {
        userId: currentUser.uid,
        date: document.getElementById('trade-date').value,
        ticker: document.getElementById('trade-ticker').value.trim().toUpperCase(),
        setup: document.getElementById('trade-setup').value.trim(),
        status: document.getElementById('trade-status').value,
        result: document.getElementById('trade-result').value,
        pnl: Number(document.getElementById('trade-pnl').value || 0),
        note: document.getElementById('trade-note').value.trim(),
        imageUrl,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (!payload.date || !payload.ticker) throw new Error('Ngày và mã là bắt buộc.');
      if (this.state.currentTradeId) {
        await db.collection('journal').doc(this.state.currentTradeId).set(payload, { merge: true });
      } else {
        payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('journal').add(payload);
      }
      this.closeTradeModal();
    } catch (error) {
      alert(error.message || 'Không lưu được lệnh.');
    }
  },

  subscribePatterns() {
    if (this.state.patternsUnsub) this.state.patternsUnsub();
    this.state.patternsUnsub = db.collection('patterns').orderBy('name', 'asc').onSnapshot((snap) => {
      const rows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.cachedPatterns = rows;
      this.renderPatterns(rows);
    }, (error) => {
      console.error(error);
      this.renderEmptyPatternState('Không tải được mẫu hình.');
    });
  },

  renderPatterns(rows) {
    const grid = document.getElementById('pattern-grid');
    if (!rows.length) return this.renderEmptyPatternState();
    grid.innerHTML = rows.map(p => `
      <article class="pattern-card">
        <img src="${p.imageUrl || ''}" alt="${this.escapeHtml(p.name || 'pattern')}" onerror="this.style.display='none'" />
        <div class="pattern-card-body space-y-4">
          <div>
            <h4 class="text-xl font-black text-white">${this.escapeHtml(p.name || '')}</h4>
            <p class="text-sm text-slate-400 mt-2">${this.escapeHtml(p.strategy || '')}</p>
          </div>
          <p class="text-sm text-slate-300 leading-6">${this.escapeHtml(p.description || '')}</p>
          <div class="pattern-list"><strong class="text-white">Điều kiện nền:</strong><br>${(p.conditions || []).map(x => '• ' + this.escapeHtml(x)).join('<br>') || '—'}</div>
          <div class="pattern-list"><strong class="text-white">Kích hoạt:</strong><br>${(p.triggers || []).map(x => '• ' + this.escapeHtml(x)).join('<br>') || '—'}</div>
          ${userRole === 'admin' ? `<div class="flex gap-3 flex-wrap"><button onclick="App.openPatternModal('${p.id}')" class="px-4 py-2 bg-emerald-600 rounded-lg text-[11px] font-black uppercase">Sửa</button><button onclick="App.deletePattern('${p.id}')" class="px-4 py-2 bg-rose-600 rounded-lg text-[11px] font-black uppercase">Xóa</button></div>` : '<div class="text-xs text-slate-500 uppercase">Chỉ admin được chỉnh sửa</div>'}
        </div>
      </article>`).join('');
  },

  renderEmptyPatternState(message = 'Chưa có mẫu hình nào.') {
    document.getElementById('pattern-grid').innerHTML = `<div class="glass-panel p-8 text-center text-slate-400 col-span-full">${message}</div>`;
  },

  openPatternModal(id = null) {
    if (userRole !== 'admin') return alert('Chỉ admin mới được thêm hoặc chỉnh sửa mẫu hình.');
    this.state.currentPatternId = id;
    const src = this.cachedPatterns?.find(x => x.id === id) || {};
    document.getElementById('pattern-name').value = src.name || '';
    document.getElementById('pattern-strategy').value = src.strategy || '';
    document.getElementById('pattern-description').value = src.description || '';
    document.getElementById('pattern-conditions').value = (src.conditions || []).join('\n');
    document.getElementById('pattern-triggers').value = (src.triggers || []).join('\n');
    document.getElementById('pattern-image-url').value = src.imageUrl || '';
    document.getElementById('pattern-image-preview').src = src.imageUrl || '';
    document.getElementById('pattern-image-file').value = '';
    document.getElementById('pattern-modal').classList.remove('hidden');
    document.getElementById('pattern-modal').classList.add('flex');
  },

  closePatternModal() {
    document.getElementById('pattern-modal').classList.add('hidden');
    document.getElementById('pattern-modal').classList.remove('flex');
  },

  async savePattern() {
    if (userRole !== 'admin') return alert('Chỉ admin mới được lưu mẫu hình.');
    try {
      let imageUrl = document.getElementById('pattern-image-url').value.trim();
      const file = document.getElementById('pattern-image-file').files?.[0];
      if (file) imageUrl = await this.uploadFile(file, 'patterns');

      const payload = {
        name: document.getElementById('pattern-name').value.trim(),
        strategy: document.getElementById('pattern-strategy').value.trim(),
        description: document.getElementById('pattern-description').value.trim(),
        conditions: document.getElementById('pattern-conditions').value.split('\n').map(x => x.trim()).filter(Boolean),
        triggers: document.getElementById('pattern-triggers').value.split('\n').map(x => x.trim()).filter(Boolean),
        imageUrl,
        updatedBy: currentUser.email,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (!payload.name) throw new Error('Tên mẫu hình là bắt buộc.');
      if (this.state.currentPatternId) {
        await db.collection('patterns').doc(this.state.currentPatternId).set(payload, { merge: true });
      } else {
        payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('patterns').add(payload);
      }
      this.closePatternModal();
    } catch (error) {
      alert(error.message || 'Không lưu được mẫu hình.');
    }
  },

  async deletePattern(id) {
    if (userRole !== 'admin') return alert('Chỉ admin mới được xóa mẫu hình.');
    if (!confirm('Xóa mẫu hình này?')) return;
    await db.collection('patterns').doc(id).delete();
  },

  subscribeMarket() {
    if (this.state.marketUnsub) this.state.marketUnsub();
    this.state.marketUnsub = db.collection('settings').doc('market').onSnapshot((doc) => {
      const data = doc.exists ? doc.data() : { distDays: 0 };
      document.getElementById('market-dist-days').value = data.distDays ?? 0;
      document.getElementById('market-dist-days').disabled = userRole !== 'admin';
    });
  },

  async loadApprovalRequests() {
    if (userRole !== 'admin') return;
    if (this.state.approvalsUnsub) this.state.approvalsUnsub();
    this.state.approvalsUnsub = db.collection(PENDING_REG_COLLECTION).orderBy('createdAt', 'desc').onSnapshot((snap) => {
      const rows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const body = document.getElementById('approval-body');
      if (!rows.length) {
        body.innerHTML = `<tr><td colspan="5" class="p-5 text-center text-slate-400">Chưa có yêu cầu chờ duyệt.</td></tr>`;
        return;
      }
      body.innerHTML = rows.map(item => `
        <tr class="border-b border-white/5">
          <td class="p-4 text-white font-semibold">${this.escapeHtml(item.name || '')}</td>
          <td class="p-4">${this.escapeHtml(item.email || '')}</td>
          <td class="p-4 font-mono">${this.escapeHtml(item.password || '')}</td>
          <td class="p-4"><span class="status-chip ${item.status === 'approved' ? 'status-win' : item.status === 'rejected' ? 'status-loss' : 'status-open'}">${item.status || 'pending'}</span></td>
          <td class="p-4 text-right">
            <div class="flex justify-end gap-2">
              <button onclick="App.approveRequest('${item.id}')" class="px-3 py-2 bg-emerald-600 rounded-lg text-[10px] font-black uppercase">Duyệt</button>
              <button onclick="App.rejectRequest('${item.id}')" class="px-3 py-2 bg-rose-600 rounded-lg text-[10px] font-black uppercase">Từ chối</button>
            </div>
          </td>
        </tr>`).join('');
    });
  },

  async approveRequest(id) {
    if (userRole !== 'admin') return;
    const doc = await db.collection(PENDING_REG_COLLECTION).doc(id).get();
    if (!doc.exists) return;
    const data = doc.data();
    await db.collection(APPROVED_EMAILS_COLLECTION).doc(id).set({
      email: data.email,
      name: data.name,
      role: 'user',
      approvedBy: currentUser.email,
      approvedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await db.collection(PENDING_REG_COLLECTION).doc(id).set({
      status: 'approved',
      approvedBy: currentUser.email,
      approvedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  },

  async rejectRequest(id) {
    if (userRole !== 'admin') return;
    await db.collection(PENDING_REG_COLLECTION).doc(id).set({
      status: 'rejected',
      rejectedBy: currentUser.email,
      rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  },

  async uploadFile(file, folder) {
    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const ref = storage.ref(`${folder}/${safeName}`);
    await ref.put(file);
    return ref.getDownloadURL();
  },

  handlePreview(event, targetId) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      document.getElementById(targetId).src = reader.result;
    };
    reader.readAsDataURL(file);
  },

  escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById('tab-' + tabId).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-' + tabId).classList.add('active');
}

async function updateGlobalMarketSettings() {
  if (userRole !== 'admin') return alert('Chỉ admin mới cập nhật được dữ liệu thị trường.');
  const days = Number(document.getElementById('market-dist-days').value || 0);
  await db.collection('settings').doc('market').set({
    distDays: days,
    updatedBy: currentUser?.email || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  alert('Đã cập nhật dữ liệu cho toàn hệ thống.');
}

window.App = App;
window.switchTab = switchTab;
window.updateGlobalMarketSettings = updateGlobalMarketSettings;
window.addEventListener('DOMContentLoaded', () => App.init());
