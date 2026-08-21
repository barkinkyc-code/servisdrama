/* ═══════════════════════════════════════════════════════════════════
   Aşağı çekip yenileme (pull to refresh)
   -------------------------------------------------------------------
   Uygulama manifest'te display:"standalone" — yani "Ana Ekrana Ekle" ile
   kurulduğunda tarayıcı çubuğu YOK. Bu modda işletim sisteminin kendi
   "yukarıdan aşağı çekince yenile" hareketi de yok (iOS'ta hiç çalışmaz,
   Android'de de güvenilmez). Satışçı telefonda sayfayı çekiyor, hiçbir şey
   olmuyordu. Bu dosya o hareketi kendimiz uyguluyor.

   Sayfa, tazeleme işini window.sdPullRefresh() ile bildirir (Promise
   dönmeli). Tanımlı değilse yalnızca sunucudan veri çekilir.

   Kasıtlı sınırlar:
     · Yalnız dar ekranda (<=768px) ve yalnız sayfa EN TEPEDEYKEN devreye girer.
     · Modal/zil/hamburger menü açıkken hiç çalışmaz — o katmanlar kendi
       içinde kayıyor, altlarındaki sayfanın yenilenmesi kafa karıştırır.
     · Dokunuş kendi içinde kayan bir kutuda başladıysa (modal gövdesi, yatay
       kayan tablo) karışmaz.
     · Yatay hareketlerde (kaydırma jestleri) kendini iptal eder.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var ESIK = 70;     // yenilemeyi tetikleyen çekme mesafesi (px)
  var MAX = 110;     // göstergenin inebileceği en fazla mesafe (lastik etkisi)
  var SONUM = 0.55;  // parmak mesafesinin göstergeye yansıma oranı

  var izleniyor = false, basY = 0, basX = 0, mesafe = 0, yenileniyor = false, gosterge = null, kap = null;

  function mobilMi() { return global.matchMedia && global.matchMedia('(max-width:768px)').matches; }

  /* Sayfanın kendisi mi kayıyor, yoksa içteki bir kutu mu? Satışçı panelinde
     #mainContent overflow-y:auto taşıyor; bugün içerik sığdığı için kaydırma
     belgeye ait ama bu her düzende böyle olmayabilir. Bu yüzden "tepede miyiz"
     sorusu, dokunuşun AİT OLDUĞU kaba göre yanıtlanır — tek bir window.scrollY
     varsayımı, kap değişirse hareketi sessizce ölü bırakırdı. */
  function kayanKap(el) {
    for (var n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      if (!n.scrollHeight || !n.clientHeight) continue;
      var s = global.getComputedStyle(n);
      if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) return n;
    }
    return null;
  }
  function tepedeMi() {
    if (kap) return kap.scrollTop <= 0;
    return (global.scrollY || document.documentElement.scrollTop || 0) <= 0;
  }

  function ustKatmanAcik() {
    var b = document.body;
    if (b.classList.contains('nb-open')) return true;                          // bildirim zili paneli (ortak)
    if (b.classList.contains('menu-open')) return true;                        // yönetici paneli mobil menü
    var tb = document.getElementById('topbar');
    if (tb && tb.classList.contains('nav-open')) return true;                  // satışçı paneli mobil menü
    return !!document.querySelector('.overlay:not(.hidden), .sales-modal:not(.hidden)');
  }

  function ensureGosterge() {
    if (gosterge && document.body.contains(gosterge)) return gosterge;
    gosterge = document.createElement('div');
    gosterge.className = 'ptr';
    gosterge.setAttribute('aria-hidden', 'true');
    gosterge.innerHTML =
      '<div class="ptr-ring">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>'
      + '</div>';
    document.body.appendChild(gosterge);
    return gosterge;
  }

  function ciz(px, hazir) {
    var g = ensureGosterge();
    g.style.transform = 'translate(-50%,' + Math.round(px) + 'px)';
    g.style.opacity = String(Math.min(1, px / ESIK));
    g.querySelector('.ptr-ring').style.transform = 'rotate(' + Math.round(px * 2.6) + 'deg)';
    g.classList.toggle('ready', !!hazir);
  }

  function gizle() {
    var g = ensureGosterge();
    g.classList.add('closing');
    g.style.transform = 'translate(-50%,0)';
    g.style.opacity = '0';
    global.setTimeout(function () { g.classList.remove('closing', 'ready', 'spin'); }, 260);
  }

  function sifirla() { izleniyor = false; mesafe = 0; kap = null; }

  function yenile() {
    yenileniyor = true;
    var g = ensureGosterge();
    g.classList.remove('ready');
    g.classList.add('spin');
    g.style.transform = 'translate(-50%,' + ESIK + 'px)';
    g.style.opacity = '1';

    var is;
    try {
      is = (typeof global.sdPullRefresh === 'function')
        ? global.sdPullRefresh()
        : (global.SD && SD.remoteReady ? SD.remoteReady({ force: true }) : null);
    } catch (e) { is = null; }

    // En az 450 ms dönsün: anında biten bir yenileme "hiçbir şey olmadı" gibi
    // görünüyor, kullanıcı tekrar tekrar çekiyordu.
    var enAz = new Promise(function (r) { global.setTimeout(r, 450); });
    Promise.all([Promise.resolve(is).catch(function () {}), enAz])
      .then(function () { yenileniyor = false; gizle(); })
      .catch(function () { yenileniyor = false; gizle(); });
  }

  function onStart(e) {
    if (yenileniyor || izleniyor) return;
    if (!mobilMi() || ustKatmanAcik()) return;
    if (!e.touches || e.touches.length !== 1) return;
    kap = kayanKap(e.target);
    if (!tepedeMi()) { kap = null; return; }
    basY = e.touches[0].clientY;
    basX = e.touches[0].clientX;
    izleniyor = true;
    mesafe = 0;
  }

  function onMove(e) {
    if (!izleniyor || yenileniyor) return;
    if (!e.touches || e.touches.length !== 1) { sifirla(); gizle(); return; }
    var dy = e.touches[0].clientY - basY;
    var dx = e.touches[0].clientX - basX;

    // Yatay hareket baskınsa bu bir kaydırma jesti; yenilemeyi bırak.
    // (mesafe sifirla()'dan ÖNCE okunur; sonra okunursa gösterge asılı kalıyor.)
    if (Math.abs(dx) > Math.abs(dy)) { var cizilmisti = mesafe > 0; sifirla(); if (cizilmisti) gizle(); return; }
    // Yukarı doğru ya da sayfa tepeden ayrıldıysa normal kaydırmaya dön.
    if (dy <= 0 || !tepedeMi()) { if (mesafe) { sifirla(); gizle(); } else izleniyor = false; return; }

    mesafe = Math.min(MAX, dy * SONUM);
    // Sayfanın kendi lastik/kaydırma davranışı devreye girmesin.
    if (e.cancelable) e.preventDefault();
    ciz(mesafe, mesafe >= ESIK);
  }

  function onEnd() {
    if (!izleniyor || yenileniyor) return;
    var yeter = mesafe >= ESIK;
    sifirla();
    if (yeter) yenile(); else gizle();
  }

  function baslat() {
    // passive:false ŞART — çekme sırasında preventDefault çağrılmazsa sayfa
    // parmakla birlikte kayıyor ve gösterge titriyor.
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', function () { if (!yenileniyor) { sifirla(); gizle(); } }, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', baslat);
  else baslat();
})(window);
