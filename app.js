// app.js
window.onload = () => {
    lucide.createIcons();
    initIntroScene();
};

let introActive = true;
let fishTargetX = 0;
let fishTargetY = 0;

function dismissIntro() {
    const intro = document.getElementById('intro-overlay');
    if (!intro) return;
    intro.classList.add('hide');
    introActive = false;
    setTimeout(() => intro.remove(), 700);
}

function initIntroScene() {
    const scene = document.getElementById('ocean-scene');
    const fish = document.getElementById('fish');
    const shark = document.getElementById('shark');
    const intro = document.getElementById('intro-overlay');
    if (!scene || !fish || !shark || !intro) return;

    const rect = () => scene.getBoundingClientRect();
    const start = rect();
    fishTargetX = start.width * 0.32;
    fishTargetY = start.height * 0.6;
    fish.style.left = `${fishTargetX}px`;
    fish.style.top = `${fishTargetY}px`;

    intro.addEventListener('mousemove', (e) => {
        const r = rect();
        fishTargetX = Math.max(90, Math.min(r.width - 90, e.clientX - r.left));
        fishTargetY = Math.max(120, Math.min(r.height - 80, e.clientY - r.top));
        const sharkDx = (e.clientX - r.left - r.width / 2) / 30;
        const sharkDy = (e.clientY - r.top - r.height / 2) / 38;
        shark.style.transform = `translate(${sharkDx}px, ${sharkDy}px)`;
    });

    let fishX = fishTargetX;
    let fishY = fishTargetY;
    let phase = 0;

    const animate = () => {
        if (!document.body.contains(intro)) return;
        fishX += (fishTargetX - fishX) * 0.12;
        fishY += (fishTargetY - fishY) * 0.12;
        fish.style.left = `${fishX}px`;
        fish.style.top = `${fishY}px`;
        fish.style.rotate = `${(fishTargetX - rect().width / 2) / 25}deg`;

        phase += 0.02;
        if (introActive) {
            shark.style.left = `${66 + Math.sin(phase) * 2.5}%`;
            shark.style.top = `${55 + Math.cos(phase * 0.85) * 2.2}%`;
        }
        requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
}

function updateAuthStatus(text) {
    const el = document.getElementById('auth-status-text');
    if (el) el.textContent = text;
}

function updateDashboardStats(rows = []) {
    const totalTrades = rows.length;
    const totalPnL = rows.reduce((sum, item) => sum + Number(item.pnl || 0), 0);
    const holdings = rows.filter(item => Number(item.pnl || 0) === 0).length;

    document.getElementById('dash-trades').textContent = totalTrades;
    document.getElementById('dash-pnl').textContent = `${totalPnL.toLocaleString('vi-VN')}đ`;
    document.getElementById('journal-pnl-total').textContent = `${totalPnL.toLocaleString('vi-VN')}đ`;
    document.getElementById('dash-holding').textContent = holdings;
    document.getElementById('dash-balance').textContent = `${Math.max(0, totalPnL).toLocaleString('vi-VN')}đ`;
}

// Theo dõi trạng thái đăng nhập
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-modal').classList.add('hidden');
        updateAuthStatus(user.email || 'Đã đăng nhập');
        await checkAdminRole(user.uid);
        loadUserJournal(user.uid);
        loadGlobalMarket();
    } else {
        document.getElementById('login-modal').classList.remove('hidden');
        updateAuthStatus('Chưa đăng nhập');
    }
});

async function handleLogin() {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-pass').value;
    const msg = document.getElementById('login-message');
    try {
        await auth.signInWithEmailAndPassword(e, p);
        msg.textContent = 'Đăng nhập thành công.';
    } catch (error) {
        msg.textContent = 'Sai tài khoản hoặc Email/Password chưa được bật trong Firebase.';
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('tab-' + tabId).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-' + tabId).classList.add('active');
}

function loadUserJournal(uid) {
    db.collection('journal').where('userId', '==', uid).orderBy('date', 'desc')
      .onSnapshot(snap => {
          const body = document.getElementById('journal-body');
          const rows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          updateDashboardStats(rows);

          if (!rows.length) {
              body.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400">Chưa có dữ liệu nhật ký cho tài khoản này.</td></tr>`;
              return;
          }

          body.innerHTML = rows.map(t => {
              return `<tr class="border-b border-white/5"><td class="p-5 font-mono">${t.date || ''}</td><td class="p-5 font-black text-white">${t.ticker || ''}</td><td class="p-5">${t.setup || ''}</td><td class="p-5 text-right font-mono ${Number(t.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${Number(t.pnl || 0).toLocaleString('vi-VN')}đ</td></tr>`;
          }).join('');
      }, err => {
          document.getElementById('journal-body').innerHTML = `<tr><td colspan="4" class="p-6 text-center text-rose-400">Không đọc được dữ liệu: ${err.message}</td></tr>`;
      });
}

function toggleChat() {
    document.getElementById('chat-container').classList.toggle('hidden');
    if (!document.getElementById('chat-container').classList.contains('hidden')) loadChat();
}

async function sendChatMessage() {
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
    db.collection('messages').orderBy('timestamp', 'asc').limitToLast(20).onSnapshot(snap => {
        const box = document.getElementById('chat-messages');
        box.innerHTML = snap.docs.map(doc => {
            const m = doc.data();
            const isMe = m.uid === currentUser.uid;
            return `<div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                <span class="text-[8px] text-slate-500 uppercase">${m.sender} ${m.role === 'admin' ? '🚀' : ''}</span>
                <div class="px-3 py-2 rounded-xl text-[11px] ${isMe ? 'bg-emerald-600 text-white' : 'bg-white/10 text-slate-200'}">${m.text}</div>
            </div>`;
        }).join('');
        box.scrollTop = box.scrollHeight;
    });
}

async function updateGlobalMarketSettings() {
    const days = Number(document.getElementById('market-dist-days').value || 0);
    await db.collection('settings').doc('market').set({ distDays: days, updatedBy: currentUser.email }, { merge: true });
    alert('Đã cập nhật dữ liệu thị trường cho toàn hệ thống.');
}

function loadGlobalMarket() {
    db.collection('settings').doc('market').onSnapshot(doc => {
        if (doc.exists) {
            document.getElementById('market-dist-days').value = doc.data().distDays || 0;
            if (userRole !== 'admin') document.getElementById('market-dist-days').disabled = true;
        }
    });
}
