const fs=require('fs');
function has(file,text){const s=fs.readFileSync(file,'utf8');if(!s.includes(text))throw new Error(`${file}: beklenen içerik yok: ${text}`);}
['routes/sales.js','routes/actions.js','routes/notifications.js','routes/visit-requests.js','utils/stateStore.js','utils/salesIdentity.js','sales.js','company-360.js','notify-bell.js'].forEach(f=>{if(!fs.existsSync(f))throw new Error(f+' eksik');});
has('server.js',"app.use('/api/sales'");
has('routes/auth.js',"Yalnızca admin kullanıcı oluşturabilir");
has('routes/auth.js',"Hesap pasif");
has('routes/state.js',"Satışçı kullanıcıları state yazamaz");
has('utils/salesIdentity.js','legacyUserId');
// Kimlik çözümleme tek merkezden gelmeli — her route kendi kopyasını yazmamalı.
has('routes/state.js',"require('../utils/salesIdentity')");
has('routes/actions.js',"require('../utils/salesIdentity')");
has('routes/notifications.js',"require('../utils/salesIdentity')");
has('services/notificationService.js',"require('../utils/salesIdentity')");
has('routes/actions.js','mutateState');
has('routes/notifications.js','mutateState');
// Satışçı bildirim/aksiyon kayıtlarını kalıcı silemez — yalnızca admin.
has('routes/actions.js',"if (!isAdmin(req.user)) return res.status(403)");
has('routes/notifications.js',"if (!isAdmin(req.user)) return res.status(403)");
has('services/notificationService.js','setInterval kullanılmıyor');
has('vercel.json','/api/cron/sales-notifications');
has('admin.html','newSalesPassword');
// Satışçı paneli hesap yapmaz: skor/durum/ziyaret okuması company-360.js'te.
has('sales.js','C360.durum');
has('company-360.js','weeklyScoreDetail');

// ═══ Ziyaret talebi ═══
has('server.js',"app.use('/api/visit-requests'");
has('routes/visit-requests.js',"require('../utils/salesIdentity')");
has('routes/visit-requests.js','recipientTechId');           // teknisyene bildirim
has('routes/visit-requests.js','Bu firma size atanmamış');   // sahiplik kontrolü
has('routes/visit-requests.js','zaten açık bir ziyaret talebi'); // mükerrer talep engeli
// Talepler sunucu otoritesinde: admin'in state gönderimi kayıtları silmemeli.
has('routes/state.js','preserveVisitRequests');
has('utils/salesIdentity.js','sd_visit_requests');
console.log('Satışçı modülü statik kontrolleri başarılı.');
