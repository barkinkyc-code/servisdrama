/* ═══════════════════════════════════════════════════════════════════
   Ziyaret Talebi — satışçı "bu firmaya gidilsin" der, firmanın atanmış
   teknisyeninin ekranına otomatik bildirim düşer, admin hepsini görür.
   -------------------------------------------------------------------
   Kayıtlar state.sd_visit_requests içinde tutulur ve YALNIZCA bu route
   tarafından yazılır: routes/state.js PUT'ta gelen sd_visit_requests
   yok sayılır, aksi halde admin panelinin state gönderimi başka bir
   kullanıcının az önce açtığı talebi silebilirdi.
   ═══════════════════════════════════════════════════════════════════ */
const express = require('express');
const auth = require('../middleware/auth');
const { readState, mutateState } = require('../utils/stateStore');
const {
  resolveSalesRepIdentity,
  getSalesRepIdentitySet,
  companyBelongsToSalesRep
} = require('../utils/salesIdentity');

const router = express.Router();
const isAdmin = u => String(u?.role || '').toLowerCase() === 'admin';
const isSales = u => String(u?.role || '').toLowerCase() === 'sales';
const isTech = u => String(u?.role || '').toLowerCase() === 'tech';

const OPEN_STATUSES = ['open', 'planned'];
const ALL_STATUSES = ['open', 'planned', 'done', 'cancelled'];

// Teknisyen kimliği: JWT yalnızca {id,username,role} taşır, sd_te'den çözülür.
// routes/notifications.js ve routes/state.js ile aynı eski/legacy eşleme.
function techIdentityForUser(state, user) {
  const username = String(user?.username || '').toLowerCase();
  const users = Array.isArray(state?.sd_users) ? state.sd_users : [];
  const techs = Array.isArray(state?.sd_te) ? state.sd_te : [];
  const appUser = users.find(u => String(u?.username || '').toLowerCase() === username);
  let tech = appUser && techs.find(t => String(t.id) === String(appUser.techId));
  if (!tech) {
    if (username === 'semih.aglan') tech = techs.find(t => String(t.code) === '1015');
    if (username === 'suleyman' || username === 'suleyman.kucuk') tech = techs.find(t => String(t.code) === '1016');
  }
  return tech || null;
}

function allRequests(state) {
  return Array.isArray(state?.sd_visit_requests) ? state.sd_visit_requests : [];
}

/* Rol kapsamı: admin hepsini, teknisyen kendi firmalarının taleplerini,
   satışçı kendi açtıklarını görür. Kimlik çözülemezse boş (fail-closed). */
function visible(state, user) {
  const all = allRequests(state);
  if (isAdmin(user)) return all;
  if (isTech(user)) {
    const tech = techIdentityForUser(state, user);
    if (!tech) return [];
    return all.filter(r => String(r.techId || '') === String(tech.id));
  }
  const rep = resolveSalesRepIdentity(state, user);
  if (!rep) return [];
  const idSet = getSalesRepIdentitySet(rep);
  return all.filter(r => idSet.has(String(r.salesRepId || '')));
}

function pushNotification(state, notif) {
  state.sd_notifications = Array.isArray(state.sd_notifications) ? state.sd_notifications : [];
  state.sd_notifications.push({
    id: 'not_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    createdAt: new Date().toISOString(),
    read: false,
    status: 'unread',
    ...notif
  });
}

router.use(auth);
router.use((req, res, next) => (isAdmin(req.user) || isSales(req.user) || isTech(req.user))
  ? next()
  : res.status(403).json({ error: 'Bu modüle erişim yetkiniz yok' }));

router.get('/', async (req, res) => {
  try {
    const { state } = await readState();
    let rows = visible(state, req.user);
    const status = String(req.query?.status || '');
    if (status === 'open') rows = rows.filter(r => OPEN_STATUSES.includes(String(r.status)));
    else if (ALL_STATUSES.includes(status)) rows = rows.filter(r => String(r.status) === status);
    rows = rows.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    res.json({ success: true, requests: rows, count: rows.length });
  } catch (e) { res.status(500).json({ error: 'Ziyaret talepleri okunamadı', details: e.message }); }
});

/* Talep aç. Aynı firmada AÇIK talep varsa yenisi oluşturulmaz (409): satışçı
   düğmeye ikinci kez bastığında teknisyenin ekranı aynı firmayla dolmasın. */
