let currentUser = null;
let userRole = 'user';
let journalUnsub = null;
let marketUnsub = null;
let chatUnsub = null;
let currentTrades = [];
let editingTradeId = null;

window.onload = () => {
  lucide.createIcons();
  initLanding();
  bindUi();
};

auth.onAuthStateChanged(async (user) => {
  currentUser = user || null;

  if (journalUnsub) { journalUnsub(); journalUnsub = null; }
  if (marketUnsub) { marketUnsub(); marketUnsub = null; }
  if (chatUnsub) { chatUnsub(); chatUnsub = null; }

  if (user) {
    await ensureUserProfile(user);
    await checkAdminRole(user.uid);
    hideLoginModal();
    document.getElementById('header-login-btn').classList.add('hidden');
    document.getElementById('header-logout-btn').classList.remove('hidden');
    document.getElementById('user-badge').classList.remove('hidden');
    document.getElementById('user-badge').textContent = user.email;
    setSyncStatus('Đã đăng nhập · ' + user.email);
    loadUserJournal();
    loadGlobalMarket();
  } else {
    userRole = 'user';
    document.body.classList.remove('is-admin');
    document.getElementById('header-login-btn').classList.remove('hidden');
    document.getElementById('header-logout-btn').classList.add('hidden');
    document.getElementById('user-badge').classList.add('hidden');
    document.getElementById('user-badge').textContent = '';
    document.getElementById('journal-body').innerHTML = '';
    document.getElementById('journal-pnl-total').textContent = '0đ';
    setDashboardFromTrades([]);
    setSyncStatus('Chưa đăng nhập');
  }
  lucide.createIcons();
});

function bindUi() {
  document.getElementById('login-pass').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
}

function initLanding() {
  const landing = document.getElementById('landing-screen');
  document.getElementById('open-login-btn').addEventListener('click', () => {
    landing.classList.add('hidden');
    showLoginModal();
  });
  document.getElementById('landing-demo-btn').addEventListener('click', () => {
    landing.classList.add('hidden');
  });
  initNetworkCanvas();
}

