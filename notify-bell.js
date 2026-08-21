/* ═══════════════════════════════════════════════════════════════════
   Bildirim zili — admin, teknisyen ve satışçı panellerinin ORTAK zili.
   -------------------------------------------------------------------
   KAPSAM KURALI: zil yalnızca SATIŞTAN GELEN işleri taşır — ziyaret
   talebi ve satışçının aldığı numune. Gecikme/skor düşüşü gibi sistem
   uyarıları zile DÜŞMEZ; onlar teknisyende ilk girişte çıkan Erken
   Uyarı banner'ında (early-warning.js) toplanır. İkisi karışınca zil
   "her şeyin çöplüğü" oluyor ve satıştan gelen gerçek iş kayboluyordu.

   Okundu kuralı: zil bir kez açıldığında listedeki her şey okundu
   sayılır (sunucuya /all/read gider) ama o anki görünümde "yeni"
   vurgusu kalır — kullanıcı neyin yeni olduğunu göremeden rozet
   sıfırlanmasın. Sonraki açılışta liste sade hâliyle gelir.

   Mobil: açılır liste değil, alttan gelen sayfa (bottom sheet) —
   telefonda üst köşeye sıkışan 360px'lik kutu okunmuyordu.
   ═══════════════════════════════════════════════════════════════════ */
