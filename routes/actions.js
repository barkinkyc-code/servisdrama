const express = require('express');
const auth = require('../middleware/auth');
const { readState, mutateState } = require('../utils/stateStore');
const { resolveSalesRepIdentity, getSalesRepIdentitySet, companyBelongsToSalesRep } = require('../utils/salesIdentity');
const router = express.Router();
const isAdmin = u => String(u?.role || '').toLowerCase() === 'admin';
const isSales = u => String(u?.role || '').toLowerCase() === 'sales';

function visible(state, user) {
  const all = Array.isArray(state.sd_actions) ? state.sd_actions : [];
  if (isAdmin(user)) return all;
  const rep = resolveSalesRepIdentity(state, user);
  if (!rep) return [];
  const idSet = getSalesRepIdentitySet(rep);
  return all.filter(a => idSet.has(String(a.salesRepId || '')));
}

router.use(auth);
router.use((req, res, next) => (isAdmin(req.user) || isSales(req.user)) ? next() : res.status(403).json({ error: 'Bu modüle erişim yetkiniz yok' }));

router.get('/', async (req, res) => {
  try {
    const { state } = await readState();
    res.json({ success: true, actions: visible(state, req.user).sort((a, b) => String(a.status).localeCompare(String(b.status)) || String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'))) });
  } catch (e) { res.status(500).json({ error: 'Aksiyonlar okunamadı', details: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    let action;
    await mutateState(state => {
      const rep = resolveSalesRepIdentity(state, req.user);
      if (!rep && !isAdmin(req.user)) throw Object.assign(new Error('Satışçı profili bulunamadı'), { statusCode: 403 });
      const companyId = String(req.body?.companyId || '');
      if (rep && companyId) {
        const company = (state.sd_co || []).find(c => String(c.id) === companyId);
        if (!company || !companyBelongsToSalesRep(company, rep)) throw Object.assign(new Error('Bu firma size atanmamış'), { statusCode: 403 });
      }
      const description = String(req.body?.description || req.body?.title || '').trim().slice(0, 1000);
      if (!description) throw Object.assign(new Error('Aksiyon açıklaması gerekli'), { statusCode: 400 });
      action = {
        id: 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        companyId, salesRepId: rep?.id || String(req.body?.salesRepId || ''),
        createdByUserId: req.user.id, createdByRole: req.user.role, assignedToUserId: rep?.userId || req.user.id,
        actionType: String(req.body?.actionType || 'follow_up').slice(0, 60),
        description, title: description.slice(0, 300),
        dueDate: String(req.body?.dueDate || '').slice(0, 10),
        status: 'open',
        priority: ['low', 'high', 'critical'].includes(req.body?.priority) ? req.body.priority : 'normal',
        relatedVisitId: String(req.body?.relatedVisitId || ''), relatedSampleId: String(req.body?.relatedSampleId || ''),
        createdAt: new Date().toISOString()
      };
      state.sd_actions = Array.isArray(state.sd_actions) ? state.sd_actions : [];
      state.sd_actions.push(action);
    }, req.user.id);
    res.status(201).json({ success: true, action });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message || 'Aksiyon eklenemedi' }); }
});

router.put('/:id', async (req, res) => {
  try {
    await mutateState(state => {
      const ids = new Set(visible(state, req.user).map(a => String(a.id)));
      if (!ids.has(String(req.params.id))) throw Object.assign(new Error('Aksiyon bulunamadı'), { statusCode: 404 });
      const status = req.body?.status === 'done' ? 'done' : (req.body?.status === 'cancelled' ? 'cancelled' : 'open');
      state.sd_actions = (state.sd_actions || []).map(a => String(a.id) === String(req.params.id) ? {
        ...a, status,
        completedAt: status !== 'open' ? new Date().toISOString() : null,
        completedByUserId: status !== 'open' ? req.user.id : null
      } : a);
    }, req.user.id);
    res.json({ success: true });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message || 'Güncellenemedi' }); }
});

// Aksiyonlar kalıcı olarak silinemez — yalnızca admin, uyumluluk/denetim
// amaçlı temizlik için kaldırabilir. Satışçı yalnızca durumunu değiştirebilir.
router.delete('/:id', async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Aksiyonlar yalnızca durum değiştirilerek kapatılabilir, silinemez' });
  try {
    await mutateState(state => {
      const ids = new Set((state.sd_actions || []).map(a => String(a.id)));
      if (!ids.has(String(req.params.id))) throw Object.assign(new Error('Aksiyon bulunamadı'), { statusCode: 404 });
      state.sd_actions = (state.sd_actions || []).filter(a => String(a.id) !== String(req.params.id));
    }, req.user.id);
    res.json({ success: true });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message || 'Silinemedi' }); }
});

module.exports = router;
