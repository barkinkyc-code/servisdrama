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
    document.querySelectorAll('[data-page="ayarlar"], [data-page="raporlar"], .nav-dd-item[onclick*="ayarlar"]').forEach(function(el){el.style.display=owner?'':'none';});
    document.querySelectorAll('.btn-icon.red[title="Sil"], .co-acts .red').forEach(function(el){el.style.display=owner?'':'none';});
    document.querySelectorAll('.week-tog').forEach(function(el){el.disabled=!owner;el.style.opacity=owner?'':'0.45';el.style.pointerEvents=owner?'':'none';});
    if(!owner&&window.A&&(A.page==='ayarlar'||A.page==='raporlar')){goto('ziyaret');UI.toast('Bu bölüm yalnızca Barkın Kayacı hesabına açıktır.','warning');}
  }
  document.addEventListener('DOMContentLoaded',function(){setTimeout(applyRoleUI,200);new MutationObserver(applyRoleUI).observe(document.body,{childList:true,subtree:true});});

  var oldGoto=window.goto;
  if(typeof oldGoto==='function')window.goto=function(p){if((p==='ayarlar'||p==='raporlar')&&!SD_isOwner()){UI.toast('Bu bölüme erişim yetkiniz yok.','warning');return;}return oldGoto.apply(this,arguments);};
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

  /* Ziyaret edilmeyenleri periyot gecikmesine göre sırala; devam eden kayıt kaybolmaz */
  window.openMissedModal=function(){
    var today=new Date(),cwk=DT.wkey(today),weeks=DT.monthWeeks(today.getFullYear(),today.getMonth()),cwi=weeks.findIndex(function(m){return m.getTime()===DT.monday(today).getTime();})+1;
    var at=SD.activeTech(),me=SD.sessionTech(),viewerCode=me?me.code:(at?at.code:null);
    var cos=SD.companies.filter(function(c){return c.aktif!==false&&(!at||c.techId===at.id)&&BL.scheduled(c,cwi);});
    var vis=SD.visits;
    function intervalDays(c){var n=(c.weeks||[1,2,3,4]).length;return n>=4?7:n===3?10:n===2?14:30;}
    var missed=cos.map(function(c){
      var current=SD.visitEntryFor(vis[c.id+'_'+cwk],viewerCode);
      if(current&&current.status==='done')return null;
      var lv=lastVisitFor(c),days=lv?Math.floor((new Date(today.getFullYear(),today.getMonth(),today.getDate())-new Date(lv.d.getFullYear(),lv.d.getMonth(),lv.d.getDate()))/86400000):9999;
      var threshold=intervalDays(c),over=days-threshold;
      return {co:c,current:current,lv:lv,days:days,threshold:threshold,over:over};
    }).filter(Boolean).sort(function(a,b){
      if(!!a.current!==!!b.current)return a.current?-1:1;
      return b.over-a.over||b.days-a.days;
    });
    var list=document.getElementById('missedList');if(!list)return;list.innerHTML='';
    var title=document.getElementById('missedTitle');if(title)title.textContent='Ziyaret Edilmeyenler'+(at?' — '+at.code:'')+' ('+missed.length+')';
    if(!missed.length){list.innerHTML='<p class="miss-empty">Tüm firmalar ziyaret edildi 🎉</p>';UI.openModal('missedModal');return;}
    missed.forEach(function(item,i){
      var co=item.co,row=document.createElement('div');row.className='miss-item enhanced'+(item.current?' ongoing':'');
      var lv=item.lv?DT.ddmmyyyy(item.lv.d):'Kayıt yok';
      var dayText=item.days>90?'+90 ~':(item.lv?(item.days+' gün geçti'):'Henüz ziyaret yok');
      var urgency=item.current?'<span class="ongoing-chip">Devam ediyor<br><small>'+esc(item.current.startTime||item.current.saat||'')+'</small></span>':(item.over>90?'<span class="overdue-chip">+90 ~</span>':(item.over>0?'<span class="overdue-chip">+'+item.over+' gün gecikmiş</span>':'<span class="due-chip">Periyot içinde</span>'));
      row.innerHTML='<span class="miss-num">'+(i+1)+'</span><div class="miss-main"><div class="miss-nm">'+esc(co.name)+'</div><div class="miss-rg">'+esc(co.bolge||'')+'</div><div class="last-visit-line">En son ziyaret: '+lv+(item.lv?' • '+dayText:'')+'</div></div>'+urgency;
      var clicks=0,t;
      row.onclick=function(){
        clicks++;clearTimeout(t);
        if(clicks<2){t=setTimeout(function(){clicks=0;},650);return;}
        clicks=0;
        var p=todayParts(),vi=SD.visits,ac=SD.actingTech(co),code=ac?ac.code:'—';
        if(item.current){
          var ed=window.prompt('Bitiş tarihi (GG.AA.YYYY)',p.date);if(ed===null)return;
          var et=window.prompt('Bitiş saati (SS:DD)',p.time);if(et===null)return;
          if(!/^\d{2}\.\d{2}\.\d{4}$/.test(ed)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(et)){UI.toast('Tarih veya saat formatı geçersiz.','error');return;}
          vi[co.id+'_'+cwk]=SD.putVisitEntry(vi[co.id+'_'+cwk],code,{date:item.current.date||ed.slice(0,5),saat:item.current.saat||item.current.startTime,startDate:item.current.startDate||p.date,startTime:item.current.startTime||item.current.saat,endDate:ed,endTime:et,status:'done',count:item.current.count||1,workType:item.current.workType||'Teknik Servis',dates:[item.current.date||ed.slice(0,5)]});
          UI.toast('İş '+(item.current.startTime||item.current.saat||'—')+'–'+et+' arasında tamamlandı.','success');
        }else{
          var type=window.prompt('İş türü: Kurulum veya Teknik Servis','Teknik Servis');if(type===null)return;
          type=/kurulum/i.test(type)?'Kurulum':'Teknik Servis';
          var sd=window.prompt('Başlama tarihi (GG.AA.YYYY)',p.date);if(sd===null)return;
          var st=window.prompt('Başlama saati (SS:DD)',p.time);if(st===null)return;
          if(!/^\d{2}\.\d{2}\.\d{4}$/.test(sd)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(st)){UI.toast('Tarih veya saat formatı geçersiz.','error');return;}
          vi[co.id+'_'+cwk]=SD.putVisitEntry(vi[co.id+'_'+cwk],code,{date:sd.slice(0,5),saat:st,startDate:sd,startTime:st,status:'pending',count:1,workType:type});
          UI.toast(type+' '+st+' saatinde başlatıldı; kayıt devam ediyor olarak tutuldu.','info');
        }
        SD.visits=vi;openMissedModal();renderVisit();
      };
      list.appendChild(row);
    });
    UI.openModal('missedModal');
  };

  /* Ayarlar: otomatik rapor ve Excel alanı */
  var oldRenderSettings=window.renderSettingsTab;
  if(typeof oldRenderSettings==='function')window.renderSettingsTab=function(tab){if(!SD_isOwner()){goto('ziyaret');return;}oldRenderSettings.apply(this,arguments);if(tab==='mail'||tab==='veri')setTimeout(injectOwnerTools,0);};
  function injectOwnerTools(){var content=document.getElementById('settingsContent');if(!content||document.getElementById('autoSummaryCard'))return;var cfg=SD.config||{};var card=document.createElement('div');card.className='settings-card';card.id='autoSummaryCard';card.innerHTML='<div class="settings-ttl">✉️ Otomatik Gün Özeti</div><p class="setting-note">Türkiye saatine göre günlük rapor gönderimini ve TO/CC alıcılarını yönetin.</p><div class="schedule-grid"><label>Gönderim saati<input class="inp" type="time" id="dailySummaryTime" value="'+esc((!cfg.dailySummaryTime||cfg.dailySummaryTime==='18:00')?'19:00':cfg.dailySummaryTime)+'"></label><label>TO alıcıları<textarea class="inp" id="dailySummaryTo" rows="3" placeholder="Her satıra bir e-posta">'+esc((cfg.dailySummaryTo||RAPOR_TO_LIST||[]).join('\n'))+'</textarea></label><label>CC alıcıları<textarea class="inp" id="dailySummaryCc" rows="3" placeholder="Her satıra bir e-posta">'+esc((cfg.dailySummaryCc||RAPOR_CC_LIST||[]).join('\n'))+'</textarea></label></div><div class="settings-acts"><button class="btn btn-primary btn-sm" onclick="saveDailySummarySettings()">Ayarları Kaydet</button><button class="btn btn-outline btn-sm" onclick="sendDailySummaryNow()">Şimdi Test Gönder</button></div><hr class="settings-sep"><div class="settings-ttl">📊 Ziyaret ve Numune Excel Dışa Aktarımı</div><div class="export-grid"><label>Başlangıç<input class="inp" type="date" id="exportStart"></label><label>Bitiş<input class="inp" type="date" id="exportEnd"></label><button class="btn btn-primary" onclick="exportOperationalExcel()">Excel İndir</button></div>';content.appendChild(card);}
  window.saveDailySummarySettings=function(){var cfg=SD.config||{};cfg.dailySummaryTime=document.getElementById('dailySummaryTime').value||'19:00';cfg.dailySummaryTo=document.getElementById('dailySummaryTo').value.split(/[\n,;]+/).map(function(x){return x.trim();}).filter(Boolean);cfg.dailySummaryCc=document.getElementById('dailySummaryCc').value.split(/[\n,;]+/).map(function(x){return x.trim();}).filter(Boolean);cfg.dailySummaryEnabled=true;SD.config=cfg;UI.toast('Otomatik gün özeti ayarları kaydedildi.','success');};
  window.sendDailySummaryNow=function(){saveDailySummarySettings();var to=(document.getElementById('dailySummaryTo').value||'').split(/[\n,;]+/).map(function(x){return x.trim();}).filter(Boolean);var cc=(document.getElementById('dailySummaryCc').value||'').split(/[\n,;]+/).map(function(x){return x.trim();}).filter(Boolean);if(!to.length){UI.toast('En az bir TO alıcısı girin.','warning');return;}UI.toast('Test maili gönderiliyor...','info');fetch('/api/daily-summary',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+(localStorage.getItem('token')||'')},body:JSON.stringify({force:true,to:to,cc:cc})}).then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.details||d.error||'Gönderilemedi');return d;});}).then(function(){UI.toast('Gün özeti gönderildi.','success');}).catch(function(e){UI.toast(e.message,'error');});};

  window.exportOperationalExcel=function(){if(!SD_isOwner())return;var s=document.getElementById('exportStart').value,e=document.getElementById('exportEnd').value,sd=s?new Date(s+'T00:00:00'):null,ed=e?new Date(e+'T23:59:59'):null;function inRange(d){var x=parseDate(d);return x&&(!sd||x>=sd)&&(!ed||x<=ed);}var rows=[['Tür','Firma','Teknisyen','Başlangıç Tarihi','Başlangıç Saati','Bitiş Tarihi','Bitiş Saati','Durum','Not/Numune','Periyot']];var companies=SD.companies||[],techs=SD.technicians||[];Object.keys(SD.visits||{}).forEach(function(k){var cid=k.split('_')[0],co=companies.find(function(c){return c.id===cid;})||{},rec=SD.visits[k],entries=rec&&rec.entries?Object.keys(rec.entries).map(function(x){return rec.entries[x];}):[rec];entries.forEach(function(v){if(!v||!inRange(v.endDate||v.startDate||v.date))return;var t=techs.find(function(x){return x.code===v.tc;})||{};rows.push(['Ziyaret',co.name||cid,t.name||v.tc,v.startDate||v.date||'',v.startTime||v.saat||'',v.endDate||'',v.endTime||'',v.status==='done'?'Tamamlandı':'Devam Ediyor',v.extraNot||'',(co.weeks||[]).join(',')]);});});(SD.samples||[]).forEach(function(n){var d=n.date||n.tarih||n.createdAt;if(!inRange(d))return;rows.push(['Numune',n.firma||n.company||n.firmaAdi||'',n.tech||n.teknisyen||'',d||'',n.saat||'','','',n.result?'Sonuçlandı':'Bekliyor',n.urun||n.product||n.not||'', '']);});var html='<html><head><meta charset="UTF-8"></head><body><table border="1">'+rows.map(function(r){return '<tr>'+r.map(function(c){return '<td>'+esc(c)+'</td>';}).join('')+'</tr>';}).join('')+'</table></body></html>';var blob=new Blob(['\ufeff'+html],{type:'application/vnd.ms-excel;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ServisDrama_Veriler_'+(s||'baslangic')+'_'+(e||'bugun')+'.xls';a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);};

  /* Program dışı ziyaretler: ilk açılışta bugünün tarihi seçili ve yalnızca o gün görünür.
     Veri kaydı bulunan günler özel takvimde siyah gösterilir (native <input type=date>
     popup'ı günlere göre stillendirilemediği için kendi mini takvimimizi kullanıyoruz). */
  var oldExtra=window.renderExtraVisits;
  if(typeof oldExtra==='function')window.renderExtraVisits=function(){
    oldExtra.apply(this,arguments);
    setTimeout(function(){
      var section=document.getElementById('extraVisitList');if(!section)return;
      var ctl=document.getElementById('extraHistoryControl');
      var isNew=!ctl;
      if(isNew){
        ctl=document.createElement('div');ctl.id='extraHistoryControl';ctl.className='extra-history-control';
        ctl.innerHTML='<button type="button" id="extraCollapseBtn">Program Dışı Ziyaretler <span>▾</span></button>'
          +'<div class="edc-wrap"><button type="button" id="extraDateBtn" title="Geçmiş tarihe bak">📅 <span id="extraDateLbl"></span></button>'
          +'<input type="date" id="extraHistoryDate" style="display:none">'
          +'<div id="extraDateCal" class="edc-pop hidden"></div></div>';
        section.parentNode.insertBefore(ctl,section);
        ctl.querySelector('#extraCollapseBtn').onclick=function(){section.classList.toggle('collapsed');this.querySelector('span').textContent=section.classList.contains('collapsed')?'▸':'▾';};
      }
      var date=document.getElementById('extraHistoryDate'),now=new Date(),todayISO=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
      if(!date.value)date.value=todayISO;
      var lbl=document.getElementById('extraDateLbl');
      function fmtDisp(iso){var p=iso.split('-');return p.length===3?p[2]+'.'+p[1]+'.'+p[0]:iso;}
      if(lbl)lbl.textContent=fmtDisp(date.value);
      function filter(){var wanted=date.value?date.value.split('-').reverse().join('.'):DT.ddmmyyyy(new Date());var any=false;Array.from(section.children).forEach(function(card){var show=card.textContent.indexOf(wanted)>=0||card.textContent.indexOf(wanted.slice(0,5))>=0;card.style.display=show?'':'none';if(show)any=true;});var empty=document.getElementById('extraEmpty');if(empty){empty.style.display=any?'none':'block';empty.textContent='Seçilen tarihte program dışı ziyaret bulunmuyor.';}}
      /* Verilen ay/yıl içinde program dışı ziyaret kaydı olan gün numaralarını topla */
      function extrasDaySet(y,m){var set={};(SD.extras||[]).forEach(function(x){var p=String(x.date||'').split('.');if(p.length===3&&parseInt(p[2],10)===y&&(parseInt(p[1],10)-1)===m)set[parseInt(p[0],10)]=true;});return set;}
      var mNames=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
      function renderCal(){
        var cal=document.getElementById('extraDateCal');if(!cal)return;
        var p=date.value.split('-'),vy=cal._vy!=null?cal._vy:parseInt(p[0],10),vm=cal._vm!=null?cal._vm:parseInt(p[1],10)-1;
        var first=new Date(vy,vm,1),startDow=(first.getDay()+6)%7,daysInMonth=new Date(vy,vm+1,0).getDate();
        var dataDays=extrasDaySet(vy,vm);
        var selDay=(parseInt(p[0],10)===vy&&(parseInt(p[1],10)-1)===vm)?parseInt(p[2],10):null;
        var html='<div class="edc-hd"><button type="button" class="edc-nav" data-dir="-1">‹</button><span>'+mNames[vm]+' '+vy+'</span><button type="button" class="edc-nav" data-dir="1">›</button></div>';
        html+='<div class="edc-dow">'+['Pt','Sa','Ça','Pe','Cu','Ct','Pz'].map(function(d){return '<span>'+d+'</span>';}).join('')+'</div>';
        html+='<div class="edc-days">';
        for(var i=0;i<startDow;i++)html+='<span></span>';
        for(var d=1;d<=daysInMonth;d++){var cls='edc-day'+(dataDays[d]?' has-data':'')+(d===selDay?' sel':'');html+='<span class="'+cls+'" data-d="'+d+'">'+d+'</span>';}
        html+='</div>';
        cal.innerHTML=html;cal._vy=vy;cal._vm=vm;
        cal.querySelectorAll('.edc-nav').forEach(function(b){b.onclick=function(e){e.stopPropagation();var dir=parseInt(b.dataset.dir,10);var nv=cal._vm+dir,ny=cal._vy;if(nv<0){nv=11;ny--;}if(nv>11){nv=0;ny++;}cal._vy=ny;cal._vm=nv;renderCal();};});
        cal.querySelectorAll('.edc-day[data-d]').forEach(function(s){s.onclick=function(){var dd=parseInt(s.dataset.d,10);var iso=cal._vy+'-'+String(cal._vm+1).padStart(2,'0')+'-'+String(dd).padStart(2,'0');date.value=iso;cal.classList.add('hidden');if(lbl)lbl.textContent=fmtDisp(iso);filter();};});
      }
      var btn=document.getElementById('extraDateBtn');
      if(isNew){
        btn.onclick=function(e){e.stopPropagation();var cal=document.getElementById('extraDateCal');var opening=cal.classList.contains('hidden');if(opening){cal._vy=null;cal._vm=null;}cal.classList.toggle('hidden');if(!cal.classList.contains('hidden'))renderCal();};
        document.addEventListener('click',function(e){var cal=document.getElementById('extraDateCal');if(cal&&!cal.classList.contains('hidden')&&!cal.contains(e.target)&&e.target!==btn)cal.classList.add('hidden');});
      }
      date.onchange=filter;filter();
    },0);
  };

  /* Mobil pull-to-refresh — açık bir modal varken (ör. Ziyaret Edilmeyenler listesi)
     devre dışı: aksi halde modal içinde dokunurken oluşan ufak dikey hareket
     "aşağı çekme" sanılıp sayfayı yeniden yüklüyor, modal kapanmış gibi görünüyordu. */
  var startY=0,pulling=false,indicator;
  function anyModalOpen(e){
    if(document.querySelector('.overlay:not(.hidden)'))return true;
    var t=e&&e.target;
    return !!(t&&t.closest&&t.closest('.overlay,.modal'));
  }
  document.addEventListener('touchstart',function(e){if(window.scrollY===0&&e.touches.length===1&&!anyModalOpen(e)){startY=e.touches[0].clientY;pulling=true;}},{passive:true});
  document.addEventListener('touchmove',function(e){if(!pulling)return;var dy=e.touches[0].clientY-startY;if(dy>55){if(!indicator){indicator=document.createElement('div');indicator.className='pull-refresh';indicator.textContent='↓ Yenilemek için bırak';document.body.appendChild(indicator);}indicator.classList.add('show');}},{passive:true});
  document.addEventListener('touchend',function(e){if(!pulling)return;pulling=false;if(indicator&&indicator.classList.contains('show')){indicator.textContent='↻ Yenileniyor...';location.reload();}else if(indicator)indicator.remove();indicator=null;},{passive:true});


  /* Logo her zaman Ziyaret Takibi'ne döner; DK Portal mobilde yalnızca bu sayfada adın solunda görünür */
  function syncMobilePortal(){var p=(window.A&&A.page)||'ziyaret',el=document.getElementById('mobileVisitPortal');if(el)el.style.display=(p==='ziyaret'&&window.innerWidth<=768)?'inline-flex':'none';}
  document.addEventListener('DOMContentLoaded',function(){var logo=document.getElementById('topbarLogo');if(logo){logo.addEventListener('click',function(){goto('ziyaret');if(typeof closeMobileMenu==='function')closeMobileMenu();});logo.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();goto('ziyaret');if(typeof closeMobileMenu==='function')closeMobileMenu();}});}syncMobilePortal();});
  window.addEventListener('resize',syncMobilePortal);
  var _gotoPortalSync=window.goto;if(typeof _gotoPortalSync==='function')window.goto=function(){var r=_gotoPortalSync.apply(this,arguments);setTimeout(syncMobilePortal,0);return r;};

  /* Uyarı üçgenindeki boş işareti düzelt */
  document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('#warnBanner svg, .warn-banner svg').forEach(function(svg){if(!svg.textContent.trim()){var t=document.createElementNS('http://www.w3.org/2000/svg','text');t.setAttribute('x','12');t.setAttribute('y','17');t.setAttribute('text-anchor','middle');t.setAttribute('font-size','14');t.setAttribute('font-weight','900');t.setAttribute('fill','currentColor');t.textContent='!';svg.appendChild(t);}});});
})();
