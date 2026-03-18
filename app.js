let currentUser = null;
let journalUnsub = null;
let marketUnsub = null;
let chatUnsub = null;
let pnlChart = null;

const App = {
  state: {
    trades: [],
    market: { distDays: 0 },
    profile: null,
    welcomeSeen: localStorage.getItem('cacon-welcome-seen') === '1'
  },

  init() {
    this.ensureGuestProfile();
    this.bindDefaults();
    this.initNetworkCanvas();
    this.mountProfile();
    this.listenJournal();
    this.listenMarket();
    this.renderDashboard();
    this.renderJournal();
    if (this.state.welcomeSeen) document.getElementById('welcome-screen').classList.add('hidden');
    lucide.createIcons();
  },

  ensureGuestProfile() {
    const saved = JSON.parse(localStorage.getItem('cacon-public-profile') || 'null');
    if (saved?.guestId) {
      this.state.profile = saved;
    } else {
      const guestId = 'guest_' + Math.random().toString(36).slice(2, 10);
      this.state.profile = {
        guestId,
        displayName: 'Guest Trader ' + guestId.slice(-4)
      };
      localStorage.setItem('cacon-public-profile', JSON.stringify(this.state.profile));
    }
    currentUser = {
      uid: this.state.profile.guestId,
      email: this.state.profile.displayName.replace(/\s+/g, '').toLowerCase() + '@guest.local',
      displayName: this.state.profile.displayName
    };
  },

  bindDefaults() {
    document.getElementById('trade-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('profile-name').value = this.state.profile.displayName;
  },

  mountProfile() {
    document.getElementById('profile-display-name').textContent = this.state.profile.displayName;
    document.getElementById('profile-display-id').textContent = this.state.profile.guestId;
  },

  enterApp() {
    localStorage.setItem('cacon-welcome-seen', '1');
    document.getElementById('welcome-screen').classList.add('hidden');
  },

  openProfileModal() {
    document.getElementById('profile-name').value = this.state.profile.displayName;
    const el = document.getElementById('profile-modal');
    el.classList.remove('hidden');
    el.classList.add('flex');
  },

  closeProfileModal() {
    const el = document.getElementById('profile-modal');
    el.classList.add('hidden');
    el.classList.remove('flex');
  },

  saveProfile() {
    const name = document.getElementById('profile-name').value.trim();
    if (!name) return alert('Bạn hãy nhập tên hiển thị.');
    this.state.profile.displayName = name;
    localStorage.setItem('cacon-public-profile', JSON.stringify(this.state.profile));
    currentUser.displayName = name;
    currentUser.email = name.replace(/\s+/g, '').toLowerCase() + '@guest.local';
    this.mountProfile();
    this.closeProfileModal();
  },

  openTradeModal() {
    const el = document.getElementById('trade-modal');
    el.classList.remove('hidden');
    el.classList.add('flex');
  },

  closeTradeModal() {
    const el = document.getElementById('trade-modal');
    el.classList.add('hidden');
    el.classList.remove('flex');
  },

  async saveTrade() {
    try {
      const file = document.getElementById('trade-image').files?.[0] || null;
      let imageUrl = '';
      if (file) imageUrl = await uploadImage(file);

      const status = document.getElementById('trade-status').value;
      const result = document.getElementById('trade-result').value;
      const entry = Number(document.getElementById('trade-entry').value || 0);
      const exit = Number(document.getElementById('trade-exit').value || 0);
      const qty = Number(document.getElementById('trade-qty').value || 0);
      const pnl = status === 'closed' ? Math.round((exit - entry) * qty) : 0;

      await db.collection('journal').add({
        userId: currentUser.uid,
        displayName: currentUser.displayName,
        date: document.getElementById('trade-date').value,
        ticker: document.getElementById('trade-ticker').value.trim().toUpperCase(),
        setup: document.getElementById('trade-setup').value.trim(),
        status,
        result,
        entry,
        exit,
        qty,
        pnl,
        note: document.getElementById('trade-note').value.trim(),
        imageUrl,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      this.closeTradeModal();
      document.getElementById('trade-image').value = '';
      document.getElementById('trade-ticker').value = '';
      document.getElementById('trade-setup').value = '';
      document.getElementById('trade-entry').value = '';
      document.getElementById('trade-exit').value = '';
      document.getElementById('trade-qty').value = '';
      document.getElementById('trade-note').value = '';
      document.getElementById('trade-status').value = 'open';
      document.getElementById('trade-result').value = 'open';
    } catch (error) {
      console.error(error);
      alert('Không lưu được lệnh: ' + (error.message || error));
    }
  },

  listenJournal() {
    if (journalUnsub) journalUnsub();
    journalUnsub = db.collection('journal')
      .where('userId', '==', currentUser.uid)
      .orderBy('date', 'desc')
      .onSnapshot((snap) => {
        this.state.trades = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        this.renderJournal();
        this.renderDashboard();
      }, (error) => {
        console.error(error);
        alert('Lỗi đọc journal. Bạn hãy kiểm tra Firestore Rules và index.');
      });
  },

  listenMarket() {
    if (marketUnsub) marketUnsub();
    marketUnsub = db.collection('settings').doc('market').onSnapshot((doc) => {
      const data = doc.exists ? doc.data() : { distDays: 0 };
      this.state.market = data;
      document.getElementById('market-dist-days').value = data.distDays || 0;
    });
  },

  renderJournal() {
    const filter = document.getElementById('filter-result').value;
    const filtered = this.state.trades.filter((t) => {
      if (filter === 'all') return true;
      if (filter === 'open') return t.status === 'open';
      if (filter === 'closed') return t.status === 'closed';
      return t.result === filter;
    });

    const body = document.getElementById('journal-body');
    body.innerHTML = filtered.length ? filtered.map((t) => {
      const pnl = Number(t.pnl || 0);
      const statusLabel = t.status === 'open' ? 'Đang mở' : 'Đóng';
      return `<tr class="border-b border-white/5">
        <td class="p-5 font-mono">${t.date || ''}</td>
        <td class="p-5 font-black text-white">${t.ticker || ''}</td>
        <td class="p-5">${t.setup || ''}</td>
        <td class="p-5">${statusLabel}</td>
        <td class="p-5 text-right font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${pnl.toLocaleString('vi-VN')}đ</td>
      </tr>`;
    }).join('') : `<tr><td colspan="5" class="p-6 text-center text-slate-500">Chưa có dữ liệu.</td></tr>`;

    const total = filtered.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
    const totalEl = document.getElementById('journal-pnl-total');
    totalEl.textContent = `${total.toLocaleString('vi-VN')}đ`;
    totalEl.className = `text-2xl font-mono font-black ${total >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
  },

  renderDashboard() {
    const trades = this.state.trades;
    const closed = trades.filter((t) => t.status === 'closed');
    const wins = closed.filter((t) => t.result === 'win').length;
    const pnl = trades.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
    const openCount = trades.filter((t) => t.status === 'open').length;
    const winrate = closed.length ? Math.round((wins / closed.length) * 100) : 0;

    document.getElementById('dash-balance').textContent = `${pnl.toLocaleString('vi-VN')}đ`;
    document.getElementById('dash-holding').textContent = openCount;
    document.getElementById('dash-count').textContent = trades.length;
    document.getElementById('dash-winrate').textContent = `${winrate}%`;

    this.renderChart(trades);
  },

  renderChart(trades) {
    const labels = trades.slice().reverse().map(t => t.ticker || '—');
    const values = trades.slice().reverse().map(t => Number(t.pnl || 0));
    const ctx = document.getElementById('pnl-chart');
    if (pnlChart) pnlChart.destroy();
    pnlChart = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'PnL', data: values, borderWidth: 0, backgroundColor: values.map(v => v >= 0 ? 'rgba(16,185,129,0.8)' : 'rgba(244,63,94,0.8)') }] },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  },

  initNetworkCanvas() {
    const canvas = document.getElementById('network-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const mouse = { x: null, y: null };
    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    const points = Array.from({ length: 75 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5
    }));

    window.addEventListener('resize', () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    });
    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of points) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(52,211,153,0.9)';
        ctx.fill();
      }
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const dx = points[i].x - points[j].x;
          const dy = points[i].y - points[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 120) {
            ctx.beginPath();
            ctx.moveTo(points[i].x, points[i].y);
            ctx.lineTo(points[j].x, points[j].y);
            ctx.strokeStyle = `rgba(148,163,184,${1 - d / 120})`;
            ctx.stroke();
          }
        }
        if (mouse.x !== null) {
          const dx = points[i].x - mouse.x;
          const dy = points[i].y - mouse.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 160) {
            ctx.beginPath();
            ctx.moveTo(points[i].x, points[i].y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(16,185,129,${1 - d / 160})`;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(draw);
    };
    draw();
  }
};

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById('tab-' + tabId).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-' + tabId).classList.add('active');
}

function toggleChat() {
  document.getElementById('chat-container').classList.toggle('hidden');
  if (!document.getElementById('chat-container').classList.contains('hidden') && !chatUnsub) loadChat();
}

async function sendChatMessage() {
  const inp = document.getElementById('chat-input');
  if (!inp.value.trim()) return;
  await db.collection('messages').add({
    text: inp.value.trim(),
    sender: currentUser.displayName,
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
      const isMe = m.uid === currentUser.uid;
      return `<div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
        <span class="text-[8px] text-slate-500 uppercase">${m.sender || 'Guest'}</span>
        <div class="px-3 py-2 rounded-xl text-[11px] ${isMe ? 'bg-emerald-600 text-white' : 'bg-white/10 text-slate-200'}">${m.text || ''}</div>
      </div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
  });
}

async function updateGlobalMarketSettings() {
  const days = Number(document.getElementById('market-dist-days').value || 0);
  await db.collection('settings').doc('market').set({
    distDays: days,
    updatedBy: currentUser.displayName,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  alert('Đã cập nhật dữ liệu thị trường.');
}

async function uploadImage(file) {
  const path = `public_uploads/${currentUser.uid}/${Date.now()}_${file.name}`;
  const ref = storage.ref().child(path);
  await ref.put(file);
  return await ref.getDownloadURL();
}

window.App = App;
window.switchTab = switchTab;
window.toggleChat = toggleChat;
window.sendChatMessage = sendChatMessage;
window.updateGlobalMarketSettings = updateGlobalMarketSettings;
window.addEventListener('DOMContentLoaded', () => App.init());
