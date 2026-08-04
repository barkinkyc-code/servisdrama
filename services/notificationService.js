/* ================================================================
   Notification Service — gecikmiş ziyaretleri tespit eder ve
   satışçılara bildirim üretir.

   NOT: Bu uygulamada firma/ziyaret/satışçı verisi ayrı SQL
   tablolarında DEĞİL, app_state tablosundaki tek JSON payload
   içinde tutulur (sd_co, sd_vi, sd_ex, sd_st, sd_notifications).
   Servis bu yüzden state üzerinden çalışır.
   ================================================================ */

const email = require('../utils/email');

let timer = null;

/* ── State okuma/yazma (routes/state.js ile aynı sözleşme) ── */
async function readState(db) {
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

async function writeState(db, state) {
  if (db.dialect === 'postgres') {
    await db.raw.query(
      `INSERT INTO app_state(state_key,payload,updated_at) VALUES('main',$1::jsonb,NOW())
       ON CONFLICT(state_key) DO UPDATE SET payload=EXCLUDED.payload,updated_at=NOW()`,
      [JSON.stringify(state)]
    );
    return;
  }
  await new Promise((resolve, reject) => db.run(
    "INSERT OR REPLACE INTO app_state(state_key,payload,updated_at) VALUES('main',?,CURRENT_TIMESTAMP)",
    [JSON.stringify(state)], e => e ? reject(e) : resolve()
  ));
}

/* ── Tarih yardımcıları ── */
// Kayıtlarda tarih DD.MM.YYYY veya YYYY-MM-DD olabilir.
function parseVisitDate(value) {
  if (!value) return null;
  const s = String(value);
  if (s.includes('.')) {
    const parts = s.split('.');
    if (parts.length === 2) {
      // "24.07" gibi yılsız kısa biçim: mevcut yılı varsay; sonuç gelecekte
      // kalıyorsa kayıt geçen yıldandır (Ocak'ta "28.12" gibi).
      const dt = new Date(new Date().getFullYear(), Number(parts[1]) - 1, Number(parts[0]));
      if (isNaN(dt.getTime())) return null;
      if (dt.getTime() > Date.now() + 86400000) dt.setFullYear(dt.getFullYear() - 1);
      return dt;
    }
    const [d, m, y] = parts;
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

// Kayıt tarihini çözer. ts (epoch ms) varsa ve geçerliyse ona güvenilir —
// birçok gerçek kayıtta date alanı yılsız kısa biçimde ("04.08") tutulur ve
// yalnız date string'inden ayrıştırma bu kayıtları sessizce yok sayardı.
function recordDate(rec) {
  const ts = Number(rec?.ts);
  if (Number.isFinite(ts) && ts > 0) return new Date(ts);
  return parseVisitDate(rec?.date || rec?.dayKey);
}

// Bir firmanın sd_vi + sd_ex içindeki en son ziyaret tarihi.
function lastVisitDateFor(state, companyId) {
  let latest = null;
  const visits = state.sd_vi && typeof state.sd_vi === 'object' ? state.sd_vi : {};

  Object.entries(visits).forEach(([key, record]) => {
    if (String(key).split(/[|_]/)[0] !== String(companyId)) return;
    const entries = record?.by && typeof record.by === 'object' ? record.by : (record?.tc ? { [record.tc]: record } : {});
    Object.values(entries).forEach(v => {
      const dt = recordDate(v);
      if (dt && (!latest || dt > latest)) latest = dt;
    });
  });

  if (Array.isArray(state.sd_ex)) {
    state.sd_ex.forEach(x => {
      if (String(x?.firmaId || x?.companyId || '') !== String(companyId)) return;
      const dt = recordDate(x);
      if (dt && (!latest || dt > latest)) latest = dt;
    });
  }

  return latest;
}

// Firmanın beklenen ziyaret aralığı (gün). weeks = ayın kaçıncı haftaları.
function expectedIntervalDays(company) {
  const weeks = Array.isArray(company?.weeks) ? company.weeks : [];
  if (!weeks.length) return 30;
  // Ayda 4 hafta işaretliyse haftalık (7), 2 ise iki haftada bir (14), 1 ise aylık (30).
  if (weeks.length >= 4) return 7;
  if (weeks.length >= 2) return 14;
  return 30;
}

/* ── Ana kontrol ── */
async function checkAndNotify(db, options) {
  const opts = options || {};
  const sendEmails = opts.sendEmails !== false;
  try {
    const state = await readState(db);
    const companies = Array.isArray(state.sd_co) ? state.sd_co : [];
    const reps = Array.isArray(state.sd_st) ? state.sd_st : [];
    if (!companies.length || !reps.length) {
      return { checked: 0, created: 0, emailed: 0 };
    }

    const repById = new Map(reps.map(r => [String(r.id), r]));
    const notifications = Array.isArray(state.sd_notifications) ? state.sd_notifications : [];
    const existingIds = new Set(notifications.map(n => String(n?.id || '')));

    const today = new Date();
    const dayStamp = today.toISOString().split('T')[0];
    let created = 0, emailed = 0, checked = 0;

    for (const company of companies) {
      if (company?.aktif === false) continue;
      const repId = String(company?.salesRepId || '');
      if (!repId) continue;
      const rep = repById.get(repId);
      if (!rep) continue;

      checked++;

      const last = lastVisitDateFor(state, company.id);
      const daysSince = last
        ? Math.floor((today - last) / 86400000)
        : null;
      const limit = expectedIntervalDays(company);

      // Hiç ziyaret yoksa da, limitin üstündeyse de uyar.
      if (daysSince !== null && daysSince <= limit) continue;

      // Aynı firma için günde bir bildirim.
      const id = 'delay_' + company.id + '_' + dayStamp;
      if (existingIds.has(id)) continue;

      const message = daysSince === null
        ? `${company.name} firmasına henüz hiç ziyaret kaydı yok`
        : `${company.name} firmasına ${daysSince} gündür ziyaret yok (beklenen aralık: ${limit} gün)`;

      notifications.push({
        id,
        type: 'delay',
        title: 'Gecikmiş Ziyaret',
        message,
        recipientUserId: repId,
        companyId: company.id,
        createdAt: today.toISOString(),
        read: false
      });
      existingIds.add(id);
      created++;

      if (sendEmails && rep.email) {
        const ok = await email.sendDelayAlert(rep, company, daysSince === null ? '∞' : daysSince);
        if (ok) emailed++;
      }
    }

    if (created > 0) {
      state.sd_notifications = notifications;
      await writeState(db, state);
    }

    console.log(`[NotificationService] ${checked} firma tarandı, ${created} bildirim üretildi, ${emailed} e-posta gönderildi`);
    return { checked, created, emailed };
  } catch (err) {
    console.error('[NotificationService] Hata:', err.message);
    return { checked: 0, created: 0, emailed: 0, error: err.message };
  }
}

function initNotificationService(db) {
  console.log('[NotificationService] başlatıldı (6 saatte bir)');
  timer = setInterval(() => { checkAndNotify(db); }, 6 * 60 * 60 * 1000);
  if (timer.unref) timer.unref();
  setTimeout(() => { checkAndNotify(db); }, 60 * 1000).unref?.();
}

function stopNotificationService() {
  if (timer) { clearInterval(timer); timer = null; console.log('[NotificationService] durduruldu'); }
}

module.exports = {
  initNotificationService,
  checkAndNotify,
  stopNotificationService,
  // test için
  _internals: { parseVisitDate, lastVisitDateFor, expectedIntervalDays }
};
