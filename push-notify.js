/* ═══════════════════════════════════════════════════════════════════
   Push bildirimleri — istemci tarafı (izin isteme, abone olma, banner).
   -------------------------------------------------------------------
   Sunucu tarafı: utils/webPush.js + routes/push.js. Servis çalışanı
   olayları: sw.js (push / notificationclick, bu dosyayla birlikte eklendi).

   iOS ÖZEL DURUM: Safari/Chrome'da push YALNIZCA "Ana Ekrana Ekle" ile
   kurulmuş, bağımsız (standalone) çalışan PWA'da çalışır (iOS 16.4+).
   Sekme olarak açıkken izin isteği anlamsızdır — bu yüzden yüklü değilse
   izin SORULMAZ, "Ana Ekrana Ekle" mesajı gösterilir.

   Kullanıcı izni reddederse BİR DAHA SORULMAZ (tarayıcı zaten hatırlıyor,
   Notification.permission==='denied' kalıcıdır). "Bugünlük kapat" ise
   günlük bir localStorage bayrağıyla ertesi gün tekrar sorar — erken uyarı
   şeridiyle aynı, tanıdık desen.
   ═══════════════════════════════════════════════════════════════════ */
(function(global){
'use strict';

function supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function isStandalone() { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
function ico(n, c) { return (typeof global.SDIcon === 'function') ? SDIcon(n, c) : ''; }
function token() { return localStorage.getItem('token') || sessionStorage.getItem('token') || ''; }
function headers() { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() }; }

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

const DISMISS_KEY = 'sd_push_banner_' + new Date().toISOString().slice(0, 10);
function dismissedToday() { try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; } }
function removeBanner() { const el = document.getElementById('pushBanner'); if (el) el.remove(); }
global.pushDismissBanner = function () { try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) {} removeBanner(); };

function ensureBanner() {
  const existing = document.getElementById('pushBanner');
  if (existing) return existing;
  const host = document.getElementById('mainContent');
  if (!host) return null;
  const el = document.createElement('div');
  el.id = 'pushBanner'; el.className = 'push-banner';
  host.insertBefore(el, host.firstChild);
  return el;
}

function renderInstallPrompt() {
  const el = ensureBanner(); if (!el) return;
  el.innerHTML =
      '<div class="push-banner-ico">' + ico('bell') + '</div>'
    + '<div class="push-banner-main"><b>Bildirimleri kaçırmayın</b>'
    + '<span>Anlık bildirim alabilmek için paylaş menüsünden <b>Ana Ekrana Ekle</b>\'yi seçip ServisDrama\'yı oradan açın.</span></div>'
    + '<button type="button" class="push-banner-x" onclick="pushDismissBanner()" aria-label="Kapat" title="Bugünlük kapat">' + ico('x') + '</button>';
}
function renderEnablePrompt() {
  const el = ensureBanner(); if (!el) return;
  el.innerHTML =
      '<div class="push-banner-ico">' + ico('bell') + '</div>'
    + '<div class="push-banner-main"><b>Bildirimleri açın</b>'
    + '<span>Yeni ziyaret talebi ve numune bildirimlerini telefon kilitliyken de alın.</span></div>'
    + '<div class="push-banner-acts">'
    + '<button type="button" class="btn btn-primary btn-sm" id="pushEnableBtn">Bildirimleri Etkinleştir</button>'
    + '<button type="button" class="push-banner-x" onclick="pushDismissBanner()" aria-label="Kapat" title="Bugünlük kapat">' + ico('x') + '</button>'
    + '</div>';
  const btn = document.getElementById('pushEnableBtn');
  if (btn) btn.addEventListener('click', enable);
}

async function subscribeAndSave(registration) {
  const r = await fetch('/api/push/vapid-public-key');
  if (!r.ok) throw new Error('Push yapılandırılmamış');
  const { publicKey } = await r.json();
  let sub = await registration.pushManager.getSubscription();
  if (!sub) sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
  await fetch('/api/push/subscribe', { method: 'POST', headers: headers(), body: JSON.stringify({ subscription: sub.toJSON(), ua: navigator.userAgent }) });
  return sub;
}

async function enable() {
  const btn = document.getElementById('pushEnableBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'İzin isteniyor…'; }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { removeBanner(); return; } // reddettiyse tarayıcı zaten hatırlar, biz de bir daha sormayız
    const reg = await navigator.serviceWorker.ready;
    await subscribeAndSave(reg);
    removeBanner();
    if (global.UI && UI.toast) UI.toast('Bildirimler etkinleştirildi.', 'success');
  } catch (e) {
    console.warn('[push] etkinleştirilemedi', e);
    if (btn) { btn.disabled = false; btn.textContent = 'Bildirimleri Etkinleştir'; }
    if (global.UI && UI.toast) UI.toast('Bildirimler etkinleştirilemedi: ' + e.message, 'error');
  }
}

/* Çıkış yapıldığında hem tarayıcıdaki abonelik hem sunucudaki kaydı kaldırır
   — aksi halde aynı cihazı kullanan bir sonraki kullanıcı öncekinin
   bildirimlerini almaya devam eder. admin.js/sales.js doLogout() çağırır. */
async function unsubscribeOnLogout() {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await fetch('/api/push/unsubscribe', { method: 'POST', headers: headers(), body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  } catch (e) {}
}
global.pushUnsubscribeOnLogout = unsubscribeOnLogout;

async function init() {
  if (!token() || !supported()) return;
  if (dismissedToday()) return;
  if (Notification.permission === 'denied') return; // reddedildiyse asla tekrar sorulmaz

  if (isIOS() && !isStandalone()) { renderInstallPrompt(); return; }

  if (Notification.permission === 'granted') {
    // İzin zaten verilmiş — banner göstermeden sessizce (yeniden) abone ol.
    // KOŞULSUZ çağrılır (yalnız "abonelik yoksa" değil): sunucudaki kayıt
    // /api/push/subscribe her çağrıldığında endpoint'e göre TAZELENİR —
    // böylece geçmişte eksik alanla (ör. username) kaydedilmiş bir abonelik
    // kullanıcı elle bir şey yapmadan, bir sonraki sayfa açılışında düzelir.
    try {
      const reg = await navigator.serviceWorker.ready;
      await subscribeAndSave(reg);
    } catch (e) { console.warn('[push] yenileme başarısız', e); }
    return;
  }
  renderEnablePrompt();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 1200); });
else setTimeout(init, 1200);
})(window);
