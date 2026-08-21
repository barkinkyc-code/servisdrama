/* ================================================================
   ServisDrama Ops V2 — Firma 360, Akıllı Öncelik, Rota, Eskalasyon,
   Performans Skoru ve Denetim Geçmişi
   Geriye uyumlu: mevcut kayıt şemalarını değiştirmez.
   ================================================================ */
(function(){
'use strict';
var O={routeSelection:[],routeRows:[]};
/* Ortak hesaplar company-360.js'te (admin, teknisyen ve satışçı panelleri aynı
   dosyayı yükler). Burada yalnızca referans alınır — ikinci bir kopya tutulursa
   Saha Planı ile Firma 360° kartı farklı sayı gösterir. */
var C=window.C360||{};
var esc=C.esc,fmtDate=C.fmtDate,visitsOf=C.visitsOf,lastVisit=C.lastVisit,
    daysSince=C.daysSince,priorityFor=C.priorityFor,ensureCompany360=window.ensureCompany360;
function priorityRows(){return (SD.companies||[]).filter(function(c){return c.aktif!==false;}).map(function(c){return{c:c,p:priorityFor(c)};}).sort(function(a,b){return b.p.score-a.p.score||a.c.name.localeCompare(b.c.name,'tr');});}
function hav(a,b){var R=6371,toRad=Math.PI/180,dlat=(b.lat-a.lat)*toRad,dlon=(b.lng-a.lng)*toRad,la1=a.lat*toRad,la2=b.lat*toRad,x=Math.sin(dlat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dlon/2)**2;return 2*R*Math.asin(Math.sqrt(x));}
function routeOrder(rows){if(!rows.length)return[];var left=rows.slice(),out=[left.shift()];while(left.length){var cur=out[out.length-1].c,best=0,dist=Infinity;left.forEach(function(r,i){var d=hav(cur,r.c);if(d<dist){dist=d;best=i;}});out.push(left.splice(best,1)[0]);}return out;}
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
  ensureCompany360();
  if(!isAdminRole())return;
  if(document.getElementById('istatPanelSaha'))return;
  var tabs=document.getElementById('istatTabs');
  if(tabs)tabs.insertAdjacentHTML('beforeend','<button class="stab" data-istat-tab="saha">🧭 Saha Planı</button><button class="stab" data-istat-tab="performans">📈 Performans</button><button class="stab" data-istat-tab="talepler">🔔 Ziyaret Talepleri</button><button class="stab" data-istat-tab="denetim">🛡️ Denetim</button><button class="stab" data-istat-tab="uyari">⚠️ Erken Uyarı</button>');
  var istatPg=document.getElementById('pg-istatistik');
  if(istatPg)istatPg.insertAdjacentHTML('beforeend','<div class="istat-tab-panel hidden" id="istatPanelSaha"><div class="pg-hd"><div><h1 class="pg-title">Saha Planı</h1><div class="pg-sub">Akıllı ziyaret önceliği ve günlük rota</div></div></div><div id="opsPriority"></div></div><div class="istat-tab-panel hidden" id="istatPanelPerformans"><div class="pg-hd"><div><h1 class="pg-title">Personel Performansı</h1><div class="pg-sub">Ziyaret kapsamı, düzenlilik ve sonuç odaklı skor kartı</div></div></div><div id="opsPerformance"></div></div><div class="istat-tab-panel hidden" id="istatPanelTalepler"><div class="pg-hd"><div><h1 class="pg-title">Ziyaret Talepleri</h1><div class="pg-sub">Satışçıların teknik servisten istediği ziyaretler ve durumları</div></div></div><div id="opsVisitRequests"></div></div><div class="istat-tab-panel hidden" id="istatPanelUyari"><div class="pg-hd"><div><h1 class="pg-title">Erken Uyarı</h1><div class="pg-sub">Skorun göremediği sapmalar: kötüye giden firma ve teknisyenler</div></div></div><div id="opsEarlyWarning"></div></div><div class="istat-tab-panel hidden" id="istatPanelDenetim"><div class="pg-hd"><div><h1 class="pg-title">Değişiklik Geçmişi</h1><div class="pg-sub">Kim, ne zaman, hangi veri grubunda değişiklik yaptı</div></div></div><div id="opsAudit"></div></div>');
  window.onIstatTabShow=function(tab){if(tab==='saha')renderSaha();if(tab==='talepler')renderVisitRequests();if(tab==='performans')renderPerformance();if(tab==='denetim')renderAudit();if(tab==='uyari'&&typeof renderEarlyWarning==='function')renderEarlyWarning();};
}
/* Ziyaret Talepleri (admin) — satışçının açtığı, teknisyene bildirim düşen
   talepler tek listede. Kayıtlar sunucudan (sd_visit_requests) gelir; buradan
   yalnızca okunur, durum değişikliği firmanın 360° kartından yapılır. */
function renderVisitRequests(){
  var host=document.getElementById('opsVisitRequests');if(!host)return;
  var rows=(SD.load('sd_visit_requests',[])||[]).slice()
    .sort(function(a,b){return String(b.createdAt||'').localeCompare(String(a.createdAt||''));});
  var meta=(C.VR_META||{});
  var acik=rows.filter(function(r){return r.status==='open';}).length,
      plan=rows.filter(function(r){return r.status==='planned';}).length;
  host.innerHTML='<div class="ops-card"><div class="ops-card-hd"><div><h3>Ziyaret Talepleri</h3>'
    +'<p>Satışçı talep açtığında firmanın atanmış teknisyenine otomatik bildirim gider.</p></div>'
    +'<span class="ops-pill">'+acik+' bekleyen · '+plan+' planlandı</span></div>'
    +(rows.length
      ?'<div class="vr-list">'+rows.map(function(r){
          var m=meta[r.status]||{lbl:r.status,ico:'•',cls:'open'};
          var ikon=(typeof window.SDIcon==='function')?SDIcon(m.ico||'dot'):'';
          return'<div class="vr-row"><div class="vr-ico">'+ikon+'</div>'
            +'<div class="vr-main"><b><button class="ops-link" onclick="openCompany360(\''+esc(r.companyId)+'\')">'+esc(r.companyName||r.companyId)+'</button></b>'
            +'<span>'+esc(r.salesRepName||'Satışçı')+' istedi · '+fmtDate(r.createdAt)
            +' → '+esc((r.techCode?r.techCode+' · ':'')+(r.techName||'teknisyen yok'))
            +(r.urgency==='high'?' · ACİL':'')
            +(r.reason?' · '+esc(r.reason):'')+'</span></div>'
            +'<span class="vr-tag '+esc(r.status)+'">'+esc(m.lbl||r.status)+'</span></div>';
        }).join('')+'</div>'
      :'<div class="ops-empty">Henüz ziyaret talebi yok. Satışçılar firma kartından talep açtığında burada görünür.</div>')
    +'</div>';
}
/* 360° kartından durum değiştirildiğinde liste açıksa anında tazelensin
   (company-360.js bu kancayı çağırır). */
window.onVisitRequestChange=function(){
  var p=document.getElementById('istatPanelTalepler');
  if(p&&!p.classList.contains('hidden'))renderVisitRequests();
};
function renderSaha(){var rows=priorityRows(),host=document.getElementById('opsPriority');if(!host)return;var top=rows.slice(0,12);O.routeRows=top.filter(function(r){return Number(r.c.lat)&&Number(r.c.lng);});
  host.innerHTML='<div class="ops-grid"><section class="ops-card"><div class="ops-card-hd"><div><h3>Bugün Öncelikli Firmalar</h3><p>Skor; ziyaret gecikmesi, haftalık plan, açık numune ve aksiyonlardan hesaplanır.</p></div><span class="ops-pill">'+rows.length+' aktif firma</span></div><div class="ops-priority-list">'+top.map(function(r,i){return'<div class="ops-pr-row"><div class="ops-rank">'+(i+1)+'</div><div class="ops-pr-main"><button class="ops-link" onclick="openCompany360(\''+esc(r.c.id)+'\')">'+esc(r.c.name)+'</button><div class="ops-reason">'+esc(r.p.reasons.slice(0,3).join(' · ')||'normal takip')+'</div></div><div class="ops-score '+(r.p.score>=70?'danger':r.p.score>=45?'warn':'ok')+'">'+r.p.score+'</div></div>';}).join('')+'</div></section><section class="ops-card"><div class="ops-card-hd"><div><h3>Günlük Rota Önerisi</h3><p>Koordinatı kayıtlı öncelikli firmaları seçin; sistem yakınlığa göre sıralar.</p></div></div><div id="opsRouteBox"></div></section></div>';renderRouteBox();}
function renderRouteBox(){var h=document.getElementById('opsRouteBox');if(!h)return;var rows=O.routeRows;h.innerHTML=rows.length?'<div class="ops-route-select">'+rows.map(function(r){var checked=O.routeSelection.includes(String(r.c.id));return'<label><input type="checkbox" data-route-id="'+esc(r.c.id)+'" '+(checked?'checked':'')+'> <span>'+esc(r.c.name)+'</span><b>'+r.p.score+'</b></label>';}).join('')+'</div><div class="ops-route-actions"><button class="btn btn-primary" id="opsBuildRoute">Rotayı Oluştur</button><button class="btn btn-ghost" id="opsSelectTop">İlk 6’yı Seç</button></div><div id="opsRouteResult"></div>':'<div class="ops-empty">Öncelikli firmalarda kayıtlı koordinat bulunamadı. Firma kartından konum ekleyin.</div>';
  h.querySelectorAll('[data-route-id]').forEach(function(x){x.addEventListener('change',function(){var id=x.dataset.routeId;if(x.checked&&!O.routeSelection.includes(id))O.routeSelection.push(id);if(!x.checked)O.routeSelection=O.routeSelection.filter(function(v){return v!==id;});});});var b=document.getElementById('opsBuildRoute');if(b)b.onclick=buildRoute;var s=document.getElementById('opsSelectTop');if(s)s.onclick=function(){O.routeSelection=rows.slice(0,6).map(function(r){return String(r.c.id);});renderRouteBox();};}
function buildRoute(){var selected=O.routeRows.filter(function(r){return O.routeSelection.includes(String(r.c.id));});if(selected.length<2){UI.toast('Rota için en az 2 firma seçin.','error');return;}var ordered=routeOrder(selected),km=0;for(var i=1;i<ordered.length;i++)km+=hav(ordered[i-1].c,ordered[i].c);var way=ordered.map(function(r){return r.c.lat+','+r.c.lng;});var url='https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(way[0])+'&destination='+encodeURIComponent(way[way.length-1])+'&waypoints='+encodeURIComponent(way.slice(1,-1).join('|'))+'&travelmode=driving';document.getElementById('opsRouteResult').innerHTML='<div class="ops-route-result"><div class="ops-route-kpi"><b>'+ordered.length+'</b><span>durak</span></div><div class="ops-route-kpi"><b>'+km.toFixed(1)+' km</b><span>kuş uçuşu yaklaşık</span></div><ol>'+ordered.map(function(r){return'<li>'+esc(r.c.name)+'</li>';}).join('')+'</ol><a class="btn btn-primary" target="_blank" rel="noopener" href="'+url+'">Haritada Aç</a></div>';}
function renderPerformance(){var host=document.getElementById('opsPerformance');if(!host)return;var now=Date.now(),techs=(SD.technicians||[]).map(function(t){var assigned=(SD.companies||[]).filter(function(c){return c.aktif!==false&&String(c.techId)===String(t.id);});var seen30=new Set(),cnt30=0,cnt90=0;assigned.forEach(function(c){visitsOf(c).forEach(function(v){var age=(now-v._date.getTime())/86400000;if(age<=30){cnt30++;seen30.add(String(c.id));}if(age<=90)cnt90++;});});var coverage=assigned.length?Math.round(seen30.size/assigned.length*100):0;var cadence=Math.min(100,Math.round(cnt30/Math.max(1,assigned.length)*100));var stale=assigned.filter(function(c){var v=lastVisit(c);return !v||daysSince(v._date)>60;}).length;var score=Math.max(0,Math.min(100,Math.round(coverage*.55+cadence*.30+(100-(assigned.length?stale/assigned.length*100:0))*.15)));return{t:t,assigned:assigned.length,cnt30:cnt30,cnt90:cnt90,coverage:coverage,stale:stale,score:score};}).sort(function(a,b){return b.score-a.score;});
  host.innerHTML='<div class="ops-scorecards">'+techs.map(function(x){return'<div class="ops-perf-card"><div class="ops-perf-top"><div><div class="ops-tech-code">'+esc(x.t.code)+'</div><h3>'+esc(x.t.name)+'</h3></div><div class="ops-big-score '+(x.score>=80?'ok':x.score>=60?'warn':'danger')+'">'+x.score+'</div></div><div class="ops-metrics"><div><b>'+x.assigned+'</b><span>atanmış firma</span></div><div><b>'+x.cnt30+'</b><span>30 gün ziyaret</span></div><div><b>%'+x.coverage+'</b><span>30 gün kapsama</span></div><div><b>'+x.stale+'</b><span>60+ gün bekleyen</span></div></div><div class="ops-progress"><i style="width:'+x.score+'%"></i></div></div>';}).join('')+'</div><div class="ops-note">Skor = %55 firma kapsama + %30 ziyaret temposu + %15 gecikmeyen firma oranı. Ham ziyaret sayısı tek başına performans kabul edilmez.</div>';}
function renderAudit(){var host=document.getElementById('opsAudit');if(!host)return;var logs=SD.load('sd_audit',[])||[];host.innerHTML='<div class="ops-card"><div class="ops-card-hd"><div><h3>Son '+Math.min(logs.length,250)+' hareket</h3><p>Kayıtlar silme/değiştirme sorunlarını izlemek için tutulur.</p></div><button class="btn btn-ghost" id="auditExport">JSON İndir</button></div>'+(logs.length?'<div class="ops-audit-list">'+logs.slice(0,250).map(function(a){return'<div class="ops-audit-row"><div class="ops-audit-dot"></div><div><b>'+esc(a.action||'Veri güncellendi')+'</b><span>'+esc(a.user||'Sistem')+' · '+esc(a.role||'')+'</span></div><time>'+fmtDate(a.at)+' '+(new Date(a.at).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}))+'</time></div>';}).join('')+'</div>':'<div class="ops-empty">Henüz denetim kaydı yok. Bu sürümden sonraki değişiklikler burada görünecek.</div>')+'</div>';var btn=document.getElementById('auditExport');if(btn)btn.onclick=function(){var blob=new Blob([JSON.stringify(logs,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='servisdrama-denetim-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);};}
function patchCompanyCards(){document.querySelectorAll('.co-card[data-company-id]').forEach(function(card){var acts=card.querySelector('.co-acts');if(!acts||acts.querySelector('.ops-360-btn'))return;var id=card.dataset.companyId,b=document.createElement('button');b.className='btn-icon ops-360-btn';b.title='Firma 360°';b.textContent='360°';b.onclick=function(e){e.stopPropagation();openCompany360(id);};acts.insertBefore(b,acts.firstChild);});}
function boot(){ensureUI();var old=window.renderFirma;if(typeof old==='function'&&!old.__opsWrapped){var wrap=function(){var r=old.apply(this,arguments);setTimeout(patchCompanyCards,0);return r;};wrap.__opsWrapped=true;window.renderFirma=wrap;}patchCompanyCards();try{SD.generateNotifications();}catch(e){console.warn('Ops notifications',e);}setInterval(function(){try{SD.generateNotifications();}catch(e){}},15*60*1000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,50);});else setTimeout(boot,50);
})();
