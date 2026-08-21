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
  try {
    // web-push, subject 'mailto:' veya 'https:' ile başlamıyorsa BURADA
    // senkron olarak fırlatıyor. Bu deneme olmadan hata, sendPushForNotification'ı
    // çağıran her yerdeki .catch(()=>{}) tarafından SESSİZCE yutuluyordu —
    // hiçbir log yok, push hiç gitmiyor, kimse neden bilmiyordu. Şimdi en
    // azından Vercel fonksiyon loglarında görünür.
    webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:destek@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
  } catch (e) {
    if (!warned) { console.error('[push] VAPID yapılandırması geçersiz:', e.message, '— VAPID_SUBJECT "mailto:" veya "https:" ile başlamalı.'); warned = true; }
    return false;
  }
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
   hiçbir aboneliğe eşleşmez. Satışçı tarafında rep.userId GÜVENİLİRDİR:
   routes/sales.js hem SQL users satırını hem sd_st.userId'yi TEK işlemde
   oluşturur ve her GET /api/sales'te hydrateProfiles ile kendini onarır. */
function subscriberMatchesUserId(state, sub, recipientUserId) {
  const raw = String(recipientUserId);
  if (String(sub.userId) === raw) return true;
  const rep = (state.sd_st || []).find(r =>
    String(r?.id || '') === raw || String(r?.userId || '') === raw || String(r?.legacyUserId || '') === raw);
  return !!(rep && rep.userId && String(sub.userId) === String(rep.userId));
}

/* Teknisyen tarafında ise sd_users[].id GÜVENİLMEZ: admin.js saveTech()
   teknisyen eklerken sd_users kaydına 'u'+Date.now() gibi RASTGELE bir id
   yazıyor — bunun gerçek SQL/JWT login id'siyle (push aboneliğinin
   userId'si) hiçbir ilişkisi yok, sales tarafındaki gibi bir eşleme/onarım
   mekanizması da yok. Kod tabanındaki ÜÇ farklı techIdentityForUser kopyası
   (routes/notifications.js, routes/state.js, routes/visit-requests.js) bu
   yüzden zaten kimliği sd_users[].id ÜZERİNDEN DEĞİL, KULLANICI ADI
   üzerinden çözüyor — orijinal iki teknisyen (semih.aglan/suleyman.kucuk)
   için ayrıca kod/username geriye dönük eşlemesiyle. Push abonelikleri de
   aynı yoldan, kendi username'i (routes/push.js subscribe'da kaydedilir)
   üzerinden teknisyen id'sine çözülerek eşleştirilir — sd_users[].id hiç
   kullanılmaz. */
function techIdOfUsername(state, username) {
  username = String(username || '').toLowerCase();
  if (!username) return '';
  const users = Array.isArray(state.sd_users) ? state.sd_users : [];
  const techs = Array.isArray(state.sd_te) ? state.sd_te : [];
  const appUser = users.find(u => String(u?.username || '').toLowerCase() === username);
  let tech = appUser && techs.find(t => String(t.id) === String(appUser.techId));
  if (!tech) {
    if (username === 'semih.aglan') tech = techs.find(t => String(t.code) === '1015');
    if (username === 'suleyman' || username === 'suleyman.kucuk') tech = techs.find(t => String(t.code) === '1016');
  }
  return tech ? String(tech.id) : '';
}
function subscriberMatchesTech(state, sub, recipientTechId) {
  const tid = techIdOfUsername(state, sub.username);
  return !!(tid && tid === String(recipientTechId));
}

/* broadcast:true → rol/kişi ayrımı yapılmadan KAYITLI TÜM abonelere gider
   (routes/notifications.js'teki aynı bayrakla aynı anlama gelir: bu bildirim
   tek bir kişiye değil herkese ait). Push atabilmek zaten kullanıcının daha
   önce bildirim izni verip abone olmuş olmasını gerektirir — hiç abone
   olmamış birine push gitmesi teknik olarak mümkün değil, yalnız uygulama
   içi zilde görünür. */
function eligibleSubscriptions(state, notif) {
  const subs = state.sd_push_subscriptions || [];
  if (notif.broadcast === true) return subs;
  return subs.filter(sub => {
    if (notif.recipientUserId && subscriberMatchesUserId(state, sub, notif.recipientUserId)) return true;
    if (notif.recipientTechId && subscriberMatchesTech(state, sub, notif.recipientTechId)) return true;
    return false;
  });
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
  try {
    if (!ensureConfigured()) return { sent: 0, reason: 'not-configured' };
    const { state } = await readState();
    if (!prefsAllow(state.sd_push_prefs, notif.type)) return { sent: 0, reason: 'pref-off' };

    if (notif.broadcast !== true && !notif.recipientUserId && !notif.recipientTechId) { console.warn('[push] '+notif.type+' — bildirimin alıcısı yok (recipientUserId/recipientTechId boş).'); return { sent: 0, reason: 'no-recipient' }; }
    const subs = eligibleSubscriptions(state, notif);
    if (!subs.length) { console.warn('[push] '+notif.type+' — hedeflenen kullanıcının kayıtlı push aboneliği yok (recipientUserId='+(notif.recipientUserId||'-')+' recipientTechId='+(notif.recipientTechId||'-')+').'); return { sent: 0, reason: 'no-subscription' }; }

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
    if (sent) console.log('[push] gönderildi:', notif.type, '→', sent, 'cihaz');
    return { sent, cleaned: dead.length };
  } catch (e) {
    // Buraya kadar sızan HER ŞEY (readState hatası, beklenmeyen bir istisna…)
    // eskiden çağıranların .catch(()=>{}) zinciriyle iz bırakmadan yutuluyordu.
    console.error('[push] sendPushForNotification beklenmeyen hata:', e && e.stack || e);
    return { sent: 0, reason: 'error' };
  }
}

module.exports = { sendPushForNotification, ensureConfigured, categories, categoryOf, prefsAllow };
