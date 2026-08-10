const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const auth = require('../middleware/auth');
const { readState, mutateState } = require('../utils/stateStore');
const { companyBelongsToSalesRep } = require('../utils/salesIdentity');
const router = express.Router();

const allowedRoles = new Set(['admin']);
const isAdmin = user => allowedRoles.has(String(user?.role || '').toLowerCase());
const clean = (v, n = 200) => String(v == null ? '' : v).trim().slice(0, n);
const profileMatchesCompany = companyBelongsToSalesRep;

async function hydrateProfiles(state) {
  const profiles = Array.isArray(state.sd_st) ? state.sd_st : [];
  const users = await db.query("SELECT id,username,name,email,role,status FROM users WHERE role='sales' ORDER BY name");
  let changed = false;
  users.forEach(user => {
    let profile = profiles.find(p => String(p.userId || '') === String(user.id))
      || profiles.find(p => String(p.username || '').toLowerCase() === String(user.username || '').toLowerCase());
    if (!profile) {
      profile = { id: 's' + user.id, userId: user.id, code: '', name: user.name, username: user.username, email: user.email || '', phone: '', status: user.status || 'active' };
      profiles.push(profile); changed = true;
    } else {
      if (String(profile.userId || '') !== String(user.id)) { profile.userId = user.id; changed = true; }
      const appUser = (state.sd_users || []).find(u => String(u.username || '').toLowerCase() === String(user.username || '').toLowerCase());
      if (appUser && profile.legacyUserId !== appUser.id) { profile.legacyUserId = appUser.id; changed = true; }
      ['name','username','email','status'].forEach(k => { const val = user[k] || (k === 'status' ? 'active' : ''); if (profile[k] !== val) { profile[k] = val; changed = true; } });
    }
  });
  state.sd_st = profiles;
  return { profiles, changed };
}

router.get('/', auth, async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Yalnızca admin erişebilir' });
  try {
    let result;
    await mutateState(async state => {
      const hydrated = await hydrateProfiles(state);
      result = hydrated.profiles;
    }, req.user.id);
    res.json({ success: true, sales: result });
  } catch (err) { res.status(500).json({ error: 'Satışçılar okunamadı', details: err.message }); }
});

router.post('/', auth, async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Yalnızca admin satışçı oluşturabilir' });
  const username = clean(req.body?.username, 80).toLowerCase();
  const password = String(req.body?.password || '');
  const name = clean(req.body?.name, 120);
  const email = clean(req.body?.email, 160);
  const phone = clean(req.body?.phone, 40);
  const code = clean(req.body?.code, 30);
  if (!username || !password || !name || !code) return res.status(400).json({ error: 'Kod, ad, kullanıcı adı ve şifre zorunlu' });
  if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
  try {
    await db.ready();
    const hash = await bcrypt.hash(password, 10);
    let userId;
    if (db.dialect === 'postgres') {
      const r = await db.raw.query(`INSERT INTO users(username,password,name,email,role,status) VALUES($1,$2,$3,$4,'sales','active') RETURNING id`, [username, hash, name, email]);
      userId = r.rows[0].id;
    } else {
      userId = await new Promise((resolve, reject) => db.run(`INSERT INTO users(username,password,name,email,role,status) VALUES(?,?,?,?,?,'active')`, [username,hash,name,email,'sales'], function(e){ e ? reject(e) : resolve(this.lastID); }));
    }
    let profile;
    try {
      await mutateState(state => {
        state.sd_st = Array.isArray(state.sd_st) ? state.sd_st : [];
        if (state.sd_st.some(x => String(x.code || '').toLowerCase() === code.toLowerCase())) throw Object.assign(new Error('Bu satışçı kodu zaten kullanılıyor'), { statusCode: 400 });
        profile = { id: 's' + userId, userId, code, name, username, phone, email, status: 'active', createdAt: new Date().toISOString() };
        state.sd_st.push(profile);
        state.sd_users = Array.isArray(state.sd_users) ? state.sd_users : [];
        const appUser = state.sd_users.find(u => String(u.username || '').toLowerCase() === username);
        if (appUser) Object.assign(appUser, { role: 'sales', salesRepId: profile.id, userId });
        else state.sd_users.push({ id: 'u' + userId, userId, username, name, role: 'sales', salesRepId: profile.id });
      }, req.user.id);
    } catch (err) {
      await db.query('DELETE FROM users WHERE id = ?', [userId]);
      throw err;
    }
    res.status(201).json({ success: true, sales: profile });
  } catch (err) {
    const msg = String(err.message || '');
    const duplicate = /unique|duplicate/i.test(msg);
    res.status(err.statusCode || (duplicate ? 400 : 500)).json({ error: duplicate ? 'Kullanıcı adı veya satışçı kodu zaten var' : 'Satışçı oluşturulamadı', details: msg });
  }
});

