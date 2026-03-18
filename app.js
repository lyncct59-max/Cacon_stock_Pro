window.addEventListener('load', () => {
  lucide.createIcons();
  setupLanding();
  bindUI();
  bindAuthState();
  seedDefaultsIfMissing();
});

const state = {
  journal: [],
  watchlist: [],
  patterns: [],
  pending: [],
  activeTab: 'dashboard'
};

function bindUI() {
  document.getElementById('open-auth-btn').addEventListener('click', openAuthModal);
  document.getElementById('close-auth-btn').addEventListener('click', closeAuthModal);
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('forgot-btn').addEventListener('click', handleForgotPassword);
  document.getElementById('send-request-btn').addEventListener('click', submitRegistrationRequest);
  document.getElementById('create-account-btn').addEventListener('click', createApprovedAccount);
  document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());
  document.getElementById('save-journal-btn').addEventListener('click', saveJournal);
  document.getElementById('clear-journal-form-btn').addEventListener('click', clearJournalForm);
  document.getElementById('journal-filter-result').addEventListener('change', renderJournalTable);
  document.getElementById('journal-search').addEventListener('input', renderJournalTable);
  document.getElementById('save-watchlist-btn').addEventListener('click', saveWatchlist);
  document.getElementById('clear-watchlist-form-btn').addEventListener('click', clearWatchlistForm);
  document.getElementById('save-pattern-btn').addEventListener('click', savePattern);
  document.getElementById('clear-pattern-form-btn').addEventListener('click', clearPatternForm);
  document.getElementById('refresh-pending-btn').addEventListener('click', loadPendingRegistrations);

  document.querySelectorAll('[data-auth-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.authTab));
  });
  document.querySelectorAll('.toggle-pass').forEach(btn => {
    btn.addEventListener('click', () => togglePassword(btn.dataset.target, btn));
  });
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.querySelectorAll('[data-tab-jump]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tabJump));
  });
}

function bindAuthState() {
  auth.onAuthStateChanged(async (user) => {
    hideAlert();
    if (!user) {
      currentUser = null;
      userProfile = null;
      userRole = 'user';
      document.getElementById('app-shell').classList.add('hidden');
      document.getElementById('landing-screen').classList.remove('hidden');
      openAuthModal();
      return;
    }

    currentUser = user;

    try {
      const profileSnap = await db.collection('users').doc(user.uid).get();
      if (!profileSnap.exists()) {
        await auth.signOut();
        showAlert('Tài khoản chưa có hồ sơ người dùng.', 'error');
        return;
      }

      userProfile = profileSnap.data();
      userRole = userProfile.role || 'user';

      if (userProfile.status && userProfile.status !== 'active') {
        await auth.signOut();
        showAlert('Tài khoản chưa được kích hoạt.', 'error');
        return;
      }

      document.body.classList.toggle('is-admin', userRole === 'admin');
      document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', userRole !== 'admin'));
      updateCurrentUserUI();
      closeAuthModal();
      document.getElementById('landing-screen').classList.add('hidden');
      document.getElementById('app-shell').classList.remove('hidden');
      switchTab(state.activeTab || 'dashboard');
      subscribeUserData();
      if (userRole === 'admin') loadPendingRegistrations();
    } catch (error) {
      console.error(error);
      showAlert(error.message || 'Không thể tải quyền người dùng.', 'error');
    }
  });
}

