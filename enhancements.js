/* ServisDrama v13 role, mobile, schedule and export enhancements */
(function(){
  'use strict';
  function session(){try{return JSON.parse(sessionStorage.getItem('sd_session')||localStorage.getItem('sd_session_persist')||'{}');}catch(e){return {};}}
  window.SD_isOwner=function(){var s=session(),u=s.userData||{};return String(u.username||s.user||'').toLowerCase()==='barkin.kayaci';};
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function todayParts(){var d=new Date();return {date:DT.ddmmyyyy(d),short:DT.ddmm(d),time:DT.hhii(d)};}
  function parseDate(v){if(!v)return null;var p=String(v).split('.');if(p.length<2)return null;return new Date(Number(p[2]||new Date().getFullYear()),Number(p[1])-1,Number(p[0]));}
  function lastVisitFor(co){var best=null,vis=SD.visits||{};Object.keys(vis).forEach(function(k){if(k.indexOf(co.id+'_')!==0)return;var e=vis[k], entries=e&&e.entries?Object.keys(e.entries).map(function(x){return e.entries[x];}):[e];entries.forEach(function(v){if(!v||v.status!=='done'||!v.date)return;var d=parseDate(v.date);if(d&&(!best||d>best.d))best={d:d,v:v};});});return best;}

  function applyRoleUI(){
    var owner=SD_isOwner();
    document.querySelectorAll('[data-page="ayarlar"], .nav-dd-item[onclick*="ayarlar"]').forEach(function(el){el.style.display=owner?'':'none';});
    document.querySelectorAll('.btn-icon.red[title="Sil"], .co-acts .red').forEach(function(el){el.style.display=owner?'':'none';});
    document.querySelectorAll('.week-tog').forEach(function(el){el.disabled=!owner;el.style.opacity=owner?'':'0.45';el.style.pointerEvents=owner?'':'none';});
    if(!owner&&window.A&&A.page==='ayarlar'){goto('ziyaret');UI.toast('Ayarlar yalnızca Barkın Kayacı hesabına açıktır.','warning');}
  }
  document.addEventListener('DOMContentLoaded',function(){setTimeout(applyRoleUI,200);new MutationObserver(applyRoleUI).observe(document.body,{childList:true,subtree:true});});

  var oldGoto=window.goto;
  if(typeof oldGoto==='function')window.goto=function(p){if(p==='ayarlar'&&!SD_isOwner()){UI.toast('Bu bölüme erişim yetkiniz yok.','warning');return;}return oldGoto.apply(this,arguments);};
  var oldDelete=window.deleteFirma;
  window.deleteFirma=function(id){if(!SD_isOwner()){UI.toast('Firma silme yetkisi yalnızca Barkın Kayacı hesabındadır.','error');return;}return oldDelete&&oldDelete(id);};

  /* Firma periyotlarını non-owner düzenlemelerinde koru */
  var oldSaveFirma=window.saveFirma;
  if(typeof oldSaveFirma==='function')window.saveFirma=function(){
    if(!SD_isOwner()&&window.A&&A.editId){var old=SD.companies.find(function(c){return c.id===A.editId;});if(old)A.selWeeks=(old.weeks||[1,2,3,4]).slice();}
    return oldSaveFirma.apply(this,arguments);
  };

  /* Haritada GPS ile mevcut konumu bul */
  var oldOpenMap=window.openMapModal;
  if(typeof oldOpenMap==='function')window.openMapModal=function(){
    oldOpenMap.apply(this,arguments);
    setTimeout(function(){
      var host=document.getElementById('mapPickerContainer');if(!host||document.getElementById('gpsLocateBtn'))return;
      var b=document.createElement('button');b.id='gpsLocateBtn';b.type='button';b.className='gps-locate-btn';b.innerHTML='⌖ <span>Konumumu Bul</span>';
      b.onclick=function(){
        if(!navigator.geolocation){UI.toast('Konum servisi desteklenmiyor.','error');return;}
        b.disabled=true;b.innerHTML='⌛ Konum alınıyor...';
        navigator.geolocation.getCurrentPosition(function(pos){A.mapLat=pos.coords.latitude;A.mapLng=pos.coords.longitude;if(A._mapPicker){A._mapPicker.setView([A.mapLat,A.mapLng],17);A._mapPicker.eachLayer(function(l){if(l instanceof L.Marker)A._mapPicker.removeLayer(l);});L.marker([A.mapLat,A.mapLng]).addTo(A._mapPicker);}b.disabled=false;b.innerHTML='✓ Konum Kaydedildi';UI.toast('GPS konumu firma konumuna aktarıldı.','success');},function(err){b.disabled=false;b.innerHTML='⌖ <span>Konumumu Bul</span>';UI.toast('Konum alınamadı: '+err.message,'error');},{enableHighAccuracy:true,timeout:12000,maximumAge:0});
      };
      host.parentNode.style.position='relative';host.parentNode.appendChild(b);
    },450);
  };

  /* Ziyaret edilmeyenleri periyot gecikmesine göre sırala */
  window.openMissedModal=function(){
    var today=new Date(),cwk=DT.wkey(today),weeks=DT.monthWeeks(today.getFullYear(),today.getMonth()),cwi=weeks.findIndex(function(m){return m.getTime()===DT.monday(today).getTime();})+1;
    var at=SD.activeTech(),cos=SD.companies.filter(function(c){return c.aktif!==false&&(!at||c.techId===at.id)&&BL.scheduled(c,cwi);});
    var vis=SD.visits;
    var missed=cos.filter(function(c){var v=vis[c.id+'_'+cwk];return !v||v.status!=='done';}).map(function(c){var lv=lastVisitFor(c),days=lv?Math.floor((new Date(today.getFullYear(),today.getMonth(),today.getDate())-new Date(lv.d.getFullYear(),lv.d.getMonth(),lv.d.getDate()))/86400000):9999;var n=(c.weeks||[1,2,3,4]).length;var threshold=n>=4?7:n===3?9:n===2?14:30;return {co:c,lv:lv,days:days,threshold:threshold,over:days-threshold};}).sort(function(a,b){return b.over-a.over||b.days-a.days;});
    var list=document.getElementById('missedList');if(!list)return;list.innerHTML='';
    if(!missed.length){list.innerHTML='<p class="miss-empty">Tüm firmalar ziyaret edildi 🎉</p>';UI.openModal('missedModal');return;}
    missed.forEach(function(item,i){var co=item.co,row=document.createElement('div');row.className='miss-item enhanced';var lv=item.lv?DT.ddmmyyyy(item.lv.d):'Kayıt yok';var urgency=item.over>0?'<span class="overdue-chip">+'+item.over+' gün gecikmiş</span>':'<span class="due-chip">Periyot içinde</span>';row.innerHTML='<span class="miss-num">'+(i+1)+'</span><div class="miss-main"><div class="miss-nm">'+esc(co.name)+'</div><div class="miss-rg">'+esc(co.bolge||'')+'</div><div class="last-visit-line">En son ziyaret: '+lv+(item.lv?' • '+item.days+' gün geçti':'')+'</div></div>'+urgency;var clicks=0,t;row.onclick=function(){clicks++;clearTimeout(t);if(clicks>=2){var p=todayParts(),vi=SD.visits,ac=SD.actingTech(co);vi[co.id+'_'+cwk]=SD.putVisitEntry(vi[co.id+'_'+cwk],ac?ac.code:'—',{date:p.short,saat:p.time,startDate:p.date,startTime:p.time,status:'pending',count:1});SD.visits=vi;openMissedModal();renderVisit();}else t=setTimeout(function(){clicks=0;},550);};list.appendChild(row);});UI.openModal('missedModal');
  };

  /* Ayarlar: otomatik rapor ve Excel alanı */
  var oldRenderSettings=window.renderSettingsTab;
  if(typeof oldRenderSettings==='function')window.renderSettingsTab=function(tab){if(!SD_isOwner()){goto('ziyaret');return;}oldRenderSettings.apply(this,arguments);if(tab==='genel'||tab==='veri')setTimeout(injectOwnerTools,0);};
  function injectOwnerTools(){var content=document.getElementById('settingsContent');if(!content||document.getElementById('autoSummaryCard'))return;var cfg=SD.config||{};var card=document.createElement('div');card.className='settings-card';card.id='autoSummaryCard';card.innerHTML='<div class="settings-ttl">✉️ Otomatik Gün Özeti</div><p class="setting-note">Türkiye saatine göre günlük rapor gönderimini ve TO/CC alıcılarını yönetin.</p><div class="schedule-grid"><label>Gönderim saati<input class="inp" type="time" id="dailySummaryTime" value="'+esc(cfg.dailySummaryTime||'18:00')+'"></label><label>TO alıcıları<textarea class="inp" id="dailySummaryTo" rows="3" placeholder="Her satıra bir e-posta">'+esc((cfg.dailySummaryTo||RAPOR_TO_LIST||[]).join('\n'))+'</textarea></label><label>CC alıcıları<textarea class="inp" id="dailySummaryCc" rows="3" placeholder="Her satıra bir e-posta">'+esc((cfg.dailySummaryCc||RAPOR_CC_LIST||[]).join('\n'))+'</textarea></label></div><div class="settings-acts"><button class="btn btn-primary btn-sm" onclick="saveDailySummarySettings()">Ayarları Kaydet</button><button class="btn btn-outline btn-sm" onclick="sendDailySummaryNow()">Şimdi Test Gönder</button></div><hr class="settings-sep"><div class="settings-ttl">📊 Ziyaret ve Numune Excel Dışa Aktarımı</div><div class="export-grid"><label>Başlangıç<input class="inp" type="date" id="exportStart"></label><label>Bitiş<input class="inp" type="date" id="exportEnd"></label><button class="btn btn-primary" onclick="exportOperationalExcel()">Excel İndir</button></div>';content.appendChild(card);}
  window.saveDailySummarySettings=function(){var cfg=SD.config||{};cfg.dailySummaryTime=document.getElementById('dailySummaryTime').value||'18:00';cfg.dailySummaryTo=document.getElementById('dailySummaryTo').value.split(/[\n,;]+/).map(function(x){return x.trim();}).filter(Boolean);cfg.dailySummaryCc=document.getElementById('dailySummaryCc').value.split(/[\n,;]+/).map(function(x){return x.trim();}).filter(Boolean);cfg.dailySummaryEnabled=true;SD.config=cfg;UI.toast('Otomatik gün özeti ayarları kaydedildi.','success');};
  window.sendDailySummaryNow=function(){saveDailySummarySettings();fetch('/api/daily-summary',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+(localStorage.getItem('token')||'')},body:JSON.stringify({force:true})}).then(function(r){return r.json();}).then(function(d){UI.toast(d.success?'Gün özeti gönderildi.':(d.error||'Gönderilemedi'),d.success?'success':'error');}).catch(function(e){UI.toast(e.message,'error');});};

  window.exportOperationalExcel=function(){if(!SD_isOwner())return;var s=document.getElementById('exportStart').value,e=document.getElementById('exportEnd').value,sd=s?new Date(s+'T00:00:00'):null,ed=e?new Date(e+'T23:59:59'):null;function inRange(d){var x=parseDate(d);return x&&(!sd||x>=sd)&&(!ed||x<=ed);}var rows=[['Tür','Firma','Teknisyen','Başlangıç Tarihi','Başlangıç Saati','Bitiş Tarihi','Bitiş Saati','Durum','Not/Numune','Periyot']];var companies=SD.companies||[],techs=SD.technicians||[];Object.keys(SD.visits||{}).forEach(function(k){var cid=k.split('_')[0],co=companies.find(function(c){return c.id===cid;})||{},rec=SD.visits[k],entries=rec&&rec.entries?Object.keys(rec.entries).map(function(x){return rec.entries[x];}):[rec];entries.forEach(function(v){if(!v||!inRange(v.endDate||v.startDate||v.date))return;var t=techs.find(function(x){return x.code===v.tc;})||{};rows.push(['Ziyaret',co.name||cid,t.name||v.tc,v.startDate||v.date||'',v.startTime||v.saat||'',v.endDate||'',v.endTime||'',v.status==='done'?'Tamamlandı':'Devam Ediyor',v.extraNot||'',(co.weeks||[]).join(',')]);});});(SD.samples||[]).forEach(function(n){var d=n.date||n.tarih||n.createdAt;if(!inRange(d))return;rows.push(['Numune',n.firma||n.company||n.firmaAdi||'',n.tech||n.teknisyen||'',d||'',n.saat||'','','',n.result?'Sonuçlandı':'Bekliyor',n.urun||n.product||n.not||'', '']);});var html='<html><head><meta charset="UTF-8"></head><body><table border="1">'+rows.map(function(r){return '<tr>'+r.map(function(c){return '<td>'+esc(c)+'</td>';}).join('')+'</tr>';}).join('')+'</table></body></html>';var blob=new Blob(['\ufeff'+html],{type:'application/vnd.ms-excel;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ServisDrama_Veriler_'+(s||'baslangic')+'_'+(e||'bugun')+'.xls';a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);};

  /* Program dışı ziyaretleri bugün + tarih seçici ile göster */
  var oldExtra=window.renderExtraVisits;
  if(typeof oldExtra==='function')window.renderExtraVisits=function(){oldExtra.apply(this,arguments);setTimeout(function(){var section=document.getElementById('extraVisitList');if(!section||document.getElementById('extraHistoryControl'))return;var ctl=document.createElement('div');ctl.id='extraHistoryControl';ctl.className='extra-history-control';ctl.innerHTML='<button type="button" id="extraCollapseBtn">Program Dışı Ziyaretler <span>▾</span></button><label title="Geçmiş tarihe bak">📅 <input type="date" id="extraHistoryDate"></label>';section.parentNode.insertBefore(ctl,section);var btn=ctl.querySelector('button'),date=ctl.querySelector('input');btn.onclick=function(){section.classList.toggle('collapsed');btn.querySelector('span').textContent=section.classList.contains('collapsed')?'▸':'▾';};date.onchange=function(){var wanted=date.value?date.value.split('-').reverse().slice(0,2).join('.'):DT.ddmm(new Date());Array.from(section.children).forEach(function(card){card.style.display=!date.value||card.textContent.indexOf(wanted)>=0?'':'none';});};date.dispatchEvent(new Event('change'));},0);};

  /* Mobil pull-to-refresh */
  var startY=0,pulling=false,indicator;
  document.addEventListener('touchstart',function(e){if(window.scrollY===0&&e.touches.length===1){startY=e.touches[0].clientY;pulling=true;}},{passive:true});
  document.addEventListener('touchmove',function(e){if(!pulling)return;var dy=e.touches[0].clientY-startY;if(dy>55){if(!indicator){indicator=document.createElement('div');indicator.className='pull-refresh';indicator.textContent='↓ Yenilemek için bırak';document.body.appendChild(indicator);}indicator.classList.add('show');}},{passive:true});
  document.addEventListener('touchend',function(e){if(!pulling)return;pulling=false;if(indicator&&indicator.classList.contains('show')){indicator.textContent='↻ Yenileniyor...';location.reload();}else if(indicator)indicator.remove();indicator=null;},{passive:true});

  /* Uyarı üçgenindeki boş işareti düzelt */
  document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('#warnBanner svg, .warn-banner svg').forEach(function(svg){if(!svg.textContent.trim()){var t=document.createElementNS('http://www.w3.org/2000/svg','text');t.setAttribute('x','12');t.setAttribute('y','17');t.setAttribute('text-anchor','middle');t.setAttribute('font-size','14');t.setAttribute('font-weight','900');t.setAttribute('fill','currentColor');t.textContent='!';svg.appendChild(t);}});});
})();

