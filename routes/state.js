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
    "SELECT payload,updated_at FROM app_state WHERE state_key='main'",
    [],
    (e, row) => e ? reject(e) : resolve({
      state: row ? JSON.parse(row.payload || '{}') : {},
      updatedAt: row?.updated_at || null
    })
  ));
}

function clone(value, fallback) {
  try { return JSON.parse(JSON.stringify(value)); } catch (_) { return fallback; }
}

function technicianCodeForUser(current, user) {
  const username = String(user?.username || '').toLowerCase();
  const users = Array.isArray(current.sd_users) ? current.sd_users : [];
  const techs = Array.isArray(current.sd_te) ? current.sd_te : [];
  const appUser = users.find(u => String(u.username || '').toLowerCase() === username);
  const tech = appUser && techs.find(t => String(t.id) === String(appUser.techId));
  if (tech?.code) return String(tech.code);

  // Eski/seed kullanıcı adları için güvenli geriye dönük eşleme.
  if (username === 'semih.aglan') return '1015';
  if (username === 'suleyman' || username === 'suleyman.kucuk') return '1016';
  return '';
}

function entriesOf(rec) {
  if (!rec || typeof rec !== 'object') return {};
  if (rec.by && typeof rec.by === 'object') return rec.by;
  if (rec.tc) return { [String(rec.tc)]: rec };
  return {};
}

function rebuildVisitRecord(entries) {
  const codes = Object.keys(entries || {});
  if (!codes.length) return null;
  let latest = entries[codes[0]];
  codes.forEach(code => {
    const item = entries[code];
    if ((Number(item?.ts) || 0) >= (Number(latest?.ts) || 0)) latest = item;
  });
  return { ...clone(latest, {}), by: clone(entries, {}) };
}

// Teknisyen yalnızca kendi 1015/1016 alt kaydını değiştirebilir.
// Böylece telefonun gönderdiği tam snapshot başka teknisyenin ziyaretini ezmez.
function mergeTechnicianVisits(currentVisits, incomingVisits, code) {
  const merged = clone(currentVisits, {}) || {};
  const incoming = incomingVisits && typeof incomingVisits === 'object' ? incomingVisits : {};
  const keys = new Set([...Object.keys(merged), ...Object.keys(incoming)]);

  keys.forEach(key => {
    const currentEntries = clone(entriesOf(merged[key]), {}) || {};
    const incomingEntries = entriesOf(incoming[key]);
    const incomingOwn = incomingEntries[code];

    if (incomingOwn) {
      currentEntries[code] = clone(incomingOwn, incomingOwn);
    } else if (Object.prototype.hasOwnProperty.call(incoming, key)) {
      // Gönderilen kayıtta teknisyenin kendi alt kaydı yoksa kendi kaydını silmiştir.
      delete currentEntries[code];
    }

    const rebuilt = rebuildVisitRecord(currentEntries);
    if (rebuilt) merged[key] = rebuilt;
    else delete merged[key];
  });

  return merged;
}

router.get('/', auth, async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  try {
    const r = await readState();
    res.json({ success: true, ...r });
  } catch (err) {
    res.status(500).json({ error: 'State read failed', details: err.message });
  }
});

router.put('/', auth, async (req, res) => {
  try {
    await db.ready();
    let state = req.body?.state;
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ error: 'Geçerli state gerekli' });
    }

    const isOwner = String(req.user.username || '').toLowerCase() === 'barkin.kayaci';
    if (!isOwner) {
      const current = (await readState()).state || {};
      const code = technicianCodeForUser(current, req.user);
      if (!code) return res.status(403).json({ error: 'Teknisyen kodu bulunamadı' });

      const safeState = clone(current, {}) || {};
      safeState.sd_vi = mergeTechnicianVisits(current.sd_vi || {}, state.sd_vi || {}, code);
      // Teknisyenlerin değiştirmesine izin verilen ortak operasyon alanları.
      safeState.sd_ex = Array.isArray(state.sd_ex) ? state.sd_ex : (current.sd_ex || []);
      safeState.sd_dp = Array.isArray(state.sd_dp) ? state.sd_dp : (current.sd_dp || []);
      state = safeState;
    }

    if (db.dialect === 'postgres') {
      await db.raw.query(
        `INSERT INTO app_state(state_key,payload,updated_by,updated_at)
         VALUES('main',$1::jsonb,$2,NOW())
         ON CONFLICT(state_key) DO UPDATE SET
           payload=EXCLUDED.payload,
           updated_by=EXCLUDED.updated_by,
           updated_at=NOW()`,
        [JSON.stringify(state), req.user.id]
      );
    } else {
      await new Promise((resolve, reject) => db.run(
        "INSERT OR REPLACE INTO app_state(state_key,payload,updated_by,updated_at) VALUES('main',?,?,CURRENT_TIMESTAMP)",
        [JSON.stringify(state), req.user.id],
        e => e ? reject(e) : resolve()
      ));
    }

    res.json({
      success: true,
      updatedAt: new Date().toISOString(),
      ownerWrite: isOwner,
      technicianWrite: !isOwner
    });
  } catch (err) {
    res.status(500).json({ error: 'State save failed', details: err.message });
  }
});

module.exports = router;
