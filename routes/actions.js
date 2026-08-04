/* Aksiyonlar — satışçının kendi takip görevleri.
   app_state içindeki sd_actions dizisinde tutulur; satışçılar state'e
   doğrudan yazamadığı (403) için CRUD bu route üzerinden yapılır.
   Kayıt: {id, salesRepId, companyId, title, dueDate, status:'open'|'done', createdAt} */

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

// Giriş yapan kullanıcının satışçı kimliği (sd_st.id) — notifications.js ile aynı sözleşme
function salesRepIdFor(state, user) {
  const username = String(user?.username || '').toLowerCase();
  const reps = Array.isArray(state?.sd_st) ? state.sd_st : [];
  let rep = reps.find(s => String(s?.username || '').toLowerCase() === username)
         || reps.find(s => String(s?.email || '').split('@')[0].toLowerCase() === username);
  if (!rep) {
    const users = Array.isArray(state?.sd_users) ? state.sd_users : [];
    const appUser = users.find(u => String(u?.username || '').toLowerCase() === username);
    if (appUser) rep = reps.find(s => String(s?.id || '') === String(appUser.salesRepId || appUser.id || ''));
  }
  return rep ? String(rep.id) : null;
}

function isAdmin(user) { return String(user?.username || '').toLowerCase() === 'barkin.kayaci'; }

// Kullanıcının görebildiği aksiyonlar (admin: hepsi)
function visibleActions(state, user) {
  const all = Array.isArray(state?.sd_actions) ? state.sd_actions : [];
  if (isAdmin(user)) return all;
  const rid = salesRepIdFor(state, user);
  if (!rid) return [];
  return all.filter(a => String(a?.salesRepId || '') === rid);
}

// Listele
router.get('/', auth, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const state = await readState();
    const mine = visibleActions(state, req.user)
      .slice()
      .sort((a, b) => String(a?.status || '').localeCompare(String(b?.status || '')) // open önce
        || String(a?.dueDate || '9999').localeCompare(String(b?.dueDate || '9999')));
    res.json({ success: true, actions: mine });
  } catch (err) {
    res.status(500).json({ error: 'Aksiyonlar okunamadı', details: err.message });
  }
});

// Ekle
router.post('/', auth, async (req, res) => {
  try {
    const state = await readState();
    const rid = salesRepIdFor(state, req.user);
    if (!rid && !isAdmin(req.user)) return res.status(403).json({ error: 'Satışçı profili bulunamadı' });

    const title = String(req.body?.title || '').trim().slice(0, 300);
    if (!title) return res.status(400).json({ error: 'Aksiyon açıklaması gerekli' });

    const companyId = String(req.body?.companyId || '').trim();
    if (companyId && rid) {
      // Satışçı yalnızca kendi firmasına aksiyon bağlayabilir
      const own = (state.sd_co || []).some(c => String(c.id) === companyId && String(c.salesRepId || '') === rid);
      if (!own) return res.status(403).json({ error: 'Bu firma size atanmamış' });
    }

    const action = {
      id: 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      salesRepId: rid || String(req.body?.salesRepId || ''),
      companyId: companyId || '',
      title,
      dueDate: String(req.body?.dueDate || '').slice(0, 10),
      status: 'open',
      createdAt: new Date().toISOString()
    };

    state.sd_actions = Array.isArray(state.sd_actions) ? state.sd_actions : [];
    state.sd_actions.push(action);
    await writeState(state, req.user.id);
    res.json({ success: true, action });
  } catch (err) {
    res.status(500).json({ error: 'Aksiyon eklenemedi', details: err.message });
  }
});

// Durum güncelle (open <-> done)
router.put('/:id', auth, async (req, res) => {
  try {
    const state = await readState();
    const mine = new Set(visibleActions(state, req.user).map(a => String(a.id)));
    if (!mine.has(String(req.params.id))) return res.status(404).json({ error: 'Aksiyon bulunamadı' });

    const status = req.body?.status === 'done' ? 'done' : 'open';
    state.sd_actions = (state.sd_actions || []).map(a =>
      String(a?.id) === String(req.params.id)
        ? { ...a, status, completedAt: status === 'done' ? new Date().toISOString() : undefined }
        : a
    );
    await writeState(state, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Güncellenemedi', details: err.message });
  }
});

// Sil
router.delete('/:id', auth, async (req, res) => {
  try {
    const state = await readState();
    const mine = new Set(visibleActions(state, req.user).map(a => String(a.id)));
    if (!mine.has(String(req.params.id))) return res.status(404).json({ error: 'Aksiyon bulunamadı' });

    state.sd_actions = (state.sd_actions || []).filter(a => String(a?.id) !== String(req.params.id));
    await writeState(state, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Silinemedi', details: err.message });
  }
});

module.exports = router;