(function(global){
'use strict';

var POLL_MS=60000, isOpen=false, timer=null, cache=[];

/* Zilin taşıdığı türler. Sunucu da aynı listeyi uygular (routes/notifications.js);
   burada ikinci kez süzülür ki eski kayıtlar da görünmesin. */
var SALES_TYPES=['visit_request','visit_request_open','visit_request_planned','visit_request_done','visit_request_cancelled','sample_taken_by_sales'];

var META={
  visit_request          :{ico:'mapPin'      ,cls:'req'  },
  visit_request_planned  :{ico:'calendarCheck',cls:'plan' },
  visit_request_done     :{ico:'checkCircle' ,cls:'done' },
  visit_request_cancelled:{ico:'xCircle'     ,cls:'off'  },
  visit_request_open     :{ico:'mapPin'      ,cls:'req'  },
  sample_taken_by_sales  :{ico:'flask'       ,cls:'lab'  }
};
function metaOf(t){return META[t]||{ico:'bell',cls:'req'};}
function ico(n,c){return (typeof global.SDIcon==='function')?SDIcon(n,c):'';}

function token(){return localStorage.getItem('token')||sessionStorage.getItem('token')||'';}
function headers(){return{'Content-Type':'application/json','Authorization':'Bearer '+token()};}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

/* "3 dk önce / 2 saat önce / dün / 14 Ağu" — mutlak tarih bir bildirim
   listesinde okunmuyor, tazelik bilgisi taşımıyor. */
var AY=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
function ne_zaman(v){
  var d=new Date(v);
  if(isNaN(d))return'';
  var fark=Math.floor((Date.now()-d.getTime())/1000);
  if(fark<60)return'az önce';
  if(fark<3600)return Math.floor(fark/60)+' dk önce';
  if(fark<86400)return Math.floor(fark/3600)+' saat önce';
  if(fark<172800)return'dün';
  if(fark<604800)return Math.floor(fark/86400)+' gün önce';
  return d.getDate()+' '+AY[d.getMonth()];
}

function ensureMarkup(){
  if(document.getElementById('navBellMenu'))return document.getElementById('navBellMenu');
  var host=document.querySelector('.topbar-right');
  if(!host)return null;
  var wrap=document.createElement('div');
  wrap.className='nav-bell-menu';wrap.id='navBellMenu';
  wrap.innerHTML=
     '<button class="nav-bell-btn" id="navBellBtn" type="button" aria-label="Bildirimler" aria-expanded="false" title="Bildirimler">'
    +ico('bell')
    +'<span class="nav-bell-badge hidden" id="navBellBadge">0</span></button>';
  var userMenu=host.querySelector('.nav-user-menu');
  if(userMenu)host.insertBefore(wrap,userMenu);else host.appendChild(wrap);

  /* Panel ve karartı <body> ALTINA konur, zilin yanına DEĞİL: .topbar'da
     transform:translateZ(0) var (style.css, iOS kaydırma düzeltmesi) ve
     transform'lu bir ata, position:fixed çocukları için kapsayıcı blok olur.
     İçeride kalsaydı telefonda alttan gelmesi gereken sayfa 64px'lik başlığa
     göre konumlanıp ekranın üstüne kaçıyordu. */
  document.body.insertAdjacentHTML('beforeend',
     '<div class="nb-backdrop hidden" id="nbBackdrop"></div>'
    +'<div class="nb-panel hidden" id="navNotifDropdown" role="dialog" aria-label="Bildirimler">'
    +'<div class="nb-grip"></div>'
    +'<div class="nb-head"><b>Bildirimler</b><span class="nb-head-sub" id="nbHeadSub"></span>'
    +'<button type="button" class="nb-close" id="nbClose" aria-label="Kapat">'+ico('x')+'</button></div>'
    +'<div class="nb-list" id="navNotifList"></div></div>');
  return wrap;
}
/* Masaüstünde panel zilin altına hizalanır (konum JS ile, çünkü panel artık
   body'nin çocuğu). Telefonda CSS alt sayfa kuralları geçerli olsun diye
   satır içi konum temizlenir. */
var MOBIL=768;
function konumla(){
  var p=document.getElementById('navNotifDropdown'),btn=document.getElementById('navBellBtn');
  if(!p||!btn)return;
  if(window.innerWidth<=MOBIL){p.style.top=p.style.right=p.style.left=p.style.bottom='';return;}
  var r=btn.getBoundingClientRect();
  p.style.top=Math.round(r.bottom+10)+'px';
  p.style.right=Math.max(8,Math.round(window.innerWidth-r.right-6))+'px';
  p.style.left='auto';p.style.bottom='auto';
}

function setBadge(n){
  var b=document.getElementById('navBellBadge'),btn=document.getElementById('navBellBtn');
  if(!b)return;
  b.textContent=n>99?'99+':String(n);
  b.classList.toggle('hidden',!n);
  if(btn)btn.title=n?(n+' yeni bildirim'):'Bildirimler';
}

function fetchList(){
  return fetch('/api/notifications',{headers:headers()})
    .then(function(r){return r.ok?r.json():{};})
    .then(function(j){
      cache=(j.notifications||[]).filter(function(n){
        return n.status!=='archived'&&SALES_TYPES.indexOf(String(n.type))>=0;
      }).slice(0,30);
      return cache;
    });
}

function refreshBadge(){
  if(!token())return Promise.resolve(0);
  return fetchList().then(function(rows){
    var n=rows.filter(function(x){return !(x.read||x.readAt);}).length;
    setBadge(n);
    return n;
  }).catch(function(){return 0;});
}

/* Her satırın okundu/yeni durumu tek yerden hesaplanır — open() ve zamanlayıcı
   aynı eşlemeyi tekrar yazmasın diye. */
function mapYeni(rows){return rows.map(function(n){return Object.assign({},n,{_yeni:!(n.read||n.readAt)});});}

function render(rows){
  var list=document.getElementById('navNotifList'),sub=document.getElementById('nbHeadSub');
  if(!list)return;
  var yeni=rows.filter(function(x){return x._yeni;}).length;
  if(sub)sub.textContent=yeni?(yeni+' yeni'):(rows.length?'hepsi okundu':'');
  if(!rows.length){
    list.innerHTML='<div class="nb-empty">'+ico('inbox','nb-empty-ico')
      +'<b>Bildiriminiz yok</b><span>Satıştan bir ziyaret talebi ya da numune bildirimi geldiğinde burada görünür.</span></div>';
    return;
  }
  /* Satır = tıklanabilir içerik + ayrı bir kapatma düğmesi. <button> içine
     <button> geçersiz HTML olduğu için ikisi kardeş, ortak bir satır
     kapsayıcısında (.nb-row). */
  list.innerHTML=rows.map(function(n){
    var m=metaOf(n.type);
    return '<div class="nb-row'+(n._yeni?' yeni':'')+'">'
      +'<button type="button" class="nb-item'+(n._yeni?' yeni':'')+'" data-nid="'+esc(n.id)+'" data-co="'+esc(n.companyId||'')+'">'
      +'<span class="nb-ico '+m.cls+'">'+ico(m.ico)+'</span>'
      +'<span class="nb-body"><b>'+esc(n.title||'Bildirim')+'</b>'
      +'<span class="nb-msg">'+esc(n.message||'')+'</span>'
      +'<time>'+esc(ne_zaman(n.createdAt))+(n.companyId?' · firma kartını aç':'')+'</time></span>'
      +(n.companyId?'<span class="nb-go">'+ico('chevron')+'</span>':'')
      +'</button>'
      +'<button type="button" class="nb-del" data-del="'+esc(n.id)+'" aria-label="Bildirimi kaldır" title="Bildirimi kaldır">'+ico('x')+'</button>'
      +'</div>';
  }).join('');
  list.querySelectorAll('[data-nid]').forEach(function(el){
    el.addEventListener('click',function(){onItemClick(el.dataset.co);});
  });
  list.querySelectorAll('[data-del]').forEach(function(el){
    el.addEventListener('click',function(e){e.stopPropagation();dismissOne(el.dataset.del);});
  });
}

/* Bildirime tıklamak firmanın 360° kartını açar — okundu işareti zaten zil
   açılırken toplu atıldı, tıklama yalnızca aksiyona götürür. */
function onItemClick(companyId){
  if(companyId&&typeof global.openCompany360==='function'){
    close();
    openCompany360(companyId);
  }
}

/* X: bildirimi listeden kaldırır. Kalıcı silme YALNIZCA admine açık (denetim
   izi korunur, bkz. routes/notifications.js); satışçı/teknisyen için "silme"
   arşivlemektir — sunucuda kayıt durur, kullanıcının listesinde görünmez. */
function dismissOne(id){
  cache=cache.filter(function(n){return String(n.id)!==String(id);});
  render(mapYeni(cache));
  setBadge(cache.filter(function(n){return !(n.read||n.readAt);}).length);
  fetch('/api/notifications/'+encodeURIComponent(id)+'/archive',{method:'PUT',headers:headers()}).catch(function(){});
}

/* Zil açılınca hepsi okundu sayılır ama görünümdeki "yeni" vurgusu kalır. */
function markAllRead(){
  return fetch('/api/notifications/all/read',{method:'PUT',headers:headers()})
    .then(function(){
      setBadge(0);
      cache.forEach(function(n){n.read=true;});
    }).catch(function(){});
}

function open(){
  var dd=document.getElementById('navNotifDropdown'),bd=document.getElementById('nbBackdrop'),
      btn=document.getElementById('navBellBtn');
  if(!dd)return;
  var user=document.getElementById('navDropdown');if(user)user.classList.add('hidden');
  konumla();
  dd.classList.remove('hidden');
  if(bd)bd.classList.remove('hidden');
  if(btn)btn.setAttribute('aria-expanded','true');
  document.body.classList.add('nb-open');
  isOpen=true;
  render(mapYeni(cache));
  fetchList().then(function(rows){
    var goster=mapYeni(rows);
    render(goster);
    if(goster.some(function(x){return x._yeni;}))markAllRead();
    else setBadge(0);
  }).catch(function(){});
}
function close(){
  var dd=document.getElementById('navNotifDropdown'),bd=document.getElementById('nbBackdrop'),
      btn=document.getElementById('navBellBtn');
  if(dd)dd.classList.add('hidden');
  if(bd)bd.classList.add('hidden');
  if(btn)btn.setAttribute('aria-expanded','false');
  document.body.classList.remove('nb-open');
  isOpen=false;
}
function toggle(e){if(e){e.preventDefault();e.stopPropagation();}isOpen?close():open();}

function init(){
  if(!token())return;
  var wrap=ensureMarkup();
  if(!wrap)return;
  var btn=document.getElementById('navBellBtn');
  if(btn&&!btn._nbWired){btn._nbWired=true;btn.addEventListener('click',toggle);}
  var x=document.getElementById('nbClose');
  if(x&&!x._nbWired){x._nbWired=true;x.addEventListener('click',function(e){e.stopPropagation();close();});}
  var bd=document.getElementById('nbBackdrop');
  if(bd&&!bd._nbWired){bd._nbWired=true;bd.addEventListener('click',close);}
  document.addEventListener('click',function(e){if(isOpen&&!e.target.closest('#navBellMenu')&&!e.target.closest('#navNotifDropdown'))close();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&isOpen)close();});
  window.addEventListener('resize',function(){if(isOpen)konumla();});
  refreshBadge();
  /* Yeni talep geldiğinde teknisyenin sayfayı yenilemesi gerekmesin: rozet
     kendi kendine artar, zil açıksa liste de tazelenir. */
  if(timer)clearInterval(timer);
  timer=setInterval(function(){
    if(isOpen)fetchList().then(function(rows){
      render(mapYeni(rows));
      if(rows.some(function(x){return !(x.read||x.readAt);}))markAllRead();
    }).catch(function(){});
    else refreshBadge();
  },POLL_MS);
}

global.NotifyBell={init:init,refresh:refreshBadge,open:open,close:close,toggle:toggle,SALES_TYPES:SALES_TYPES};
/* sales.html'deki eski inline onclick adı korunuyor. */
global.toggleNotifBell=toggle;

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})(window);