/* Start/end date-time capture for visit cells */
(function(){
  function askTime(label,def){var v=window.prompt(label,def);if(v===null)return null;return /^([01]\d|2[0-3]):[0-5]\d$/.test(v)?v:def;}
  function askDate(label,def){var v=window.prompt(label+' (GG.AA.YYYY)',def);if(v===null)return null;return /^\d{2}\.\d{2}\.\d{4}$/.test(v)?v:def;}
  document.addEventListener('click',function(e){
    var btn=e.target.closest&&e.target.closest('.vc[data-visit-key]');if(!btn||btn.disabled)return;
    var key=btn.dataset.visitKey,coid=btn.dataset.companyId,rec=SD.visits[key],co=SD.companies.find(function(c){return c.id===coid;});
    var code=(SD.actingTech(co)||{}).code||'—',mine=SD.visitEntryFor(rec,code),now=new Date(),date=DT.ddmmyyyy(now),time=DT.hhii(now);
    if(btn.classList.contains('vc-empty')||btn.classList.contains('vc-miss')){
      e.preventDefault();e.stopImmediatePropagation();var sd=askDate('Başlama tarihi',date);if(sd===null)return;var st=askTime('Başlama saati',time);if(st===null)return;var vi=SD.visits;vi[key]=SD.putVisitEntry(vi[key],code,{date:sd.slice(0,5),saat:st,startDate:sd,startTime:st,status:'pending',count:1});SD.visits=vi;UI.toast('Ziyaret '+st+' saatinde başlatıldı.','info');if(typeof renderVisit==='function')renderVisit();return;
    }
    if(btn.classList.contains('vc-pending')){
      e.preventDefault();e.stopImmediatePropagation();var ed=askDate('Bitiş tarihi',date);if(ed===null)return;var et=askTime('Bitiş saati',time);if(et===null)return;var vi2=SD.visits,entry=mine||{};vi2[key]=SD.putVisitEntry(vi2[key],code,{date:entry.date||ed.slice(0,5),saat:entry.saat||entry.startTime||et,startDate:entry.startDate||ed,startTime:entry.startTime||entry.saat||et,endDate:ed,endTime:et,status:'done',count:entry.count||1,dates:[entry.date||ed.slice(0,5)]});SD.visits=vi2;UI.toast('Ziyaret '+(entry.startTime||entry.saat||'—')+'–'+et+' arasında tamamlandı.','success');if(typeof renderVisit==='function')renderVisit();return;
    }
  },true);
})();
