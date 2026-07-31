const express = require('express');
const db = require('../config/database');
const auth = require('../middleware/auth');
const router = express.Router();

async function readState() {
  await db.ready();
  if (db.dialect === 'postgres') {
    const r = await db.raw.query("SELECT payload,updated_at FROM app_state WHERE state_key='main'");
    return { state: r.rows[0]?.payload || {}, updatedAt: r.rows[0]?.updated_at || null };
  }
  return await new Promise((resolve, reject) => db.get(
    "SELECT payload,updated_at FROM app_state WHERE state_key='main'", [],
    (e, row) => e ? reject(e) : resolve({ state: row ? JSON.parse(row.payload || '{}') : {}, updatedAt: row?.updated_at || null })
  ));
}

function isOwner(req) {
  return String(req.user?.username || '').trim().toLowerCase() === 'barkin.kayaci';
}

async function writeState(state, userId) {
  await db.ready();
  if (db.dialect === 'postgres') {
    await db.raw.query(
      `INSERT INTO app_state(state_key,payload,updated_by,updated_at)
       VALUES('main',$1::jsonb,$2,NOW())
       ON CONFLICT(state_key) DO UPDATE
       SET payload=EXCLUDED.payload,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
      [JSON.stringify(state), userId]
    );
    return;
  }
  await new Promise((resolve, reject) => db.run(
    "INSERT OR REPLACE INTO app_state(state_key,payload,updated_by,updated_at) VALUES('main',?,?,CURRENT_TIMESTAMP)",
    [JSON.stringify(state), userId], e => e ? reject(e) : resolve()
  ));
}

router.get('/', auth, async (req, res) => {
  try { const r = await readState(); res.json({ success: true, ...r, dialect: db.dialect }); }
  catch (err) { res.status(500).json({ error: 'State read failed', details: err.message }); }
});

router.put('/', auth, async (req, res) => {
  try {
    let state = req.body?.state;
    if (!state || typeof state !== 'object') return res.status(400).json({ error: 'Geçerli state gerekli' });
    const owner = isOwner(req);
    if (!owner) {
      const current = (await readState()).state || {};
      ['sd_co','sd_cfg','sd_users','sd_te'].forEach(k => {
        if (Object.prototype.hasOwnProperty.call(current, k)) state[k] = current[k]; else delete state[k];
      });
    }
    await writeState(state, req.user.id);
    res.json({ success: true, updatedAt: new Date().toISOString(), ownerWrite: owner, dialect: db.dialect });
  } catch (err) {
    res.status(500).json({ error: 'State save failed', details: err.message, dialect: db.dialect });
  }
});

/* Firma düzenleme için doğrudan ve atomik Neon kaydı. Tam state senkronundan bağımsızdır. */
router.put('/company/:id', auth, async (req, res) => {
  try {
    if (!isOwner(req)) return res.status(403).json({ error: 'Firma düzenleme yalnızca Barkın Kayacı hesabına açıktır' });
    const company = req.body?.company;
    if (!company || typeof company !== 'object') return res.status(400).json({ error: 'Geçerli firma verisi gerekli' });
    const id = String(req.params.id || company.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Firma kimliği gerekli' });
    company.id = id;

    const current = (await readState()).state || {};
    const companies = Array.isArray(current.sd_co) ? current.sd_co.slice() : [];
    const index = companies.findIndex(c => String(c?.id) === id);
    if (index >= 0) companies[index] = { ...companies[index], ...company };
    else companies.push(company);
    current.sd_co = companies;
    await writeState(current, req.user.id);

    res.json({ success: true, company, count: companies.length, updatedAt: new Date().toISOString(), dialect: db.dialect });
  } catch (err) {
    res.status(500).json({ error: 'Firma Neon kaydı başarısız', details: err.message, dialect: db.dialect });
  }
});

module.exports = router;
