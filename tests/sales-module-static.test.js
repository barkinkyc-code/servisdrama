const fs=require('fs');
function has(file,text){const s=fs.readFileSync(file,'utf8');if(!s.includes(text))throw new Error(`${file}: beklenen içerik yok: ${text}`);}
['routes/sales.js','routes/actions.js','routes/notifications.js','utils/stateStore.js','sales.js'].forEach(f=>{if(!fs.existsSync(f))throw new Error(f+' eksik');});
has('server.js',"app.use('/api/sales'");
has('routes/auth.js',"Yalnızca admin kullanıcı oluşturabilir");
has('routes/auth.js',"Hesap pasif");
has('routes/state.js',"Satışçı kullanıcıları state yazamaz");
has('routes/state.js','legacyUserId');
has('routes/actions.js','mutateState');
has('routes/notifications.js','mutateState');
has('services/notificationService.js','setInterval kullanılmıyor');
has('vercel.json','/api/cron/sales-notifications');
has('admin.html','newSalesPassword');
has('sales.js','Riskli/Kritik Firma');
console.log('Satışçı modülü statik kontrolleri başarılı.');
