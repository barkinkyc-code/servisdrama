/* ================================================================
   ServisDrama Ops V2 — Firma 360, Akıllı Öncelik, Rota, Eskalasyon,
   Performans Skoru ve Denetim Geçmişi
   Geriye uyumlu: mevcut kayıt şemalarını değiştirmez.
   ================================================================ */
(function(){
'use strict';
var O={routeSelection:[],routeRows:[]};
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function fmtDate(d){if(!d)return'—';var x=d instanceof Date?d:new Date(d);if(isNaN(x))return'—';return String(x.getDate()).padStart(2,'0')+'.'+String(x.getMonth()+1).padStart(2,'0')+'.'+x.getFullYear();}
function parseAnyDate(v){if(!v)return null;if(v instanceof Date)return v;var n=Number(v);if(n>100000000000)return new Date(n);var s=String(v);var m=s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);if(m)return new Date(+m[3],+m[2]-1,+m[1]);m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);var d=new Date(s);return isNaN(d)?null:d;}
function companyIdFromVisitKey(k){return String(k).split(/[|_]/)[0];}
function visitsOf(c){var out=[];Object.entries(SD.visits||{}).forEach(function(x){if(companyIdFromVisitKey(x[0])!==String(c.id))return;var rec=x[1]||{};var es=SD.visitEntries?SD.visitEntries(rec):(rec.by||{});Object.keys(es||{}).forEach(function(code){var v=es[code]||{},d=parseAnyDate(v.ts||v.dateISO||v.date||v.dayKey);if(d)out.push(Object.assign({_kind:'visit',_date:d,_tech:code},v));});});(SD.extras||[]).forEach(function(v){if(String(v.firmaId||v.companyId)!==String(c.id))return;var d=parseAnyDate(v.ts||v.dateISO||v.date||v.dayKey);if(d)out.push(Object.assign({_kind:'extra',_date:d},v));});return out.sort(function(a,b){return b._date-a._date;});}
function lastVisit(c){var a=visitsOf(c);return a.length?a[0]:null;}
function daysSince(d){if(!d)return 999;return Math.max(0,Math.floor((Date.now()-d.getTime())/86400000));}
function samplesOf(c){return (SD.load('sd_samples',[])||[]).filter(function(s){return String(s.companyId||s.firmaId||s.company_id)===String(c.id);});}
function actionsOf(c){return (SD.load('sd_actions',[])||[]).filter(function(a){return String(a.companyId||a.firmaId)===String(c.id);});}
function isOpen(x){var s=String(x.status||'').toLowerCase();return !['done','completed','closed','cancelled','tamamlandı','kapalı','iptal'].includes(s);}
function currentWeekOfMonth(){var n=new Date(),first=new Date(n.getFullYear(),n.getMonth(),1),offset=(first.getDay()+6)%7;return Math.max(1,Math.min(4,Math.ceil((n.getDate()+offset)/7)));}
function priorityFor(c){var lv=lastVisit(c),age=lv?daysSince(lv._date):999,weeks=c.weeks||[1,2,3,4],planned=weeks.indexOf(currentWeekOfMonth())>=0,openS=samplesOf(c).filter(isOpen).length,openA=actionsOf(c).filter(isOpen).length,overA=actionsOf(c).filter(function(a){return isOpen(a)&&a.dueDate&&new Date(a.dueDate+'T23:59:59')<new Date();}).length,score=0,reasons=[];
  if(!lv){score+=40;reasons.push('ziyaret kaydı yok');}else if(age>90){score+=38;reasons.push(age+' gündür ziyaret yok');}else if(age>60){score+=28;reasons.push(age+' gündür ziyaret yok');}else if(age>30){score+=18;reasons.push(age+' gündür ziyaret yok');}else score+=Math.min(12,Math.floor(age/3));
  if(planned){score+=25;reasons.push('bu hafta planlı');}
  if(openS){score+=Math.min(15,openS*6);reasons.push(openS+' açık numune');}
  if(openA){score+=Math.min(12,openA*4);reasons.push(openA+' açık aksiyon');}
  if(overA){score+=Math.min(20,overA*10);reasons.push(overA+' gecikmiş aksiyon');}
  if(c.aktif===false)score=0;score=Math.min(100,score);return{score:score,reasons:reasons,planned:planned,age:age,openSamples:openS,openActions:openA};}
