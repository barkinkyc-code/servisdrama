/* ═══════════════════════════════════════════════════════════════════
   Bildirim zili — admin, teknisyen ve satışçı panellerinin ORTAK zili.
   -------------------------------------------------------------------
   Bildirimler sunucuda (state.sd_notifications) tutulur ve /api/notifications
   rol kapsamıyla döner: admin hepsini, teknisyen recipientTechId'si kendisi
   olanları, satışçı recipientUserId'si kendisi olanları görür.

   Zil eskiden yalnız sales.js içinde vardı; teknisyen panelinde hiç yoktu, bu
   yüzden "satışçı numune aldı" gibi teknisyene yazılan bildirimler üretiliyor
   ama kimse görmüyordu. Artık iki panel de bu dosyayı yükler.

   Markup yoksa (admin.html) kendisi kurar; varsa (sales.html) mevcut markup'ı
   kullanır — iki panelin üst çubuğu farklı, HTML'i tek yerde tutmak yerine
   bağlanma noktası esnek bırakıldı.
   ═══════════════════════════════════════════════════════════════════ */
(function(global){
'use strict';

var POLL_MS=60000, dropdownOpen=false, timer=null;

function token(){return localStorage.getItem('token')||sessionStorage.getItem('token')||'';}
function headers(){return{'Content-Type':'application/json','Authorization':'Bearer '+token()};}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function fmt(v){
  if(global.C360&&C360.fmtDate)return C360.fmtDate(v);
  var d=new Date(v);return isNaN(d)?'':d.toLocaleDateString('tr-TR');
}
/* Bildirim türüne göre ikon: listede hangi satırın aksiyon istediği metni
   okumadan da anlaşılsın. */
var ICONS={
  visit_request:'🔔',visit_request_planned:'📅',visit_request_done:'✅',visit_request_cancelled:'✖️',
  sample_taken_by_sales:'🧪',visit_overdue:'⏰',visit_missing:'❓',visit_critical:'🚨'
};

function ensureMarkup(){
  if(document.getElementById('navBellMenu'))return document.getElementById('navBellMenu');
  var host=document.querySelector('.topbar-right');
  if(!host)return null;
  var wrap=document.createElement('div');
  wrap.className='nav-bell-menu';wrap.id='navBellMenu';
  wrap.innerHTML='<button class="nav-bell-btn" id="navBellBtn" type="button" aria-label="Bildirimler" title="Bildirimler">'
    +'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>'
    +'<span class="nav-bell-badge hidden" id="navBellBadge">0</span></button>'
    +'<div class="nav-dropdown nav-notif-dropdown hidden" id="navNotifDropdown">'
    +'<div class="nav-dd-header"><div class="nav-dd-name">Bildirimler</div>'
    +'<button type="button" class="nav-dd-allread" id="navNotifAllRead">Tümünü okundu yap</button></div>'
    +'<div class="nav-notif-list" id="navNotifList"></div></div>';
  var userMenu=host.querySelector('.nav-user-menu');
  if(userMenu)host.insertBefore(wrap,userMenu);else host.appendChild(wrap);
  return wrap;
}

function setBadge(n){
  var b=document.getElementById('navBellBadge');
  if(!b)return;
  b.textContent=n>9?'9+':String(n);
  b.classList.toggle('hidden',!n);
}

function refreshBadge(){
  if(!token())return Promise.resolve();
  return fetch('/api/notifications/unread/count',{headers:headers()})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(j){if(j)setBadge(j.unread_count||0);})
    .catch(function(){});
}

function loadList(){
  var list=document.getElementById('navNotifList');
  if(!list)return;
  list.innerHTML='<div class="nav-notif-empty">Yükleniyor…</div>';
  fetch('/api/notifications',{headers:headers()})
    .then(function(r){return r.json();})
    .then(function(j){
      var items=(j.notifications||[]).filter(function(n){return n.status!=='archived';}).slice(0,20);
      if(!items.length){list.innerHTML='<div class="nav-notif-empty">Bildiriminiz yok.</div>';return;}
      list.innerHTML=items.map(function(n){
        var okundu=!!(n.read||n.readAt);
        return '<div class="nav-notif-item'+(okundu?'':' unread')+'" data-nid="'+esc(n.id)+'" data-co="'+esc(n.companyId||'')+'">'
          +'<b><span class="nav-notif-ico">'+(ICONS[n.type]||'🔔')+'</span>'+esc(n.title||'Bildirim')+'</b>'
          +'<div>'+esc(n.message||'')+'</div>'
          +'<small>'+esc(fmt(n.createdAt))+(n.companyId?' · firmayı aç':'')+'</small></div>';
      }).join('');
      list.querySelectorAll('[data-nid]').forEach(function(el){
        el.addEventListener('click',function(){onItemClick(el.dataset.nid,el.dataset.co);});
      });
    })
    .catch(function(){list.innerHTML='<div class="nav-notif-empty">Bildirimler yüklenemedi.</div>';});
}

/* Bildirime tıklamak okundu yapar VE ilgili firmanın 360° kartını açar:
   teknisyen "ziyaret talebi" bildirimini gördüğü yerden aksiyona geçebilsin. */
function onItemClick(id,companyId){
  fetch('/api/notifications/'+encodeURIComponent(id)+'/read',{method:'PUT',headers:headers()})
    .then(function(){refreshBadge();loadList();})
    .catch(function(){});
  if(companyId&&typeof global.openCompany360==='function'){
    close();
    openCompany360(companyId);
  }
}

function markAllRead(){
  fetch('/api/notifications/all/read',{method:'PUT',headers:headers()})
    .then(function(){refreshBadge();loadList();})
    .catch(function(){});
}

function open(){
  var dd=document.getElementById('navNotifDropdown');
  if(!dd)return;
  document.getElementById('navDropdown')&&document.getElementById('navDropdown').classList.add('hidden');
  dd.classList.remove('hidden');dropdownOpen=true;loadList();
}
function close(){
  var dd=document.getElementById('navNotifDropdown');
  if(dd)dd.classList.add('hidden');
  dropdownOpen=false;
}
function toggle(e){if(e)e.stopPropagation();dropdownOpen?close():open();}

function init(){
  if(!token())return;
  var wrap=ensureMarkup();
  if(!wrap)return;
  var btn=document.getElementById('navBellBtn');
  if(btn&&!btn._nbWired){btn._nbWired=true;btn.addEventListener('click',toggle);}
  var all=document.getElementById('navNotifAllRead');
  if(all&&!all._nbWired){all._nbWired=true;all.addEventListener('click',function(e){e.stopPropagation();markAllRead();});}
  document.addEventListener('click',function(e){if(!e.target.closest('#navBellMenu'))close();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  refreshBadge();
  /* Talep açıldığında teknisyenin sayfayı yenilemesi gerekmesin. */
  if(timer)clearInterval(timer);
  timer=setInterval(function(){refreshBadge();if(dropdownOpen)loadList();},POLL_MS);
}

global.NotifyBell={init:init,refresh:refreshBadge,open:open,close:close,toggle:toggle,markAllRead:markAllRead};
/* sales.js'in eski global adları korunuyor: sales.html'deki onclick="toggleNotifBell(event)". */
global.toggleNotifBell=toggle;

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})(window);
