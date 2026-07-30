require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
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
// Mail gönder endpoint (CID attachments + Nodemailer)
app.post('/api/send-test-mail', (req, res) => {
  try {
    const fs = require('fs');
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
    const attachments = [];
    const pngFiles = {
      'drama-makine-logo': { file: 'drama-makine-logo.png', dir: 'technical-service' },
      'icon-phone': { file: 'icon-phone.png', dir: 'technical-service' },
      'icon-mail': { file: 'icon-mail.png', dir: 'technical-service' },
      'icon-star': { file: 'icon-star.png', dir: 'servisdrama' },
      'servisdrama-calendar-white': { file: 'icon-calendar-white.png', dir: 'servisdrama' }
    };

    // Add requested attachments if specified
    if (attachmentNames && Array.isArray(attachmentNames)) {
      attachmentNames.forEach(cid => {
        const fileInfo = pngFiles[cid];
        if (fileInfo) {
          const filepath = path.join(__dirname, 'assets', 'email', fileInfo.dir, fileInfo.file);
          try {
            const content = fs.readFileSync(filepath);
            attachments.push({
              filename: fileInfo.file,
              content: content,
              cid: cid
            });
            console.log(`✓ Attached ${fileInfo.file} (${cid}) from ${fileInfo.dir}`);
          } catch (e) {
            console.warn(`✗ Could not attach ${fileInfo.file} (${cid}): ${e.message}`);
          }
        }
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


// Automatic daily summary (Vercel Cron or owner test)
async function loadMainState(){
  const db=require('./config/database');await db.ready();
  if(db.dialect==='postgres'){const r=await db.raw.query("SELECT payload FROM app_state WHERE state_key='main'");return r.rows[0]?.payload||{};}
  return await new Promise((resolve,reject)=>db.get("SELECT payload FROM app_state WHERE state_key='main'",[],(e,row)=>e?reject(e):resolve(row?JSON.parse(row.payload||'{}'):{})));
}
function trNow(){return new Date(new Date().toLocaleString('en-US',{timeZone:'Europe/Istanbul'}));}
function summaryHtml(state,now){const vis=state.sd_vi||{},cos=state.sd_co||[],techs=state.sd_te||[];const dd=String(now.getDate()).padStart(2,'0')+'.'+String(now.getMonth()+1).padStart(2,'0')+'.'+now.getFullYear();let rows=[];Object.keys(vis).forEach(k=>{const c=cos.find(x=>k.indexOf(x.id+'_')===0);const v=vis[k];const entries=v&&v.entries?Object.values(v.entries):[v];entries.forEach(x=>{if(!x||String(x.endDate||x.startDate||x.date||'').indexOf(dd.slice(0,5))!==0)return;const t=techs.find(z=>z.code===x.tc);rows.push(`<tr><td>${c?.name||k}</td><td>${t?.name||x.tc||'-'}</td><td>${x.startDate||x.date||''} ${x.startTime||x.saat||''}</td><td>${x.status==='done'?((x.endDate||x.date||'')+' '+(x.endTime||'')):'Devam Ediyor'}</td></tr>`);});});return `<!doctype html><html><body style="font-family:Arial;background:#f3f6fa;padding:24px"><div style="max-width:760px;margin:auto;background:#fff;border-radius:16px;overflow:hidden"><div style="background:#0b2c5f;color:#fff;padding:24px"><h2 style="margin:0">ServisDrama Gün Özeti</h2><div style="opacity:.8;margin-top:6px">${dd}</div></div><div style="padding:20px"><table width="100%" cellspacing="0" cellpadding="9" style="border-collapse:collapse"><tr style="background:#eef4ff"><th align="left">Firma</th><th align="left">Teknisyen</th><th align="left">Başlangıç</th><th align="left">Bitiş / Durum</th></tr>${rows.join('')||'<tr><td colspan="4">Bugün ziyaret kaydı bulunmuyor.</td></tr>'}</table></div></div></body></html>`;}
app.all('/api/daily-summary',async(req,res)=>{try{const state=await loadMainState(),cfg=state.sd_cfg||{},now=trNow(),force=req.method==='POST'&&req.body?.force===true;if(force){const jwt=require('jsonwebtoken'),token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');let decoded;try{decoded=jwt.verify(token,process.env.JWT_SECRET||'servisdrama-secret-key-change-in-production');}catch(e){return res.status(401).json({error:'Yetkisiz istek'});}if(String(decoded.username||'').toLowerCase()!=='barkin.kayaci')return res.status(403).json({error:'Bu işlem yalnızca Barkın Kayacı hesabına açıktır'});}const target=cfg.dailySummaryTime||'18:00',today=now.toISOString().slice(0,10),nowMin=now.getHours()*60+now.getMinutes(),tp=target.split(':').map(Number),targetMin=(tp[0]||0)*60+(tp[1]||0),due=nowMin>=targetMin&&nowMin<targetMin+15;if(!force&&(!cfg.dailySummaryEnabled||!due||cfg.dailySummaryLastSent===today))return res.json({success:true,skipped:true,reason:'not-due'});const to=(cfg.dailySummaryTo||[]),cc=(cfg.dailySummaryCc||[]);if(!to.length)return res.status(400).json({error:'Gün özeti TO alıcısı tanımlı değil'});const port=parseInt(cfg.smtpPort||process.env.SMTP_PORT||587,10);const transporter=nodemailer.createTransport({host:cfg.smtpHost||process.env.SMTP_HOST,port,secure:port===465,auth:{user:cfg.smtpUser||process.env.SMTP_USER,pass:cfg.smtpPass||process.env.SMTP_PASS},tls:{rejectUnauthorized:false}});await transporter.sendMail({from:(cfg.smtpSenderName||'Drama Makine')+' <'+(cfg.smtpSenderEmail||process.env.SMTP_FROM||cfg.smtpUser)+'>',to:to.join(','),cc:cc.join(','),subject:'ServisDrama - Gün Özeti ('+String(now.getDate()).padStart(2,'0')+'.'+String(now.getMonth()+1).padStart(2,'0')+'.'+now.getFullYear()+')',html:summaryHtml(state,now)});cfg.dailySummaryLastSent=today;state.sd_cfg=cfg;const db=require('./config/database');if(db.dialect==='postgres')await db.raw.query("UPDATE app_state SET payload=$1::jsonb,updated_at=NOW() WHERE state_key='main'",[JSON.stringify(state)]);res.json({success:true,to,cc});}catch(e){res.status(500).json({error:'Gün özeti gönderilemedi',details:e.message});}});

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
