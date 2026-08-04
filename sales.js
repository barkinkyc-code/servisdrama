/* ================================================================
   ServisDrama — Satışçı Paneli v1
   ================================================================ */

// ═══ Sabit Değerler ═══
const CURRENT_USER_ID = 'sales-panel-v1';
const STORAGE_KEY = 'sd_sales_state';

// ═══ Başlangıç ═══
document.addEventListener('DOMContentLoaded', () => {
  console.log('✓ Sales.js loaded');
  initializeSalesPanel();
});

async function initializeSalesPanel() {
  try {
    // 1. Kullanıcı doğrulama
    const user = SD.sessionUser();
    if (!user) {
      window.location.href = 'index.html';
      return;
    }

    if (String(user.role || '').toLowerCase() !== 'sales') {
      alert('Yetkisiz erişim. Satışçı paneline sadece satışçılar erişebilir.');
      window.location.href = 'index.html';
      return;
    }

    // 2. Veriyi sunucudan çek — satışçı profili (sd_st) buradan gelir,
    //    bu yüzden profil aramasından ÖNCE tamamlanmalı.
    await SD.remoteReady();

    // 3. Satışçı bilgisini al
    const salesRep = SD.sessionSalesRep();
    if (!salesRep) {
      alert('Satışçı profili bulunamadı. Yöneticinizden hesabınızın satışçı listesine eklenmesini isteyin.');
      doLogout();
      return;
    }

    // 4. UI'yi hazırla ve ilk sayfayı çiz
    initializeUI(user, salesRep);

    // 5. Sync listener
    window.addEventListener('sd-sync-status', (e) => {
      console.log('Sync status:', e.detail.status);
    });

  } catch (err) {
    console.error('Init error:', err);
    alert('Hata: ' + err.message);
  }
}

// ═══ UI İnitialization ═══
function initializeUI(user, salesRep) {
  // Kullanıcı bilgisini göster
  const initials = (user.name || user.username || '?').split(' ').map(w => w[0]).join('').toUpperCase();
  const avatarEl = document.getElementById('navAvatarImg');
  if (avatarEl) avatarEl.textContent = initials;

  const userLabelEl = document.getElementById('navUserLabel');
  if (userLabelEl) userLabelEl.textContent = user.name || user.username;

  const ddAvatarEl = document.getElementById('navDdAvatar');
  if (ddAvatarEl) ddAvatarEl.textContent = initials;

  const ddNameEl = document.getElementById('navDdName');
  if (ddNameEl) ddNameEl.textContent = user.name || user.username;

  // Menu event listeners
  const navTabs = document.querySelectorAll('.nav-tab[data-page]');
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const page = tab.getAttribute('data-page');
      showPage(page);
      closeMobileMenu();
    });
  });

  const logo = document.getElementById('topbarLogo');
  if (logo) {
    logo.addEventListener('click', () => {
      showPage('dashboard');
    });
  }

  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);
  }

  const mobileOverlay = document.getElementById('mobileOverlay');
  if (mobileOverlay) {
    mobileOverlay.addEventListener('click', closeMobileMenu);
  }

  // Aksiyon ekleme formu
  const actionForm = document.getElementById('actionForm');
  if (actionForm) actionForm.addEventListener('submit', submitAction);

  // Firma detay modalı: dış alana tıklama ve Esc ile kapanır
  const detailModal = document.getElementById('companyDetailModal');
  if (detailModal) {
    detailModal.addEventListener('click', e => {
      if (e.target === detailModal) closeCompanyDetail();
    });
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeCompanyDetail();
  });

  // İlk sayfa: Dashboard
  showPage('dashboard');
}

// ═══ Sayfa Navigasyonu ═══
function showPage(pageName) {
  // Tüm sayfaları gizle
  const pages = document.querySelectorAll('.page');
  pages.forEach(p => p.classList.add('hidden'));

  // İstenen sayfayı göster
  const pageId = pageName + 'Content';
  const page = document.getElementById(pageId);
  if (page) {
    page.classList.remove('hidden');
    console.log('✓ Showing page:', pageName);

    // Render fonksiyonlarını çağır
    if (pageName === 'dashboard') renderDashboard();
    else if (pageName === 'firmalar') renderCompanies();
    else if (pageName === 'ziyaretler') renderVisitHistory();
    else if (pageName === 'numuneler') renderSamples();
    else if (pageName === 'aksiyonlar') renderActions();
    else if (pageName === 'bildirimler') renderNotifications();
  }

  // Tab aktifleştir
  const tabs = document.querySelectorAll('.nav-tab[data-page]');
  tabs.forEach(t => {
    if (t.getAttribute('data-page') === pageName) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });
}

