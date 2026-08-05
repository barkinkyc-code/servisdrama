const fs=require('fs');
function has(file,text){const s=fs.readFileSync(file,'utf8');if(!s.includes(text))throw new Error(`${file}: beklenen içerik yok: ${text}`);}
['routes/sales.js','routes/actions.js','routes/notifications.js','utils/stateStore.js','utils/salesIdentity.js','sales.js'].forEach(f=>{if(!fs.existsSync(f))throw new Error(f+' eksik');});
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
has('sales.js','Riskli/Kritik Firma');
console.log('Satışçı modülü statik kontrolleri başarılı.');
