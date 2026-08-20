/* ================================================================
   Firma 360° — TÜM panellerin ORTAK firma kartı
   ----------------------------------------------------------------
   Kart eskiden ops-v2.js içindeydi. ops-v2.js yalnız admin.html'de
   yüklenir ve yüklendiğinde bildirim üretip sunucuya yazar; satışçı
   paneline olduğu gibi eklenemiyordu. Kart bu yüzden yan etkisiz
   ayrı bir dosyaya alındı: admin, teknisyen ve satışçı aynı kartı,
   aynı skoru ve aynı durum etiketini görür.

   Skor motoru burada DEĞİL, weekly-report-data.js'te (weeklyScoreDetail).
   Bu dosya yalnız yorumlar. weekly-report-data.js yüklü değilse kart
   yine açılır, skor bölümü "akıllı öncelik" nedenlerine düşer.
   ================================================================ */
(function(global){
'use strict';

/* ── küçük yardımcılar ─────────────────────────────────────────── */
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function fmtDate(d){if(!d)return'—';var x=d instanceof Date?d:new Date(d);if(isNaN(x))return'—';return String(x.getDate()).padStart(2,'0')+'.'+String(x.getMonth()+1).padStart(2,'0')+'.'+x.getFullYear();}
function parseAnyDate(v){if(!v)return null;if(v instanceof Date)return isNaN(v)?null:v;var n=Number(v);if(n>100000000000)return new Date(n);var s=String(v);var m=s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);if(m)return new Date(+m[3],+m[2]-1,+m[1]);m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);var d=new Date(s);return isNaN(d)?null:d;}
function mondayOf(d){if(global.DT&&DT.monday)return DT.monday(d);var x=new Date(d);x.setDate(x.getDate()-((x.getDay()+6)%7));x.setHours(0,0,0,0);return x;}
function companyIdFromVisitKey(k){return String(k).split(/[|_]/)[0];}

/* Ziyaret kaydı üç şemada da tutulabiliyor: {by:{kod:...}}, {tc:...} ya da
   düz kaydın kendisi. Üçü de okunur, yoksa ziyaretler sessizce kaybolur. */
function visitEntriesOf(rec){
  if(!rec)return{};
  if(SD.visitEntries){try{return SD.visitEntries(rec)||{};}catch(e){}}
  if(rec.by&&typeof rec.by==='object')return rec.by;
  if(rec.tc){var o={};o[rec.tc]=rec;return o;}
  return{};
}
function visitsOf(c){
  var out=[];
  Object.keys(SD.visits||{}).forEach(function(k){
    if(companyIdFromVisitKey(k)!==String(c.id))return;
    var es=visitEntriesOf((SD.visits||{})[k]);
    Object.keys(es).forEach(function(code){
      var v=es[code]||{},d=parseAnyDate(v.ts||v.dateISO||v.date||v.dayKey);
      if(d)out.push(Object.assign({_kind:'visit',_date:d,_tech:v.tc||code},v));
    });
  });
  (SD.extras||[]).forEach(function(v){
    if(String(v.firmaId||v.companyId)!==String(c.id))return;
    var d=parseAnyDate(v.ts||v.dateISO||v.date||v.dayKey);
    if(d)out.push(Object.assign({_kind:'extra',_date:d},v));
  });
  return out.sort(function(a,b){return b._date-a._date;});
}
function lastVisit(c){var a=visitsOf(c);return a.length?a[0]:null;}
function daysSince(d){if(!d)return 999;return Math.max(0,Math.floor((Date.now()-d.getTime())/86400000));}
function samplesOf(c){return (SD.load('sd_samples',[])||[]).filter(function(s){return String(s.companyId||s.firmaId||s.company_id||'')===String(c.id);});}
function actionsOf(c){return (SD.load('sd_actions',[])||[]).filter(function(a){return String(a.companyId||a.firmaId||'')===String(c.id);});}
function isOpen(x){var s=String(x.status||'').toLowerCase();return ['done','completed','closed','cancelled','tamamlandı','kapalı','iptal'].indexOf(s)<0;}
/* Numunenin açıklığı skor motoruyla AYNI kuralla ölçülür (weekly-report-data.js):
   durum metni status/durum/sonuc alanlarından herhangi birinde olabiliyor. Kart
   ile skorun farklı sayı göstermemesi için tek kural. */
function sampleOpen(s){return !/(kapandı|kapandi|iptal|sonuç geldi|sonuc geldi|tamamlandı|tamamlandi)/i.test(String(s.status||s.durum||s.sonuc||''));}
function techName(code){var t=(SD.technicians||[]).find(function(x){return String(x.code)===String(code)||String(x.id)===String(code);});return t?t.code+' · '+t.name:(code||'—');}
function companyById(id){return (SD.companies||[]).find(function(x){return String(x.id)===String(id);})||null;}

