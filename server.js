require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();

// Security Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

// ═══ MAIL SYSTEM ═══
// Rapor e-postalarındaki cid: görsellerin ortak kaynağı (manuel "Rapor Gönder" ve
// otomatik gün özeti aynı görselleri kullanır).
const REPORT_PNG_FILES = {
  'drama-makine-logo': { file: 'drama-makine-logo.png', dir: 'technical-service' },
  'icon-phone': { file: 'icon-phone.png', dir: 'technical-service' },
  'icon-mail': { file: 'icon-mail.png', dir: 'technical-service' },
  'icon-star': { file: 'icon-star.png', dir: 'servisdrama' },
  'servisdrama-calendar-white': { file: 'icon-calendar-white.png', dir: 'servisdrama' }
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
    let { to, cc, subject, html, smtpHost, smtpPort, smtpUser, smtpPass, smtpTls, from, attachmentNames } = req.body;

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
const { buildOutlookRaporHTML } = require('./email-template.js');
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
app.all('/api/daily-summary',async(req,res)=>{try{const state=await loadMainState(),cfg=state.sd_cfg||{},now=trNow(),force=req.method==='POST'&&req.body?.force===true;if(force){const jwt=require('jsonwebtoken'),token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');let decoded;try{decoded=jwt.verify(token,process.env.JWT_SECRET||'servisdrama-secret-key-change-in-production');}catch(e){return res.status(401).json({error:'Yetkisiz istek'});}if(String(decoded.username||'').toLowerCase()!=='barkin.kayaci')return res.status(403).json({error:'Bu işlem yalnızca Barkın Kayacı hesabına açıktır'});}const target=cfg.dailySummaryTime||'18:00',today=now.toISOString().slice(0,10),nowMin=now.getHours()*60+now.getMinutes(),tp=target.split(':').map(Number),targetMin=(tp[0]||0)*60+(tp[1]||0),due=nowMin>=targetMin;if(!force&&(!cfg.dailySummaryEnabled||!due||cfg.dailySummaryLastSent===today))return res.json({success:true,skipped:true,reason:'not-due'});const to=(cfg.dailySummaryTo||[]),cc=(cfg.dailySummaryCc||[]);if(!to.length)return res.status(400).json({error:'Gün özeti TO alıcısı tanımlı değil'});const port=parseInt(cfg.smtpPort||process.env.SMTP_PORT||587,10);const transporter=nodemailer.createTransport({host:cfg.smtpHost||process.env.SMTP_HOST,port,secure:port===465,auth:{user:cfg.smtpUser||process.env.SMTP_USER,pass:cfg.smtpPass||process.env.SMTP_PASS},tls:{rejectUnauthorized:false}});const html=buildOutlookRaporHTML({SD:stateToReportSD(state),DT:REPORT_DT,BL:REPORT_BL,today:now});const attachments=buildCidAttachments(['drama-makine-logo','icon-star','servisdrama-calendar-white']);await transporter.sendMail({from:(cfg.smtpSenderName||'Drama Makine')+' <'+(cfg.smtpSenderEmail||process.env.SMTP_FROM||cfg.smtpUser)+'>',to:to.join(','),cc:cc.join(','),subject:'ServisDrama - Günlük Ziyaret Raporu ('+String(now.getDate()).padStart(2,'0')+'.'+String(now.getMonth()+1).padStart(2,'0')+'.'+now.getFullYear()+')',html,...(attachments.length>0&&{attachments})});cfg.dailySummaryLastSent=today;state.sd_cfg=cfg;const db=require('./config/database');if(db.dialect==='postgres')await db.raw.query("UPDATE app_state SET payload=$1::jsonb,updated_at=NOW() WHERE state_key='main'",[JSON.stringify(state)]);res.json({success:true,to,cc});}catch(e){res.status(500).json({error:'Gün özeti gönderilemedi',details:e.message});}});

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
  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║   ServisDrama System Started         ║
║   Server: http://localhost:${PORT}   ║
╚══════════════════════════════════════╝
    `);
  });
}

module.exports = app;