function priorityRows(){return (SD.companies||[]).filter(function(c){return c.aktif!==false;}).map(function(c){return{c:c,p:priorityFor(c)};}).sort(function(a,b){return b.p.score-a.p.score||a.c.name.localeCompare(b.c.name,'tr');});}
function hav(a,b){var R=6371,toRad=Math.PI/180,dlat=(b.lat-a.lat)*toRad,dlon=(b.lng-a.lng)*toRad,la1=a.lat*toRad,la2=b.lat*toRad,x=Math.sin(dlat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dlon/2)**2;return 2*R*Math.asin(Math.sqrt(x));}
function routeOrder(rows){if(!rows.length)return[];var left=rows.slice(),out=[left.shift()];while(left.length){var cur=out[out.length-1].c,best=0,dist=Infinity;left.forEach(function(r,i){var d=hav(cur,r.c);if(d<dist){dist=d;best=i;}});out.push(left.splice(best,1)[0]);}return out;}
function techName(code){var t=(SD.technicians||[]).find(function(x){return String(x.code)===String(code)||String(x.id)===String(code);});return t?t.code+' · '+t.name:(code||'—');}
/* Yalnızca role==='admin' olan oturum bu paneli görür — session() (enhancements.js)
   ile aynı okuma deseni, admin.js'e bağımlı olmadan kendi başına çalışır. */
function isAdminRole(){
  try{
    var sess=sessionStorage.getItem('sd_session')||localStorage.getItem('sd_session_persist');
    var s=JSON.parse(sess);
    return String((s&&s.userData&&s.userData.role)||'').toLowerCase()==='admin';
  }catch(e){return false;}
}
/* Saha Planı/Performans/Denetim artık bağımsız üst-menü sayfaları DEĞİL,
   İstatistikler sayfasının içindeki alt-sekmeler (bkz. admin.html #istatTabs,
   admin.js switchIstatTab). Yalnızca admin rolündeki kullanıcı için eklenir. */
function ensureUI(){
  if(!isAdminRole())return;
  if(document.getElementById('istatPanelSaha'))return;
  var tabs=document.getElementById('istatTabs');
  if(tabs)tabs.insertAdjacentHTML('beforeend','<button class="stab" data-istat-tab="saha">🧭 Saha Planı</button><button class="stab" data-istat-tab="performans">📈 Performans</button><button class="stab" data-istat-tab="denetim">🛡️ Denetim</button><button class="stab" data-istat-tab="uyari">⚠️ Erken Uyarı</button>');
  var istatPg=document.getElementById('pg-istatistik');
  if(istatPg)istatPg.insertAdjacentHTML('beforeend','<div class="istat-tab-panel hidden" id="istatPanelSaha"><div class="pg-hd"><div><h1 class="pg-title">Saha Planı</h1><div class="pg-sub">Akıllı ziyaret önceliği ve günlük rota</div></div></div><div id="opsPriority"></div></div><div class="istat-tab-panel hidden" id="istatPanelPerformans"><div class="pg-hd"><div><h1 class="pg-title">Personel Performansı</h1><div class="pg-sub">Ziyaret kapsamı, düzenlilik ve sonuç odaklı skor kartı</div></div></div><div id="opsPerformance"></div></div><div class="istat-tab-panel hidden" id="istatPanelUyari"><div class="pg-hd"><div><h1 class="pg-title">Erken Uyarı</h1><div class="pg-sub">Skorun göremediği sapmalar: kötüye giden firma ve teknisyenler</div></div></div><div id="opsEarlyWarning"></div></div><div class="istat-tab-panel hidden" id="istatPanelDenetim"><div class="pg-hd"><div><h1 class="pg-title">Değişiklik Geçmişi</h1><div class="pg-sub">Kim, ne zaman, hangi veri grubunda değişiklik yaptı</div></div></div><div id="opsAudit"></div></div>');
  document.body.insertAdjacentHTML('beforeend','<div class="overlay hidden" id="company360Modal"><div class="modal modal-lg ops-360-modal"><div class="modal-hd"><h2 id="c360Title">Firma 360°</h2><button class="modal-x" onclick="UI.closeModal(\'company360Modal\')">×</button></div><div class="modal-body" id="c360Body"></div></div></div>');
  window.onIstatTabShow=function(tab){if(tab==='saha')renderSaha();if(tab==='performans')renderPerformance();if(tab==='denetim')renderAudit();if(tab==='uyari'&&typeof renderEarlyWarning==='function')renderEarlyWarning();};
}
function renderSaha(){var rows=priorityRows(),host=document.getElementById('opsPriority');if(!host)return;var top=rows.slice(0,12);O.routeRows=top.filter(function(r){return Number(r.c.lat)&&Number(r.c.lng);});
  host.innerHTML='<div class="ops-grid"><section class="ops-card"><div class="ops-card-hd"><div><h3>Bugün Öncelikli Firmalar</h3><p>Skor; ziyaret gecikmesi, haftalık plan, açık numune ve aksiyonlardan hesaplanır.</p></div><span class="ops-pill">'+rows.length+' aktif firma</span></div><div class="ops-priority-list">'+top.map(function(r,i){return'<div class="ops-pr-row"><div class="ops-rank">'+(i+1)+'</div><div class="ops-pr-main"><button class="ops-link" onclick="openCompany360(\''+esc(r.c.id)+'\')">'+esc(r.c.name)+'</button><div class="ops-reason">'+esc(r.p.reasons.slice(0,3).join(' · ')||'normal takip')+'</div></div><div class="ops-score '+(r.p.score>=70?'danger':r.p.score>=45?'warn':'ok')+'">'+r.p.score+'</div></div>';}).join('')+'</div></section><section class="ops-card"><div class="ops-card-hd"><div><h3>Günlük Rota Önerisi</h3><p>Koordinatı kayıtlı öncelikli firmaları seçin; sistem yakınlığa göre sıralar.</p></div></div><div id="opsRouteBox"></div></section></div>';renderRouteBox();}
