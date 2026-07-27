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
