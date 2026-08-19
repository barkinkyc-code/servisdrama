/* ================================================================
   ServisDrama — Erken Uyarı / Sapma Tespiti

   Firma skoru "şu anki durumu" ölçer. Bu modül ZAMAN İÇİNDEKİ SAPMAYI
   arar: durum hâlâ iyi görünse bile kötüye GİDİYORSA erkenden yakalar.

   Dört kural (hepsi açıklanabilir, kara kutu yok):
     1. Ziyaret aralığı uzuyor      — firma bazlı
     2. Firma skoru düşüşte         — firma bazlı, 60 günlük fark
     3. Kronik program dışı çağrı   — firma bazlı, 90 gün
     4. Tamamlama oranı düştü       — teknisyen bazlı, 4 hafta vs önceki 4 hafta

   KAPSAM: teknisyen girişinde yalnızca KENDİ firmaları ve kendi tamamlama
   oranı; admin girişinde her şey. Aynı hesap üç yerde kullanılır:
     - açılışta bir kez çıkan uyarı ekranı
     - kullanıcı adının yanındaki zil + sayaç
     - İstatistikler › Erken Uyarı sekmesi (admin)

   Skor ve izin kuralı yeniden yazılmaz; weekly-report-data.js'ten
   weeklyScoreDetail / weeklyTechOnLeaveWeek olarak kullanılır — böylece
   rapor ile uyarı paneli aynı modeli paylaşır.
   ================================================================ */
