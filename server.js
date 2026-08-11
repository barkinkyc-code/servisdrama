require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();

// Security Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
// admin.js/data.js gibi metin yanıtlarını küçültür; compression paketi video/webm
// gibi zaten sıkıştırılmış içerikleri kendi filtresiyle otomatik atlar.
app.use(compression());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting (only in production)
if (process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 100 // limit her IP için 100 requests
  });
  app.use(limiter);
}

// Static files
app.use(express.static(path.join(__dirname)));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/data', require('./routes/data'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/state', require('./routes/state'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/actions', require('./routes/actions'));
app.use('/api/samples', require('./routes/samples'));
app.use('/api/sales', require('./routes/sales'));

// ═══ MAIL SYSTEM ═══
// Rapor e-postalarındaki cid: görsellerin ortak kaynağı (manuel "Rapor Gönder" ve
// otomatik gün özeti aynı görselleri kullanır).
const REPORT_PNG_FILES = {
  'drama-makine-logo': { file: 'drama-makine-logo.png', dir: 'technical-service' },
  'icon-phone': { file: 'icon-phone.png', dir: 'technical-service' },
  'icon-mail': { file: 'icon-mail.png', dir: 'technical-service' },
  'icon-linkedin': { file: 'icon-linkedin.png', dir: 'technical-service' },
  'icon-youtube': { file: 'icon-youtube.png', dir: 'technical-service' },
  'icon-instagram': { file: 'icon-instagram.png', dir: 'technical-service' },
  'icon-web': { file: 'icon-web.png', dir: 'technical-service' },
  'icon-pin': { file: 'icon-pin.png', dir: 'technical-service' },
  'icon-shield': { file: 'icon-shield.png', dir: 'technical-service' },
  'icon-check': { file: 'icon-check.png', dir: 'technical-service' },
  'icon-headset': { file: 'icon-headset.png', dir: 'technical-service' },
  'icon-star': { file: 'icon-star.png', dir: 'servisdrama' },
  'servisdrama-calendar-white': { file: 'icon-calendar-white.png', dir: 'servisdrama' },
  'stat-visits': { file: 'stat-visits.png', dir: 'servisdrama/stat-icons' },
  'stat-companies': { file: 'stat-companies.png', dir: 'servisdrama/stat-icons' },
  'stat-check': { file: 'stat-check.png', dir: 'servisdrama/stat-icons' },
  'stat-alert': { file: 'stat-alert.png', dir: 'servisdrama/stat-icons' },
  'stat-calendar': { file: 'stat-calendar.png', dir: 'servisdrama/stat-icons' },
  'stat-score': { file: 'stat-score.png', dir: 'servisdrama/stat-icons' },
  'stat-target': { file: 'stat-target.png', dir: 'servisdrama/stat-icons' }
};
function buildCidAttachments(names) {
  const attachments = [];
  if (Array.isArray(names)) {
    names.forEach(cid => {
      const fileInfo = REPORT_PNG_FILES[cid];
      if (!fileInfo) return;
      const filepath = path.join(__dirname, 'assets', 'email', fileInfo.dir, fileInfo.file);
      try {
        attachments.push({ filename: fileInfo.file, content: fs.readFileSync(filepath), cid });
      } catch (e) {
        console.warn(`✗ Could not attach ${fileInfo.file} (${cid}): ${e.message}`);
      }
    });
  }
  return attachments;
}

// Mail gönder endpoint (CID attachments + Nodemailer)
app.post('/api/send-test-mail', (req, res) => {
  try {
    let { to, cc, subject, html, smtpHost, smtpPort, smtpUser, smtpPass, smtpTls, from, attachmentNames, attachments: uploadedAttachments } = req.body;

    // Array'ları string'e çevir
    to = Array.isArray(to) ? to.join(', ') : to;
    cc = Array.isArray(cc) ? cc.join(', ') : cc;

    console.log('=== MAIL GÖNDERİM DEBUG ===');
    console.log('TO:', to);
    console.log('CC:', cc);
    console.log('CC tip:', typeof cc);
    console.log('CC boş mu:', !cc);

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // SMTP config from request body (form data) or env
    const resolvedPort = parseInt(smtpPort || process.env.SMTP_PORT || 587, 10);
    const smtpConfig = {
      host: smtpHost || process.env.SMTP_HOST || 'mail.dramagroup.com.tr',
      port: resolvedPort,
      secure: resolvedPort === 465,
      requireTLS: resolvedPort !== 465,
      auth: {
        user: smtpUser || process.env.SMTP_USER || 'kimyaservis@dramagroup.com',
        pass: smtpPass || process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false // Kendi imzalı sertifikalar için
      }
    };

    console.log('SMTP Config:', { host: smtpConfig.host, port: smtpConfig.port, user: smtpConfig.auth.user });

    const transporter = nodemailer.createTransport(smtpConfig);

    // Build attachments array from PNG files
    const attachments = buildCidAttachments(attachmentNames);
    if (Array.isArray(uploadedAttachments)) {
      uploadedAttachments.forEach(file => {
        if (!file || !file.filename || !file.contentBase64) return;
        attachments.push({
          filename: String(file.filename).replace(/[\\/]/g, '_'),
          content: Buffer.from(file.contentBase64, 'base64'),
          contentType: file.contentType || 'application/octet-stream'
        });
      });
    }

    const mailOptions = {
      from: from || process.env.SMTP_FROM || 'Drama Kimya <kimyaservis@dramamakine.com>',
      to: to,
      subject: subject,
      html: html,
      ...(cc && { cc }),
      ...(attachments.length > 0 && { attachments })
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error('Mail gönderme hatası:', err);
        return res.status(500).json({ error: 'Mail gönderme başarısız', details: err.message });
      }
      console.log('Mail gönderildi:', info.response);
      res.json({ success: true, message: 'Test maili başarıyla gönderildi', response: info.response });
    });
  } catch (err) {
    console.error('Server hatası:', err);
    res.status(500).json({ error: 'Server hatası', details: err.message });
  }
});

