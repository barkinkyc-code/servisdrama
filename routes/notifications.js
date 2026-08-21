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

function visible(state, user) {
  const all = Array.isArray(state.sd_notifications) ? state.sd_notifications : [];
  if (isAdmin(user)) return all;
  if (isTech(user)) {
    const tech = techIdentityForUser(state, user);
    if (!tech) return [];
    return all.filter(n => String(n.recipientTechId || '') === String(tech.id)
      && TECH_BELL_TYPES.has(String(n.type || '')));
  }
  const rep = resolveSalesRepIdentity(state, user);
  if (!rep) return [];
  const idSet = getSalesRepIdentitySet(rep);
  return all.filter(n => idSet.has(String(n.recipientUserId || n.salesRepId || '')));
}

router.use(auth);
router.use((req, res, next) => (isAdmin(req.user) || isSales(req.user) || isTech(req.user)) ? next() : res.status(403).json({ error: 'Bu modüle erişim yetkiniz yok' }));

router.get('/', async (req, res) => {
  try {
    const { state } = await readState();
    const rows = visible(state, req.user).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 100);
    res.json({ success: true, notifications: rows, count: rows.length });
  } catch (e) { res.status(500).json({ error: 'Bildirimler okunamadı', details: e.message }); }
});

router.get('/unread/count', async (req, res) => {
  try {
    const { state } = await readState();
    res.json({ success: true, unread_count: visible(state, req.user).filter(n => !(n.read || n.readAt)).length });
  } catch (e) { res.status(500).json({ error: 'Sayı okunamadı' }); }
});

router.put('/all/read', async (req, res) => {
  try {
    let updated = 0;
    await mutateState(state => {
      const ids = new Set(visible(state, req.user).map(n => String(n.id)));
      state.sd_notifications = (state.sd_notifications || []).map(n => ids.has(String(n.id)) && !(n.read || n.readAt) ? (updated++, { ...n, read: true, readAt: new Date().toISOString() }) : n);
    }, req.user.id);
    res.json({ success: true, updated });
  } catch (e) { res.status(500).json({ error: 'Güncellenemedi' }); }
});

router.put('/:id/read', async (req, res) => {
  try {
    await mutateState(state => {
      const ids = new Set(visible(state, req.user).map(n => String(n.id)));
      if (!ids.has(String(req.params.id))) throw Object.assign(new Error('Bildirim bulunamadı'), { statusCode: 404 });
      state.sd_notifications = (state.sd_notifications || []).map(n => String(n.id) === String(req.params.id) ? { ...n, read: true, readAt: new Date().toISOString() } : n);
    }, req.user.id);
    res.json({ success: true });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// Bildirim arşivleme: satışçı görünümünden kaldırır ama kalıcı silmez.
router.put('/:id/archive', async (req, res) => {
  try {
    await mutateState(state => {
      const ids = new Set(visible(state, req.user).map(n => String(n.id)));
      if (!ids.has(String(req.params.id))) throw Object.assign(new Error('Bildirim bulunamadı'), { statusCode: 404 });
      state.sd_notifications = (state.sd_notifications || []).map(n => String(n.id) === String(req.params.id) ? { ...n, status: 'archived', archivedAt: new Date().toISOString() } : n);
    }, req.user.id);
    res.json({ success: true });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// Bildirimler kalıcı olarak silinemez — satışçı yalnızca okundu/arşivlendi
// yapabilir. Kalıcı silme yalnızca admin'e açık.
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
