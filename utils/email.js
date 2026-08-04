/* ================================================================
   Email Sender — Nodemailer Integration
   ================================================================ */

const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// Email transporter configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  } : undefined
});

// Email template paths
const emailTemplatesDir = path.join(__dirname, '../templates/email');

// Read email template
function getTemplate(templateName) {
  try {
    const templatePath = path.join(emailTemplatesDir, `${templateName}.html`);
    return fs.readFileSync(templatePath, 'utf-8');
  } catch (err) {
    console.warn(`Template not found: ${templateName}`, err.message);
    return '';
  }
}

// Send notification email
async function sendNotificationEmail(recipient, notification) {
  try {
    if (!recipient || !recipient.email) {
      console.warn('No valid recipient email');
      return false;
    }

    const subject = getNotificationSubject(notification);
    const html = buildNotificationHtml(notification);

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@servisdrama.local',
      to: recipient.email,
      subject: subject,
      html: html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return true;
  } catch (err) {
    console.error('Email send error:', err);
    return false;
  }
}

// Send delay alert email
async function sendDelayAlert(salesRep, company, daysSince) {
  try {
    if (!salesRep || !salesRep.email) return false;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #DC2626;">⚠️ Gecikmiş Ziyaret Uyarısı</h2>
        <p>Merhaba <strong>${salesRep.name}</strong>,</p>
        <p><strong>${company.name}</strong> firmasına <strong>${daysSince} gün</strong> ziyaret yapılmamıştır.</p>
        <p style="background: #FEF2F2; padding: 12px; border-left: 4px solid #DC2626;">
          <strong>Bölge:</strong> ${company.bolge || '-'}<br/>
          <strong>Teknik Temsilci:</strong> ${company.techId || '-'}<br/>
          <strong>Durum:</strong> Acil ziyaret gerekli
        </p>
        <p><a href="${process.env.APP_URL || 'http://localhost:3000'}/sales.html"
              style="background: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Panele Git
        </a></p>
      </div>
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@servisdrama.local',
      to: salesRep.email,
      subject: `⚠️ Gecikmiş Ziyaret: ${company.name}`,
      html: html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Delay alert sent:', info.messageId);
    return true;
  } catch (err) {
    console.error('Delay alert error:', err);
    return false;
  }
}

// Send visit completion email
async function sendVisitCompletionEmail(salesRep, company, technician, visitDate) {
  try {
    if (!salesRep || !salesRep.email) return false;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #059669;">✅ Ziyaret Tamamlandı</h2>
        <p>Merhaba <strong>${salesRep.name}</strong>,</p>
        <p><strong>${company.name}</strong> firmasına yapılan ziyaret tamamlanmıştır.</p>
        <p style="background: #ECFDF5; padding: 12px; border-left: 4px solid #059669;">
          <strong>Tarih:</strong> ${visitDate}<br/>
          <strong>Teknisyen:</strong> ${technician}<br/>
          <strong>Firma:</strong> ${company.name}
        </p>
        <p><a href="${process.env.APP_URL || 'http://localhost:3000'}/sales.html"
              style="background: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Ziyaret Detayları
        </a></p>
      </div>
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@servisdrama.local',
      to: salesRep.email,
      subject: `✅ Ziyaret Tamamlandı: ${company.name}`,
      html: html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Visit completion email sent:', info.messageId);
    return true;
  } catch (err) {
    console.error('Visit completion email error:', err);
    return false;
  }
}

function getNotificationSubject(notification) {
  const subjects = {
    delay: '⚠️ Gecikmiş Ziyaret Uyarısı',
    visit: '✅ Ziyaret Tamamlandı',
    action: '📋 Aksiyon Hatırlatması',
    system: '📢 Sistem Bildirimi'
  };
  return subjects[notification.type] || notification.title;
}

function buildNotificationHtml(notification) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <h2>${notification.title}</h2>
      <p>${notification.message}</p>
      <p><a href="${process.env.APP_URL || 'http://localhost:3000'}/sales.html"
            style="background: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
        Detayları Gör
      </a></p>
    </div>
  `;
}

module.exports = {
  sendNotificationEmail,
  sendDelayAlert,
  sendVisitCompletionEmail
};
