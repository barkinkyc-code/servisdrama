const express = require('express');
const db = require('../config/database');
const auth = require('../middleware/auth');
const { resolveSalesRepIdentity, filterStateForSalesRep } = require('../utils/salesIdentity');
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


function technicianIdentityForUser(current, user) {
  const username = String(user?.username || '').toLowerCase();
  const users = Array.isArray(current.sd_users) ? current.sd_users : [];
  const techs = Array.isArray(current.sd_te) ? current.sd_te : [];
  const appUser = users.find(u => String(u.username || '').toLowerCase() === username);
  let tech = appUser && techs.find(t => String(t.id) === String(appUser.techId));

  if (!tech) {
    if (username === 'semih.aglan') tech = techs.find(t => String(t.code) === '1015') || { id: 't1', code: '1015' };
    if (username === 'suleyman' || username === 'suleyman.kucuk') tech = techs.find(t => String(t.code) === '1016') || { id: 't2', code: '1016' };
  }

  return tech ? { techId: String(tech.id || ''), code: String(tech.code || '') } : { techId: '', code: '' };
}

function finiteCoordinate(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

// Teknisyen bütün firma kaydını değiştiremez. Yalnızca kendisine atanmış
// mevcut firmaların GPS koordinatları ve konum denetim alanları güncellenir.
function mergeTechnicianCompanyLocations(currentCompanies, incomingCompanies, identity, user) {
  const current = Array.isArray(currentCompanies) ? currentCompanies : [];
  const incoming = Array.isArray(incomingCompanies) ? incomingCompanies : [];
  const incomingById = new Map(incoming.map(company => [String(company?.id || ''), company]));

  return current.map(company => {
    if (String(company?.techId || '') !== String(identity.techId || '')) return company;
    const candidate = incomingById.get(String(company?.id || ''));
    if (!candidate) return company;

    const lat = finiteCoordinate(candidate.lat, -90, 90);
    const lng = finiteCoordinate(candidate.lng, -180, 180);
    if (lat === null || lng === null) return company;

    const oldLat = finiteCoordinate(company.lat, -90, 90);
    const oldLng = finiteCoordinate(company.lng, -180, 180);
    if (oldLat === lat && oldLng === lng) return company;

    return {
      ...company,
      lat,
      lng,
      locationUpdatedAt: new Date().toISOString(),
      locationUpdatedBy: identity.code || String(user?.username || ''),
      locationSource: 'technician-gps'
    };
  });
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

function itemOwnerCode(item) {
  return String(item?.techCode || item?.technicianCode || item?.tc || '');
}

function itemKey(item) {
  if (item?.id) return String(item.id);
  return [item?.firmaId || item?.companyId || '', item?.date || item?.dayKey || '', item?.saat || item?.time || '', itemOwnerCode(item)].join('|');
}

// Teknisyen yalnızca kendi operasyon kayıtlarını ekler/günceller/siler.
// Diğer teknisyenlerin program dışı ziyaret ve yola çıkış kayıtları korunur.
function mergeTechnicianArray(currentArray, incomingArray, code) {
  const current = Array.isArray(currentArray) ? currentArray : [];
  const incoming = Array.isArray(incomingArray) ? incomingArray : [];
  const others = current.filter(item => itemOwnerCode(item) !== code);
  const ownIncoming = incoming.filter(item => itemOwnerCode(item) === code);
  const unique = new Map();
  [...others, ...ownIncoming].forEach(item => unique.set(itemKey(item), clone(item, item)));
  return Array.from(unique.values());
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
    const isAdmin = String(req.user.role || '').toLowerCase() === 'admin';
    const isSalesRep = String(req.user.role || '').toLowerCase() === 'sales';

    // Satışçı: sadece kendi firmalarının verisi. Kimlik çözülemezse boş state (fail-closed).
    if (isSalesRep && !isAdmin) {
      const salesRep = resolveSalesRepIdentity(r.state, req.user);
      r.state = filterStateForSalesRep(r.state, salesRep);
    }
    // Tech user: satışçı veri anahtarları gizli
    else if (!isAdmin && String(req.user.role || '').toLowerCase() === 'tech') {
      const hiddenForTech = ['sd_st', 'sd_notifications', 'sd_actions', 'sd_risk_events'];
      hiddenForTech.forEach(k => {
        if (r.state && k in r.state) delete r.state[k];
      });
    }

    res.json({ success: true, ...r });
  } catch (err) {
    res.status(500).json({ error: 'State read failed', details: err.message });
  }
});