// ═══ Dashboard Render ═══
function renderDashboard() {
  const statsGrid = document.getElementById('dashboardStats');
  if (!statsGrid) return;

  const salesRep = SD.sessionSalesRep();
  if (!salesRep) return;

  // Satışçıya atanmış firmalar
  const allCompanies = SD.companies;
  const myCompanies = allCompanies.filter(c => String(c.salesRepId || '') === String(salesRep.id));

  // Ziyaretleri al
  const visits = SD.visits;
  const extras = SD.extras;

  // Stats hesapla
  const stats = [
    {
      title: 'Toplam Firma',
      value: myCompanies.length,
      icon: '🏢',
      color: 'blue'
    },
    {
      title: 'Bu Hafta Gidilmesi Gereken',
      value: getScheduledThisWeek(myCompanies).length,
      icon: '📅',
      color: 'green'
    },
    {
      title: 'Bu Hafta Ziyaret Edilen',
      value: getVisitedThisWeek(myCompanies).length,
      icon: '✅',
      color: 'green'
    },
    {
      title: 'Geciken Firmalar',
      value: getDelayedCompanies(myCompanies).length,
      icon: '⚠️',
      color: 'red'
    }
  ];

  statsGrid.innerHTML = stats.map(stat => `
    <div class="stat-card stat-${stat.color}">
      <div class="stat-icon">${stat.icon}</div>
      <div class="stat-content">
        <div class="stat-value">${stat.value}</div>
        <div class="stat-label">${stat.title}</div>
      </div>
    </div>
  `).join('');
}

