let currentUser = null;
let userRole = 'user';
let pendingUnsubscribe = null;

window.onload = () => {
  lucide.createIcons();
};

auth.onAuthStateChanged(async (user) => {
  currentUser = user || null;
  if (user) {
    document.getElementById('login-modal').classList.add('hidden');
    await checkAdminRole(user.email, user.uid);
    document.getElementById('user-email-show').textContent = user.email || '—';
    document.getElementById('user-role-show').textContent = userRole;
    loadUserJournal(user.uid);
    loadGlobalMarket();
    if (userRole === 'admin') loadPendingRegistrations();
  } else {
    userRole = 'user';
    document.body.classList.remove('is-admin');
    document.getElementById('user-email-show').textContent = 'Chưa đăng nhập';
    document.getElementById('user-role-show').textContent = 'user';
    document.getElementById('login-modal').classList.remove('hidden');
    document.getElementById('journal-body').innerHTML = '';
    document.getElementById('approval-body').innerHTML = '';
    if (pendingUnsubscribe) { pendingUnsubscribe(); pendingUnsubscribe = null; }
  }
});

function setAuthMessage(message, type = '') {
  const box = document.getElementById('auth-message');
  box.className = 'auth-message';
  if (type) box.classList.add(type);
  box.textContent = message;
}

function switchAuthTab(tab) {
  ['login', 'request', 'signup'].forEach(name => {
    document.getElementById(`auth-box-${name}`).classList.toggle('hidden', name !== tab);
    document.getElementById(`tab-btn-${name}`).classList.toggle('active', name === tab);
  });
  setAuthMessage('Admin có thể phê duyệt email đăng ký trong bảng quản trị.');
}

function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.textContent = show ? 'Ẩn' : 'Hiện';
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-pass').value;
  if (!email || !password) return setAuthMessage('Nhập đầy đủ email và mật khẩu.', 'error');
  try {
    await auth.signInWithEmailAndPassword(email, password);
    setAuthMessage('Đăng nhập thành công.', 'success');
  } catch (error) {
    setAuthMessage('Sai tài khoản, sai mật khẩu, hoặc Email/Password chưa bật trên Firebase.', 'error');
  }
}

async function resetPassword() {
  const email = document.getElementById('login-email').value.trim();
  if (!email) return setAuthMessage('Nhập email để gửi link đặt lại mật khẩu.', 'error');
  try {
    await auth.sendPasswordResetEmail(email);
    setAuthMessage('Đã gửi email đặt lại mật khẩu.', 'success');
  } catch (error) {
    setAuthMessage('Không gửi được email đặt lại mật khẩu: ' + (error.message || error), 'error');
  }
}

