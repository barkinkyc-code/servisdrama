const express = require('express');
const auth = require('../middleware/auth');
const { mutateState } = require('../utils/stateStore');
const { resolveSalesRepIdentity, companyBelongsToSalesRep } = require('../utils/salesIdentity');
const { sendPushForNotification } = require('../utils/webPush');
const router = express.Router();
const isAdmin = u => String(u?.role || '').toLowerCase() === 'admin';
const isSales = u => String(u?.role || '').toLowerCase() === 'sales';

router.use(auth);
router.use((req, res, next) => (isAdmin(req.user) || isSales(req.user)) ? next() : res.status(403).json({ error: 'Bu modüle erişim yetkiniz yok' }));

// Satışçı numuneyi bizzat kendisi aldığında kayıt oluşturur — numune.js ile aynı veri
// modeli ({id,firmaId,firmAdi,lab,ekipmanlar,urunler,tarih,not,result}) + kaynak bilgisi.
// Firmaya atanmış teknisyene otomatik bildirim düşer.
router.post('/', async (req, res) => {
  try {
    let sample, notifForPush;
    await mutateState(state => {
      const rep = resolveSalesRepIdentity(state, req.user);
      if (!rep && !isAdmin(req.user)) throw Object.assign(new Error('Satışçı profili bulunamadı'), { statusCode: 403 });

      const companyId = String(req.body?.companyId || req.body?.firmaId || '');
      const company = (state.sd_co || []).find(c => String(c.id) === companyId);
      if (!company) throw Object.assign(new Error('Firma bulunamadı'), { statusCode: 404 });
      if (rep && !companyBelongsToSalesRep(company, rep)) throw Object.assign(new Error('Bu firma size atanmamış'), { statusCode: 403 });

      const lab = String(req.body?.lab || '').trim().toUpperCase().slice(0, 100);
      if (!lab) throw Object.assign(new Error('Analiz merkezi/lab gerekli'), { statusCode: 400 });
      const urunler = String(req.body?.urunler || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);
      if (!urunler.length) throw Object.assign(new Error('En az bir ürün/numune girin'), { statusCode: 400 });
      const tarih = String(req.body?.tarih || new Date().toISOString().slice(0, 10)).slice(0, 10);

      sample = {
        id: 'NM-' + Date.now().toString(36).toUpperCase(),
        firmaId: companyId,
        firmAdi: company.name,
        lab,
        ekipmanlar: [],
        urunler,
        tarih,
        not: String(req.body?.not || '').trim().slice(0, 500),
        result: '',
        reminderSent: false,
        ts: Date.now(),
        source: 'sales',
        salesRepId: rep?.id || '',
        salesRepName: rep?.name || req.user.username
      };
      state.sd_samples = Array.isArray(state.sd_samples) ? state.sd_samples : [];
      state.sd_samples.push(sample);

      // Atanmış teknisyene bildirim: satışçı numune aldı.
      if (company.techId) {
        state.sd_notifications = Array.isArray(state.sd_notifications) ? state.sd_notifications : [];
        notifForPush = {
          id: 'not_' + Date.now() + '_smp',
          recipientTechId: String(company.techId),
          recipientRole: 'tech',
          companyId,
          type: 'sample_taken_by_sales',
          title: 'Satışçı numune aldı',
          message: `${sample.salesRepName}, ${company.name} firmasından numune aldı: ${urunler.join(', ')} (${lab}).`,
          createdAt: new Date().toISOString(),
          read: false,
          status: 'unread'
        };
        state.sd_notifications.push(notifForPush);
      }
    }, req.user.id);
    // await edilir — Vercel serverless'te cevap gönderildikten SONRA çalışan
    // kod bitmesi garanti edilmeden dondurulabiliyor (bkz. visit-requests.js
    // aynı notu). Ateşle-unut yapılsaydı push çoğu zaman hiç gitmezdi.
    if (notifForPush) await sendPushForNotification(notifForPush).catch(() => {});
    res.status(201).json({ success: true, sample });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message || 'Numune eklenemedi' }); }
});

module.exports = router;