/* Firmanın kendi planına göre iki ziyaret arası beklenen hafta (weekly-report-data
   ile aynı formül): [1,2,3,4]→her hafta, [1,3]→2 haftada bir, [2]→4 haftada bir. */
function cadenceWeeks(c){var n=(c&&c.weeks&&c.weeks.length)?c.weeks.length:4;return Math.max(1,Math.min(4,Math.round(4/n)));}
function currentWeekOfMonth(){var n=new Date(),first=new Date(n.getFullYear(),n.getMonth(),1),offset=(first.getDay()+6)%7;return Math.max(1,Math.min(4,Math.ceil((n.getDate()+offset)/7)));}
function plannedThisWeek(c){var w=(c&&c.weeks&&c.weeks.length)?c.weeks:[1,2,3,4];return w.indexOf(currentWeekOfMonth())>=0;}

/* ── skor: tek kaynak weekly-report-data.js ────────────────────── */
function scoreDetail(c){
  if(typeof global.weeklyScoreDetail!=='function')return null;
  var now=new Date();now.setHours(23,59,59,999);
  var sd=global.weeklyScoreDetail(c,now);
  return (sd&&sd.score!=null)?sd:null;
}
function grade(score){
  if(typeof global.weeklyReportGrade==='function')return global.weeklyReportGrade(score);
  if(score==null)return{g:'-',label:'Kayıt yok',color:'#94A3B8'};
  return score>=80?{g:'A',label:'Sağlıklı',color:'#46A758'}
    :score>=60?{g:'B',label:'Takip',color:'#F58220'}
    :score>=40?{g:'C',label:'Riskli',color:'#EA580C'}
    :{g:'D',label:'Kritik',color:'#DC2626'};
}
function scoreClass(score){return score==null?'warn':score>=80?'ok':score>=60?'warn':'danger';}
/* "Kaç gün önce" tek yerden gelir. Skor motoru günü gün SONUNA göre sayar,
   çıplak Date.now() farkı ise şu ana göre; ikisi karışınca kart "40 gün önce"
   derken hemen altındaki skor yorumu "41 gün" diyordu. Skor varsa onun sayısı
   kullanılır. */
function gunFarki(c,lv){
  var sd=scoreDetail(c),q=sd&&sd.parts;
  if(q&&q.daysSince!=null)return q.daysSince;
  return lv?daysSince(lv._date):null;
}

/* Skorun NEDEN bu seviyede olduğunu ve ne yapılması gerektiğini tek cümleyle
   söyler. Hesap yapmaz, yalnızca scoreDetail çıktısını yorumlar. */
function scoreAdvice(c){
  var sd=scoreDetail(c);
  if(!sd)return null;
  var now=new Date();now.setHours(23,59,59,999);
  var past=new Date(now.getTime()-60*86400000);
  var sp=global.weeklyScoreDetail(c,past);
  var q=sd.parts||{},drop=(sp&&sp.score!=null)?sp.score-sd.score:null;
  var tespit=[],oneri='';
  if(q.neverVisited){
    tespit.push('hiç ziyaret kaydı yok');
    oneri='İlk ziyareti planlayın; skor ancak ilk ziyaretten sonra oluşmaya başlar.';
  }else{
    if(q.missed>0)tespit.push(q.expected+' planlı haftanın '+q.missed+' tanesi kaçırıldı');
    if(q.overdue)tespit.push('son ziyaretin üzerinden '+q.daysSince+' gün geçti (plan '+q.planDays+' gün)');
    if(q.leaveDays)tespit.push(q.leaveDays+' günlük teknisyen izni skordan zaten düşüldü');
    (q.penalties||[]).forEach(function(x){tespit.push(String(x).toLocaleLowerCase('tr'));});
    if(q.overdue)oneri='Bu hafta bir ziyaret planlayın — gecikme kapanmadan skor toparlamaz.';
    else if(q.missed>0)oneri='Planlı haftalarda aksatmadan gidilirse uyum puanı kendini toparlar.';
    else if((q.penalties||[]).length)oneri='Açık kayıtları kapatmak skoru doğrudan yükseltir.';
    else oneri='Tempo yerinde; mevcut ziyaret düzenini koruyun.';
  }
  return{score:sd.score,drop:drop,tespit:tespit,oneri:oneri,lowData:!!q.lowData};
}