function openAuthModal() {
  document.getElementById('auth-modal').classList.remove('hidden');
}
function closeAuthModal() {
  if (!currentUser) return;
  document.getElementById('auth-modal').classList.add('hidden');
}
function switchAuthTab(tab) {
  document.querySelectorAll('[data-auth-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.authTab === tab));
  document.querySelectorAll('[data-auth-panel]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.authPanel !== tab));
  hideAlert();
}
function showAlert(message, type = 'error') {
  const el = document.getElementById('auth-alert');
  el.textContent = message;
  el.className = `auth-alert ${type}`;
  el.classList.remove('hidden');
}
function hideAlert() {
  const el = document.getElementById('auth-alert');
  el.className = 'auth-alert hidden';
  el.textContent = '';
}
function togglePassword(targetId, btn) {
  const input = document.getElementById(targetId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
  const icon = btn.querySelector('i');
  if (icon) icon.setAttribute('data-lucide', input.type === 'password' ? 'eye' : 'eye-off');
  lucide.createIcons();
}

async function handleLogin() {
  const email = getValue('login-email').toLowerCase();
  const password = getValue('login-pass');
  if (!email || !password) return showAlert('Vui lòng nhập email và mật khẩu.', 'error');

  try {
    const approvedSnap = await db.collection('approved_emails').doc(email).get();
    if (!approvedSnap.exists() || approvedSnap.data().approved !== true) {
      return showAlert('Email chưa được admin phê duyệt.', 'error');
    }

    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    console.error(error);
    showAlert(mapAuthError(error), 'error');
  }
}

async function handleForgotPassword() {
  const email = getValue('login-email').toLowerCase();
  if (!email) return showAlert('Nhập email trước khi gửi yêu cầu đặt lại mật khẩu.', 'error');
  try {
    await auth.sendPasswordResetEmail(email);
    showAlert('Đã gửi email đặt lại mật khẩu.', 'success');
  } catch (error) {
    showAlert(mapAuthError(error), 'error');
  }
}

async function submitRegistrationRequest() {
  const name = getValue('request-name');
  const email = getValue('request-email').toLowerCase();
  const password = getValue('request-pass');
  if (!name || !email || !password) return showAlert('Vui lòng nhập đủ họ tên, email và mật khẩu đề xuất.', 'error');

  try {
    await db.collection('pending_registrations').doc(email).set({
      name,
      email,
      password,
      status: 'pending',
      createdAt: Date.now()
    }, { merge: true });
    showAlert('Đã gửi yêu cầu. Chờ admin phê duyệt.', 'success');
  } catch (error) {
    console.error(error);
    showAlert('Không gửi được yêu cầu phê duyệt.', 'error');
  }
}

async function createApprovedAccount() {
  const name = getValue('create-name');
  const email = getValue('create-email').toLowerCase();
  const password = getValue('create-pass');
  if (!name || !email || !password) return showAlert('Vui lòng nhập đủ thông tin.', 'error');

  try {
    const approvedSnap = await db.collection('approved_emails').doc(email).get();
    if (!approvedSnap.exists() || approvedSnap.data().approved !== true) {
      return showAlert('Email chưa được admin phê duyệt.', 'error');
    }

    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection('users').doc(cred.user.uid).set({
      uid: cred.user.uid,
      email,
      name,
      role: approvedSnap.data().role || 'user',
      status: 'active',
      createdAt: Date.now(),
      theme: 'dark'
    }, { merge: true });

    const pendingSnap = await db.collection('pending_registrations').doc(email).get();
    if (pendingSnap.exists()) {
      await db.collection('pending_registrations').doc(email).set({ status: 'created', createdUserId: cred.user.uid, updatedAt: Date.now() }, { merge: true });
    }

    showAlert('Tạo tài khoản thành công. Đang đăng nhập...', 'success');
  } catch (error) {
    console.error(error);
    showAlert(mapAuthError(error), 'error');
  }
}

function updateCurrentUserUI() {
  document.getElementById('current-user-name').textContent = userProfile?.name || currentUser?.email || '-';
  document.getElementById('current-user-meta').textContent = `${currentUser?.email || '-'} • ${userRole}`;
}

function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.toggle('hidden', el.id !== `tab-${tab}`));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
}

function subscribeUserData() {
  if (!currentUser) return;

  db.collection('journal').where('userId', '==', currentUser.uid).orderBy('date', 'desc')
    .onSnapshot((snap) => {
      state.journal = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderJournalTable();
      renderDashboard();
    });

  db.collection('watchlist').where('userId', '==', currentUser.uid).orderBy('ticker', 'asc')
    .onSnapshot((snap) => {
      state.watchlist = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderWatchlistTable();
      renderDashboard();
    });

  db.collection('patterns').orderBy('name', 'asc')
    .onSnapshot((snap) => {
      state.patterns = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderPatterns();
    });
}

function renderDashboard() {
  const totalPnl = state.journal.reduce((sum, x) => sum + Number(x.pnl || 0), 0);
  const openTrades = state.journal.filter(x => x.status === 'open').length;
  document.getElementById('stat-total-trades').textContent = String(state.journal.length);
  document.getElementById('stat-open-trades').textContent = String(openTrades);
  document.getElementById('stat-total-pnl').textContent = formatCurrency(totalPnl);
  document.getElementById('stat-balance').textContent = formatCurrency(totalPnl);

  const recentBox = document.getElementById('dashboard-recent-journal');
  if (!state.journal.length) {
    recentBox.innerHTML = '<div class="empty-state">Chưa có dữ liệu nhật ký.</div>';
  } else {
    recentBox.innerHTML = state.journal.slice(0, 5).map(item => `
      <div class="flex items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div>
          <div class="font-semibold text-white">${escapeHtml(item.ticker || '-')} • ${escapeHtml(item.setup || '-')}</div>
          <div class="text-xs text-slate-400">${escapeHtml(item.date || '')} • ${item.status === 'open' ? 'Đang mở' : 'Đóng'}</div>
        </div>
        <div class="${Number(item.pnl || 0) >= 0 ? 'profit-text' : 'loss-text'}">${formatCurrency(Number(item.pnl || 0))}</div>
      </div>
    `).join('');
  }

  const watchBox = document.getElementById('dashboard-watchlist');
  if (!state.watchlist.length) {
    watchBox.innerHTML = '<div class="empty-state">Chưa có watchlist.</div>';
  } else {
    watchBox.innerHTML = state.watchlist.slice(0, 5).map(item => `
      <div class="flex items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div>
          <div class="font-semibold text-white">${escapeHtml(item.ticker || '-')}</div>
          <div class="text-xs text-slate-400">${escapeHtml(item.pattern || '-')} • ${escapeHtml(item.status || '-')}</div>
        </div>
        <div class="text-sm text-emerald-300">${escapeHtml(item.buyZone || '-')}</div>
      </div>
    `).join('');
  }
}

function renderJournalTable() {
  const body = document.getElementById('journal-body');
  const queryText = getValue('journal-search').toLowerCase();
  const resultFilter = getValue('journal-filter-result');

  let rows = [...state.journal];
  if (queryText) rows = rows.filter(x => `${x.ticker || ''} ${x.setup || ''}`.toLowerCase().includes(queryText));
  if (resultFilter === 'open') rows = rows.filter(x => x.status === 'open');
  if (resultFilter === 'closed') rows = rows.filter(x => x.status === 'closed');
  if (resultFilter === 'profit') rows = rows.filter(x => Number(x.pnl || 0) > 0);
  if (resultFilter === 'loss') rows = rows.filter(x => Number(x.pnl || 0) < 0);

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-state">Không có dữ liệu phù hợp.</td></tr>';
    return;
  }

  body.innerHTML = rows.map(item => {
    const pnl = Number(item.pnl || 0);
    const statusText = item.status === 'open' ? 'Đang mở' : 'Đóng';
    return `
      <tr>
        <td>${escapeHtml(item.date || '')}</td>
        <td class="font-semibold text-white">${escapeHtml(item.ticker || '')}</td>
        <td>${escapeHtml(item.setup || '')}</td>
        <td><span class="badge ${item.status === 'open' ? 'open' : 'closed'}">${statusText}</span></td>
        <td class="${pnl >= 0 ? 'profit-text' : 'loss-text'}">${formatCurrency(pnl)}</td>
        <td>
          <div class="action-row">
            <button class="btn btn-secondary btn-sm" onclick="editJournal('${item.id}')">Sửa</button>
            <button class="btn btn-secondary btn-sm" onclick="deleteJournal('${item.id}')">Xóa</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function saveJournal() {
  if (!currentUser) return;
  const payload = {
    userId: currentUser.uid,
    date: getValue('journal-date'),
    ticker: getValue('journal-ticker').toUpperCase(),
    setup: getValue('journal-setup'),
    status: getValue('journal-status'),
    entryPrice: toNumber('journal-entry'),
    exitPrice: toNumber('journal-exit'),
    pnl: toNumber('journal-pnl'),
    imageUrl: getValue('journal-image'),
    emotion: getValue('journal-emotion'),
    marketPulse: getValue('journal-market'),
    note: getValue('journal-note'),
    updatedAt: Date.now()
  };

  if (!payload.date || !payload.ticker) return alert('Ngày và mã là bắt buộc.');

  const id = getValue('journal-id');
  try {
    if (id) {
      const docRef = db.collection('journal').doc(id);
      const snap = await docRef.get();
      if (!snap.exists || snap.data().userId !== currentUser.uid) return alert('Không có quyền sửa dữ liệu này.');
      await docRef.set(payload, { merge: true });
    } else {
      payload.createdAt = Date.now();
      await db.collection('journal').add(payload);
    }
    clearJournalForm();
  } catch (error) {
    console.error(error);
    alert('Không lưu được lệnh. Kiểm tra Rules và Index của Firestore.');
  }
}

window.editJournal = function(id) {
  const item = state.journal.find(x => x.id === id);
  if (!item) return;
  setValue('journal-id', item.id);
  setValue('journal-date', item.date || '');
  setValue('journal-ticker', item.ticker || '');
  setValue('journal-setup', item.setup || '');
  setValue('journal-status', item.status || 'open');
  setValue('journal-entry', item.entryPrice ?? '');
  setValue('journal-exit', item.exitPrice ?? '');
  setValue('journal-pnl', item.pnl ?? '');
  setValue('journal-image', item.imageUrl || '');
  setValue('journal-emotion', item.emotion || '');
  setValue('journal-market', item.marketPulse || '');
  setValue('journal-note', item.note || '');
  switchTab('journal');
};
window.deleteJournal = async function(id) {
  if (!confirm('Xóa lệnh này?')) return;
  await db.collection('journal').doc(id).delete();
};
function clearJournalForm() {
  ['journal-id','journal-date','journal-ticker','journal-setup','journal-entry','journal-exit','journal-pnl','journal-image','journal-emotion','journal-market','journal-note'].forEach(id => setValue(id, ''));
  setValue('journal-status', 'open');
}

function renderWatchlistTable() {
  const body = document.getElementById('watchlist-body');
  if (!state.watchlist.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty-state">Chưa có watchlist.</td></tr>';
    return;
  }
  body.innerHTML = state.watchlist.map(item => `
    <tr>
      <td class="font-semibold text-white">${escapeHtml(item.ticker || '')}</td>
      <td>${escapeHtml(item.pattern || '')}</td>
      <td>${escapeHtml(item.buyZone || '')}</td>
      <td>${escapeHtml(item.status || '')}</td>
      <td><div class="action-row"><button class="btn btn-secondary btn-sm" onclick="editWatchlist('${item.id}')">Sửa</button><button class="btn btn-secondary btn-sm" onclick="deleteWatchlist('${item.id}')">Xóa</button></div></td>
    </tr>
  `).join('');
}
async function saveWatchlist() {
  if (!currentUser) return;
  const payload = {
    userId: currentUser.uid,
    ticker: getValue('watchlist-ticker').toUpperCase(),
    pattern: getValue('watchlist-pattern'),
    buyZone: getValue('watchlist-buy-zone'),
    status: getValue('watchlist-status'),
    note: getValue('watchlist-note'),
    updatedAt: Date.now()
  };
  if (!payload.ticker) return alert('Mã là bắt buộc.');
  const id = getValue('watchlist-id');
  if (id) await db.collection('watchlist').doc(id).set(payload, { merge: true });
  else { payload.createdAt = Date.now(); await db.collection('watchlist').add(payload); }
  clearWatchlistForm();
}
window.editWatchlist = function(id) {
  const item = state.watchlist.find(x => x.id === id);
  if (!item) return;
  setValue('watchlist-id', item.id);
  setValue('watchlist-ticker', item.ticker || '');
  setValue('watchlist-pattern', item.pattern || '');
  setValue('watchlist-buy-zone', item.buyZone || '');
  setValue('watchlist-status', item.status || 'watching');
  setValue('watchlist-note', item.note || '');
  switchTab('watchlist');
};
window.deleteWatchlist = async function(id) { if (confirm('Xóa watchlist này?')) await db.collection('watchlist').doc(id).delete(); };
function clearWatchlistForm() { ['watchlist-id','watchlist-ticker','watchlist-pattern','watchlist-buy-zone','watchlist-note'].forEach(id => setValue(id, '')); setValue('watchlist-status', 'watching'); }

function renderPatterns() {
  const wrap = document.getElementById('patterns-grid');
  if (!state.patterns.length) {
    wrap.innerHTML = '<div class="empty-state">Chưa có mẫu hình.</div>';
    return;
  }
  wrap.innerHTML = state.patterns.map(item => {
    const conditions = splitLines(item.conditions).map(x => `<li>${escapeHtml(x)}</li>`).join('');
    const trigger = splitLines(item.trigger).map(x => `<li>${escapeHtml(x)}</li>`).join('');
    return `
      <div class="glass-panel pattern-card">
        ${item.imageUrl ? `<img src="${escapeAttribute(item.imageUrl)}" alt="${escapeAttribute(item.name || 'pattern')}" />` : '<div class="empty-state">Chưa có ảnh minh họa.</div>'}
        <div>
          <h4>${escapeHtml(item.name || '')}</h4>
          <div class="pattern-meta">${escapeHtml(item.strategy || '')}</div>
        </div>
        <div class="text-sm text-slate-300">${escapeHtml(item.description || '')}</div>
        <div>
          <div class="text-xs font-bold text-slate-400 uppercase mb-1">Điều kiện nền</div>
          <ul class="pattern-list">${conditions || '<li>-</li>'}</ul>
        </div>
        <div>
          <div class="text-xs font-bold text-slate-400 uppercase mb-1">Điều kiện kích hoạt</div>
          <ul class="pattern-list">${trigger || '<li>-</li>'}</ul>
        </div>
        ${userRole === 'admin' ? `<div class="action-row"><button class="btn btn-secondary btn-sm" onclick="editPattern('${item.id}')">Sửa</button><button class="btn btn-secondary btn-sm" onclick="deletePattern('${item.id}')">Xóa</button></div>` : ''}
      </div>
    `;
  }).join('');
}
async function savePattern() {
  if (userRole !== 'admin') return alert('Chỉ admin mới được sửa mẫu hình.');
  const payload = {
    name: getValue('pattern-name'),
    strategy: getValue('pattern-strategy'),
    imageUrl: getValue('pattern-image'),
    description: getValue('pattern-description'),
    conditions: getValue('pattern-conditions'),
    trigger: getValue('pattern-trigger'),
    updatedAt: Date.now(),
    updatedBy: currentUser.email
  };
  if (!payload.name) return alert('Tên mẫu hình là bắt buộc.');
  const id = getValue('pattern-id');
  if (id) await db.collection('patterns').doc(id).set(payload, { merge: true });
  else { payload.createdAt = Date.now(); await db.collection('patterns').add(payload); }
  clearPatternForm();
}
window.editPattern = function(id) {
  if (userRole !== 'admin') return;
  const item = state.patterns.find(x => x.id === id);
  if (!item) return;
  setValue('pattern-id', item.id);
  setValue('pattern-name', item.name || '');
  setValue('pattern-strategy', item.strategy || '');
  setValue('pattern-image', item.imageUrl || '');
  setValue('pattern-description', item.description || '');
  setValue('pattern-conditions', item.conditions || '');
  setValue('pattern-trigger', item.trigger || '');
  switchTab('patterns');
};
window.deletePattern = async function(id) {
  if (userRole !== 'admin') return;
  if (confirm('Xóa mẫu hình này?')) await db.collection('patterns').doc(id).delete();
};
function clearPatternForm() { ['pattern-id','pattern-name','pattern-strategy','pattern-image','pattern-description','pattern-conditions','pattern-trigger'].forEach(id => setValue(id, '')); }

async function loadPendingRegistrations() {
  if (userRole !== 'admin') return;
  const snap = await db.collection('pending_registrations').orderBy('createdAt', 'desc').get();
  state.pending = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const body = document.getElementById('pending-body');
  if (!state.pending.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty-state">Không có yêu cầu chờ duyệt.</td></tr>';
    return;
  }
  body.innerHTML = state.pending.map(item => `
    <tr>
      <td>${escapeHtml(item.name || '')}</td>
      <td>${escapeHtml(item.email || '')}</td>
      <td>${escapeHtml(item.password || '')}</td>
      <td>${escapeHtml(item.status || 'pending')}</td>
      <td>
        <div class="action-row">
          <button class="btn btn-primary btn-sm" onclick="approveEmail('${escapeJs(item.email)}', '${escapeJs(item.name || '')}')">Duyệt</button>
          <button class="btn btn-secondary btn-sm" onclick="rejectEmail('${escapeJs(item.email)}')">Từ chối</button>
        </div>
      </td>
    </tr>
  `).join('');
}
window.approveEmail = async function(email, name) {
  if (userRole !== 'admin') return;
  await db.collection('approved_emails').doc(email.toLowerCase()).set({
    email: email.toLowerCase(),
    approved: true,
    role: 'user',
    approvedBy: currentUser.email,
    approvedAt: Date.now(),
    name: name || ''
  }, { merge: true });
  await db.collection('pending_registrations').doc(email.toLowerCase()).set({ status: 'approved', updatedAt: Date.now() }, { merge: true });
  loadPendingRegistrations();
};
window.rejectEmail = async function(email) {
  if (userRole !== 'admin') return;
  await db.collection('pending_registrations').doc(email.toLowerCase()).set({ status: 'rejected', updatedAt: Date.now() }, { merge: true });
  loadPendingRegistrations();
};

async function seedDefaultsIfMissing() {
  try {
    const marketRef = db.collection('settings').doc('market');
    const marketSnap = await marketRef.get();
    if (!marketSnap.exists) await marketRef.set({ distDays: 0, updatedAt: Date.now() });
  } catch (e) {
    console.warn('Seed skipped', e);
  }
}

function setupLanding() {
  const canvas = document.getElementById('network-canvas');
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0;
  const mouse = { x: null, y: null, radius: 140 };
  const colors = ['#22c55e', '#3b82f6', '#eab308', '#ef4444'];
  const particles = [];
  const count = 85;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  class Particle {
    constructor() { this.reset(); this.x = Math.random() * w; this.y = Math.random() * h; }
    reset() {
      this.size = Math.random() * 2 + 1;
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.vx = (Math.random() - 0.5) * 0.7;
      this.vy = (Math.random() - 0.5) * 0.7;
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      if (this.x < 0 || this.x > w) this.vx *= -1;
      if (this.y < 0 || this.y > h) this.vy *= -1;
    }
    draw() {
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.fill();
    }
  }
  function connect() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(255,255,255,${0.08 * (1 - dist / 120)})`;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
      if (mouse.x !== null) {
        const mdx = particles[i].x - mouse.x;
        const mdy = particles[i].y - mouse.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < mouse.radius) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(18,216,158,${0.25 * (1 - mdist / mouse.radius)})`;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
    }
  }
  function animate() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => { p.update(); p.draw(); });
    connect();
    requestAnimationFrame(animate);
  }
  resize();
  for (let i = 0; i < count; i++) particles.push(new Particle());
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseleave', () => { mouse.x = null; mouse.y = null; });
  animate();
}

function getValue(id) { return (document.getElementById(id)?.value || '').trim(); }
function setValue(id, value) { const el = document.getElementById(id); if (el) el.value = value; }
function toNumber(id) { const n = Number(getValue(id)); return Number.isFinite(n) ? n : 0; }
function formatCurrency(value) { return `${Number(value || 0).toLocaleString('vi-VN')} đ`; }
function splitLines(text) { return String(text || '').split('\n').map(x => x.trim()).filter(Boolean); }
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function escapeAttribute(s) { return escapeHtml(s).replace(/`/g, '&#96;'); }
function escapeJs(s) { return String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function mapAuthError(error) {
  const code = error?.code || '';
  if (code.includes('wrong-password')) return 'Sai mật khẩu.';
  if (code.includes('user-not-found')) return 'Email chưa tồn tại.';
  if (code.includes('invalid-email')) return 'Email không hợp lệ.';
  if (code.includes('email-already-in-use')) return 'Email đã có tài khoản.';
  if (code.includes('weak-password')) return 'Mật khẩu quá yếu, cần ít nhất 6 ký tự.';
  return error?.message || 'Có lỗi xảy ra.';
}