function renderRouteBox(){var h=document.getElementById('opsRouteBox');if(!h)return;var rows=O.routeRows;h.innerHTML=rows.length?'<div class="ops-route-select">'+rows.map(function(r){var checked=O.routeSelection.includes(String(r.c.id));return'<label><input type="checkbox" data-route-id="'+esc(r.c.id)+'" '+(checked?'checked':'')+'> <span>'+esc(r.c.name)+'</span><b>'+r.p.score+'</b></label>';}).join('')+'</div><div class="ops-route-actions"><button class="btn btn-primary" id="opsBuildRoute">Rotayı Oluştur</button><button class="btn btn-ghost" id="opsSelectTop">İlk 6’yı Seç</button></div><div id="opsRouteResult"></div>':'<div class="ops-empty">Öncelikli firmalarda kayıtlı koordinat bulunamadı. Firma kartından konum ekleyin.</div>';
  h.querySelectorAll('[data-route-id]').forEach(function(x){x.addEventListener('change',function(){var id=x.dataset.routeId;if(x.checked&&!O.routeSelection.includes(id))O.routeSelection.push(id);if(!x.checked)O.routeSelection=O.routeSelection.filter(function(v){return v!==id;});});});var b=document.getElementById('opsBuildRoute');if(b)b.onclick=buildRoute;var s=document.getElementById('opsSelectTop');if(s)s.onclick=function(){O.routeSelection=rows.slice(0,6).map(function(r){return String(r.c.id);});renderRouteBox();};}