async function submitRegistrationRequest() {
  const name = document.getElementById('request-name').value.trim();
  const email = document.getElementById('request-email').value.trim().toLowerCase();
  const password = document.getElementById('request-pass').value;
  if (!name || !email || !password) return setAuthMessage('Điền đủ họ tên, email và mật khẩu.', 'error');
  if (password.length < 6) return setAuthMessage('Mật khẩu tối thiểu 6 ký tự.', 'error');

  try {
    await db.collection('pending_registrations').doc(email).set({
      name,
      email,
      password,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    setAuthMessage('Đã gửi yêu cầu đăng ký. Chờ admin phê duyệt email.', 'success');
    switchAuthTab('signup');
    document.getElementById('signup-name').value = name;
    document.getElementById('signup-email').value = email;
    document.getElementById('signup-pass').value = password;
  } catch (error) {
    setAuthMessage('Không gửi được yêu cầu: ' + (error.message || error), 'error');
  }
}

async function completeApprovedSignup() {
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim().toLowerCase();
  const password = document.getElementById('signup-pass').value;
  if (!name || !email || !password) return setAuthMessage('Điền đủ họ tên, email và mật khẩu.', 'error');

  try {
    const approvedDoc = await db.collection('approved_emails').doc(email).get();
    if (!approvedDoc.exists || approvedDoc.data().status !== 'approved') {
      return setAuthMessage('Email này chưa được admin phê duyệt.', 'error');
    }

    const pendingDoc = await db.collection('pending_registrations').doc(email).get();
    if (pendingDoc.exists) {
      const pendingData = pendingDoc.data();
      if (pendingData.password !== password) {
        return setAuthMessage('Mật khẩu không trùng với mật khẩu đã gửi để phê duyệt.', 'error');
      }
    }

    const credential = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection('users').doc(credential.user.uid).set({
      name,
      email,
      role: 'user',
      approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await db.collection('pending_registrations').doc(email).set({
      status: 'completed',
      linkedUid: credential.user.uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    setAuthMessage('Tạo tài khoản thành công.', 'success');
  } catch (error) {
    const msg = String(error.message || error);
    if (msg.includes('email-already-in-use')) {
      setAuthMessage('Email này đã có tài khoản. Hãy đăng nhập.', 'error');
    } else {
      setAuthMessage('Không tạo được tài khoản: ' + msg, 'error');
    }
  }
}

async function checkAdminRole(email, uid) {
  userRole = 'user';
  document.body.classList.remove('is-admin');

  try {
    const adminByEmail = email ? await db.collection('admin_emails').doc(email.toLowerCase()).get() : null;
    const adminByUid = uid ? await db.collection('admins').doc(uid).get() : null;
    if ((adminByEmail && adminByEmail.exists) || (adminByUid && adminByUid.exists)) {
      userRole = 'admin';
      document.body.classList.add('is-admin');
    }
  } catch (error) {
    console.error('checkAdminRole error', error);
  }
}

function loadPendingRegistrations() {
  if (pendingUnsubscribe) pendingUnsubscribe();
  pendingUnsubscribe = db.collection('pending_registrations').orderBy('updatedAt', 'desc').onSnapshot((snap) => {
    const body = document.getElementById('approval-body');
    if (snap.empty) {
      body.innerHTML = '<tr><td colspan="5" class="p-4 text-slate-400">Chưa có yêu cầu đăng ký.</td></tr>';
      return;
    }

    body.innerHTML = snap.docs.map(doc => {
      const item = doc.data();
      const status = item.status || 'pending';
      return `
        <tr>
          <td class="p-4 font-semibold">${escapeHtml(item.name || '')}</td>
          <td class="p-4 normal-case">${escapeHtml(item.email || '')}</td>
          <td class="p-4 normal-case font-mono text-amber-300">${escapeHtml(item.password || '')}</td>
          <td class="p-4"><span class="status-pill status-${status === 'pending' ? 'pending' : status === 'approved' ? 'approved' : 'rejected'}">${status}</span></td>
          <td class="p-4">
            <div class="flex justify-end gap-2">
              <button class="table-btn approve" ${status === 'approved' ? 'disabled' : ''} onclick="approveRegistration('${encodeURIComponent(doc.id)}')">Duyệt</button>
              <button class="table-btn reject" ${status === 'rejected' ? 'disabled' : ''} onclick="rejectRegistration('${encodeURIComponent(doc.id)}')">Từ chối</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  }, (error) => {
    document.getElementById('approval-body').innerHTML = `<tr><td colspan="5" class="p-4 text-rose-300">Lỗi tải danh sách phê duyệt: ${escapeHtml(error.message || String(error))}</td></tr>`;
  });
}

async function approveRegistration(encodedEmail) {
  const email = decodeURIComponent(encodedEmail);
  try {
    const ref = db.collection('pending_registrations').doc(email);
    const snap = await ref.get();
    if (!snap.exists) return;
    const data = snap.data();
    await ref.set({ status: 'approved', updatedAt: firebase.firestore.FieldValue.serverTimestamp(), approvedBy: currentUser.email }, { merge: true });
    await db.collection('approved_emails').doc(email).set({
      email,
      name: data.name || '',
      password: data.password || '',
      status: 'approved',
      approvedBy: currentUser.email,
      approvedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    alert('Không duyệt được: ' + (error.message || error));
  }
}

async function rejectRegistration(encodedEmail) {
  const email = decodeURIComponent(encodedEmail);
  try {
    await db.collection('pending_registrations').doc(email).set({
      status: 'rejected',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      rejectedBy: currentUser.email
    }, { merge: true });
    await db.collection('approved_emails').doc(email).set({
      status: 'rejected',
      email,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    alert('Không từ chối được: ' + (error.message || error));
  }
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById('tab-' + tabId).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-' + tabId).classList.add('active');
}

function loadUserJournal(uid) {
  db.collection('journal').where('userId', '==', uid).orderBy('date', 'desc').onSnapshot(snap => {
    const body = document.getElementById('journal-body');
    let total = 0;
    if (snap.empty) {
      body.innerHTML = '<tr><td colspan="4" class="p-5 text-slate-400">Chưa có dữ liệu nhật ký.</td></tr>';
      document.getElementById('dash-holding').textContent = '0';
      document.getElementById('dash-balance').textContent = '0đ';
      document.getElementById('journal-pnl-total').textContent = '0đ';
      return;
    }

    body.innerHTML = snap.docs.map(doc => {
      const t = doc.data();
      total += Number(t.pnl || 0);
      return `<tr class="border-b border-white/5"><td class="p-5 font-mono">${escapeHtml(t.date || '')}</td><td class="p-5 font-black text-white">${escapeHtml(t.ticker || '')}</td><td class="p-5">${escapeHtml(t.setup || '')}</td><td class="p-5 text-right font-mono ${Number(t.pnl||0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${Number(t.pnl || 0).toLocaleString('vi-VN')}đ</td></tr>`;
    }).join('');

    document.getElementById('dash-holding').textContent = String(snap.size);
    document.getElementById('dash-balance').textContent = total.toLocaleString('vi-VN') + 'đ';
    document.getElementById('journal-pnl-total').textContent = total.toLocaleString('vi-VN') + 'đ';
  });
}

async function seedSampleTrade() {
  if (!currentUser) return;
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  try {
    await db.collection('journal').add({
      userId: currentUser.uid,
      date,
      ticker: 'FPT',
      setup: 'VCP Breakout',
      pnl: Math.floor(Math.random() * 4000000) - 500000,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    alert('Không thêm được lệnh mẫu: ' + (error.message || error));
  }
}

async function updateGlobalMarketSettings() {
  if (userRole !== 'admin') return alert('Chỉ admin mới được cập nhật.');
  const days = Number(document.getElementById('market-dist-days').value || 0);
  await db.collection('settings').doc('market').set({
    distDays: days,
    updatedBy: currentUser?.email || 'unknown',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  alert('Đã cập nhật dữ liệu cho toàn hệ thống.');
}

function loadGlobalMarket() {
  db.collection('settings').doc('market').onSnapshot(doc => {
    if (!doc.exists) return;
    document.getElementById('market-dist-days').value = doc.data().distDays || 0;
    if (userRole !== 'admin') document.getElementById('market-dist-days').setAttribute('disabled', 'disabled');
    else document.getElementById('market-dist-days').removeAttribute('disabled');
  });
}

async function logout() {
  await auth.signOut();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
