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
  companyBelongsToSalesRep,
  technicianIdentityForUser
} = require('../utils/salesIdentity');
const { sendPushForNotification } = require('../utils/webPush');

const router = express.Router();
const isAdmin = u => String(u?.role || '').toLowerCase() === 'admin';
const isSales = u => String(u?.role || '').toLowerCase() === 'sales';
const isTech = u => String(u?.role || '').toLowerCase() === 'tech';

const OPEN_STATUSES = ['open', 'planned'];
const ALL_STATUSES = ['open', 'planned', 'done', 'cancelled'];

function techIdentityForUser(state, user) {
  return technicianIdentityForUser(state, user);
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

// Oluşturulan bildirim nesnesini döner: mutateState kapandıktan SONRA push
// gönderilebilsin diye (ağ çağrısı transaction/kilit süresini uzatmasın).
function pushNotification(state, notif) {
  state.sd_notifications = Array.isArray(state.sd_notifications) ? state.sd_notifications : [];
  const full = {
    id: 'not_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    createdAt: new Date().toISOString(),
    read: false,
    status: 'unread',
    ...notif
  };
  state.sd_notifications.push(full);
  return full;
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
    let request, notifForPush;
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

      // Not zorunlu: sebepsiz talep teknisyene "neden gidilmedi" bilgisi vermez.
      // Satışçı küçük harfle yazsa bile BÜYÜK HARFE çevrilerek kaydedilir —
      // toLocaleUpperCase('tr') kullanılır (düz .toUpperCase() Türkçe 'i'yi
      // 'İ' değil 'I' yapar, "ıstanbul"→"ISTANBUL" yerine "İSTANBUL" olmalı).
      const reason = String(req.body?.reason || '').trim().slice(0, 500).toLocaleUpperCase('tr');
      if (!reason) throw Object.assign(new Error('Neden gidilmediğini belirtmeden talep gönderilemez.'), { statusCode: 400 });
      const now = new Date().toISOString();
      const salesRepName = rep?.name || req.user.username;

      request = {
        id: 'vr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        companyId, companyName: company.name,
        salesRepId: rep?.id || '', salesRepName,
        techId: String(tech.id), techCode: String(tech.code || ''), techName: tech.name || '',
        reason, urgency: 'normal', // "Acil" seçeneği arayüzden kaldırıldı — profesyonel/sade tek akış
        status: 'open',
        createdAt: now, createdByUserId: req.user.id, createdByRole: req.user.role,
        updatedAt: now, history: [{ at: now, by: salesRepName, role: req.user.role, status: 'open' }]
      };
      state.sd_visit_requests = allRequests(state).concat([request]);

      // Ziyaret talebi bildirimi HERKESE gider (broadcast:true) — yalnız
      // atanmış teknisyene değil, sistemdeki her role (routes/notifications.js
      // visible() ve utils/webPush.js eligibleSubscriptions bu bayrağı
      // rol/kişi filtresini atlamak için kullanır). recipientTechId yine de
      // METADATA olarak tutulur ("asıl atanmış teknisyen kim" bilgisi için —
      // ör. 360° kartında gösterilebilir), teslimatı ARTIK BELİRLEMEZ.
      // Başlık sabit: "Ziyaret Talebi". Metin talebi AÇAN satışçıyı adıyla
      // söyler — kartı açmadan kimin istediği görülsün diye.
      notifForPush = pushNotification(state, {
        broadcast: true,
        recipientTechId: String(tech.id),
        recipientRole: 'tech',
        companyId,
        visitRequestId: request.id,
        type: 'visit_request',
        title: 'Ziyaret Talebi',
        message: `${salesRepName}, ${company.name} firmasına öncelikli ziyaret istiyor.`
      });
    }, req.user.id);
    // AWAIT edilir, ateşle-unut YAPILMAZ: Vercel serverless fonksiyonu HTTP
    // cevabı gönderilir gönderilmez donduruluyor/sonlandırılıyor (Lambda tabanlı
    // platformların hepsinde aynı — cevaptan SONRAKİ bekleyen promise'lerin
    // bitmesi garanti değil). Ateşle-unut yapılsaydı push çoğu zaman yarıda
    // kesilip hiç gitmezdi; kalıcı sunucuda (node server.js) da zararı yok,
    // yalnızca birkaç yüz ms gecikme ekler.
    if (notifForPush) await sendPushForNotification(notifForPush).catch(() => {});
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
    let updated, notifForPush;
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
        notifForPush = pushNotification(state, {
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
    if (notifForPush) await sendPushForNotification(notifForPush).catch(() => {});
    res.json({ success: true, request: updated });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message || 'Güncellenemedi' }); }
});

module.exports = router;
