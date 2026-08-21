(() => {
  'use strict';

  const BUILD_ID = '20260821-talep-v4';
  const RELOAD_KEY = `sd_pwa_reloaded_${BUILD_ID}`;
  let registration = null;
  let checking = false;

  function showUpdateNotice(message) {
    let notice = document.getElementById('sdUpdateNotice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'sdUpdateNotice';
      Object.assign(notice.style, {
        position: 'fixed', left: '12px', right: '12px', bottom: '12px', zIndex: '2147483647',
        padding: '12px 14px', borderRadius: '10px', background: '#111827', color: '#fff',
        font: '600 13px/1.35 Inter,system-ui,sans-serif', textAlign: 'center',
        boxShadow: '0 8px 28px rgba(0,0,0,.24)'
      });
      document.body.appendChild(notice);
    }
    notice.textContent = message;
  }

  async function activateWaitingWorker() {
    if (!registration?.waiting) return false;
    showUpdateNotice('Yeni sürüm bulundu. Uygulama güncelleniyor…');
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    return true;
  }

  async function checkForUpdate() {
    if (!registration || checking || !navigator.onLine) return;
    checking = true;
    try {
      await registration.update();
      await activateWaitingWorker();
    } catch (error) {
      console.warn('[PWA] Güncelleme kontrolü yapılamadı:', error);
    } finally {
      checking = false;
    }
  }

  if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return;

  window.addEventListener('load', async () => {
    try {
      registration = await navigator.serviceWorker.register(`/sw.js?v=${BUILD_ID}`, {
        scope: '/', updateViaCache: 'none'
      });

      if (registration.waiting) await activateWaitingWorker();

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            activateWaitingWorker();
          }
        });
      });

      // Check immediately, periodically, and whenever the installed app returns foreground.
      await checkForUpdate();
      setInterval(checkForUpdate, 5 * 60 * 1000);
      window.addEventListener('online', checkForUpdate);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate();
      });
    } catch (error) {
      console.warn('[PWA] Service worker kaydı yapılamadı:', error);
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (sessionStorage.getItem(RELOAD_KEY)) return;
    sessionStorage.setItem(RELOAD_KEY, '1');
    location.reload();
  });
})();