/* ── durum etiketi: liste kartı da 360 kartı da bunu kullanır ──────
   Dört hal yeter: gidildi / gidilecek / gecikmiş / planında. Daha fazlası
   (riskli, kritik, plan dışı…) sahada aynı aksiyona çıkıyor ve listeyi
   okunmaz hale getiriyordu. */
var DURUM={
  gidildi     :{key:'gidildi'  ,label:'Bu Hafta Gidildi'  ,cls:'green'},
  gidilecek   :{key:'gidilecek',label:'Bu Hafta Gidilecek',cls:'blue' },
  gecikmis    :{key:'gecikmis' ,label:'Gecikmiş'          ,cls:'red'  },
  hicgidilmedi:{key:'gecikmis' ,label:'Hiç Gidilmedi'     ,cls:'red'  },
  planinda    :{key:'planinda' ,label:'Planında'          ,cls:'gray' }
};
function durum(c){
  var lv=lastVisit(c);
  if(lv&&lv._date>=mondayOf(new Date()))return DURUM.gidildi;
  var sd=scoreDetail(c),q=sd&&sd.parts;
  var gecikti=q?(q.neverVisited||q.overdue):(!lv||daysSince(lv._date)>cadenceWeeks(c)*7);
  if(gecikti)return lv?DURUM.gecikmis:DURUM.hicgidilmedi;
  if(plannedThisWeek(c))return DURUM.gidilecek;
  return DURUM.planinda;
}

/* Akıllı öncelik: rota/sıralama için (admin Saha Planı). Skorun tersi değildir —
   "bugün kime gidilmeli" sorusunu cevaplar. */
function priorityFor(c){
  var lv=lastVisit(c),age=lv?daysSince(lv._date):999,planned=plannedThisWeek(c),
    openS=samplesOf(c).filter(sampleOpen).length,
    openA=actionsOf(c).filter(isOpen).length,
    overA=actionsOf(c).filter(function(a){return isOpen(a)&&a.dueDate&&new Date(a.dueDate+'T23:59:59')<new Date();}).length,
    score=0,reasons=[];
  if(!lv){score+=40;reasons.push('ziyaret kaydı yok');}
  else if(age>90){score+=38;reasons.push(age+' gündür ziyaret yok');}
  else if(age>60){score+=28;reasons.push(age+' gündür ziyaret yok');}
  else if(age>30){score+=18;reasons.push(age+' gündür ziyaret yok');}
  else score+=Math.min(12,Math.floor(age/3));
  if(planned){score+=25;reasons.push('bu hafta planlı');}
  if(openS){score+=Math.min(15,openS*6);reasons.push(openS+' açık numune');}
  if(openA){score+=Math.min(12,openA*4);reasons.push(openA+' açık aksiyon');}
  if(overA){score+=Math.min(20,overA*10);reasons.push(overA+' gecikmiş aksiyon');}
  if(c.aktif===false)score=0;
  return{score:Math.min(100,score),reasons:reasons,planned:planned,age:age,openSamples:openS,openActions:openA};
}

/* Liste kartlarının tek satırlık "neden" metni: kart açılmadan da ne olduğu
   anlaşılsın diye. Uzun cümle değil, en fazla iki kırılım. */
function ozet(c){
  var lv=lastVisit(c),openS=samplesOf(c).filter(sampleOpen).length,bits=[];
  bits.push(lv?(gunFarki(c,lv)+' gün önce · '+techName(lv._tech||lv.tc||lv.techCode)):'Ziyaret kaydı yok');
  if(openS)bits.push(openS+' açık numune');
  return bits.join(' · ');
}

/* ── kart ──────────────────────────────────────────────────────── */
function ensureCompany360(){
  if(document.getElementById('company360Modal'))return;
  document.body.insertAdjacentHTML('beforeend',
    '<div class="overlay hidden" id="company360Modal"><div class="modal modal-lg ops-360-modal">'
   +'<div class="modal-hd"><h2 id="c360Title">Firma 360°</h2>'
   +'<button class="modal-x" onclick="UI.closeModal(\'company360Modal\')">×</button></div>'
   +'<div class="modal-body" id="c360Body"></div></div></div>');
  var ov=document.getElementById('company360Modal');
  /* Karartıya tıklayınca kapanır; kartın içine tıklamak kapatmaz. */
  ov.addEventListener('click',function(e){if(e.target===ov)UI.closeModal('company360Modal');});
}