function buildRoute(){var selected=O.routeRows.filter(function(r){return O.routeSelection.includes(String(r.c.id));});if(selected.length<2){UI.toast('Rota için en az 2 firma seçin.','error');return;}var ordered=routeOrder(selected),km=0;for(var i=1;i<ordered.length;i++)km+=hav(ordered[i-1].c,ordered[i].c);var way=ordered.map(function(r){return r.c.lat+','+r.c.lng;});var url='https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(way[0])+'&destination='+encodeURIComponent(way[way.length-1])+'&waypoints='+encodeURIComponent(way.slice(1,-1).join('|'))+'&travelmode=driving';document.getElementById('opsRouteResult').innerHTML='<div class="ops-route-result"><div class="ops-route-kpi"><b>'+ordered.length+'</b><span>durak</span></div><div class="ops-route-kpi"><b>'+km.toFixed(1)+' km</b><span>kuş uçuşu yaklaşık</span></div><ol>'+ordered.map(function(r){return'<li>'+esc(r.c.name)+'</li>';}).join('')+'</ol><a class="btn btn-primary" target="_blank" rel="noopener" href="'+url+'">Haritada Aç</a></div>';}
function renderPerformance(){var host=document.getElementById('opsPerformance');if(!host)return;var now=Date.now(),techs=(SD.technicians||[]).map(function(t){var assigned=(SD.companies||[]).filter(function(c){return c.aktif!==false&&String(c.techId)===String(t.id);});var seen30=new Set(),cnt30=0,cnt90=0;assigned.forEach(function(c){visitsOf(c).forEach(function(v){var age=(now-v._date.getTime())/86400000;if(age<=30){cnt30++;seen30.add(String(c.id));}if(age<=90)cnt90++;});});var coverage=assigned.length?Math.round(seen30.size/assigned.length*100):0;var cadence=Math.min(100,Math.round(cnt30/Math.max(1,assigned.length)*100));var stale=assigned.filter(function(c){var v=lastVisit(c);return !v||daysSince(v._date)>60;}).length;var score=Math.max(0,Math.min(100,Math.round(coverage*.55+cadence*.30+(100-(assigned.length?stale/assigned.length*100:0))*.15)));return{t:t,assigned:assigned.length,cnt30:cnt30,cnt90:cnt90,coverage:coverage,stale:stale,score:score};}).sort(function(a,b){return b.score-a.score;});
  host.innerHTML='<div class="ops-scorecards">'+techs.map(function(x){return'<div class="ops-perf-card"><div class="ops-perf-top"><div><div class="ops-tech-code">'+esc(x.t.code)+'</div><h3>'+esc(x.t.name)+'</h3></div><div class="ops-big-score '+(x.score>=80?'ok':x.score>=60?'warn':'danger')+'">'+x.score+'</div></div><div class="ops-metrics"><div><b>'+x.assigned+'</b><span>atanmış firma</span></div><div><b>'+x.cnt30+'</b><span>30 gün ziyaret</span></div><div><b>%'+x.coverage+'</b><span>30 gün kapsama</span></div><div><b>'+x.stale+'</b><span>60+ gün bekleyen</span></div></div><div class="ops-progress"><i style="width:'+x.score+'%"></i></div></div>';}).join('')+'</div><div class="ops-note">Skor = %55 firma kapsama + %30 ziyaret temposu + %15 gecikmeyen firma oranı. Ham ziyaret sayısı tek başına performans kabul edilmez.</div>';}
function renderAudit(){var host=document.getElementById('opsAudit');if(!host)return;var logs=SD.load('sd_audit',[])||[];host.innerHTML='<div class="ops-card"><div class="ops-card-hd"><div><h3>Son '+Math.min(logs.length,250)+' hareket</h3><p>Kayıtlar silme/değiştirme sorunlarını izlemek için tutulur.</p></div><button class="btn btn-ghost" id="auditExport">JSON İndir</button></div>'+(logs.length?'<div class="ops-audit-list">'+logs.slice(0,250).map(function(a){return'<div class="ops-audit-row"><div class="ops-audit-dot"></div><div><b>'+esc(a.action||'Veri güncellendi')+'</b><span>'+esc(a.user||'Sistem')+' · '+esc(a.role||'')+'</span></div><time>'+fmtDate(a.at)+' '+(new Date(a.at).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}))+'</time></div>';}).join('')+'</div>':'<div class="ops-empty">Henüz denetim kaydı yok. Bu sürümden sonraki değişiklikler burada görünecek.</div>')+'</div>';var btn=document.getElementById('auditExport');if(btn)btn.onclick=function(){var blob=new Blob([JSON.stringify(logs,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='servisdrama-denetim-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);};}
/* Firma skorunun NEDEN bu seviyede olduğunu ve ne yapılması gerektiğini kısa
   bir cümleyle söyler. Skor motoru weekly-report-data.js'te; burada yeniden
   hesaplanmaz, yalnızca yorumlanır — rapor, erken uyarı ve bu kart aynı
   modeli paylaşır. */
function scoreAdvice(c){
  if(typeof window.weeklyScoreDetail!=='function')return null;
  var now=new Date();now.setHours(23,59,59,999);
  var past=new Date(now.getTime()-60*86400000);
  var sd=window.weeklyScoreDetail(c,now);
  if(!sd||sd.score==null)return null;
  var sp=window.weeklyScoreDetail(c,past);
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
  return {score:sd.score,drop:drop,tespit:tespit,oneri:oneri,lowData:!!q.lowData};
}
window.openCompany360=function(id){var c=(SD.companies||[]).find(function(x){return String(x.id)===String(id);});if(!c)return;var vs=visitsOf(c),ss=samplesOf(c),aa=actionsOf(c),lv=vs[0],p=priorityFor(c),tech=(SD.technicians||[]).find(function(t){return String(t.id)===String(c.techId);}),sales=(SD.load('sd_st',[])||[]).find(function(s){return String(s.id)===String(c.salesRepId);});var timeline=[];vs.slice(0,4).forEach(function(v){timeline.push({d:v._date,t:v._kind==='extra'?'Program Dışı Ziyaret':'Ziyaret',x:techName(v._tech||v.by||v.techCode)});});ss.forEach(function(s){timeline.push({d:parseAnyDate(s.createdAt||s.date||s.ts),t:'Numune',x:s.title||s.sampleNo||s.status||'Numune kaydı'});});aa.forEach(function(a){timeline.push({d:parseAnyDate(a.createdAt),t:'Aksiyon',x:(a.status==='done'?'✓ ':'')+(a.title||a.description||'Aksiyon')});});timeline=timeline.filter(function(x){return x.d;}).sort(function(a,b){return b.d-a.d;}).slice(0,40);
  var adv=scoreAdvice(c);
var advHtml=adv
  ?('<div class="c360-reasons"><b>Skor Yorumu</b><span>Firma skoru <b>'+adv.score+'/100</b>'
    +(adv.drop>0?' \u00b7 son 60 g\u00fcnde '+adv.drop+' puan d\u00fc\u015ft\u00fc':'')
    +(adv.tespit.length?' \u2014 '+esc(adv.tespit.join(', ')):'')
    +(adv.lowData?' \u00b7 az veri, skor ge\u00e7ici':'')
    +'<br><b>\u00d6neri:</b> '+esc(adv.oneri)+'</span></div>')
  :('<div class="c360-reasons"><b>Ak\u0131ll\u0131 \u00d6ncelik Nedeni</b><span>'+esc(p.reasons.join(' \u00b7 ')||'Normal takip')+'</span></div>');
document.getElementById('c360Title').textContent=c.name+' · 360°';document.getElementById('c360Body').innerHTML='<div class="c360-kpis"><div><span>Öncelik</span><b class="'+(p.score>=70?'danger-txt':p.score>=45?'warn-txt':'ok-txt')+'">'+p.score+'/100</b></div><div><span>Son Ziyaret</span><b>'+fmtDate(lv&&lv._date)+'</b></div></div><div class="c360-info"><div><span>Teknisyen</span><b>'+esc(tech?tech.code+' · '+tech.name:'Atanmamış')+'</b></div><div><span>Periyot</span><b>'+esc((c.weeks||[]).map(function(w){return w+'. hafta';}).join(', ')||'—')+'</b></div></div>'+advHtml+'<h3 class="c360-title">Firma Zaman Çizgisi</h3>'+(timeline.length?'<div class="c360-timeline">'+timeline.map(function(e){return'<div><i></i><time>'+fmtDate(e.d)+'</time><b>'+esc(e.t)+'</b><span>'+esc(e.x)+'</span></div>';}).join('')+'</div>':'<div class="ops-empty">Bu firma için geçmiş hareket bulunamadı.</div>');UI.openModal('company360Modal');};
function patchCompanyCards(){document.querySelectorAll('.co-card[data-company-id]').forEach(function(card){var acts=card.querySelector('.co-acts');if(!acts||acts.querySelector('.ops-360-btn'))return;var id=card.dataset.companyId,b=document.createElement('button');b.className='btn-icon ops-360-btn';b.title='Firma 360°';b.textContent='360°';b.onclick=function(e){e.stopPropagation();openCompany360(id);};acts.insertBefore(b,acts.firstChild);});}
function boot(){ensureUI();var old=window.renderFirma;if(typeof old==='function'&&!old.__opsWrapped){var wrap=function(){var r=old.apply(this,arguments);setTimeout(patchCompanyCards,0);return r;};wrap.__opsWrapped=true;window.renderFirma=wrap;}patchCompanyCards();try{SD.generateNotifications();}catch(e){console.warn('Ops notifications',e);}setInterval(function(){try{SD.generateNotifications();}catch(e){}},15*60*1000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,50);});else setTimeout(boot,50);
})();
