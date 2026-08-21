/* ═══════════════════════════════════════════════════════════════════
   Push bildirimleri — native Web Push (VAPID), Firebase KULLANILMAZ.
   -------------------------------------------------------------------
   Neden Firebase değil: projede zaten bir Firebase projesi yoktu, yeni bir
   tane açmak gereksiz bir dış bağımlılık ekler. W3C Push API standardı iOS
   16.4+ (yalnızca Ana Ekrana eklenmiş PWA'da), Android Chrome ve masaüstünde
   aynı sonucu verir — VAPID anahtar çifti dışında hiçbir hesaba ihtiyaç yok.

   Bu dosya SESSİZCE devre dışı kalır (VAPID_PUBLIC_KEY/PRIVATE_KEY env'de
   yoksa): push göndermeden mevcut sistemin geri kalanı olduğu gibi çalışır.

   Abonelikler ve tercihler sd_push_subscriptions / sd_push_prefs altında,
   sd_notifications ile AYNI mutateState deposunda tutulur ama genel
   /api/state cevabına hiç girmez (bkz. routes/state.js) — yalnız bu dosya
   ve routes/push.js okur/yazar.
   ═══════════════════════════════════════════════════════════════════ */
const webpush = require('web-push');
const { readState, mutateState } = require('./stateStore');

let configured = false;
let warned = false;
function ensureConfigured() {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    if (!warned) { console.warn('[push] VAPID anahtarları tanımlı değil — push bildirimleri kapalı.'); warned = true; }
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:destek@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

/* Bildirim türü → admin panelindeki kategori. Yeni bir sd_notifications türü
   eklenirse buraya da eklenmezse "diğer" kategorisine düşer ve varsayılan
   KAPALI olur — sessizce her şeyi push'lamak yerine bilinçli bir seçim. */
const PUSH_CATEGORY = {
  visit_request: 'visit_request',
  visit_request_open: 'visit_request',
  visit_request_planned: 'visit_request_status',
  visit_request_done: 'visit_request_status',
  visit_request_cancelled: 'visit_request_status',
  sample_taken_by_sales: 'sample_taken',
  sample_wait: 'sample_taken',
  visit_overdue: 'visit_overdue',
  visit_missing: 'visit_overdue',
  visit_critical: 'visit_overdue',
  action_overdue: 'action',
  action_due: 'action'
};
/* Satıştan gelen ve bugüne kadar zaten uygulama-içi zilde gösterilen türler
   varsayılan AÇIK gelir; sistem uyarıları (gecikme/aksiyon) admin bilinçli
   olarak açana kadar KAPALI — "her site içi bildirimi otomatik push yapma"
   isteğinin karşılığı. */
const DEFAULT_ON = new Set(['visit_request', 'visit_request_status', 'sample_taken']);
function categoryOf(type) { return PUSH_CATEGORY[String(type || '')] || 'diger'; }
function categories() {
  return Array.from(new Set(Object.values(PUSH_CATEGORY))).map(key => ({ key, defaultOn: DEFAULT_ON.has(key) }));
}

function prefsAllow(prefs, type) {
  prefs = prefs || {};
  if (prefs.enabled === false) return false;
  const cat = categoryOf(type);
  if (Object.prototype.hasOwnProperty.call(prefs, cat)) return prefs[cat] !== false;
  return DEFAULT_ON.has(cat);
}

/* recipientUserId İKİ FARKLI değer taşıyabilir — mevcut kodda tutarsız:
   routes/samples.js ve services/notificationService.js gerçek giriş id'sini
   yazar, ama routes/visit-requests.js satışçı tarafı için sd_st KAYIT id'sini
   yazar (rep.id, örn. 's1'). Uygulama-içi zil bunu routes/notifications.js
   visible()'da getSalesRepIdentitySet ile açıp kapatıyor; push abonelikleri
   ise her zaman GERÇEK giriş id'siyle (JWT sub) tutulur, bu yüzden aynı
   genişletme burada da yapılmazsa satışçıya giden push'lar sessizce
   hiçbir aboneliğe eşleşmez. recipientTechId ise sd_te kaydı — giriş
   kullanıcısına sd_users[].techId üzerinden geri çevrilir. */
function subscriberUserIds(state, notif) {
  const ids = new Set();
  if (notif.recipientUserId) {
    const raw = String(notif.recipientUserId);
    ids.add(raw);
    const rep = (state.sd_st || []).find(r =>
      String(r?.id || '') === raw || String(r?.userId || '') === raw || String(r?.legacyUserId || '') === raw);
    if (rep && rep.userId) ids.add(String(rep.userId));
  }
  if (notif.recipientTechId) {
    (state.sd_users || []).forEach(u => {
      if (String(u?.techId || '') === String(notif.recipientTechId)) ids.add(String(u.id));
    });
  }
  return Array.from(ids);
}

function targetUrl(role, companyId) {
  const page = role === 'sales' ? '/sales.html' : '/admin.html';
  return companyId ? (page + '?openCompany=' + encodeURIComponent(companyId)) : page;
}

/* Bir sd_notifications kaydı oluştuktan SONRA çağrılır (mutateState işlemi
   kapandıktan sonra — push gönderimi ağ üzerinden Apple/Google/Mozilla push
   servislerine gittiği için veritabanı kilidini o süre boyunca tutmamak
   gerekir). Başarısız/geçersiz (404/410) abonelikler otomatik temizlenir. */
async function sendPushForNotification(notif) {
  if (!notif) return { sent: 0 };
  if (!ensureConfigured()) return { sent: 0, reason: 'not-configured' };
  const { state } = await readState();
  if (!prefsAllow(state.sd_push_prefs, notif.type)) return { sent: 0, reason: 'pref-off' };

  const userIds = subscriberUserIds(state, notif);
  if (!userIds.length) return { sent: 0 };
  const subs = (state.sd_push_subscriptions || []).filter(s => userIds.includes(String(s.userId)));
  if (!subs.length) return { sent: 0 };

  let sent = 0;
  const dead = [];
  await Promise.all(subs.map(async sub => {
    const payload = JSON.stringify({
      title: notif.title || 'ServisDrama',
      body: notif.message || '',
      tag: notif.type || 'servisdrama',
      url: targetUrl(sub.role, notif.companyId)
    });
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) dead.push(sub.endpoint);
      else console.warn('[push] gönderilemedi:', e.statusCode || e.message);
    }
  }));

  if (dead.length) {
    await mutateState(s => {
      s.sd_push_subscriptions = (s.sd_push_subscriptions || []).filter(x => !dead.includes(x.endpoint));
    }, null).catch(() => {});
  }
  return { sent, cleaned: dead.length };
}

module.exports = { sendPushForNotification, ensureConfigured, categories, categoryOf, prefsAllow };
