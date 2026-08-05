const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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
