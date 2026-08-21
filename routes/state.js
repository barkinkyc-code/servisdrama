const express = require('express');
const db = require('../config/database');
const auth = require('../middleware/auth');
const { resolveSalesRepIdentity, filterStateForSalesRep, technicianIdentityForUser } = require('../utils/salesIdentity');
const { sendPushForNotification } = require('../utils/webPush');
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




/* Ziyaret talepleri SUNUCU otoritesindedir: yalnızca /api/visit-requests yazar.
   Admin paneli state'i bütün olarak PUT ettiği için, tarayıcısındaki liste eski
   kaldığında az önce açılmış bir talebi silebilirdi. Bu yüzden gelen paylaşımda
   ne olursa olsun sunucudaki kayıt korunur. */
function preserveVisitRequests(current) {
  return Array.isArray(current?.sd_visit_requests) ? current.sd_visit_requests : [];
}

// Push abonelikleri (uç nokta+anahtar) ve push tercihleri de SUNUCU otoritesinde:
// yalnızca routes/push.js yazar. İstemci bunları hiç göndermez/görmez (GET'te
// aşağıda budanır); yine de admin'in toplu state PUT'u önceki kaydı silmesin
// diye burada da korunur — sd_visit_requests ile aynı desen.
function preservePushState(current) {
  return {
    sd_push_subscriptions: Array.isArray(current?.sd_push_subscriptions) ? current.sd_push_subscriptions : [],
    sd_push_prefs: (current?.sd_push_prefs && typeof current.sd_push_prefs === 'object') ? current.sd_push_prefs : {}
  };
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

// "GG.AA.YYYY", "YYYY-AA-GG" veya epoch ms okur — company-360.js'teki
// parseAnyDate ile aynı, sunucu tarafında bağımsız kopya (istemci koduna
// bağımlı olmadan çalışsın diye).
function parseAnyDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const n = Number(v);
  if (n > 100000000000) return new Date(n);
  const s = String(v);
  let m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function ddmmyyyy(d) { return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear(); }

/* Teknisyen ziyaretini senkronize ettiğinde, KENDİSİNE atanmış AÇIK ziyaret
   taleplerini otomatik "tamamlandı" yapar — talep "gidilsin" der, teknisyen
   gidip ziyareti kaydettiğinde talebin açık kalması ve ayrıca elle
   "Tamamladım" tıklamayı hatırlaması gerekmemeli. Yalnızca talebin AÇILDIĞI
   TARİHTEN SONRAKİ bir ziyaret sayılır — talep açılmadan ÖNCEKİ eski bir
   ziyaretin (ör. ilk kurulum, geçmiş veri senkronizasyonu) yanlışlıkla
   kapatmasına karşı. Kapanınca sistemdeki HERKESE broadcast bildirim gider
   (routes/visit-requests.js'teki 'visit_request' açılış bildirimiyle aynı
   yayın modeli) — "şu tarihli talep kapanmıştır" bilgisi. */
function autoCloseVisitRequestsForTech(currentRequests, mergedVi, mergedEx, techId, actor) {
  const requests = Array.isArray(currentRequests) ? currentRequests : [];
  const hasOpenForTech = requests.some(r => String(r?.status) === 'open' && String(r?.techId || '') === String(techId));
  if (!hasOpenForTech) return { visitRequests: requests, notifications: [] };

  const notifications = [];
  const now = new Date().toISOString();
  const visitedSince = (companyId, since) => {
    let found = false;
    Object.keys(mergedVi || {}).forEach(key => {
      if (found || companyIdFromKey_state(key) !== String(companyId)) return;
      Object.values(entriesOf(mergedVi[key])).forEach(e => {
        if (found || !e || e.status !== 'done') return;
        const dates = (e.dates && e.dates.length ? e.dates : [e.date]).filter(Boolean);
        dates.forEach(dstr => {
          const d = parseAnyDate(dstr) || (e.ts ? new Date(Number(e.ts)) : null);
          if (d && (!since || d >= since)) found = true;
        });
        if (!dates.length && e.ts) {
          const d = new Date(Number(e.ts));
          if (!isNaN(d.getTime()) && (!since || d >= since)) found = true;
        }
      });
    });
    if (!found) {
      (mergedEx || []).forEach(e => {
        if (found || String(e?.firmaId || e?.companyId || '') !== String(companyId)) return;
        const d = parseAnyDate(e.date) || (e.ts ? new Date(Number(e.ts)) : null);
        if (d && (!since || d >= since)) found = true;
      });
    }
    return found;
  };

  const visitRequests = requests.map(r => {
    if (String(r?.status) !== 'open' || String(r?.techId || '') !== String(techId)) return r;
    const reqCreated = parseAnyDate(r.createdAt);
    if (!visitedSince(r.companyId, reqCreated)) return r;

    notifications.push({
      broadcast: true,
      companyId: r.companyId,
      visitRequestId: r.id,
      type: 'visit_request_done',
      title: 'Ziyaret Talebi Kapandı',
      message: (r.companyName || '') + ' — ' + ddmmyyyy(reqCreated || new Date()) + ' tarihli talep kapanmıştır.'
    });

    return {
      ...r,
      status: 'done',
      updatedAt: now,
      updatedByUserId: actor.userId,
      updatedByRole: 'tech',
      closedAt: now,
      note: r.note || 'Otomatik: teknisyen ziyareti kaydetti.',
      history: (Array.isArray(r.history) ? r.history : [])
        .concat([{ at: now, by: actor.code || actor.username, role: 'tech', status: 'done', note: 'Otomatik kapatma — ziyaret kaydedildi.' }])
    };
  });

  return { visitRequests, notifications };
}
function companyIdFromKey_state(k) { return String(k).split(/[|_]/)[0]; }

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
    if (r.updatedAt) {
      const etag = 'W/"' + Buffer.from(String(req.user.id) + '_' + String(r.updatedAt)).toString('base64') + '"';
      res.set('ETag', etag);
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }
    }
    // Push abonelikleri (uç nokta+şifreleme anahtarı) ve push tercihleri hiçbir
    // rolün genel state indirmesinde YER ALMAZ — admin dahil. Abonelik nesneleri
    // yalnızca sunucunun push göndermek için kullandığı veridir; istemcinin
    // TÜM kullanıcıların uç noktalarını toplu indirmesine gerek yok. Kendi
    // yönetim ekranları /api/push/prefs ve /api/push/status üzerinden okur.
    if (r.state) { delete r.state.sd_push_subscriptions; delete r.state.sd_push_prefs; }
    const isAdmin = String(req.user.role || '').toLowerCase() === 'admin';
    const isSalesRep = String(req.user.role || '').toLowerCase() === 'sales';

    // Satışçı: sadece kendi firmalarının verisi. Kimlik çözülemezse boş state (fail-closed).
    if (isSalesRep && !isAdmin) {
      const salesRep = resolveSalesRepIdentity(r.state, req.user);
      r.state = filterStateForSalesRep(r.state, salesRep);
    }
    // Tech user: satışçı veri anahtarları gizli
    else if (!isAdmin && String(req.user.role || '').toLowerCase() === 'tech') {
      const hiddenForTech = ['sd_st', 'sd_notifications', 'sd_actions', 'sd_risk_events', 'sd_audit'];
      hiddenForTech.forEach(k => {
        if (r.state && k in r.state) delete r.state[k];
      });
      // Ziyaret talepleri gizlenmez ama KENDİ firmalarıyla sınırlanır: teknisyen
      // kendisinden istenen ziyaretleri görmeli, başkasınınkileri değil.
      if (Array.isArray(r.state?.sd_visit_requests)) {
        const identity = technicianIdentityForUser(r.state, req.user);
        r.state.sd_visit_requests = identity.techId
          ? r.state.sd_visit_requests.filter(v => String(v?.techId || '') === String(identity.techId))
          : [];
      }
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
    // Otomatik kapanan ziyaret taleplerinin broadcast bildirimi transaction
    // KAPANDIKTAN SONRA gönderilir (push ağ çağrısı DB kilidini uzatmasın).
    const notifsToPush = [];

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

        // state (=safeState), current'ın klonu — sd_notifications zaten
        // current ile aynı, yeni bildirimler doğrudan buna eklenir.
        const closed = autoCloseVisitRequestsForTech(current.sd_visit_requests, state.sd_vi, state.sd_ex, identity.techId, { userId: req.user.id, code, username: req.user.username });
        state.sd_visit_requests = closed.visitRequests;
        if (closed.notifications.length) {
          state.sd_notifications = Array.isArray(state.sd_notifications) ? state.sd_notifications : [];
          closed.notifications.forEach(n => {
            const full = { id: 'not_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), createdAt: new Date().toISOString(), read: false, status: 'unread', ...n };
            state.sd_notifications.push(full);
            notifsToPush.push(full);
          });
        }
      } else {
        state.sd_visit_requests = preserveVisitRequests(current);
      }
      Object.assign(state, preservePushState(current));

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

          const closed = autoCloseVisitRequestsForTech(current.sd_visit_requests, state.sd_vi, state.sd_ex, identity.techId, { userId: req.user.id, code, username: req.user.username });
          state.sd_visit_requests = closed.visitRequests;
          if (closed.notifications.length) {
            state.sd_notifications = Array.isArray(state.sd_notifications) ? state.sd_notifications : [];
            closed.notifications.forEach(n => {
              const full = { id: 'not_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), createdAt: new Date().toISOString(), read: false, status: 'unread', ...n };
              state.sd_notifications.push(full);
              notifsToPush.push(full);
            });
          }
        } else {
          state.sd_visit_requests = preserveVisitRequests(current);
        }
        Object.assign(state, preservePushState(current));
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

    // Transaction kapandı — otomatik kapanan taleplerin broadcast push'u ŞİMDİ
    // gönderilir (await edilir: Vercel serverless cevaptan sonrasını
    // garanti bitirmiyor, bkz. routes/visit-requests.js'teki aynı not).
    for (const n of notifsToPush) { await sendPushForNotification(n).catch(() => {}); }

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