(function(global){
'use strict';

var DAY=86400000;
var LOOKBACK_SCORE_DAYS=60;   /* skor karşılaştırma penceresi */
var LOOKBACK_EXTRA_DAYS=90;   /* kronik çağrı penceresi */
var MIN_SCORE_DROP=15;        /* puan */
var MIN_RATE_DROP=20;         /* yüzde puanı */
var MIN_EXTRA_CALLS=3;        /* 90 günde */
var INTERVAL_FACTOR=1.5;      /* son aralık / önceki aralık */

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function avg(a){return a.length?a.reduce(function(x,y){return x+y;},0)/a.length:0;}
function daysBetween(a,b){return Math.round((b-a)/DAY);}
function weekIdxOfMonday(m){
  var weeks=DT.monthWeeks(m.getFullYear(),m.getMonth());
  var i=weeks.findIndex(function(w){return w.getTime()===m.getTime();})+1;
  return i<1?1:i;
}
/* "GG.AA.YYYY", "GG.AA" (yıl hafta anahtarından) ve "YYYY-AA-GG" biçimlerini okur. */
function parseAny(v,weekKey){
  if(v instanceof Date)return isNaN(v.getTime())?null:v;
  var s=String(v||''),m=s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if(m)return new Date(+m[3],+m[2]-1,+m[1]);
  m=s.match(/^(\d{2})\.(\d{2})$/);
  if(m){
    var y=Number((String(weekKey).match(/(20\d{2})/)||[])[1]);
    return y?new Date(y,+m[2]-1,+m[1]):null;
  }
  m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m)return new Date(+m[1],+m[2]-1,+m[3]);
  return null;
}
function entriesOf(rec){
  if(!rec)return{};
  if(SD.visitEntries)return SD.visitEntries(rec)||{};
  if(rec.by&&typeof rec.by==='object')return rec.by;
  if(rec.tc){var o={};o[rec.tc]=rec;return o;}
  return{};
}
/* Firmanın tamamlanmış ziyaret tarihleri, yeniden eskiye. Aynı hafta içindeki
   çoklu ziyaretler `dates` dizisinden açılır (yalnız `date` okunursa aradaki
   ziyaretler kaybolur, aralık hesabı yanlış çıkar). */
function doneVisitDates(companyId){
  var out=[],visits=SD.visits||{};
  Object.keys(visits).forEach(function(k){
    if(String(k).split('_')[0]!==String(companyId))return;
    var wk=String(k).split('_')[1],es=entriesOf(visits[k]);
    Object.keys(es).forEach(function(code){
      var e=es[code];
      if(!e||e.status!=='done')return;
      var list=(e.dates&&e.dates.length?e.dates:[e.date]).filter(Boolean);
      list.forEach(function(d){var x=parseAny(d,wk);if(x)out.push(x);});
    });
  });
  return out.sort(function(a,b){return b-a;});
}
/* Firmanın kendi planına göre iki ziyaret arası beklenen gün sayısı. */
function planDays(co){
  var n=(co&&co.weeks&&co.weeks.length)?co.weeks.length:4;
  return Math.max(1,Math.min(4,Math.round(4/n)))*7;
}
function techOnLeave(tech,mon){
  return global.weeklyTechOnLeaveWeek?global.weeklyTechOnLeaveWeek(tech,mon):false;
}

/* ── KAPSAM ──────────────────────────────────────────────────────
   Teknisyen girişinde yalnızca kendi verisi; admin girişinde hepsi. */
function viewerScope(){
  var tech=null;
  try{tech=(SD.sessionTech&&SD.sessionTech())||null;}catch(e){tech=null;}
  return tech?{techId:tech.id,tech:tech,isAdmin:false}:{techId:null,tech:null,isAdmin:true};
}
function scopedCompanies(scope){
  return (SD.companies||[]).filter(function(c){
    if(c.aktif===false)return false;
    return !scope.techId||String(c.techId)===String(scope.techId);
  });
}

/* ── KURAL 1: Ziyaret aralığı uzuyor ─────────────────────────────
   Son 2 aralığın ortalaması, ondan önceki aralıkların ortalamasının
   INTERVAL_FACTOR katını aşıyorsa VE firmanın kendi planını geçiyorsa. */
function intervalDrift(co){
  var d=doneVisitDates(co.id);
  if(d.length<4)return null;
  var gaps=[];
  for(var i=0;i<d.length-1&&gaps.length<5;i++){
    var g=daysBetween(d[i+1],d[i]);
    if(g>0)gaps.push(g);
  }
  if(gaps.length<3)return null;
  var recent=avg(gaps.slice(0,2)),earlier=avg(gaps.slice(2));
  var plan=planDays(co);
  if(!(recent>earlier*INTERVAL_FACTOR&&recent>plan))return null;
  return {
    tur:'aralik',
    ad:co.name,firmaId:co.id,
    olcu:'+'+Math.round(recent-earlier)+' gün',
    aciklama:'Ziyaret aralığı '+Math.round(earlier)+' → '+Math.round(recent)+' güne çıktı (plan '+plan+' gün)',
    kritik:recent>plan*2
  };
}

/* ── KURAL 2: Firma skoru düşüşte ────────────────────────────────
   Bugünkü skor ile LOOKBACK_SCORE_DAYS gün öncesinin skoru arasındaki fark.
   Aynı skor modeli (izin düşümü dahil) kullanılır. */
function scoreDrift(co,now,past){
  if(!global.weeklyScoreDetail)return null;
  var sNow=global.weeklyScoreDetail(co,now),sPast=global.weeklyScoreDetail(co,past);
  if(!sNow||!sPast||sNow.score==null||sPast.score==null)return null;
  var drop=sPast.score-sNow.score;
  if(drop<MIN_SCORE_DROP)return null;
  return {
    tur:'skor',
    ad:co.name,firmaId:co.id,
    olcu:'-'+drop,
    aciklama:'Firma skoru '+sPast.score+' → '+sNow.score+' (son '+LOOKBACK_SCORE_DAYS+' gün)',
    kritik:sNow.score<50
  };
}

/* ── KURAL 3: Kronik program dışı çağrı ──────────────────────────
   Planlı olmayan ziyaretin tekrarı, çözülmemiş bir sorunun işareti.
   Kayıtsız (serbest metin) firmalar da normalize edilmiş isimle sayılır. */
function chronicExtras(scope){
  var since=new Date(Date.now()-LOOKBACK_EXTRA_DAYS*DAY),groups={},cos=SD.companies||[];
  (SD.extras||[]).forEach(function(e){
    var d=parseAny(e.date,e.wk);
    if(!d||d<since)return;
    var co=e.firmaId?cos.find(function(c){return String(c.id)===String(e.firmaId);}):null;
    if(scope.techId){
      /* Kayıtlı firmada sorumluluk firmanın teknisyenine, kayıtsız girişte
         ziyareti giren teknisyene göre belirlenir. */
      var owns=co?String(co.techId)===String(scope.techId):String(e.techId||'')===String(scope.techId);
      if(!owns)return;
    }
    var key=e.firmaId||('ad:'+String(e.firmAdi||'').toLocaleUpperCase('tr').trim());
    if(!groups[key])groups[key]={n:0,firmaId:e.firmaId||'',ad:co?co.name:(e.firmAdi||''),son:d};
    groups[key].n++;
    if(d>groups[key].son)groups[key].son=d;
  });
  return Object.keys(groups).map(function(k){
    var g=groups[k];
    if(g.n<MIN_EXTRA_CALLS)return null;
    return {
      tur:'kronik',
      ad:g.ad||'Bilinmeyen firma',firmaId:g.firmaId,
      olcu:g.n+'×',
      aciklama:'Son '+LOOKBACK_EXTRA_DAYS+' günde '+g.n+' program dışı çağrı (son: '+DT.ddmmyyyy(g.son)+')',
      kritik:g.n>=5
    };
  }).filter(Boolean);
}

/* ── KURAL 4: Teknisyen tamamlama oranı düştü ────────────────────
   Planlı firma-hafta başına tamamlanan ziyaret oranı. İzinli haftalar
   paydadan düşülür (haftalık rapordaki kuralın aynısı), yoksa izin
   dönüşü teknisyen haksız yere düşmüş görünür. */
function techCompletion(tech,startMonday,weekCount){
  var expected=0,met=0;
  var cos=(SD.companies||[]).filter(function(c){return c.aktif!==false&&String(c.techId)===String(tech.id);});
  var cursor=new Date(startMonday);
  for(var w=0;w<weekCount;w++){
    var wi=weekIdxOfMonday(cursor),wk=DT.wkey(cursor),onLeave=techOnLeave(tech,cursor);
    cos.forEach(function(c){
      if(!BL.scheduled(c,wi))return;
      var v=SD.visitEntryFor((SD.visits||{})[c.id+'_'+wk],tech.code);
      if(v&&v.status==='done'){expected++;met++;}
      else if(!onLeave)expected++;
    });
    cursor=new Date(cursor);cursor.setDate(cursor.getDate()+7);
  }
  return {expected:expected,met:met,rate:expected?Math.round(met/expected*100):null};
}
function techDrift(tech,thisMonday){
  var curStart=new Date(thisMonday);curStart.setDate(curStart.getDate()-28);
  var prevStart=new Date(thisMonday);prevStart.setDate(prevStart.getDate()-56);
  var cur=techCompletion(tech,curStart,4),prev=techCompletion(tech,prevStart,4);
  /* Az veri varken oran gürültülü olur; iki pencerede de en az 4 planlı
     firma-hafta aranır. */
  if(cur.expected<4||prev.expected<4||cur.rate==null||prev.rate==null)return null;
  var drop=prev.rate-cur.rate;
  if(drop<MIN_RATE_DROP)return null;
  return {
    tur:'teknisyen',
    ad:tech.code+' · '+(tech.name||''),firmaId:'',
    olcu:'-'+drop+' puan',
    aciklama:'Tamamlama oranı %'+prev.rate+' → %'+cur.rate+' (önceki 4 hafta → son 4 hafta, '+cur.met+'/'+cur.expected+')',
    kritik:cur.rate<50
  };
}

/* ── Toplama ─────────────────────────────────────────────────── */
function collectWarnings(scope){
  scope=scope||viewerScope();
  var now=new Date();now.setHours(23,59,59,999);
  var past=new Date(now.getTime()-LOOKBACK_SCORE_DAYS*DAY);
  var thisMonday=DT.monday(new Date());
  var out={aralik:[],skor:[],kronik:[],teknisyen:[],scope:scope};
  scopedCompanies(scope).forEach(function(co){
    var a=intervalDrift(co);if(a)out.aralik.push(a);
    var s=scoreDrift(co,now,past);if(s)out.skor.push(s);
  });
  out.kronik=chronicExtras(scope);
  (SD.technicians||[]).forEach(function(t){
    if(scope.techId&&String(t.id)!==String(scope.techId))return;
    var d=techDrift(t,thisMonday);if(d)out.teknisyen.push(d);
  });
  ['aralik','skor','kronik','teknisyen'].forEach(function(k){
    out[k].sort(function(a,b){return (b.kritik?1:0)-(a.kritik?1:0)||String(a.ad).localeCompare(String(b.ad),'tr');});
  });
  return out;
}
var GROUPS=[
  {key:'aralik',baslik:'Ziyaret aralığı uzayan firmalar',alt:'Son iki ziyaret arası, önceki temposunun 1.5 katını ve firmanın kendi planını aştı.'},
  {key:'skor',baslik:'Skoru düşen firmalar',alt:'Son '+LOOKBACK_SCORE_DAYS+' günde firma skoru en az '+MIN_SCORE_DROP+' puan geriledi.'},
  {key:'kronik',baslik:'Kronik program dışı çağrı',alt:'Son '+LOOKBACK_EXTRA_DAYS+' günde '+MIN_EXTRA_CALLS+' veya daha fazla plansız ziyaret — çözülmemiş sorun işareti.'},
  {key:'teknisyen',baslik:'Tamamlama oranı düşen teknisyenler',alt:'Son 4 hafta, önceki 4 haftaya göre en az '+MIN_RATE_DROP+' puan geriledi. İzinli haftalar sayılmaz.'}
];
function totalOf(w){return GROUPS.reduce(function(n,g){return n+w[g.key].length;},0);}
function criticalOf(w){return GROUPS.reduce(function(n,g){return n+w[g.key].filter(function(x){return x.kritik;}).length;},0);}

/* ── Görünüm ─────────────────────────────────────────────────── */
function rowHtml(w){
  /* Firma 360° yalnızca admin panelinde tanımlı; yoksa düz metin gösterilir. */
  /* Firma 360° yalnizca admin panelinde KURULUR: ops-v2.js fonksiyonu her
     rolde tanimlar ama modal elemanini yalnizca admin icin olusturur. Sadece
     fonksiyona bakmak teknisyende tiklanip hicbir sey acmayan olu bag uretiyordu. */
  var c360Hazir=(typeof global.openCompany360==='function')&&!!document.getElementById('company360Modal');
  var isim=(w.firmaId&&c360Hazir)
    ? '<button class="ops-link" onclick="ewOpenCompany(\''+esc(w.firmaId)+'\')">'+esc(w.ad)+'</button>'
    : '<b style="font-size:13px;color:#172033;">'+esc(w.ad)+'</b>';
  return '<div class="ops-pr-row">'
    +'<div class="ops-pr-main">'+isim+'<div class="ops-reason">'+esc(w.aciklama)+'</div></div>'
    +'<div class="ops-score '+(w.kritik?'danger':'warn')+'">'+esc(w.olcu)+'</div>'
    +'</div>';
}
function groupsHtml(w){
  var html='';
  GROUPS.forEach(function(g){
    var list=w[g.key];if(!list.length)return;
    html+='<div class="ops-card" style="margin-bottom:14px;"><div class="ops-card-hd"><div><h3>'+esc(g.baslik)+'</h3><p>'+esc(g.alt)+'</p></div>'
      +'<span class="ops-pill">'+list.length+'</span></div>'
      +'<div class="ops-priority-list">'+list.map(rowHtml).join('')+'</div></div>';
  });
  return html;
}
function scopeNote(scope){
  return scope.isAdmin
    ? 'Kapsam: <b>tüm firmalar ve teknisyenler</b>.'
    : 'Kapsam: <b>size atanmış firmalar</b> ('+esc((scope.tech&&scope.tech.code)||'')+').';
}

/* İstatistikler › Erken Uyarı sekmesi (admin) */
function renderEarlyWarning(){
  var host=document.getElementById('opsEarlyWarning');if(!host)return;
  var w=collectWarnings(),total=totalOf(w);
  var html='<div class="ops-card" style="margin-bottom:14px;"><div class="ops-card-hd"><div>'
    +'<h3>Durum Özeti</h3>'
    +'<p>Skor anlık durumu ölçer; burada durum iyi görünse bile <b>kötüye gidenler</b> listelenir. '+scopeNote(w.scope)+'</p>'
    +'</div><span class="ops-pill">'+total+' uyarı · '+criticalOf(w)+' kritik</span></div></div>';
  html+=total?groupsHtml(w)
    :'<div class="ops-card"><div class="ops-empty">Sapma bulunamadı — takip edilen dört ölçütte de kötüye giden bir eğilim yok.</div></div>';
  host.innerHTML=html;
}

/* Açılış ekranı / zil ile açılan pencere */
function ensureModal(){
  if(document.getElementById('earlyWarningModal'))return;
  document.body.insertAdjacentHTML('beforeend',
    '<div class="overlay hidden" id="earlyWarningModal"><div class="modal ew-modal">'
    +'<div class="modal-hd"><h2>⚠️ Erken Uyarı</h2><button class="modal-x" onclick="UI.closeModal(\'earlyWarningModal\')" aria-label="Kapat">×</button></div>'
    +'<div class="modal-body ew-body" id="ewModalBody"></div>'
    +'<div class="modal-ft"><button class="btn btn-primary" onclick="UI.closeModal(\'earlyWarningModal\')">Tamam</button></div>'
    +'</div></div>');
}
function openEarlyWarningModal(){
  ensureModal();
  var body=document.getElementById('ewModalBody');if(!body)return;
  var w=collectWarnings(),total=totalOf(w),kritik=criticalOf(w);
  var head='<div class="ew-scope"><b>'+total+' uyarı</b>'+(kritik?' · <b style="color:#c33434;">'+kritik+' kritik</b>':'')+' — '+scopeNote(w.scope)+'</div>';
  body.innerHTML=head+(total?groupsHtml(w)
    :'<div class="ops-card"><div class="ops-empty">Şu an bir sapma yok. Takip edilen dört ölçütte de kötüye giden eğilim görünmüyor.</div></div>');
  refreshBell();
  if(global.UI&&UI.openModal)UI.openModal('earlyWarningModal');
}

/* Kullanıcı adının yanındaki zil + sayaç */
function refreshBell(){
  var btn=document.getElementById('ewBell'),badge=document.getElementById('ewBellBadge');
  if(!btn||!badge)return 0;
  var n=0;
  try{n=totalOf(collectWarnings());}catch(e){return 0;}
  badge.textContent=n>99?'99+':String(n);
  badge.classList.toggle('hidden',n===0);
  btn.title=n?(n+' erken uyarı — görmek için tıklayın'):'Erken uyarı yok';
  return n;
}
/* Açılışta günde bir kez otomatik açılır; uyarı yoksa hiç açılmaz ki
   ekran boşuna kapatılmak zorunda kalınmasın. */
function autoOpenOnce(){
  var n=refreshBell();
  if(!n)return;
  var key='sd_ew_auto_'+new Date().toISOString().slice(0,10);
  try{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'1');}catch(e){}
  openEarlyWarningModal();
}
function init(){
  if(!global.SD||!global.DT||!global.BL)return;
  if(!document.getElementById('ewBell'))return;   /* yalnızca admin.html */
  ensureModal();
  autoOpenOnce();
  /* Uzak veri açılıştan sonra gelebilir; sayaç bir kez tazelenir. */
  setTimeout(function(){try{refreshBell();}catch(e){}},4000);
}
function boot(){setTimeout(init,900);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();

/* Firma 360° açılmadan ÖNCE uyarı penceresi kapatılır: ikisi de aynı
   z-index katmanında olduğu için üst üste binip mobilde okunamıyordu. */
global.ewOpenCompany=function(id){
  if(typeof global.openCompany360!=='function'||!document.getElementById('company360Modal'))return;
  if(global.UI&&UI.closeModal)UI.closeModal('earlyWarningModal');
  setTimeout(function(){openCompany360(id);},120);
};
global.renderEarlyWarning=renderEarlyWarning;
global.openEarlyWarningModal=openEarlyWarningModal;
global.refreshEarlyWarningBell=refreshBell;
global.collectEarlyWarnings=collectWarnings;
})(typeof window!=='undefined'?window:this);
