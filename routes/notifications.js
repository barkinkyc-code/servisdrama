/* Bildirimler — app_state içindeki sd_notifications dizisi üzerinden.
   Ayrı bir notifications tablosu YOKTUR; tüm uygulama verisi tek
   JSON payload'da tutulur (bkz. routes/state.js). */

const express = require('express');
const db = require('../config/database');
const auth = require('../middleware/auth');
const router = express.Router();

async function readState() {
  await db.ready();
  if (db.dialect === 'postgres') {
    const r = await db.raw.query("SELECT payload FROM app_state WHERE state_key='main'");
    return r.rows[0]?.payload || {};
  }
  return await new Promise((resolve, reject) => db.get(
    "SELECT payload FROM app_state WHERE state_key='main'", [],
    (e, row) => e ? reject(e) : resolve(row ? JSON.parse(row.payload || '{}') : {})
  ));
}

async function writeState(state, userId) {
  if (db.dialect === 'postgres') {
    await db.raw.query(
      `INSERT INTO app_state(state_key,payload,updated_by,updated_at) VALUES('main',$1::jsonb,$2,NOW())
       ON CONFLICT(state_key) DO UPDATE SET payload=EXCLUDED.payload,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
      [JSON.stringify(state), userId]
    );
    return;
  }
  await new Promise((resolve, reject) => db.run(
    "INSERT OR REPLACE INTO app_state(state_key,payload,updated_by,updated_at) VALUES('main',?,?,CURRENT_TIMESTAMP)",
    [JSON.stringify(state), userId], e => e ? reject(e) : resolve()
  ));
}

// Giriş yapan kullanıcının bildirim alıcı kimliği (satışçı için sd_st.id).
// Çözülemezse null döner ve kullanıcı hiçbir bildirim görmez (fail-closed).
function recipientIdFor(state, user) {
  const username = String(user?.username || '').toLowerCase();
  const reps = Array.isArray(state?.sd_st) ? state.sd_st : [];
  const users = Array.isArray(state?.sd_users) ? state.sd_users : [];

  let rep = reps.find(s => String(s?.username || '').toLowerCase() === username)
         || reps.find(s => String(s?.email || '').split('@')[0].toLowerCase() === username);

  if (!rep) {
    const appUser = users.find(u => String(u?.username || '').toLowerCase() === username);
    if (appUser) {
      const wanted = String(appUser.salesRepId || appUser.id || '');
      rep = reps.find(s => String(s?.id || '') === wanted);
    }
  }
  return rep ? String(rep.id) : null;
}

function ownNotifications(state, user) {
  const all = Array.isArray(state?.sd_notifications) ? state.sd_notifications : [];
  const isAdmin = String(user?.username || '').toLowerCase() === 'barkin.kayaci';
  if (isAdmin) return all;
  const rid = recipientIdFor(state, user);
  if (!rid) return [];
  return all.filter(n => String(n?.recipientUserId || '') === rid);
}

// Kullanıcının bildirimleri
router.get('/', auth, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const state = await readState();
    const mine = ownNotifications(state, req.user)
      .slice()
      .sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')))
      .slice(0, 50);
    res.json({ success: true, notifications: mine, count: mine.length });
  } catch (err) {
    res.status(500).json({ error: 'Bildirimler okunamadı', details: err.message });
  }
});

// Okunmamış sayısı — /:id rotasından ÖNCE tanımlı olmalı
router.get('/unread/count', auth, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const state = await readState();
    const unread = ownNotifications(state, req.user).filter(n => !n?.read).length;
    res.json({ success: true, unread_count: unread });
  } catch (err) {
    res.status(500).json({ error: 'Sayı okunamadı', details: err.message });
  }
});

// Tümünü okundu işaretle — /:id/read rotasından ÖNCE tanımlı olmalı
router.put('/all/read', auth, async (req, res) => {
  try {
    const state = await readState();
    const mine = new Set(ownNotifications(state, req.user).map(n => String(n.id)));
    if (!mine.size) return res.json({ success: true, updated: 0 });

    let updated = 0;
    state.sd_notifications = (state.sd_notifications || []).map(n => {
      if (mine.has(String(n?.id)) && !n?.read) { updated++; return { ...n, read: true }; }
      return n;
    });
    if (updated) await writeState(state, req.user.id);
    res.json({ success: true, updated });
  } catch (err) {
    res.status(500).json({ error: 'Güncellenemedi', details: err.message });
  }
});

// Tek bildirimi okundu işaretle
router.put('/:id/read', auth, async (req, res) => {
  try {
    const state = await readState();
    const mine = new Set(ownNotifications(state, req.user).map(n => String(n.id)));
    if (!mine.has(String(req.params.id))) return res.status(404).json({ error: 'Bildirim bulunamadı' });

    state.sd_notifications = (state.sd_notifications || []).map(
      n => String(n?.id) === String(req.params.id) ? { ...n, read: true } : n
    );
    await writeState(state, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Güncellenemedi', details: err.message });
  }
});

// Bildirimi sil
router.delete('/:id', auth, async (req, res) => {
  try {
    const state = await readState();
    const mine = new Set(ownNotifications(state, req.user).map(n => String(n.id)));
    if (!mine.has(String(req.params.id))) return res.status(404).json({ error: 'Bildirim bulunamadı' });

    state.sd_notifications = (state.sd_notifications || []).filter(n => String(n?.id) !== String(req.params.id));
    await writeState(state, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Silinemedi', details: err.message });
  }
});

module.exports = router;