// ═══ Firmalar Render ═══
function renderCompanies() {
  const companiesList = document.getElementById('companiesList');
  if (!companiesList) return;

  const salesRep = SD.sessionSalesRep();
  if (!salesRep) return;

  const allCompanies = SD.companies;
  const myCompanies = allCompanies.filter(c => String(c.salesRepId || '') === String(salesRep.id));

  if (myCompanies.length === 0) {
    companiesList.innerHTML = '<p>Size atanmış firma yok.</p>';
    return;
  }

  companiesList.innerHTML = myCompanies.map(company => {
    const lastVisit = getLastVisitForCompany(company.id);
    const scheduledThisWeek = isScheduledThisWeek(company);

    return `
      <div class="company-card" onclick="showCompanyDetail('${company.id}')">
        <div class="company-name">${escapeHtml(company.name)}</div>
        <div class="company-region">${company.bolge || '-'}</div>
        <div class="company-meta">
          <span class="meta-item">🔧 ${company.techId || '?'}</span>
          <span class="meta-item">📍 ${lastVisit ? lastVisit.date : 'Hiç ziyaret yok'}</span>
          <span class="meta-badge" data-badge="${scheduledThisWeek ? 'scheduled' : 'unscheduled'}">
            ${scheduledThisWeek ? '📅 Bu hafta' : '✓ Planlı değil'}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

// ═══ Ziyaret Geçmişi Render ═══
function renderVisitHistory() {
  const visitHistory = document.getElementById('visitHistory');
  if (!visitHistory) return;

  const salesRep = SD.sessionSalesRep();
  if (!salesRep) return;

  const allCompanies = SD.companies;
  const myCompanies = allCompanies.filter(c => String(c.salesRepId || '') === String(salesRep.id));
  const myCompanyIds = new Set(myCompanies.map(c => c.id));

  // Birleşik ziyaret geçmişi (sd_vi + sd_ex)
  const unified = [];

  // sd_vi (normal ziyaretler). Anahtar biçimi: firmaId_hafta
  const visits = SD.visits;
  Object.entries(visits).forEach(([key, record]) => {
    const coId = visitKeyCompanyId(key);
    if (!myCompanyIds.has(coId)) return;

    const entries = SD.visitEntries(record);
    Object.values(entries).forEach(visit => {
      unified.push({
        type: 'normal',
        date: visit.date,
        time: visit.saat || '?',
        techCode: visit.techCode || visit.tc,
        status: visit.status,
        notes: visit.problem || '',
        ts: visit.ts || 0
      });
    });
  });

  // sd_ex (program dışı ziyaretler)
  const extras = SD.extras;
  if (Array.isArray(extras)) {
    extras.forEach(extra => {
      if (!myCompanyIds.has(extra.firmaId)) return;

      unified.push({
        type: 'extra',
        date: extra.date,
        time: extra.saat || '?',
        techCode: extra.tc,
        status: 'program dışı',
        notes: extra.aciklama || '',
        ts: extra.ts || 0
      });
    });
  }

  // Sırala (en yeniden en eskiye)
  unified.sort((a, b) => b.ts - a.ts);

  if (unified.length === 0) {
    visitHistory.innerHTML = '<p>Ziyaret geçmişi yok.</p>';
    return;
  }

  visitHistory.innerHTML = `
    <div class="visit-timeline">
      ${unified.map(visit => `
        <div class="visit-entry">
          <div class="visit-date">${visit.date} ${visit.time}</div>
          <div class="visit-type">${visit.type === 'normal' ? '✅ Normal' : '🚨 Program Dışı'}</div>
          <div class="visit-tech">Teknisyen: ${visit.techCode}</div>
          <div class="visit-status">${visit.status}</div>
          ${visit.notes ? `<div class="visit-notes">${escapeHtml(visit.notes)}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

// ═══ Numuneler Render ═══
function renderSamples() {
  const samplesList = document.getElementById('samplesList');
  if (!samplesList) return;

  const salesRep = SD.sessionSalesRep();
  if (!salesRep) return;

  const allCompanies = SD.companies;
  const myCompanyIds = new Set(
    allCompanies.filter(c => String(c.salesRepId || '') === String(salesRep.id)).map(c => c.id)
  );

  // Kayıt formatı numune.js ile ortak:
  // {id, firmaId, firmAdi, lab, ekipmanlar[], urunler[], tarih, not, result, ts}
  const samples = SD.load('sd_samples', []);
  const mySamples = samples
    .filter(s => myCompanyIds.has(String(s.firmaId || '')))
    .sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));

  if (mySamples.length === 0) {
    samplesList.innerHTML = '<div class="empty-msg">Firmalarınıza ait numune kaydı yok.</div>';
    return;
  }

  samplesList.innerHTML = mySamples.map(sample => {
    const urunler = Array.isArray(sample.urunler) ? sample.urunler.join(', ') : '';
    const ekipman = Array.isArray(sample.ekipmanlar) ? sample.ekipmanlar.join(', ') : '';
    return `
    <div class="sample-card">
      <div class="sample-id">${escapeHtml(sample.id || '')}</div>
      <div class="sample-company">${escapeHtml(sample.firmAdi || '')}</div>
      <div class="sample-lab">🧪 ${escapeHtml(sample.lab || 'Lab belirtilmemiş')}</div>
      ${urunler ? '<div class="sample-lab">📦 ' + escapeHtml(urunler) + '</div>' : ''}
      ${ekipman ? '<div class="sample-lab">🔧 ' + escapeHtml(ekipman) + '</div>' : ''}
      <div class="sample-date">📅 ${escapeHtml(sample.tarih || '—')}</div>
      ${sample.not ? '<div class="sample-lab">📝 ' + escapeHtml(sample.not) + '</div>' : ''}
      <div class="sample-result">
        ${sample.result
          ? '<span class="result-ok">✓ ' + escapeHtml(sample.result) + '</span>'
          : '<span class="result-pending">Analiz bekleniyor</span>'}
      </div>
    </div>`;
  }).join('');
}

// ═══ Aksiyonlar Render ═══
// Aksiyonlar sunucuda sd_actions içinde tutulur; satışçı state'e doğrudan
// yazamadığı için tüm CRUD /api/actions üzerinden yapılır.
async function renderActions() {
  const actionsList = document.getElementById('actionsList');
  if (!actionsList) return;

  // Firma seçiciyi doldur (kendi firmaları)
  const sel = document.getElementById('actionCompany');
  const salesRep = SD.sessionSalesRep();
  if (sel && salesRep && sel.options.length <= 1) {
    SD.companies
      .filter(c => String(c.salesRepId || '') === String(salesRep.id))
      .forEach(c => {
        const o = document.createElement('option');
        o.value = c.id; o.textContent = c.name;
        sel.appendChild(o);
      });
  }

  try {
    const r = await fetch('/api/actions', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
    if (!r.ok) throw new Error('API ' + r.status);
    const data = await r.json();
    const actions = data.actions || [];

    if (!actions.length) {
      actionsList.innerHTML = '<div class="empty-msg">Henüz aksiyon eklemediniz.</div>';
      return;
    }

    const coById = {};
    SD.companies.forEach(c => { coById[c.id] = c.name; });
    const today = new Date().toISOString().slice(0, 10);

    actionsList.innerHTML = actions.map(a => {
      const done = a.status === 'done';
      const overdue = !done && a.dueDate && a.dueDate < today;
      return `
      <div class="action-card" data-status="${done ? 'done' : 'open'}">
        <div class="action-type">${done ? '✓ Tamamlandı' : (overdue ? '⚠️ Gecikti' : 'Açık')}</div>
        <div class="action-description">${escapeHtml(a.title || '')}</div>
        ${a.companyId && coById[a.companyId] ? '<div class="action-due">🏢 ' + escapeHtml(coById[a.companyId]) + '</div>' : ''}
        ${a.dueDate ? '<div class="action-due">📅 ' + escapeHtml(a.dueDate) + '</div>' : ''}
        <div class="notification-actions">
          <button class="btn-small" onclick="toggleAction('${a.id}','${done ? 'open' : 'done'}')">${done ? 'Geri Aç' : 'Tamamla'}</button>
          <button class="btn-small" style="margin-left:8px" onclick="deleteAction('${a.id}')">Sil</button>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    console.error('Aksiyonlar yüklenemedi:', e);
    actionsList.innerHTML = '<div class="empty-msg">Aksiyonlar yüklenemedi. Bağlantınızı kontrol edin.</div>';
  }
}

async function submitAction(e) {
  e.preventDefault();
  const title = document.getElementById('actionTitle').value.trim();
  if (!title) return;
  try {
    const r = await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
      body: JSON.stringify({
        title,
        companyId: document.getElementById('actionCompany').value,
        dueDate: document.getElementById('actionDue').value
      })
    });
    const j = await r.json();
    if (!r.ok) { alert(j.error || 'Aksiyon eklenemedi'); return; }
    document.getElementById('actionForm').reset();
    renderActions();
  } catch (err) {
    alert('Aksiyon eklenemedi: ' + err.message);
  }
}

async function toggleAction(id, status) {
  try {
    await fetch('/api/actions/' + encodeURIComponent(id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
      body: JSON.stringify({ status })
    });
    renderActions();
  } catch (e) { console.error(e); }
}

async function deleteAction(id) {
  if (!confirm('Aksiyon silinsin mi?')) return;
  try {
    await fetch('/api/actions/' + encodeURIComponent(id), {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    });
    renderActions();
  } catch (e) { console.error(e); }
}

// ═══ Bildirimler Render ═══
async function renderNotifications() {
  const notificationsList = document.getElementById('notificationsList');
  if (!notificationsList) return;

  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('sd_session');

    // Try API first
    if (token) {
      const response = await fetch('/api/notifications', {
        headers: { 'Authorization': 'Bearer ' + token }
      });

      if (response.ok) {
        const data = await response.json();
        const notifications = data.notifications || [];

        if (notifications.length === 0) {
          notificationsList.innerHTML = '<p>Bildirim yok.</p>';
          return;
        }

        notificationsList.innerHTML = notifications.map(notif => `
          <div class="notification-card" data-notification-id="${notif.id}">
            <div class="notification-type">${notif.type}</div>
            <div class="notification-title">${escapeHtml(notif.title)}</div>
            <div class="notification-message">${escapeHtml(notif.message)}</div>
            <div class="notification-date">${new Date(notif.createdAt).toLocaleString('tr-TR')}</div>
            <div class="notification-actions">
              <button onclick="markNotificationAsRead('${notif.id}')" class="btn-small">Okundu İşaretle</button>
            </div>
          </div>
        `).join('');
        return;
      }
    }

    // Fallback to offline data
    const user = SD.sessionUser();
    if (!user) return;

    const allNotifications = SD.load('sd_notifications', []);
    const myNotifications = allNotifications.filter(n => String(n.recipientUserId || '') === String(user.id));

    if (myNotifications.length === 0) {
      notificationsList.innerHTML = '<p>Bildirim yok.</p>';
      return;
    }

    notificationsList.innerHTML = myNotifications.map(notif => `
      <div class="notification-card">
        <div class="notification-type">${notif.type}</div>
        <div class="notification-title">${escapeHtml(notif.title)}</div>
        <div class="notification-message">${escapeHtml(notif.message)}</div>
        <div class="notification-date">${new Date(notif.createdAt).toLocaleString('tr-TR')}</div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Notification render error:', err);
    notificationsList.innerHTML = '<p>Bildirimler yüklenemedi.</p>';
  }
}

// Mark notification as read
async function markNotificationAsRead(notificationId) {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('sd_session');
    if (!token) return;

    const response = await fetch(`/api/notifications/${notificationId}/read`, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (response.ok) {
      // Remove from UI or mark as read
      const card = document.querySelector(`[data-notification-id="${notificationId}"]`);
      if (card) card.style.opacity = '0.7';
    }
  } catch (err) {
    console.error('Mark as read error:', err);
  }
}

// ═══ Yardımcı Fonksiyonlar ═══
// Ziyaret anahtarı biçimi: firmaId + '_' + DT.wkey(tarih)  → örn. "c12_2026-W32"
function visitKeyCompanyId(key) {
  return String(key).split(/[|_]/)[0];
}

// Haftanın pazartesisi (uygulamanın geri kalanıyla aynı kural)
function mondayOf(date) {
  const x = new Date(date);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

// Ayın kaçıncı haftası (1..5) — c.weeks bu ölçeği kullanır
function weekOfMonth(date) {
  const monday = mondayOf(date);
  const firstMonday = mondayOf(new Date(monday.getFullYear(), monday.getMonth(), 1));
  return Math.floor((monday - firstMonday) / 604800000) + 1;
}

// Firma bu hafta planlı mı? 4'lü pattern tekrarı (BL.scheduled ile aynı mantık)
function isScheduledThisWeek(company) {
  const pattern = company.weeks || [1, 2, 3, 4];
  const idx = ((weekOfMonth(new Date()) - 1) % 4) + 1;
  return pattern.indexOf(idx) >= 0;
}

function parseVisitDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr);
  if (s.includes('.')) {
    const parts = s.split('.');
    if (parts.length === 2) {
      // "24.07" gibi yılsız kısa biçim: mevcut yılı varsay; sonuç gelecekte
      // kalıyorsa kayıt geçen yıldandır (Ocak'ta "28.12" gibi).
      const dt = new Date(new Date().getFullYear(), Number(parts[1]) - 1, Number(parts[0]));
      if (isNaN(dt.getTime())) return null;
      if (dt.getTime() > Date.now() + 86400000) dt.setFullYear(dt.getFullYear() - 1);
      return dt;
    }
    const [d, m, y] = parts;                   // DD.MM.YYYY
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s);                      // YYYY-MM-DD
  return isNaN(dt.getTime()) ? null : dt;
}

// Kayıt tarihini çözer. ts (epoch ms) varsa ona güvenilir — birçok gerçek
// kayıtta date alanı yılsız kısa biçimde ("04.08") tutulur ve yalnız
// date string'inden ayrıştırma bu kayıtları sessizce yok sayardı.
function recordDate(rec) {
  const ts = Number(rec?.ts);
  if (Number.isFinite(ts) && ts > 0) return new Date(ts);
  return parseVisitDate(rec?.date || rec?.dayKey);
}

// Firmanın son ziyareti (sd_vi + sd_ex birleşik).
function getLastVisitForCompany(companyId) {
  let best = null, bestTime = -Infinity;

  const consider = (rec, type) => {
    const dt = recordDate(rec);
    const time = dt ? dt.getTime() : -Infinity;
    if (time > bestTime) { bestTime = time; best = { date: rec?.date || rec?.dayKey, type, ts: rec?.ts, dt }; }
  };

  Object.entries(SD.visits || {}).forEach(([key, record]) => {
    if (visitKeyCompanyId(key) !== String(companyId)) return;
    Object.values(SD.visitEntries(record)).forEach(v => consider(v, 'normal'));
  });

  const extras = SD.extras;
  if (Array.isArray(extras)) {
    extras.forEach(x => {
      if (String(x?.firmaId || x?.companyId || '') !== String(companyId)) return;
      consider(x, 'extra');
    });
  }

  return best;
}

function getScheduledThisWeek(companies) {
  return companies.filter(isScheduledThisWeek);
}

// Bu hafta (pazartesi–pazar) fiilen ziyaret edilmiş firmalar
function getVisitedThisWeek(companies) {
  const start = mondayOf(new Date());
  const end = new Date(start.getTime() + 7 * 86400000);
  const visited = new Set();

  Object.entries(SD.visits || {}).forEach(([key, record]) => {
    const coId = visitKeyCompanyId(key);
    Object.values(SD.visitEntries(record)).forEach(v => {
      const dt = recordDate(v);
      if (dt && dt >= start && dt < end) visited.add(coId);
    });
  });

  if (Array.isArray(SD.extras)) {
    SD.extras.forEach(x => {
      const dt = recordDate(x);
      if (dt && dt >= start && dt < end) visited.add(String(x?.firmaId || x?.companyId || ''));
    });
  }

  return companies.filter(c => visited.has(String(c.id)));
}

// Firmanın ziyaret sıklığına göre beklenen aralık (gün)
function expectedIntervalDays(company) {
  const weeks = Array.isArray(company?.weeks) ? company.weeks : [];
  if (!weeks.length) return 30;
  if (weeks.length >= 4) return 7;
  if (weeks.length >= 2) return 14;
  return 30;
}

function getDelayedCompanies(companies) {
  const now = new Date();
  return companies.filter(c => {
    const last = getLastVisitForCompany(c.id);
    if (!last || !last.dt) return true;              // hiç ziyaret yok → gecikmiş
    const days = Math.floor((now - last.dt) / 86400000);
    return days > expectedIntervalDays(c);
  });
}

// ═══ Firma Detayı ═══
// Ziyaret sıklığı etiketi (c.weeks = ayın kaçıncı haftaları)
function frequencyLabel(company) {
  const w = Array.isArray(company.weeks) ? company.weeks : [];
  if (!w.length) return 'Planlanmamış';
  if (w.length >= 4) return 'Her hafta';
  if (w.length === 3) return 'Ayda 3 kez';
  if (w.length === 2) return '2 haftada bir';
  return 'Ayda 1 kez';
}

function showCompanyDetail(companyId) {
  const company = SD.companies.find(c => String(c.id) === String(companyId));
  if (!company) return;

  // Güvenlik: satışçı yalnızca kendi firmasının detayını açabilir
  const salesRep = SD.sessionSalesRep();
  if (!salesRep || String(company.salesRepId || '') !== String(salesRep.id)) return;

  const titleEl = document.getElementById('companyDetailTitle');
  const bodyEl = document.getElementById('companyDetailBody');
  const modal = document.getElementById('companyDetailModal');
  if (!titleEl || !bodyEl || !modal) return;

  titleEl.textContent = company.name || '—';

  // Teknisyen adı (sd_te satışçıya açık değilse id'ye düşer)
  const techs = SD.technicians || [];
  const tech = techs.find(t => String(t.id) === String(company.techId));
  const techLabel = tech ? (tech.name + (tech.code ? ' (' + tech.code + ')' : '')) : (company.techId || '—');

  const last = getLastVisitForCompany(company.id);
  const delayed = getDelayedCompanies([company]).length > 0;

  // Bu firmanın tüm ziyaretleri (sd_vi + sd_ex), en yeniden eskiye
  const visits = [];
  Object.entries(SD.visits || {}).forEach(([key, record]) => {
    if (visitKeyCompanyId(key) !== String(company.id)) return;
    Object.values(SD.visitEntries(record)).forEach(v => {
      visits.push({ type: 'normal', date: v.date, saat: v.saat, tech: v.techCode || v.tc, note: v.extraNot || v.problem || '', dt: recordDate(v) });
    });
  });
  if (Array.isArray(SD.extras)) {
    SD.extras.forEach(x => {
      if (String(x.firmaId || x.companyId || '') !== String(company.id)) return;
      visits.push({ type: 'extra', date: x.date, saat: x.saat, tech: x.techCode || x.tc, note: x.not || x.aciklama || '', dt: recordDate(x) });
    });
  }
  visits.sort((a, b) => (b.dt ? b.dt.getTime() : 0) - (a.dt ? a.dt.getTime() : 0));

  // Bu firmaya ait numuneler
  const samples = (SD.load('sd_samples', []) || []).filter(s => String(s.firmaId || '') === String(company.id));

  const field = (lbl, val) =>
    '<div class="sd-field"><div class="sd-field-lbl">' + escapeHtml(lbl) + '</div>' +
    '<div class="sd-field-val">' + escapeHtml(val || '—') + '</div></div>';

  let html = '<div class="sd-sec"><div class="sd-sec-ttl">Firma Bilgileri</div><div class="sd-grid">' +
    field('Bölge', company.bolge) +
    field('Teknik Sorumlu', techLabel) +
    field('Ziyaret Sıklığı', frequencyLabel(company)) +
    field('Durum', company.aktif === false ? 'Pasif' : 'Aktif') +
    field('Son Ziyaret', last && last.date ? last.date : 'Kayıt yok') +
    field('Gecikme', delayed ? 'Gecikmiş' : 'Zamanında') +
    '</div></div>';

  html += '<div class="sd-sec"><div class="sd-sec-ttl">Ziyaret Geçmişi (' + visits.length + ')</div>';
  if (!visits.length) {
    html += '<div class="empty-msg">Bu firmaya ait ziyaret kaydı yok.</div>';
  } else {
    html += '<div class="sd-list">' + visits.map(v =>
      '<div class="sd-row">' +
        '<span class="sd-row-date">' + escapeHtml(v.date || '—') + (v.saat ? ' ' + escapeHtml(v.saat) : '') + '</span>' +
        '<span class="sd-row-tag" data-type="' + v.type + '">' + (v.type === 'extra' ? 'Program Dışı' : 'Planlı') + '</span>' +
        '<span>Teknisyen: ' + escapeHtml(v.tech || '—') + '</span>' +
        (v.note ? '<span class="sd-row-note">' + escapeHtml(v.note) + '</span>' : '') +
      '</div>').join('') + '</div>';
  }
  html += '</div>';

  html += '<div class="sd-sec"><div class="sd-sec-ttl">Numuneler (' + samples.length + ')</div>';
  if (!samples.length) {
    html += '<div class="empty-msg">Bu firmaya ait numune kaydı yok.</div>';
  } else {
    html += '<div class="sd-list">' + samples.map(s =>
      '<div class="sd-row">' +
        '<span class="sd-row-date">' + escapeHtml(s.tarih || s.date || '—') + '</span>' +
        '<span>' + escapeHtml(s.lab || 'Lab belirtilmemiş') + '</span>' +
        '<span class="sd-row-tag">' + escapeHtml(s.result || s.sonuc || 'Bekliyor') + '</span>' +
      '</div>').join('') + '</div>';
  }
  html += '</div>';

  bodyEl.innerHTML = html;
  modal.classList.remove('hidden');
}

function closeCompanyDetail() {
  const modal = document.getElementById('companyDetailModal');
  if (modal) modal.classList.add('hidden');
}

// ═══ Mobile Menu ═══
function toggleMobileMenu() {
  const nav = document.getElementById('navTabs');
  const overlay = document.getElementById('mobileOverlay');
  const btn = document.getElementById('mobileMenuBtn');

  if (nav && overlay && btn) {
    const isOpen = nav.classList.contains('mobile-open');
    if (isOpen) {
      closeMobileMenu();
    } else {
      nav.classList.add('mobile-open');
      overlay.classList.add('mobile-open');
      btn.setAttribute('aria-expanded', 'true');
    }
  }
}

function closeMobileMenu() {
  const nav = document.getElementById('navTabs');
  const overlay = document.getElementById('mobileOverlay');
  const btn = document.getElementById('mobileMenuBtn');

  if (nav && overlay && btn) {
    nav.classList.remove('mobile-open');
    overlay.classList.remove('mobile-open');
    btn.setAttribute('aria-expanded', 'false');
  }
}

// ═══ User Menu ═══
function toggleUserMenu() {
  const dropdown = document.getElementById('navDropdown');
  if (dropdown) {
    dropdown.classList.toggle('hidden');
  }
}

function doLogout() {
  localStorage.removeItem('token');
  sessionStorage.removeItem('sd_session');
  localStorage.removeItem('sd_session_persist');
  if (SD && SD.clearSharedData) SD.clearSharedData();
  window.location.href = 'index.html';
}

// ═══ Utility ═══
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

console.log('✓ Sales.js initialized');