router.put('/:id', auth, async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Yalnızca admin güncelleyebilir' });
  try {
    const { state } = await readState();
    const profile = (state.sd_st || []).find(x => String(x.id) === String(req.params.id));
    if (!profile) return res.status(404).json({ error: 'Satışçı bulunamadı' });
    const patch = {
      code: clean(req.body?.code ?? profile.code, 30), name: clean(req.body?.name ?? profile.name, 120),
      username: clean(req.body?.username ?? profile.username, 80).toLowerCase(), email: clean(req.body?.email ?? profile.email, 160),
      phone: clean(req.body?.phone ?? profile.phone, 40), status: req.body?.status === 'inactive' ? 'inactive' : 'active'
    };
    if (!patch.code || !patch.name || !patch.username) return res.status(400).json({ error: 'Kod, ad ve kullanıcı adı zorunlu' });
    // Kod artık panelden düzenlenebiliyor; POST'taki benzersizlik kontrolünün
    // aynısı burada da olmalı, yoksa iki satışçı aynı kodu taşıyabilir ve
    // raporlardaki "Satış Temsilcisi" sütunu ayırt edilemez hale gelir.
    if ((state.sd_st || []).some(x => String(x.id) !== String(profile.id) && String(x.code || '').toLowerCase() === patch.code.toLowerCase()))
      return res.status(400).json({ error: 'Bu satışçı kodu başka bir satışçıda kullanılıyor' });
    const password = String(req.body?.password || '');
    const params = [patch.username, patch.name, patch.email, patch.status];
    let sql = 'UPDATE users SET username=?,name=?,email=?,status=?,updated_at=CURRENT_TIMESTAMP';
    if (password) { if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' }); sql += ',password=?'; params.push(await bcrypt.hash(password, 10)); }
    sql += ' WHERE id=? AND role=\'sales\''; params.push(profile.userId);
    await db.query(sql, params);
    await mutateState(state2 => {
      state2.sd_st = (state2.sd_st || []).map(x => String(x.id) === String(profile.id) ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x);
      state2.sd_users = (state2.sd_users || []).map(u => String(u.salesRepId || '') === String(profile.id) || String(u.userId || '') === String(profile.userId) ? { ...u, username: patch.username, name: patch.name, role: 'sales', salesRepId: profile.id, userId: profile.userId } : u);
    }, req.user.id);
    res.json({ success: true });
  } catch (err) { res.status(/unique/i.test(String(err.message)) ? 400 : 500).json({ error: 'Satışçı güncellenemedi', details: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Yalnızca admin pasif yapabilir' });
  try {
    const { state } = await readState();
    const profile = (state.sd_st || []).find(x => String(x.id) === String(req.params.id));
    if (!profile) return res.status(404).json({ error: 'Satışçı bulunamadı' });
    await db.query("UPDATE users SET status='inactive',updated_at=CURRENT_TIMESTAMP WHERE id=? AND role='sales'", [profile.userId]);
    await mutateState(state2 => {
      state2.sd_st = (state2.sd_st || []).map(x => String(x.id) === String(profile.id) ? { ...x, status: 'inactive', updatedAt: new Date().toISOString() } : x);
    }, req.user.id);
    res.json({ success: true, message: 'Satışçı pasif yapıldı; firma atamaları korundu' });
  } catch (err) { res.status(500).json({ error: 'Satışçı pasif yapılamadı', details: err.message }); }
});

module.exports = router;
