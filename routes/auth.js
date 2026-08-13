const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../config/database');
const auth = require('../middleware/auth');
const router = express.Router();
const isAdmin = user => String(user?.role || '').toLowerCase() === 'admin';

const jwtSecret = () => process.env.JWT_SECRET || 'servisdrama-change-this-secret';
const jwtExpire = () => process.env.JWT_EXPIRE || '12h';

router.post('/login', async (req, res) => {
  try {
    await db.ready();
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
    const results = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (!results.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = results[0];
    if (String(user.status || 'active').toLowerCase() !== 'active') return res.status(403).json({ error: 'Hesap pasif' });
    if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, jwtSecret(), { expiresIn: jwtExpire() });
    res.json({ success:true, token, user:{ id:user.id, username:user.username, name:user.name, role:user.role, email:user.email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

/* Şifremi unuttum: kullanıcının e-postasına yeni, rastgele bir geçici şifre
   gönderir ve hesabın şifresini doğrudan bununla değiştirir (ayrı bir reset
   token/link akışı gerektirmez). E-posta sistemde kayıtlı olsun ya da olmasın
   aynı genel mesaj döner — aksi halde bu uç nokta hangi e-postaların kayıtlı
   olduğunu dışarıya sızdırır (kullanıcı numarasını çıkarma saldırısı). */
router.post('/forgot-password', async (req, res) => {
  const generic = { success: true, message: 'Bu e-posta adresi sistemde kayıtlıysa, yeni şifre gönderildi.' };
  try {
    await db.ready();
    const email = String((req.body || {}).email || '').trim();
    if (!email) return res.status(400).json({ error: 'E-posta gerekli' });
    const results = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    if (!results.length) return res.json(generic);
    const user = results[0];
    if (String(user.status || 'active').toLowerCase() !== 'active') return res.json(generic);

    const tempPassword = crypto.randomBytes(6).toString('hex');
    const hash = await bcrypt.hash(tempPassword, 10);
    await db.query('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hash, user.id]);

    const resolvedPort = parseInt(process.env.SMTP_PORT || 587, 10);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mail.dramagroup.com.tr',
      port: resolvedPort,
      secure: resolvedPort === 465,
      requireTLS: resolvedPort !== 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false }
    });
    const html = `<!doctype html><html lang="tr"><body style="margin:0;padding:0;background:#F3F6FA;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E3EAF3;max-width:480px;width:100%;">
        <tr><td style="padding:28px 28px 8px;"><div style="color:#27A4FF;font-size:13px;font-weight:700;letter-spacing:3px;">SERVİSDRAMA</div>
        <h1 style="margin:14px 0 6px;color:#0F1937;font-size:22px;">Şifre Sıfırlama</h1>
        <p style="margin:0;color:#333;font-size:14px;line-height:22px;">Merhaba ${user.name ? String(user.name).replace(/[<>&]/g, '') : ''},<br>Hesabınız için yeni bir geçici şifre oluşturuldu.</p></td></tr>
        <tr><td style="padding:8px 28px;"><div style="background:#F7FAFE;border:1px solid #E3EAF3;padding:16px;text-align:center;">
          <div style="color:#8093B5;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Yeni Şifreniz</div>
          <div style="margin-top:6px;color:#0F1937;font-size:22px;font-weight:700;letter-spacing:2px;">${tempPassword}</div>
        </td></tr>
        <tr><td style="padding:16px 28px 28px;"><p style="margin:0;color:#5B6B8C;font-size:13px;line-height:20px;">Giriş yaptıktan sonra bu şifreyi profil ayarlarınızdan değiştirmenizi öneririz. Bu isteği siz yapmadıysanız lütfen sistem yöneticinizle iletişime geçin.</p></td></tr>
      </table></td></tr></table></body></html>`;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'ServisDrama <servis@dramamakine.com>',
      to: user.email,
      subject: 'ServisDrama - Şifre Sıfırlama',
      html
    });
    res.json(generic);
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Şifre sıfırlama isteği işlenemedi', details: err.message });
  }
});

router.post('/register', auth, async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Yalnızca admin kullanıcı oluşturabilir' });
  try {
    await db.ready();
    const { username, password, name, email, role } = req.body || {};
    if (!username || !password || !name) return res.status(400).json({ error: 'Zorunlu alanlar eksik' });
    const safeRole = ['admin','tech'].includes(String(role || '').toLowerCase()) ? String(role).toLowerCase() : 'tech';
    if (String(password).length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
    const hashedPassword = await bcrypt.hash(password, 10);
    if (db.dialect === 'postgres') {
      const result = await db.raw.query('INSERT INTO users (username,password,name,email,role) VALUES ($1,$2,$3,$4,$5) RETURNING id',[username,hashedPassword,name,email,safeRole]);
      return res.status(201).json({ success:true, id:result.rows[0].id });
    }
    db.run('INSERT INTO users (username,password,name,email,role) VALUES (?,?,?,?,?)',[username,hashedPassword,name,email,safeRole],function(err){
      if(err) return res.status(400).json({ error:'Kullanıcı oluşturulamadı', details:err.message });
      res.status(201).json({ success:true, id:this.lastID });
    });
  } catch (err) {
    const duplicate = String(err.message).toLowerCase().includes('unique');
    res.status(duplicate?400:500).json({ error: duplicate?'Kullanıcı adı zaten var':'Database error', details:err.message });
  }
});

// Kullanıcı kendi şifresini değiştirir (rol fark etmez) — mevcut şifre doğrulaması zorunlu.
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Mevcut ve yeni şifre gerekli' });
    if (String(newPassword).length < 6) return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalı' });
    await db.ready();
    const rows = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    const user = rows[0];
    if (!(await bcrypt.compare(currentPassword, user.password))) return res.status(401).json({ error: 'Mevcut şifre yanlış' });
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hash, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Şifre güncellenemedi', details: err.message });
  }
});

function verifyToken(req,res,next){
  const token=req.headers.authorization?.split(' ')[1];
  if(!token)return res.status(401).json({error:'No token provided'});
  jwt.verify(token,jwtSecret(),(err,decoded)=>{if(err)return res.status(401).json({error:'Invalid token'});req.user=decoded;next();});
}
router.get('/verify',verifyToken,(req,res)=>res.json({success:true,user:req.user}));
router.get('/users',verifyToken,async(req,res)=>{
  if (!isAdmin(req.user)) return res.status(403).json({error:'Yalnızca admin erişebilir'});
  try{const users=await db.query('SELECT id,username,name,role,email,status FROM users ORDER BY role DESC,name');res.json({success:true,users});}
  catch(err){res.status(500).json({error:'Database error',details:err.message});}
});
module.exports=router;
