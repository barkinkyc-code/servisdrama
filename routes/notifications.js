const express = require('express');
const auth = require('../middleware/auth');
const { readState, mutateState } = require('../utils/stateStore');
const { resolveSalesRepIdentity, getSalesRepIdentitySet } = require('../utils/salesIdentity');
const router = express.Router();
const isAdmin = u => String(u?.role || '').toLowerCase() === 'admin';
const isSales = u => String(u?.role || '').toLowerCase() === 'sales';
const isTech = u => String(u?.role || '').toLowerCase() === 'tech';

// Teknisyen kimliği: JWT yalnızca {id,username,role} taşır, sd_te'den çözülür.
// routes/state.js'teki technicianIdentityForUser ile aynı eski/legacy eşleme.
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

/* Teknisyenin zili YALNIZCA satıştan gelen işi taşır: ziyaret talebi ve
   satışçının aldığı numune. Gecikme/skor uyarıları zile düşmez — onlar
   teknisyende ilk girişte açılan Erken Uyarı banner'ında toplanır
   (early-warning.js). İkisi tek listede karışınca satıştan gelen gerçek iş
   sistem gürültüsünün altında kayboluyordu. */
const TECH_BELL_TYPES = new Set([
  'visit_request', 'visit_request_open', 'visit_request_planned',
  'visit_request_done', 'visit_request_cancelled', 'sample_taken_by_sales'
]);

/* broadcast:true taşıyan bildirimler TEK kayıttır ama HERKESE görünür (ör.
   "ziyaret talebi" artık sadece atanmış teknisyene değil, sistemdeki her
   role gider). Rol bazlı hedefleme (recipientTechId/recipientUserId) bu
   bildirimler için by-pass edilir. */
function visible(state, user) {
  const all = Array.isArray(state.sd_notifications) ? state.sd_notifications : [];
  if (isAdmin(user)) return all;
  if (isTech(user)) {
    const tech = techIdentityForUser(state, user);
    return all.filter(n => {
      if (!TECH_BELL_TYPES.has(String(n.type || ''))) return false;
      if (n.broadcast === true) return true;
      return !!tech && String(n.recipientTechId || '') === String(tech.id);
    });
  }
  const rep = resolveSalesRepIdentity(state, user);
  const idSet = rep ? getSalesRepIdentitySet(rep) : new Set();
  return all.filter(n => n.broadcast === true || idSet.has(String(n.recipientUserId || n.salesRepId || '')));
}

/* Paylaşımlı (broadcast) bir bildirimde "okundu" ve "arşivlendi" GLOBAL bir
   alan OLAMAZ — biri okuyunca herkeste okunmuş görünmemeli, biri arşivleyince
   herkesin listesinden kaybolmamalı. Bu yüzden kişi bazlı iki dizi tutulur:
   readBy/archivedBy (kullanıcının JWT id'si). Eski kayıtlarda bu diziler
   yoksa (broadcast öncesi oluşturulmuş, tek alıcılı bildirimler) eski
   read/status alanlarına geriye dönük bakılır — veri kaybı/geçiş sorunu
   olmasın diye. API cevabı, çağıran kullanıcı için HESAPLANMIŞ read/status
   alanlarını döner; ön yüz (notify-bell.js) hiç değişmeden çalışmaya devam
   eder. */
function isReadFor(n, uid) {
  if (Array.isArray(n.readBy)) return n.readBy.includes(uid);
  return !!(n.read || n.readAt);
}
function isArchivedFor(n, uid) {
  if (Array.isArray(n.archivedBy)) return n.archivedBy.includes(uid);
  return n.status === 'archived';
}
function withPersonalState(list, user) {
  const uid = String(user.id);
  return list.map(n => ({
    ...n,
    read: isReadFor(n, uid),
    status: isArchivedFor(n, uid) ? 'archived' : (n.status && n.status !== 'archived' ? n.status : undefined)
  }));
}
function addTo(arr, uid) {
  const next = Array.isArray(arr) ? arr.slice() : [];
  if (!next.includes(uid)) next.push(uid);
  return next;
}