// Ziyaret kaydı endpoint'i
app.post('/api/visits', (req, res) => {
  try {
    const { visits } = req.body;
    if (!visits) {
      return res.status(400).json({ error: 'Ziyaret verisi gerekli' });
    }
    console.log('✓ Ziyaret kaydı alındı:', Object.keys(visits).length, 'kayıt');
    res.json({ success: true, message: 'Ziyaretler kaydedildi' });
  } catch (err) {
    console.error('Ziyaret kaydetme hatası:', err);
    res.status(500).json({ error: 'Ziyaret kaydetme başarısız', details: err.message });
  }
});

// Ana sayfa
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Admin paneli
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Health check for Vercel and uptime tests
app.get('/api/health', (req, res) => {
  res.json({ success: true, service: 'servisdrama', runtime: process.env.VERCEL ? 'vercel' : 'local' });
});

app.get('/api/cron/sales-notifications', async (req, res) => {
  try {
    const expected = process.env.CRON_SECRET;
    const supplied = req.headers.authorization === `Bearer ${expected}` || req.query.secret === expected;
    if (expected && !supplied) return res.status(401).json({ error: 'Unauthorized' });
    const notificationService = require('./services/notificationService');
    const db = require('./config/database');
    const result = await notificationService.checkAndNotify(db, { sendEmails: false });
    res.json({ success: true, ...result });
  } catch (err) { res.status(500).json({ error: 'Bildirim kontrolü başarısız', details: err.message }); }
});


// Automatic daily summary (Vercel Cron or owner test)
async function loadMainState(){
  const db=require('./config/database');await db.ready();
  if(db.dialect==='postgres'){const r=await db.raw.query("SELECT payload FROM app_state WHERE state_key='main'");return r.rows[0]?.payload||{};}
  return await new Promise((resolve,reject)=>db.get("SELECT payload FROM app_state WHERE state_key='main'",[],(e,row)=>e?reject(e):resolve(row?JSON.parse(row.payload||'{}'):{})));
}
function trNow(){return new Date(new Date().toLocaleString('en-US',{timeZone:'Europe/Istanbul'}));}

