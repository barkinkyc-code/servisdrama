/* ═══════════════════════════════════════════════════════════════════
   Push abonelik yönetimi — bkz. utils/webPush.js (gönderim tarafı).
   ═══════════════════════════════════════════════════════════════════ */
const express = require('express');
const auth = require('../middleware/auth');
const { readState, mutateState } = require('../utils/stateStore');
const { categories } = require('../utils/webPush');
const router = express.Router();
const isAdmin = u => String(u?.role || '').toLowerCase() === 'admin';

// VAPID public key gizli değildir (SSH public key gibi) — abonelik akışı
// bunu ihtiyaç duyduğu an alabilsin diye auth ARANMAZ.
router.get('/vapid-public-key', (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) return res.status(503).json({ error: 'Push yapılandırılmamış' });
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

router.use(auth);

// Abonelik kaydet/güncelle. Aynı endpoint (cihaz+tarayıcı+origin eşsiz
// kimliği) tekrar geldiğinde eskisi silinip yenisi yazılır — çoğaltılmaz.
router.post('/subscribe', async (req, res) => {
  try {
    const sub = req.body?.subscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return res.status(400).json({ error: 'Geçersiz abonelik' });
    }
    await mutateState(state => {
      state.sd_push_subscriptions = Array.isArray(state.sd_push_subscriptions) ? state.sd_push_subscriptions : [];
      state.sd_push_subscriptions = state.sd_push_subscriptions.filter(s => s.endpoint !== sub.endpoint);
      state.sd_push_subscriptions.push({
        id: 'push_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        userId: String(req.user.id),
        role: String(req.user.role || '').toLowerCase(),
        endpoint: sub.endpoint,
        keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) },
        ua: String(req.body?.ua || '').slice(0, 200),
        createdAt: new Date().toISOString()
      });
    }, req.user.id);
    res.status(201).json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Kaydedilemedi', details: e.message }); }
});

// Çıkış yapıldığında veya bildirimler kapatıldığında: yalnızca KENDİ
// aboneliğini silebilir — başka bir kullanıcının cihazını hedefleyemez.
router.post('/unsubscribe', async (req, res) => {
  try {
    const endpoint = String(req.body?.endpoint || '');
    await mutateState(state => {
      state.sd_push_subscriptions = (state.sd_push_subscriptions || [])
        .filter(s => !(s.endpoint === endpoint && String(s.userId) === String(req.user.id)));
    }, req.user.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Silinemedi' }); }
});

router.get('/status', async (req, res) => {
  try {
    const { state } = await readState();
    const mine = (state.sd_push_subscriptions || []).filter(s => String(s.userId) === String(req.user.id));
    res.json({ success: true, configured: !!process.env.VAPID_PUBLIC_KEY, deviceCount: mine.length });
  } catch (e) { res.status(500).json({ error: 'Okunamadı' }); }
});

// Tercihler: hangi bildirim türlerinin push olarak da gönderileceği — yalnız
// admin değiştirebilir (sistem geneli tek anahtar seti, kullanıcı başına değil;
// "Push Bildirimleri [Açık] / Yeni servis ziyareti [✓] ..." örneğiyle birebir).
router.get('/prefs', async (req, res) => {
  try {
    const { state } = await readState();
    res.json({ success: true, prefs: state.sd_push_prefs || {}, categories: categories() });
  } catch (e) { res.status(500).json({ error: 'Okunamadı' }); }
});
router.put('/prefs', async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Yalnızca yönetici değiştirebilir' });
  try {
    let saved;
    await mutateState(state => {
      const body = req.body?.prefs || {};
      const clean = {};
      Object.keys(body).forEach(k => { clean[String(k).slice(0, 60)] = !!body[k]; });
      state.sd_push_prefs = clean;
      saved = clean;
    }, req.user.id);
    res.json({ success: true, prefs: saved });
  } catch (e) { res.status(500).json({ error: 'Kaydedilemedi' }); }
});

module.exports = router;
