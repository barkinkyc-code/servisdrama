/* ═══════════════════════════════════════════════════════════════════
   SDIcon — ortak SVG ikon seti
   -------------------------------------------------------------------
   Bildirim listesi, ziyaret talebi kartı, erken uyarı banner'ı ve
   satışçı filtre düğmeleri emoji kullanıyordu. Emoji her işletim
   sisteminde farklı çiziliyor (Windows'ta düz, iOS'ta renkli/3B),
   hizalanmıyor ve metin rengini almıyor — kurumsal bir panelde
   dağınık duruyordu. Tek çizgi kalınlığı, tek boyut, currentColor.

   Kullanım: SDIcon('bell')  →  <svg …>…</svg>
   ═══════════════════════════════════════════════════════════════════ */
(function(global){
'use strict';

var P={
  bell        :'<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  calendar    :'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  calendarCheck:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>',
  check       :'<path d="M20 6 9 17l-5-5"/>',
  checkCircle :'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/>',
  xCircle     :'<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>',
  x           :'<path d="M18 6 6 18M6 6l12 12"/>',
  clock       :'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  alert       :'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  flask       :'<path d="M9 2v6.6L3.9 17.4A2 2 0 0 0 5.6 20.5h12.8a2 2 0 0 0 1.7-3.1L15 8.6V2"/><path d="M8 2h8"/><path d="M6.9 15h10.2"/>',
  building    :'<path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M15 9h2a2 2 0 0 1 2 2v10"/><path d="M9 7h2M9 11h2M9 15h2"/>',
  mapPin      :'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/>',
  inbox       :'<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/>',
  trendDown   :'<path d="M23 18l-9.5-9.5-5 5L1 6"/><path d="M17 18h6v-6"/>',
  wrench      :'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/>',
  chevron     :'<path d="m9 18 6-6-6-6"/>',
  send        :'<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  help        :'<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  dot         :'<circle cx="12" cy="12" r="4"/>'
};

/* stroke-width 1.9: 24px kutuda 16-18px çizilen ikonlarda 2 kalın, 1.5 soluk
   kalıyor. Tüm ikonlar currentColor kullanır, rengi kapsayıcı belirler. */
function icon(name,cls){
  return '<svg class="sd-ico'+(cls?' '+cls:'')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    +' stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
    +(P[name]||P.dot)+'</svg>';
}
icon.has=function(n){return Object.prototype.hasOwnProperty.call(P,n);};
global.SDIcon=icon;
})(window);