// Ziyaret Takibi'ndeki manuel "Rapor Gönder" ikonu ile otomatik gün özeti AYNI
// e-posta şablonunu (email-template.js) kullanır. Bu şablon tarayıcıda global
// SD/DT/BL nesnelerini okur; sunucu tarafında bunların salt-veri (state
// tabanlı) karşılıklarını üretip enjekte ediyoruz — data.js'teki mantıkla
// birebir aynı, saf fonksiyonlar.
const { buildOutlookRaporHTML, buildNumuneReminderMailHTML } = require('./email-template.js');
const REPORT_DT = {
  monday(d){const x=new Date(d),n=(x.getDay()+6)%7;x.setDate(x.getDate()-n);x.setHours(0,0,0,0);return x;},
  isoWeek(d){const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=(x.getUTCDay()+6)%7;x.setUTCDate(x.getUTCDate()-day+3);const t4=new Date(Date.UTC(x.getUTCFullYear(),0,4));return 1+Math.round(((x-t4)/864e5-3+((t4.getUTCDay()+6)%7))/7);},
  wkey(d){return d.getFullYear()+'-W'+String(REPORT_DT.isoWeek(d)).padStart(2,'0');},
  ddmm(d){return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0');},
  monthWeeks(y,m){const first=new Date(y,m,1),last=new Date(y,m+1,0),weeks=[];let cur=REPORT_DT.monday(first);while(cur<=last){weeks.push(new Date(cur));cur=new Date(cur);cur.setDate(cur.getDate()+7);}return weeks;}
};
const REPORT_BL = {
  scheduled(co,wi){const pattern=co.weeks||[1,2,3,4],idx=((wi-1)%4);return pattern.indexOf(idx+1)>=0;},
  avatarColor(str){if(!str)return'#0B5FE8';if(str.indexOf('Semih')>=0||str.indexOf('1015')>=0)return'#0B5FE8';if(str.indexOf('Süleyman')>=0||str.indexOf('Suleyman')>=0||str.indexOf('1016')>=0)return'#F59E0B';const cols=['#0B5FE8','#059669','#F59E0B','#DC2626','#7C3AED','#06B6D4','#8B5CF6','#0EA5E9'];let h=0;for(let i=0;i<str.length;i++)h=(h*31+str.charCodeAt(i))&0xffff;return cols[h%cols.length];}
};
function reportVisitEntryFor(rec,code){
  if(!rec)return null;
  const by=(rec.by&&typeof rec.by==='object')?rec.by:(rec.tc?{[rec.tc]:rec}:{});
  return by[code]||null;
}
function stateToReportSD(state){
  return {
    companies: state.sd_co||[],
    visits: state.sd_vi||{},
    technicians: state.sd_te||[],
    extras: state.sd_ex||[],
    visitEntryFor: reportVisitEntryFor
  };
}

// state'i kaydettiği tabloya (postgres/sqlite) geri yazar — hem gün özeti
// hem numune hatırlatma tarafından paylaşılan tek yazma noktası.
async function persistState(state){
  const db=require('./config/database');
  await db.ready();
  if(db.dialect==='postgres'){
    await db.raw.query(`INSERT INTO app_state(state_key,payload,updated_at)
      VALUES('main',$1::jsonb,NOW())
      ON CONFLICT(state_key) DO UPDATE SET payload=EXCLUDED.payload,updated_at=NOW()`,[JSON.stringify(state)]);
  }else{
    await new Promise((resolve,reject)=>db.run("INSERT OR REPLACE INTO app_state(state_key,payload,updated_at) VALUES('main',?,CURRENT_TIMESTAMP)",[JSON.stringify(state)],e=>e?reject(e):resolve()));
  }
}
function envMailList(name){
  return String(process.env[name]||'').split(/[\n,;]+/).map(v=>v.trim()).filter(Boolean);
}
function assertSmtpConfig(cfg){
  const host=cfg.smtpHost||process.env.SMTP_HOST;
  const user=cfg.smtpUser||process.env.SMTP_USER;
  const pass=cfg.smtpPass||process.env.SMTP_PASS;
  if(!host||!user||!pass){
    const err=new Error('SMTP ayarları eksik. Vercel Environment Variables içine SMTP_HOST, SMTP_USER ve SMTP_PASS ekleyin.');
    err.statusCode=503;throw err;
  }
}

// "dd.mm.yyyy" veya native <input type=date> "yyyy-mm-dd" biçimini ayrıştırır.
function parseSimpleDate(v){
  if(!v)return null;
  if(v instanceof Date)return isNaN(v.getTime())?null:new Date(v.getTime());
  var s=String(v).trim();
  var iso=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(iso)return new Date(Number(iso[1]),Number(iso[2])-1,Number(iso[3]));
  var p=s.split('.');
  if(p.length<3)return null;
  var d=new Date(Number(p[2]),Number(p[1])-1,Number(p[0]));
  return isNaN(d.getTime())?null:d;
}
// data.js'teki businessDaysBetween ile birebir aynı mantık (hafta sonu +
// sabit resmi tatiller + ayarlardaki özel tatiller hariç tutulur).
function businessDaysBetween(fromDate,toDate,officialHolidays){
  var from=parseSimpleDate(fromDate),to=parseSimpleDate(toDate);
  if(!from||!to||to<=from)return 0;
  from.setHours(0,0,0,0);to.setHours(0,0,0,0);
  var fixedHolidays={'01-01':true,'04-23':true,'05-01':true,'05-19':true,'07-15':true,'08-30':true,'10-29':true};
  var configured={};
  (officialHolidays||[]).forEach(function(value){
    var d=parseSimpleDate(value);
    if(d)configured[d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')]=true;
  });
  var count=0,current=new Date(from);
  current.setDate(current.getDate()+1);
  while(current<=to){
    var day=current.getDay();
    var monthDay=String(current.getMonth()+1).padStart(2,'0')+'-'+String(current.getDate()).padStart(2,'0');
    var fullKey=current.getFullYear()+'-'+monthDay;
    if(day>=1&&day<=5&&!fixedHolidays[monthDay]&&!configured[fullKey])count++;
    current.setDate(current.getDate()+1);
  }
  return count;
}

// Sonucu girilmemiş numuneler için: gönderim tarihinden itibaren 7 iş günü
// geçtiyse ve daha önce hatırlatma gönderilmediyse (reminderSent), aynı
// alıcı listesiyle (firma + analiz merkezi + ilave adres) hatırlatma maili
// gönderir. state.sd_samples üzerinde değişiklik varsa true döner.
async function checkNumuneReminders(state,cfg){
  var samples=state.sd_samples||[];
  var companies=state.sd_co||[];
  var now=trNow();
  var changed=false;
  var transporter=null;
  for(var i=0;i<samples.length;i++){
    var s=samples[i];
    if(!s||s.result||s.reminderSent)continue;
    var submitted=parseSimpleDate(s.tarih);
    if(!submitted)continue;
    var days=businessDaysBetween(submitted,now,cfg.officialHolidays);
    if(days<7)continue;
    if(!transporter){
      var port=parseInt(cfg.smtpPort||process.env.SMTP_PORT||587,10);
      transporter=nodemailer.createTransport({host:cfg.smtpHost||process.env.SMTP_HOST,port,secure:port===465,auth:{user:cfg.smtpUser||process.env.SMTP_USER,pass:cfg.smtpPass||process.env.SMTP_PASS},tls:{rejectUnauthorized:false}});
    }
    var co=companies.find(function(c){return c.id===s.firmaId;});
    var ccList=[].concat((co&&co.aMails)||[],(cfg.labMails&&cfg.labMails[s.lab])||[]);
    if(s.extraMail)ccList.push(s.extraMail);
    ccList=ccList.filter(function(v,idx,arr){return v&&arr.indexOf(v)===idx;});
    var html=buildNumuneReminderMailHTML(s,days);
    var attachments=buildCidAttachments(['drama-makine-logo']);
    try{
      await transporter.sendMail({
        from:(cfg.smtpSenderName||'Drama Makine')+' <'+(cfg.smtpSenderEmail||process.env.SMTP_FROM||cfg.smtpUser)+'>',
        to:'barkin.kayaci@dramamakine.com',
        subject:'ServisDrama - Numune Hatırlatma ('+s.id+' | '+s.firmAdi+')',
        html:html,
        ...(ccList.length>0&&{cc:ccList.join(',')}),
        ...(attachments.length>0&&{attachments})
      });
      s.reminderSent=true;changed=true;
    }catch(e){
      console.error('Numune hatırlatma maili gönderilemedi:',s.id,e.message);
    }
  }
  if(changed)state.sd_samples=samples;
  return changed;
}

app.all('/api/daily-summary',async(req,res)=>{
  try{
    const state=await loadMainState(),cfg=state.sd_cfg||{},now=trNow();
    const force=req.method==='POST'&&req.body?.force===true;
    if(force){
      const jwt=require('jsonwebtoken'),token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
      let decoded;
      try{decoded=jwt.verify(token,process.env.JWT_SECRET||'servisdrama-secret-key-change-in-production');}
      catch(e){return res.status(401).json({error:'Yetkisiz istek'});}
      if(String(decoded.username||'').toLowerCase()!=='barkin.kayaci')return res.status(403).json({error:'Bu işlem yalnızca Barkın Kayacı hesabına açıktır'});
    }

    // Numune hatırlatmaları, günlük ziyaret raporunun saat/durum kontrolünden
    // bağımsız olarak her cron tetiklemesinde kontrol edilir.
    const remindersChanged=await checkNumuneReminders(state,cfg);

    const target=(!cfg.dailySummaryTime||cfg.dailySummaryTime==='18:00')?'19:00':cfg.dailySummaryTime,today=now.toISOString().slice(0,10),nowMin=now.getHours()*60+now.getMinutes();
    const tp=target.split(':').map(Number),targetMin=(tp[0]||0)*60+(tp[1]||0),due=nowMin>=targetMin;
    if(!force&&(!cfg.dailySummaryEnabled||!due||cfg.dailySummaryLastSent===today)){
      if(remindersChanged)await persistState(state);
      return res.json({success:true,skipped:true,reason:'not-due',reminders:remindersChanged});
    }

    // Test düğmesi, veritabanı senkronizasyonunu beklemeden güncel alıcıları göndersin.
    const bodyTo=force&&Array.isArray(req.body?.to)?req.body.to:[];
    const bodyCc=force&&Array.isArray(req.body?.cc)?req.body.cc:[];
    const to=(bodyTo.length?bodyTo:(cfg.dailySummaryTo||envMailList('DAILY_SUMMARY_TO'))).filter(Boolean);
    const cc=(bodyCc.length?bodyCc:(cfg.dailySummaryCc||envMailList('DAILY_SUMMARY_CC'))).filter(Boolean);
    if(!to.length)return res.status(400).json({error:'Gün özeti TO alıcısı tanımlı değil. Panelden alıcı ekleyin veya DAILY_SUMMARY_TO ortam değişkenini tanımlayın.'});
    assertSmtpConfig(cfg);
    const port=parseInt(cfg.smtpPort||process.env.SMTP_PORT||587,10);
    const transporter=nodemailer.createTransport({host:cfg.smtpHost||process.env.SMTP_HOST,port,secure:port===465,requireTLS:port!==465,auth:{user:cfg.smtpUser||process.env.SMTP_USER,pass:cfg.smtpPass||process.env.SMTP_PASS},tls:{rejectUnauthorized:false}});
    const html=buildOutlookRaporHTML({SD:stateToReportSD(state),DT:REPORT_DT,BL:REPORT_BL,today:now});
    const attachments=buildCidAttachments(['drama-makine-logo','icon-star','servisdrama-calendar-white']);
    await transporter.sendMail({from:(cfg.smtpSenderName||'Drama Makine')+' <'+(cfg.smtpSenderEmail||process.env.SMTP_FROM||cfg.smtpUser)+'>',to:to.join(','),cc:cc.join(','),subject:'ServisDrama - Günlük Ziyaret Raporu ('+String(now.getDate()).padStart(2,'0')+'.'+String(now.getMonth()+1).padStart(2,'0')+'.'+now.getFullYear()+')',html,...(attachments.length>0&&{attachments})});
    cfg.dailySummaryLastSent=today;state.sd_cfg=cfg;
    await persistState(state);
    res.json({success:true,to,cc,reminders:remindersChanged});
  }catch(e){
    res.status(e.statusCode||500).json({error:'Gün özeti gönderilemedi',details:e.message});
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Server error', message: err.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;

// Local development: open a TCP port only when this file is executed directly.
// Vercel imports and invokes the exported Express app as a serverless function.
if (require.main === module) {
  // Start notification service
  const notificationService = require('./services/notificationService');
  const db = require('./config/database');
  // Vercel/serverless ortamında setInterval güvenilir değildir; bildirimler cron endpoint'iyle üretilir.

  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║   ServisDrama System Started         ║
║   Server: http://localhost:${PORT}   ║
║   Notification Service: Active       ║
╚══════════════════════════════════════╝
    `);
  });
}

module.exports = app;
