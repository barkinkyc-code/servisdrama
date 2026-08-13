/* Satışçı kimlik çözümleme — tek merkezi kaynak.
   Eski veri modelleri (s1, u3, sayısal userId, salesRepUserId, legacyUserId)
   burada tek yerde çözülür; routes/state.js, routes/actions.js,
   routes/notifications.js, routes/sales.js ve services/notificationService.js
   bu modülü kullanır — her biri kendi eşleme mantığını tekrar yazmaz. */

function clone(value, fallback) {
  try { return JSON.parse(JSON.stringify(value)); } catch (_) { return fallback; }
}

// JWT yalnızca {id,username,role} taşır; satışçı kimliği state'ten çözülür.
function resolveSalesRepIdentity(current, user) {
  const username = String(user?.username || '').toLowerCase();
  const reps = Array.isArray(current?.sd_st) ? current.sd_st : [];
  const users = Array.isArray(current?.sd_users) ? current.sd_users : [];

  // 1) veritabanı userId veya doğrudan username/email eşleşmesi
  let rep = reps.find(s => String(s?.userId || '') === String(user?.id || ''))
         || reps.find(s => String(s?.username || '').toLowerCase() === username)
         || reps.find(s => String(s?.email || '').split('@')[0].toLowerCase() === username);

  // 2) sd_users üzerinden id/salesRepId köprüsü
  if (!rep) {
    const appUser = users.find(u => String(u?.username || '').toLowerCase() === username);
    if (appUser) {
      const wanted = String(appUser.salesRepId || appUser.id || '');
      rep = reps.find(s => String(s?.id || '') === wanted);
    }
  }

  if (!rep) return null;
  const appUser = users.find(u => String(u?.username || '').toLowerCase() === username);
  return { ...rep, userId: rep.userId || user?.id || '', legacyUserId: rep.legacyUserId || appUser?.id || '' };
}

// Bir satışçı profiline karşı eşleşecek tüm kimlik değerleri (id, gerçek
// kullanıcı id'si, eski/legacy id) — firma ataması ve kayıt sahipliği
// kontrollerinde tutarlı biçimde kullanılır.
function getSalesRepIdentitySet(rep) {
  if (!rep) return new Set();
  return new Set([rep.id, rep.userId, rep.legacyUserId].filter(Boolean).map(String));
}

// Firma bu satışçıya atanmış mı? (salesRepId veya salesRepUserId, eski/yeni id fark etmez)
function companyBelongsToSalesRep(company, rep) {
  if (!company || !rep) return false;
  const idSet = getSalesRepIdentitySet(rep);
  if (!idSet.size) return false;
  const values = [company?.salesRepId, company?.salesRepUserId].filter(Boolean).map(String);
  return values.some(v => idSet.has(v));
}

// Bir firmaya atanmış aktif satışçı profilini bulur (kullanıcı bağlamı olmayan
// arka plan işleri için — örn. bildirim üretimi).
function getCompanySalesRep(state, company) {
  const reps = Array.isArray(state?.sd_st) ? state.sd_st : [];
  if (!company) return null;
  return reps.find(rep => rep.status !== 'inactive' && companyBelongsToSalesRep(company, rep)) || null;
}

// Satışçı kullanıcısı için state filtrelemesi: yalnızca atanmış firmaları döner.
// Kimlik çözülemezse boş state döner (fail-closed).
function filterStateForSalesRep(state, salesRep) {
  if (!state || typeof state !== 'object' || !salesRep || !salesRep.id) return {};
  const salesRepId = String(salesRep.id);
  const filtered = clone(state, {});
  const idSet = getSalesRepIdentitySet(salesRep);

  const assignedCompanies = (filtered.sd_co || []).filter(c => companyBelongsToSalesRep(c, salesRep));
  const assignedCoIds = new Set(assignedCompanies.map(c => String(c.id)));

  filtered.sd_co = assignedCompanies;

  // Ziyaretleri filtrele (sadece atanmış firmaların ziyaretleri).
  // Anahtar biçimi hem 'firmaId|hafta' hem 'firmaId_hafta' olabilir.
  if (filtered.sd_vi && typeof filtered.sd_vi === 'object') {
    const filteredVisits = {};
    Object.entries(filtered.sd_vi).forEach(([key, record]) => {
      const firmaId = String(key).split(/[|_]/)[0];
      if (assignedCoIds.has(firmaId)) filteredVisits[key] = record;
    });
    filtered.sd_vi = filteredVisits;
  }

  if (Array.isArray(filtered.sd_ex)) {
    filtered.sd_ex = filtered.sd_ex.filter(x => assignedCoIds.has(String(x.firmaId || x.companyId || '')));
  }

  filtered.sd_dp = [];

  if (Array.isArray(filtered.sd_samples)) {
    filtered.sd_samples = filtered.sd_samples.filter(s => assignedCoIds.has(String(s.firmaId || s.companyId || '')));
  }

  // Bildirim ve aksiyonlar: yalnızca kendisine ait olanlar (id/userId/legacyUserId birlikte)
  if (Array.isArray(filtered.sd_notifications)) {
    filtered.sd_notifications = filtered.sd_notifications.filter(
      n => idSet.has(String(n?.recipientUserId || ''))
    );
  }
  if (Array.isArray(filtered.sd_actions)) {
    filtered.sd_actions = filtered.sd_actions.filter(
      a => idSet.has(String(a?.salesRepId || ''))
    );
  }

  filtered.sd_st = [salesRep];

  delete filtered.sd_users;
  delete filtered.sd_risk_events;
  delete filtered.sd_audit;
  delete filtered.sd_cfg;

  return filtered;
}

module.exports = {
  resolveSalesRepIdentity,
  getSalesRepIdentitySet,
  companyBelongsToSalesRep,
  getCompanySalesRep,
  filterStateForSalesRep
};