router.put('/', auth, async (req, res) => {
  let client = null;
  try {
    await db.ready();
    let incomingState = req.body?.state;
    if (!incomingState || typeof incomingState !== 'object' || Array.isArray(incomingState)) {
      return res.status(400).json({ error: 'Geçerli state gerekli' });
    }
    const payloadBytes = Buffer.byteLength(JSON.stringify(incomingState), 'utf8');
    if (payloadBytes > 5 * 1024 * 1024) return res.status(413).json({ error: 'State boyutu çok büyük' });

    const isOwner = String(req.user.role || '').toLowerCase() === 'admin';
    let state = incomingState;

    if (db.dialect === 'postgres') {
      client = await db.raw.connect();
      await client.query('BEGIN');
      await client.query("INSERT INTO app_state(state_key,payload,updated_at) VALUES('main','{}'::jsonb,NOW()) ON CONFLICT(state_key) DO NOTHING");
      const locked = await client.query("SELECT payload FROM app_state WHERE state_key='main' FOR UPDATE");
      const current = locked.rows[0]?.payload || {};

      if (!isOwner) {
        const isSalesRep = String(req.user.role || '').toLowerCase() === 'sales';
        if (isSalesRep) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Satışçı kullanıcıları state yazamaz' });
        }
        const identity = technicianIdentityForUser(current, req.user);
        const code = identity.code || technicianCodeForUser(current, req.user);
        if (!code || !identity.techId) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Teknisyen eşlemesi bulunamadı' }); }
        const safeState = clone(current, {}) || {};
        safeState.sd_vi = mergeTechnicianVisits(current.sd_vi || {}, incomingState.sd_vi || {}, code);
        safeState.sd_ex = mergeTechnicianArray(current.sd_ex, incomingState.sd_ex, code);
        safeState.sd_dp = mergeTechnicianArray(current.sd_dp, incomingState.sd_dp, code);
        safeState.sd_co = mergeTechnicianCompanyLocations(current.sd_co, incomingState.sd_co, identity, req.user);
        state = safeState;
      }

      await client.query(
        `INSERT INTO app_state(state_key,payload,updated_by,updated_at)
         VALUES('main',$1::jsonb,$2,NOW())
         ON CONFLICT(state_key) DO UPDATE SET payload=EXCLUDED.payload,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
        [JSON.stringify(state), req.user.id]
      );
      await client.query('COMMIT');
    } else {
      await new Promise((resolve, reject) => db.run('BEGIN IMMEDIATE', e => e ? reject(e) : resolve()));
      try {
        const row = await new Promise((resolve, reject) => db.get("SELECT payload FROM app_state WHERE state_key='main'", [], (e, r) => e ? reject(e) : resolve(r)));
        const current = row?.payload ? clone(JSON.parse(row.payload), {}) : {};
        if (!isOwner) {
          const isSalesRep = String(req.user.role || '').toLowerCase() === 'sales';
          if (isSalesRep) throw Object.assign(new Error('Satışçı kullanıcıları state yazamaz'), { statusCode: 403 });
          const identity = technicianIdentityForUser(current, req.user);
          const code = identity.code || technicianCodeForUser(current, req.user);
          if (!code || !identity.techId) throw Object.assign(new Error('Teknisyen eşlemesi bulunamadı'), { statusCode: 403 });
          const safeState = clone(current, {}) || {};
          safeState.sd_vi = mergeTechnicianVisits(current.sd_vi || {}, incomingState.sd_vi || {}, code);
          safeState.sd_ex = mergeTechnicianArray(current.sd_ex, incomingState.sd_ex, code);
          safeState.sd_dp = mergeTechnicianArray(current.sd_dp, incomingState.sd_dp, code);
          safeState.sd_co = mergeTechnicianCompanyLocations(current.sd_co, incomingState.sd_co, identity, req.user);
          state = safeState;
        }
        await new Promise((resolve, reject) => db.run(
          "INSERT OR REPLACE INTO app_state(state_key,payload,updated_by,updated_at) VALUES('main',?,?,CURRENT_TIMESTAMP)",
          [JSON.stringify(state), req.user.id], e => e ? reject(e) : resolve()
        ));
        await new Promise((resolve, reject) => db.run('COMMIT', e => e ? reject(e) : resolve()));
      } catch (e) {
        try { await new Promise(resolve => db.run('ROLLBACK', () => resolve())); } catch (_) {}
        if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
        throw e;
      }
    }

    res.set('Cache-Control', 'no-store');
    res.json({ success: true, updatedAt: new Date().toISOString(), ownerWrite: isOwner, technicianWrite: !isOwner });
  } catch (err) {
    if (client) { try { await client.query('ROLLBACK'); } catch (_) {} }
    res.status(500).json({ error: 'State save failed', details: err.message });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