function initNetworkCanvas() {
  const canvas = document.getElementById('network-canvas');
  const ctx = canvas.getContext('2d');
  const mouse = { x: null, y: null };
  let particles = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    particles = Array.from({ length: Math.min(90, Math.floor(window.innerWidth / 18)) }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.7,
      vy: (Math.random() - 0.5) * 0.7,
      r: Math.random() * 2.2 + 1,
      c: ['#10b981','#3b82f6','#f59e0b','#ef4444'][Math.floor(Math.random()*4)]
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      ctx.beginPath();
      ctx.fillStyle = p.c;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 13000) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(255,255,255,${0.12 - d2 / 13000 * 0.1})`;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
      if (mouse.x !== null) {
        const dx = particles[i].x - mouse.x;
        const dy = particles[i].y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 24000) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(16,185,129,0.18)';
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseleave', () => { mouse.x = null; mouse.y = null; });
  resize();
  draw();
}

function showLoginModal() {
  const modal = document.getElementById('login-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  lucide.createIcons();
}

function hideLoginModal() {
  const modal = document.getElementById('login-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function setAuthStatus(text, isError = false) {
  const box = document.getElementById('auth-status');
  box.textContent = text;
  box.className = `text-sm rounded-xl px-4 py-3 text-left border ${isError ? 'bg-rose-950/60 border-rose-500/30 text-rose-200' : 'bg-white/5 border-white/10 text-slate-300'}`;
}

function setSyncStatus(text) {
  document.getElementById('sync-status').textContent = text;
}

async function ensureUserProfile(user) {
  await db.collection('users').doc(user.uid).set({
    uid: user.uid,
    email: user.email || '',
    name: user.displayName || user.email?.split('@')[0] || 'Trader',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function checkAdminRole(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    userRole = doc.exists && doc.data().role === 'admin' ? 'admin' : 'user';
    document.body.classList.toggle('is-admin', userRole === 'admin');
  } catch (e) {
    userRole = 'user';
    document.body.classList.remove('is-admin');
  }
}

async function handleLogin() {
  const e = document.getElementById('login-email').value.trim();
  const p = document.getElementById('login-pass').value;
  try {
    if (!e || !p) throw new Error('Vui lòng nhập email và mật khẩu.');
    setAuthStatus('Đang đăng nhập...');
    await auth.signInWithEmailAndPassword(e, p);
    setAuthStatus('Đăng nhập thành công.');
  } catch (error) {
    console.error(error);
    setAuthStatus(error.message || 'Sai tài khoản hoặc mật khẩu.', true);
  }
}

async function handleRegister() {
  const e = document.getElementById('login-email').value.trim();
  const p = document.getElementById('login-pass').value;
  try {
    if (!e || !p) throw new Error('Vui lòng nhập email và mật khẩu để tạo tài khoản.');
    setAuthStatus('Đang tạo tài khoản...');
    await auth.createUserWithEmailAndPassword(e, p);
    setAuthStatus('Tạo tài khoản thành công.');
  } catch (error) {
    console.error(error);
    setAuthStatus(error.message || 'Không tạo được tài khoản.', true);
  }
}

async function handleResetPassword() {
  const e = document.getElementById('login-email').value.trim();
  try {
    if (!e) throw new Error('Vui lòng nhập email để đặt lại mật khẩu.');
    await auth.sendPasswordResetEmail(e);
    setAuthStatus('Đã gửi email đặt lại mật khẩu.');
  } catch (error) {
    setAuthStatus(error.message || 'Không gửi được email.', true);
  }
}

async function handleLogout() {
  await auth.signOut();
  showLoginModal();
}

function togglePassword(id, btn) {
  const input = document.getElementById(id);
  const isPwd = input.type === 'password';
  input.type = isPwd ? 'text' : 'password';
  const icon = btn.querySelector('i');
  icon.setAttribute('data-lucide', isPwd ? 'eye-off' : 'eye');
  lucide.createIcons();
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById('tab-' + tabId).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-' + tabId).classList.add('active');
}

function currency(v) {
  return `${Number(v || 0).toLocaleString('vi-VN')}đ`;
}

function resultChip(result) {
  if (result === 'win') return '<span class="result-chip result-win">Lãi</span>';
  if (result === 'loss') return '<span class="result-chip result-loss">Lỗ</span>';
  return '<span class="result-chip result-open">Đang mở</span>';
}

function normalizeTrade(id, data) {
  const qty = Number(data.qty || 0);
  const entry = Number(data.entry || 0);
  const hasExit = data.exit !== null && data.exit !== '' && !Number.isNaN(Number(data.exit));
  const exit = hasExit ? Number(data.exit) : null;
  const pnl = exit !== null ? Math.round((exit - entry) * qty) : 0;
  return {
    id,
    userId: data.userId,
    date: data.date || '',
    ticker: (data.ticker || '').toUpperCase(),
    setup: data.setup || '',
    entry,
    exit,
    qty,
    status: data.status || (data.result === 'open' ? 'open' : 'closed'),
    result: data.result || (exit === null ? 'open' : pnl >= 0 ? 'win' : 'loss'),
    note: data.note || '',
    pnl,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null
  };
}

function getFilteredTrades() {
  const filter = document.getElementById('journal-filter')?.value || 'all';
  let rows = [...currentTrades];
  if (filter === 'open') rows = rows.filter(t => t.status === 'open' || t.result === 'open');
  if (filter === 'closed') rows = rows.filter(t => t.status === 'closed');
  if (filter === 'win') rows = rows.filter(t => t.result === 'win');
  if (filter === 'loss') rows = rows.filter(t => t.result === 'loss');
  rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return rows;
}

function renderJournal() {
  const rows = getFilteredTrades();
  const body = document.getElementById('journal-body');
  body.innerHTML = rows.map(t => `
    <tr class="border-b border-white/5">
      <td class="p-5 font-mono">${t.date || ''}</td>
      <td class="p-5 font-black text-white">${t.ticker}</td>
      <td class="p-5">${t.setup || ''}</td>
      <td class="p-5">${resultChip(t.result)}</td>
      <td class="p-5 text-right font-mono ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${currency(t.pnl)}</td>
      <td class="p-5 text-right">
        <div class="inline-flex gap-2">
          <button class="table-action edit" onclick="openTradeModal('${t.id}')">Sửa</button>
          <button class="table-action delete" onclick="deleteTrade('${t.id}')">Xóa</button>
        </div>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="6" class="p-8 text-center text-slate-500">Chưa có dữ liệu nhật ký.</td></tr>`;
  const total = rows.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
  const totalBox = document.getElementById('journal-pnl-total');
  totalBox.textContent = currency(total);
  totalBox.classList.toggle('text-rose-400', total < 0);
  totalBox.classList.toggle('text-emerald-400', total >= 0);
  setDashboardFromTrades(currentTrades);
}

function setDashboardFromTrades(trades) {
  const holding = trades.filter(t => t.status === 'open').length;
  const closed = trades.filter(t => t.status === 'closed').length;
  const wins = trades.filter(t => t.result === 'win').length;
  const decided = trades.filter(t => t.result === 'win' || t.result === 'loss').length;
  const pnl = trades.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
  document.getElementById('dash-balance').textContent = currency(pnl);
  document.getElementById('dash-holding').textContent = String(holding);
  document.getElementById('dash-closed').textContent = String(closed);
  document.getElementById('dash-winrate').textContent = decided ? `${Math.round((wins / decided) * 100)}%` : '0%';
}

function loadUserJournal() {
  if (!currentUser) return;
  if (journalUnsub) journalUnsub();
  setSyncStatus('Đang đồng bộ nhật ký...');
  journalUnsub = db.collection('journal').where('userId', '==', currentUser.uid)
    .onSnapshot((snap) => {
      currentTrades = snap.docs.map(doc => normalizeTrade(doc.id, doc.data()));
      renderJournal();
      setSyncStatus(`Đã đồng bộ ${currentTrades.length} lệnh`);
    }, (error) => {
      console.error(error);
      setSyncStatus('Lỗi tải nhật ký');
      alert('Không tải được dữ liệu nhật ký: ' + (error.message || error));
    });
}

function openTradeModal(id = null) {
  if (!currentUser) {
    showLoginModal();
    return;
  }
  editingTradeId = id;
  const t = currentTrades.find(x => x.id === id) || { date: new Date().toISOString().slice(0,10), result: 'open', status: 'open' };
  document.getElementById('trade-modal-title').textContent = id ? 'Chỉnh sửa lệnh' : 'Thêm lệnh mới';
  document.getElementById('trade-date').value = t.date || new Date().toISOString().slice(0,10);
  document.getElementById('trade-ticker').value = t.ticker || '';
  document.getElementById('trade-setup').value = t.setup || '';
  document.getElementById('trade-entry').value = t.entry || '';
  document.getElementById('trade-exit').value = t.exit ?? '';
  document.getElementById('trade-qty').value = t.qty || '';
  document.getElementById('trade-result').value = t.result || 'open';
  document.getElementById('trade-status').value = t.status || 'open';
  document.getElementById('trade-note').value = t.note || '';
  handleTradeResultChange();
  document.getElementById('trade-modal').classList.remove('hidden');
  document.getElementById('trade-modal').classList.add('flex');
  lucide.createIcons();
}

function closeTradeModal() {
  document.getElementById('trade-modal').classList.add('hidden');
  document.getElementById('trade-modal').classList.remove('flex');
}

function handleTradeResultChange() {
  const result = document.getElementById('trade-result').value;
  const status = document.getElementById('trade-status');
  const exit = document.getElementById('trade-exit');
  if (result === 'open') {
    status.value = 'open';
    exit.value = '';
    exit.disabled = true;
  } else {
    status.value = 'closed';
    exit.disabled = false;
  }
}

async function saveTrade() {
  if (!currentUser) {
    showLoginModal();
    return;
  }
  try {
    const payload = {
      userId: currentUser.uid,
      date: document.getElementById('trade-date').value,
      ticker: document.getElementById('trade-ticker').value.trim().toUpperCase(),
      setup: document.getElementById('trade-setup').value.trim(),
      entry: Number(document.getElementById('trade-entry').value || 0),
      exit: document.getElementById('trade-result').value === 'open' ? null : Number(document.getElementById('trade-exit').value || 0),
      qty: Number(document.getElementById('trade-qty').value || 0),
      result: document.getElementById('trade-result').value,
      status: document.getElementById('trade-status').value,
      note: document.getElementById('trade-note').value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!payload.date || !payload.ticker || !payload.setup || !payload.entry || !payload.qty) {
      throw new Error('Vui lòng nhập đủ ngày, mã, setup, giá mua và khối lượng.');
    }
    if (payload.result !== 'open' && (!payload.exit || Number.isNaN(payload.exit))) {
      throw new Error('Lệnh đã kết thúc cần có giá bán.');
    }

    setSyncStatus('Đang lưu dữ liệu...');
    if (editingTradeId) {
      await db.collection('journal').doc(editingTradeId).set(payload, { merge: true });
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('journal').add(payload);
    }
    closeTradeModal();
    setSyncStatus('Đã lưu dữ liệu');
  } catch (error) {
    console.error(error);
    setSyncStatus('Lưu thất bại');
    alert('Không lưu được dữ liệu: ' + (error.message || error));
  }
}

async function deleteTrade(id) {
  if (!currentUser || !id) return;
  if (!confirm('Bạn chắc chắn muốn xóa lệnh này?')) return;
  try {
    await db.collection('journal').doc(id).delete();
  } catch (error) {
    alert('Không xóa được dữ liệu: ' + (error.message || error));
  }
}

function toggleChat() {
  const box = document.getElementById('chat-container');
  box.classList.toggle('hidden');
  if (!box.classList.contains('hidden')) loadChat();
}

async function sendChatMessage() {
  if (!currentUser) {
    showLoginModal();
    return;
  }
  const inp = document.getElementById('chat-input');
  if (!inp.value.trim()) return;
  await db.collection('messages').add({
    text: inp.value,
    sender: currentUser.email.split('@')[0],
    role: userRole,
    uid: currentUser.uid,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  inp.value = '';
}

function loadChat() {
  if (chatUnsub) chatUnsub();
  chatUnsub = db.collection('messages').orderBy('timestamp', 'asc').limitToLast(20).onSnapshot(snap => {
    const box = document.getElementById('chat-messages');
    box.innerHTML = snap.docs.map(doc => {
      const m = doc.data();
      const isMe = currentUser && m.uid === currentUser.uid;
      return `<div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
        <span class="text-[8px] text-slate-500 uppercase">${m.sender || 'Guest'} ${m.role === 'admin' ? '🚀' : ''}</span>
        <div class="px-3 py-2 rounded-xl text-[11px] ${isMe ? 'bg-emerald-600 text-white' : 'bg-white/10 text-slate-200'}">${m.text || ''}</div>
      </div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
  });
}

async function updateGlobalMarketSettings() {
  if (!currentUser || userRole !== 'admin') {
    alert('Chỉ admin mới cập nhật được dữ liệu thị trường.');
    return;
  }
  const days = Number(document.getElementById('market-dist-days').value || 0);
  await db.collection('settings').doc('market').set({
    distDays: days,
    updatedBy: currentUser.email,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  alert('Đã cập nhật dữ liệu cho toàn hệ thống!');
}

function loadGlobalMarket() {
  marketUnsub = db.collection('settings').doc('market').onSnapshot(doc => {
    if (doc.exists) {
      document.getElementById('market-dist-days').value = doc.data().distDays || 0;
      document.getElementById('market-dist-days').disabled = userRole !== 'admin';
    }
  });
}
