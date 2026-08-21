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

  /* Üç durum tek göstergede: çekilirken/yenilenirken dönen ok, bitince onay
     işareti, hata olursa ünlem. Sonuç bildirimi için UI.toast KULLANILMAZ —
     satışçı panelinde #toast öğesi hiç yok, çağrı sessizce düşüyor ve
     kullanıcı hiçbir onay göremiyordu ("yenilemiyor gibi" hissi). */
  var IKON = {
    yenile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    hata: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5M12 16.5h.01"/><circle cx="12" cy="12" r="9"/></svg>'
  };

  function ensureGosterge() {
    if (gosterge && document.body.contains(gosterge)) return gosterge;
    gosterge = document.createElement('div');
    gosterge.className = 'ptr';
    gosterge.setAttribute('aria-hidden', 'true');
    gosterge.innerHTML = '<div class="ptr-ring">' + IKON.yenile + '</div>';
    document.body.appendChild(gosterge);
    return gosterge;
  }

  /* Mobilde .topbar position:fixed, 76px yüksekliğinde ve z-index:3000
     (style.css v19 bloğu). Gösterge bunun ALTINDA kalırsa kullanıcı çekerken
     hiçbir şey görmüyor — "yenilemiyor" hissinin sebebi buydu. Bu yüzden
     gösterge hem çubuğun ÜSTÜNE çizilir (CSS z-index) hem de yolculuğuna
     çubuğun altından, yani gizliden başlar. */
  function ustCubukYuksekligi() {
    var tb = document.getElementById('topbar');
    if (!tb) return 0;
    var cs = global.getComputedStyle(tb);
    if (cs.position !== 'fixed') return 0;   // masaüstünde sticky; hareket zaten kapalı
    return Math.round(tb.getBoundingClientRect().height);
  }
  function taban() { return ustCubukYuksekligi() - 48; }

  /* İçerik de parmakla birlikte iner. Yalnız göstergenin oynadığı, sayfanın
     taş gibi durduğu bir hareket "uygulama donmuş" gibi duruyordu; asıl
     profesyonel his içeriğin parmağı takip etmesinden geliyor. */
  function icerik() { return document.getElementById('mainContent'); }
  function icerikKaydir(px, yumusak) {
    var m = icerik();
    if (!m) return;
    m.classList.toggle('ptr-shift', !!yumusak);
    m.style.transform = px ? 'translateY(' + Math.round(px) + 'px)' : '';
  }

  function ciz(px, hazir) {
    var g = ensureGosterge();
    g.classList.remove('closing');
    g.style.transform = 'translate(-50%,' + Math.round(taban() + px) + 'px)';
    g.style.opacity = String(Math.min(1, px / (ESIK * 0.7)));
    g.querySelector('.ptr-ring').style.transform = 'rotate(' + Math.round(px * 3.2) + 'deg)';
    g.classList.toggle('ready', !!hazir);
    icerikKaydir(px * 0.9, false);
  }

  function gizle() {
    var g = ensureGosterge();
    g.classList.add('closing');
    g.style.transform = 'translate(-50%,' + taban() + 'px)';
    g.style.opacity = '0';
    icerikKaydir(0, true);
    global.setTimeout(function () {
      g.classList.remove('closing', 'ready', 'spin');
      var m = icerik(); if (m) m.classList.remove('ptr-shift');
    }, 300);
  }

  function sifirla() { izleniyor = false; mesafe = 0; kap = null; }

  function yenile() {
    yenileniyor = true;
    var g = ensureGosterge();
    g.classList.remove('ready', 'closing');
    g.classList.add('spin');
    g.style.transform = 'translate(-50%,' + (taban() + ESIK) + 'px)';
    g.style.opacity = '1';
    // Parmak bırakıldı: içerik serbest düşüşe geçmesin, sabit bir basamağa otursun.
    icerikKaydir(ESIK * 0.72, true);

    var is;
    try {
      is = (typeof global.sdPullRefresh === 'function')
        ? global.sdPullRefresh()
        : (global.SD && SD.remoteReady ? SD.remoteReady({ force: true }) : null);
    } catch (e) { is = null; }

    // En az 650 ms dönsün: anında biten bir yenileme "hiçbir şey olmadı" gibi
    // görünüyor, kullanıcı tekrar tekrar çekiyordu.
    var enAz = new Promise(function (r) { global.setTimeout(r, 650); });
    /* Dönen halka, kapanmadan önce 750 ms boyunca onay işaretine dönüşür.
       Kullanıcının gözü zaten oradadır; "gerçekten yenilendi mi" diye tekrar
       tekrar çekmesinin önüne geçen tek şey bu görünür sonuç. */
    function bitir(basarili) {
      yenileniyor = false;
      var gg = ensureGosterge();
      gg.classList.remove('spin');
      gg.classList.add(basarili ? 'done' : 'fail');
      gg.querySelector('.ptr-ring').innerHTML = basarili ? IKON.ok : IKON.hata;
      global.setTimeout(function () {
        gizle();
        global.setTimeout(function () {
          gg.classList.remove('done', 'fail');
          gg.querySelector('.ptr-ring').innerHTML = IKON.yenile;
        }, 320);
      }, 750);
    }
    Promise.resolve(is)
      .then(function () { return enAz; })
      .then(function () { bitir(true); })
      .catch(function () { enAz.then(function () { bitir(false); }); });
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