function cardHTML(c){
  var vs=visitsOf(c),ss=samplesOf(c),aa=actionsOf(c),lv=vs[0],d=durum(c),
    tech=(SD.technicians||[]).find(function(t){return String(t.id)===String(c.techId);}),
    sd=scoreDetail(c),skor=sd?sd.score:null,g=grade(skor),openS=ss.filter(sampleOpen).length;

  /* Zaman çizgisi 4 ziyaretle sınırlı: kart "son durum" kartıdır, ziyaret
     arşivi değil. Numune ve aksiyonlar tarihine göre araya karışır. */
  var timeline=[];
  vs.slice(0,4).forEach(function(v){timeline.push({d:v._date,t:v._kind==='extra'?'Program Dışı Ziyaret':'Ziyaret',x:techName(v._tech||v.tc||v.techCode)});});
  ss.forEach(function(s){timeline.push({d:parseAnyDate(s.createdAt||s.date||s.tarih||s.ts),t:'Numune',x:s.title||s.sampleNo||s.lab||s.status||'Numune kaydı'});});
  aa.forEach(function(a){timeline.push({d:parseAnyDate(a.createdAt),t:'Aksiyon',x:(a.status==='done'?'✓ ':'')+(a.title||a.description||'Aksiyon')});});
  timeline=timeline.filter(function(x){return x.d;}).sort(function(a,b){return b.d-a.d;}).slice(0,40);

  var adv=scoreAdvice(c),p=adv?null:priorityFor(c);
  var advHtml=adv
    ?('<div class="c360-reasons"><b>Skor Yorumu</b><span>Firma skoru <b>'+adv.score+'/100</b>'
      +(adv.drop>0?' · son 60 günde '+adv.drop+' puan düştü':'')
      +(adv.tespit.length?' — '+esc(adv.tespit.join(', ')):'')
      +(adv.lowData?' · az veri, skor geçici':'')
      +'<br><b>Öneri:</b> '+esc(adv.oneri)+'</span></div>')
    :('<div class="c360-reasons"><b>Akıllı Öncelik Nedeni</b><span>'+esc(p.reasons.join(' · ')||'Normal takip')+'</span></div>');

  return '<div class="c360-kpis">'
      +'<div><span>Firma Skoru</span><b class="'+scoreClass(skor)+'-txt">'
        +(skor==null?'—':skor)+'<small>'+(skor==null?'skor motoru yok':'/100 · '+esc(g.label))+'</small></b></div>'
      +'<div><span>Son Ziyaret</span><b>'+fmtDate(lv&&lv._date)+'<small>'+(lv?gunFarki(c,lv)+' gün önce':'kayıt yok')+'</small></b></div>'
    +'</div>'
    +'<div class="c360-info">'
      +'<div><span>Durum</span><b class="c360-durum d-'+d.cls+'">'+esc(d.label)+'</b></div>'
      +'<div><span>Açık Numune</span><b>'+openS+'</b></div>'
      +'<div><span>Teknisyen</span><b>'+esc(tech?tech.code+' · '+tech.name:'Atanmamış')+'</b></div>'
      +'<div><span>Periyot</span><b>'+esc((c.weeks||[]).map(function(w){return w+'. hafta';}).join(', ')||'—')+'</b></div>'
    +'</div>'
    +advHtml
    +'<h3 class="c360-title">Firma Zaman Çizgisi</h3>'
    +(timeline.length
      ?'<div class="c360-timeline">'+timeline.map(function(e){return'<div><i></i><time>'+fmtDate(e.d)+'</time><b>'+esc(e.t)+'</b><span>'+esc(e.x)+'</span></div>';}).join('')+'</div>'
      :'<div class="ops-empty">Bu firma için geçmiş hareket bulunamadı.</div>');
}

global.openCompany360=function(id){
  var c=companyById(id);
  if(!c)return;
  ensureCompany360();
  document.getElementById('c360Title').textContent=c.name+' · 360°';
  document.getElementById('c360Body').innerHTML=cardHTML(c);
  UI.openModal('company360Modal');
};
global.ensureCompany360=ensureCompany360;

/* ops-v2.js ve satışçı paneli aynı hesapları yeniden yazmasın diye dışa açılır. */
global.C360={
  esc:esc,fmtDate:fmtDate,parseAnyDate:parseAnyDate,mondayOf:mondayOf,
  visitsOf:visitsOf,lastVisit:lastVisit,daysSince:daysSince,
  samplesOf:samplesOf,actionsOf:actionsOf,isOpen:isOpen,sampleOpen:sampleOpen,
  techName:techName,companyById:companyById,cadenceWeeks:cadenceWeeks,
  currentWeekOfMonth:currentWeekOfMonth,plannedThisWeek:plannedThisWeek,
  scoreDetail:scoreDetail,grade:grade,scoreClass:scoreClass,scoreAdvice:scoreAdvice,gunFarki:gunFarki,
  durum:durum,priorityFor:priorityFor,ozet:ozet,cardHTML:cardHTML
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureCompany360);
else ensureCompany360();
})(window);