router.post('/', async (req, res) => {
  try {
    let request;
    await mutateState(state => {
      const rep = resolveSalesRepIdentity(state, req.user);
      if (!rep && !isAdmin(req.user)) throw Object.assign(new Error('Satışçı profili bulunamadı'), { statusCode: 403 });

      const companyId = String(req.body?.companyId || req.body?.firmaId || '');
      const company = (state.sd_co || []).find(c => String(c.id) === companyId);
      if (!company) throw Object.assign(new Error('Firma bulunamadı'), { statusCode: 404 });
      if (rep && !companyBelongsToSalesRep(company, rep)) throw Object.assign(new Error('Bu firma size atanmamış'), { statusCode: 403 });

      const tech = (state.sd_te || []).find(t => String(t.id) === String(company.techId || ''));
      if (!tech) throw Object.assign(new Error('Bu firmaya teknik servis atanmamış. Talep gönderilemedi — yöneticinizle görüşün.'), { statusCode: 400 });

      const open = allRequests(state).find(r => String(r.companyId) === companyId && OPEN_STATUSES.includes(String(r.status)));
      if (open) throw Object.assign(new Error('Bu firma için zaten açık bir ziyaret talebi var.'), { statusCode: 409, existing: open });

      const urgency = req.body?.urgency === 'high' ? 'high' : 'normal';
      const reason = String(req.body?.reason || '').trim().slice(0, 500);
      const now = new Date().toISOString();
      const salesRepName = rep?.name || req.user.username;

      request = {
        id: 'vr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        companyId, companyName: company.name,
        salesRepId: rep?.id || '', salesRepName,
        techId: String(tech.id), techCode: String(tech.code || ''), techName: tech.name || '',
        reason, urgency,
        status: 'open',
        createdAt: now, createdByUserId: req.user.id, createdByRole: req.user.role,
        updatedAt: now, history: [{ at: now, by: salesRepName, role: req.user.role, status: 'open' }]
      };
      state.sd_visit_requests = allRequests(state).concat([request]);

      // Teknisyenin ekranına düşen bildirim. Admin tüm bildirimleri gördüğü için
      // ayrıca bir admin kopyası üretilmez (bkz. routes/notifications.js visible()).
      pushNotification(state, {
        recipientTechId: String(tech.id),
        recipientRole: 'tech',
        companyId,
        visitRequestId: request.id,
        type: 'visit_request',
        title: urgency === 'high' ? 'ACİL ziyaret talebi' : 'Satışçıdan ziyaret talebi',
        message: `${salesRepName}, ${company.name} firmasına ziyaret istiyor.` + (reason ? ` Not: ${reason}` : '')
      });
    }, req.user.id);
    res.status(201).json({ success: true, request });
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || 'Ziyaret talebi oluşturulamadı', existing: e.existing });
  }
});

/* Durum değişikliği.
   teknisyen : planned / done  (yalnız kendi firmalarında)
   satışçı   : cancelled       (yalnız kendi açtığı talebi geri çeker)
   admin     : hepsi
   Her değişiklikte talebi açan satışçıya geri bildirim düşer — talep tek yönlü
   bir istek değil, kapanan bir döngü olsun diye. */
const TECH_ALLOWED = ['planned', 'done'];
const STATUS_TEXT = { open: 'yeniden açıldı', planned: 'planlandı', done: 'tamamlandı', cancelled: 'iptal edildi' };

router.put('/:id', async (req, res) => {
  try {
    let updated;
    await mutateState(state => {
      const mine = visible(state, req.user);
      const current = mine.find(r => String(r.id) === String(req.params.id));
      if (!current) throw Object.assign(new Error('Ziyaret talebi bulunamadı'), { statusCode: 404 });

      const status = String(req.body?.status || '');
      if (!ALL_STATUSES.includes(status)) throw Object.assign(new Error('Geçersiz durum'), { statusCode: 400 });
      if (isTech(req.user) && !TECH_ALLOWED.includes(status)) throw Object.assign(new Error('Teknisyen talebi yalnızca planlandı/tamamlandı yapabilir'), { statusCode: 403 });
      if (isSales(req.user) && status !== 'cancelled') throw Object.assign(new Error('Satışçı talebi yalnızca geri çekebilir'), { statusCode: 403 });
      if (String(current.status) === status) throw Object.assign(new Error('Talep zaten bu durumda'), { statusCode: 400 });

      const now = new Date().toISOString();
      const who = req.user.username || req.user.id;
      const note = String(req.body?.note || '').trim().slice(0, 500);

      updated = {
        ...current,
        status,
        note: note || current.note || '',
        updatedAt: now, updatedByUserId: req.user.id, updatedByRole: req.user.role,
        closedAt: (status === 'done' || status === 'cancelled') ? now : null,
        history: (Array.isArray(current.history) ? current.history : []).concat([{ at: now, by: who, role: req.user.role, status, note }])
      };
      state.sd_visit_requests = allRequests(state).map(r => String(r.id) === String(current.id) ? updated : r);

      if (current.salesRepId && !isSales(req.user)) {
        pushNotification(state, {
          recipientUserId: String(current.salesRepId),
          recipientRole: 'sales',
          companyId: String(current.companyId),
          visitRequestId: current.id,
          type: 'visit_request_' + status,
          title: 'Ziyaret talebiniz ' + (STATUS_TEXT[status] || 'güncellendi'),
          message: `${current.companyName} için açtığınız ziyaret talebi ${STATUS_TEXT[status] || 'güncellendi'}.` + (note ? ` Not: ${note}` : '')
        });
      }
    }, req.user.id);
    res.json({ success: true, request: updated });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message || 'Güncellenemedi' }); }
});

module.exports = router;