router.use(auth);
router.use((req, res, next) => (isAdmin(req.user) || isSales(req.user) || isTech(req.user)) ? next() : res.status(403).json({ error: 'Bu modüle erişim yetkiniz yok' }));

router.get('/', async (req, res) => {
  try {
    const { state } = await readState();
    const rows = withPersonalState(visible(state, req.user), req.user)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, 100);
    res.json({ success: true, notifications: rows, count: rows.length });
  } catch (e) { res.status(500).json({ error: 'Bildirimler okunamadı', details: e.message }); }
});

router.get('/unread/count', async (req, res) => {
  try {
    const { state } = await readState();
    const uid = String(req.user.id);
    res.json({ success: true, unread_count: visible(state, req.user).filter(n => !isReadFor(n, uid)).length });
  } catch (e) { res.status(500).json({ error: 'Sayı okunamadı' }); }
});

router.put('/all/read', async (req, res) => {
  try {
    let updated = 0;
    const uid = String(req.user.id);
    await mutateState(state => {
      const ids = new Set(visible(state, req.user).map(n => String(n.id)));
      state.sd_notifications = (state.sd_notifications || []).map(n => {
        if (!ids.has(String(n.id)) || isReadFor(n, uid)) return n;
        updated++;
        return { ...n, readBy: addTo(n.readBy, uid), read: true, readAt: n.readAt || new Date().toISOString() };
      });
    }, req.user.id);
    res.json({ success: true, updated });
  } catch (e) { res.status(500).json({ error: 'Güncellenemedi' }); }
});

router.put('/:id/read', async (req, res) => {
  try {
    const uid = String(req.user.id);
    await mutateState(state => {
      const ids = new Set(visible(state, req.user).map(n => String(n.id)));
      if (!ids.has(String(req.params.id))) throw Object.assign(new Error('Bildirim bulunamadı'), { statusCode: 404 });
      state.sd_notifications = (state.sd_notifications || []).map(n =>
        String(n.id) === String(req.params.id)
          ? { ...n, readBy: addTo(n.readBy, uid), read: true, readAt: n.readAt || new Date().toISOString() }
          : n
      );
    }, req.user.id);
    res.json({ success: true });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// Bildirim arşivleme: yalnızca ARŞİVLEYENİN görünümünden kaldırır, kalıcı
// silmez — broadcast bir bildirimde başkasının listesini etkilemez.
router.put('/:id/archive', async (req, res) => {
  try {
    const uid = String(req.user.id);
    await mutateState(state => {
      const ids = new Set(visible(state, req.user).map(n => String(n.id)));
      if (!ids.has(String(req.params.id))) throw Object.assign(new Error('Bildirim bulunamadı'), { statusCode: 404 });
      state.sd_notifications = (state.sd_notifications || []).map(n =>
        String(n.id) === String(req.params.id)
          ? { ...n, archivedBy: addTo(n.archivedBy, uid) }
          : n
      );
    }, req.user.id);
    res.json({ success: true });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// Bildirimler kalıcı olarak silinemez — kullanıcılar yalnızca okundu/arşivlendi
// yapabilir. Kalıcı silme (herkes için, tamamen) yalnızca admin'e açık.
router.delete('/:id', async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Bildirimler yalnızca okundu/arşivlendi olarak işaretlenebilir, silinemez' });
  try {
    await mutateState(state => {
      const ids = new Set((state.sd_notifications || []).map(n => String(n.id)));
      if (!ids.has(String(req.params.id))) throw Object.assign(new Error('Bildirim bulunamadı'), { statusCode: 404 });
      state.sd_notifications = (state.sd_notifications || []).filter(n => String(n.id) !== String(req.params.id));
    }, req.user.id);
    res.json({ success: true });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

module.exports = router;
