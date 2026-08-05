/* ================================================================
   ServisDrama — Teknisyen JS v5
   Kart + Tablo responsive, sıralama, warn sheet, premium UX
   ================================================================ */

var T = {
  vy: new Date().getFullYear(),
  vm: new Date().getMonth(),
  step: 0, _tt: null, _fabTimer: null
};

/* ═══ YETKİ KONTROLÜ ═══ */
function currentUsername(){
  try{
    var sess=sessionStorage.getItem('sd_session')||localStorage.getItem('sd_session_persist');
    var s=JSON.parse(sess);
    return String((s&&s.userData&&s.userData.username)||'').toLowerCase();
  }catch(e){return '';}
}
function getCurrentUserId(){
  try{
    var sess=sessionStorage.getItem('sd_session')||localStorage.getItem('sd_session_persist');
    var s=JSON.parse(sess);
    return s&&s.userData&&s.userData.id;
  }catch(e){return null;}
}
function isSuperAdmin(){return currentUsername()==='barkin.kayaci';}
function canSendReport(){
  if(isSuperAdmin())return true;
  var cfg=SD.config||{};
  var userId=getCurrentUserId();
  if(!userId)return false;
  var perms=cfg.sendReportPermissions||{};
  return perms[userId]===true;
}

/* ── Toast ── */
function tToast(msg, type) {
  var el = document.getElementById('toast'); if (!el) return;
  el.textContent = msg;
  el.className = 't-toast t-toast-' + (type||'info') + ' show';
  clearTimeout(T._tt);
  T._tt = setTimeout(function(){ el.classList.remove('show'); }, 3000);
}


window.addEventListener('sd-sync-status',function(e){
  var d=e.detail||{};
  if(d.status==='error')tToast('Kayıt sunucuya ulaşmadı. İnternet gelince tekrar denenecek.','error');
});

/* ── Sheet ── */
function openSheet(id){ var el=document.getElementById(id); if(el) el.classList.remove('hidden'); }
function closeSheet(){ document.querySelectorAll('.sheet-overlay').forEach(function(el){ el.classList.add('hidden'); }); }

/* ── Teknikyen Panel Navigation ── */
function techPage(page){
  document.querySelectorAll('.tech-page').forEach(function(el){ el.style.display='none'; });
  var p = document.getElementById('page-'+page);
  if(p) p.style.display = 'block';
  document.querySelectorAll('.tech-nav-btn').forEach(function(el){ el.style.background='transparent'; });
  document.querySelector('[onclick*="techPage(\'' + page + '\')"]').style.background='rgba(255,255,255,.15)';
  if(page==='numune') renderNumunePage();
  if(page==='istatistik') renderIstatistikPage();
  localStorage.setItem('techPage', page);
}

function techLogout(){
  localStorage.removeItem('techCode');
  sessionStorage.removeItem('sd_role_id');
  location.href='tech.html';
}

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', async function(){
  await SD.remoteReady();
  SD.seed();
  if(!initTechPanel()) return;
  var rid = sessionStorage.getItem('sd_role_id');
  if (rid) SD.activeTechId = rid;
  var tech = SD.activeTech();
  if (!tech) { window.location.href = 'index.html'; return; }

  var logo = document.getElementById('tLogo'); if(logo) logo.src = LOGO_SRC;

  var tn = document.getElementById('tName'); if(tn) tn.textContent = tech.name;
  var tn2 = document.getElementById('tName2'); if(tn2) tn2.textContent = tech.name;
  var tc = document.getElementById('tCode'); if(tc) tc.textContent = tech.code;
  var tc2 = document.getElementById('tCode2'); if(tc2) tc2.textContent = tech.code;

  /* Ay nav */
  document.getElementById('prevM').addEventListener('click', function(){ T.vm--; if(T.vm<0){T.vm=11;T.vy--;} render(); });
  document.getElementById('nextM').addEventListener('click', function(){ T.vm++; if(T.vm>11){T.vm=0;T.vy++;} render(); });

  /* FAB + masaüstü rapor btn */
  var cfg = SD.config, feats = cfg.techFeatures||{};
  var fab = document.getElementById('fabBtn');
  if (fab && feats.canSendReport !== false) fab.classList.remove('hidden-fab');
  var dBtn = document.getElementById('desktopRaporBtn');
  if (dBtn) dBtn.style.display = feats.canSendReport !== false ? 'flex' : 'none';

  /* Warn banner tıklama */
  var wb = document.getElementById('warnBanner');
  if (wb) wb.addEventListener('click', openMissedSheet);

  render();
  updateTechSendMailButtonState();
  /* Otomatik mail kontrolü */
  setTimeout(function(){ if(typeof initAutoMail==='function') initAutoMail(); }, 2000);

  /* Arka planda bekleyen sekme/PWA öne geldiğinde ve her 15 dakikada bir
     ortak veriyi sunucudan tazele — kullanıcı elle "yenile" yapmasa da
     ekrandaki veri güncel kalsın. */
  function autoRefreshData(){
    SD.remoteReady().then(function(){SD.seed();render();});
  }
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='visible')autoRefreshData();
  });
  setInterval(function(){if(!SD.syncBusy())autoRefreshData();},15000);
});

/* ── Otomatik Mail Gönderimi ── */
function initAutoMail(){
  var cfg=SD.config||{};
  var mailTo=cfg.reportTo||'barkin.kayaci@dramamakine.com';
  if(!mailTo) return;
  var today=new Date();
  var todayKey='lastMailDate_'+DT.ddmmyyyy(today);
  if(localStorage.getItem(todayKey)) return;

  setTimeout(function(){
    var report='ServisDrama Günlük Ziyaret Özeti - '+DT.ddmmyyyy(today);
    fetch('/api/send-test-mail',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({to:mailTo,subject:report,html:'<p>Günlük rapor otomatik gönderildi.</p>',attachmentNames:['drama-makine-logo']})
    }).then(r=>r.json()).then(d=>{
      if(d.success){
        localStorage.setItem(todayKey,'1');
        console.log('Mail başarıyla gönderildi: '+mailTo);
      }
    }).catch(e=>console.log('Mail hatası: '+e.message));
  }, 3000);
}

/* ── Render Ana ── */
function render(){
  var tech = SD.activeTech(); if(!tech) return;
  var cfg = SD.config, feats = cfg.techFeatures||{};
  var today = new Date(), todayMon = DT.monday(today);
  todayMon.setHours(0,0,0,0);
  var allWeeks = DT.monthWeeks(T.vy, T.vm);
  allWeeks = allWeeks.filter(function(w){ return DT.isoWeek(w) > 30; });
  var curIdx = allWeeks.findIndex(function(w){
    var w_normalized = new Date(w);
    w_normalized.setHours(0,0,0,0);
    return w_normalized.getTime()===todayMon.getTime();
  });
  var cwk = DT.wkey(today), cwi = curIdx + 1;

  /* Ay etiketi */
  var ml = document.getElementById('monthLbl');
  if (ml) ml.textContent = DT.MONTHS[T.vm] + ' ' + T.vy;
  var wl = document.getElementById('weekLbl');
  if (wl) wl.textContent = DT.isoWeek(today) + '. Hafta — ' + DT.ddmmyyyy(today);

  var vis = SD.visits, cos = SD.companies;
  var myCos = cos.filter(function(c){ return feats.showAllFirms ? true : c.techId===tech.id; });

  /* Bu haftaki firmalar ve gerçek kayıt durumları */
  var isThisMonth = (T.vy===today.getFullYear() && T.vm===today.getMonth());
  var scheduled = myCos.filter(function(c){ return BL.scheduled(c, cwi); });
  var done = scheduled.filter(function(c){var v=vis[c.id+'_'+cwk];return v&&v.status==='done';});
  var pending = scheduled.filter(function(c){var v=vis[c.id+'_'+cwk];return v&&v.status==='pending';});
  var missing = scheduled.filter(function(c){return !vis[c.id+'_'+cwk];});

  /* Progress */
  var tot = scheduled.length, don = done.length;
  var pf = document.getElementById('progFill'); if(pf) pf.style.width=(tot?Math.round(don/tot*100):0)+'%';
  var pl = document.getElementById('progLabel'); if(pl) pl.textContent=don+' / '+tot+' ziyaret tamamlandı';

  /* Warn */
  var wbn = document.getElementById('warnBanner');
  if (wbn){
    if (isThisMonth && missing.length > 0){
      wbn.classList.remove('hidden');
      var wt=document.getElementById('warnTitle'); if(wt) wt.textContent='Bu hafta '+missing.length+' firma ziyaret edilmedi ('+tech.code+')';
      var wbg=document.getElementById('warnBadge'); if(wbg) wbg.textContent=missing.length;
    } else wbn.classList.add('hidden');
  }

  /* Sıralama: done en alta, diğerleri üste */
  var sortedCos = myCos.slice().sort(function(a,b){
    var va=vis[a.id+'_'+cwk], vb=vis[b.id+'_'+cwk];
    var da = va&&va.status==='done' ? 1 : 0;
    var db = vb&&vb.status==='done' ? 1 : 0;
    return da - db;
  });

  /* Görüntülenecek haftalar — sadece güncel ve gelecek 4 hafta (hafta numarası kullanarak) */
  var curWeekNum = DT.isoWeek(today);
  var futureWeeks = [];
  for (var i = 0; i < allWeeks.length; i++) {
    var wn = DT.isoWeek(allWeeks[i]);
    if (wn >= curWeekNum) {
      futureWeeks.push(allWeeks[i]);
    }
  }
  var si = Math.max(0, allWeeks.length - futureWeeks.length);
  var viewWeeks = futureWeeks.slice(0, 4).map(function(w,i){
    return { m:w, k:DT.wkey(w), wn:DT.isoWeek(w), wi:si+i+1,
             isCur: w.getTime()===todayMon.getTime(), isPast: w<todayMon };
  });

  /* Önceki ziyaret tarihleri */
  function prevVisit(coId){
    var all=[], prevWks=allWeeks.slice(0, Math.max(0,si));
    prevWks.forEach(function(wm){ var v=vis[coId+'_'+DT.wkey(wm)]; if(v&&v.date) all.push(v); });
    return all.length ? all[all.length-1] : null;
  }

  /* ── MOBİL KARTLAR ── */
  var mc = document.getElementById('mobileContent'); if(mc) mc.innerHTML='';

  function appendSection(title, list, isCnt){
    if(!list.length) return;
    var hd=document.createElement('div'); hd.className='section-hd';
    hd.innerHTML=title+'<span class="section-count">'+list.length+'</span>';
    if(mc) mc.appendChild(hd);
    list.forEach(function(co){ if(mc) mc.appendChild(makeMobileCard(co, vis[co.id+'_'+cwk], prevVisit(co.id), cwk, feats, viewWeeks)); });
  }

  /* Bekleyenler ve eksikler önce, tamamlananlar sona */
  var pend2 = sortedCos.filter(function(c){ var v=vis[c.id+'_'+cwk]; return v&&v.status==='pending'; });
  var miss2 = sortedCos.filter(function(c){ return BL.scheduled(c,cwi)&&(!vis[c.id+'_'+cwk]); });
  var done2 = sortedCos.filter(function(c){ var v=vis[c.id+'_'+cwk]; return v&&v.status==='done'; });
  var noSch = sortedCos.filter(function(c){ return !BL.scheduled(c,cwi); });

  appendSection('⏳ Yola Çıkıldı / Planlandı', pend2);
  appendSection('📋 Bu Hafta', miss2);
  appendSection('✅ Tamamlananlar', done2);
  appendSection('Bu Hafta Programda Değil', noSch);
  if (mc && !mc.children.length) mc.innerHTML='<div style="text-align:center;padding:48px 20px;color:var(--muted);font-size:14px;line-height:2;">Bu ay firma bulunamadı.</div>';

  /* ── MASAÜSTÜ TABLO ── */
  var dc = document.getElementById('desktopContent'); if(!dc) return;
  dc.innerHTML='';

  var wrap = document.createElement('div'); wrap.className='vt-table-wrap';
  var table = document.createElement('table'); table.className='vt-table';
  /* Thead */
  var thead = document.createElement('thead'); thead.className='vt-thead';
  var headRow = document.createElement('tr');
  var th0 = document.createElement('th'); th0.textContent='Firma'; headRow.appendChild(th0);
  viewWeeks.forEach(function(col){
    var th=document.createElement('th');
    th.textContent=col.wn+'. Hafta';
    if(col.isCur) th.className='cur-week';
    headRow.appendChild(th);
  });
  thead.appendChild(headRow); table.appendChild(thead);
  /* Tbody */
  var tbody = document.createElement('tbody'); tbody.className='vt-tbody';
  sortedCos.forEach(function(co){
    var tr = document.createElement('tr');
    /* Firma adı */
    var td0 = document.createElement('td');
    var nc = document.createElement('div'); nc.className='vt-name-cell';
    if(co.truck){
      var tb=document.createElement('button'); tb.className='vt-truck'; tb.title='2× truck mail'; tb.textContent='🚚';
      var tc2=0,tt2; tb.addEventListener('click',function(e){e.stopPropagation();tc2++;clearTimeout(tt2);if(tc2>=2){tc2=0;sendTruck(co);}else tt2=setTimeout(function(){tc2=0;},600);});
      nc.appendChild(tb);
    }
    var nm=document.createElement('div'); nm.className='vt-name'; nm.textContent=co.name;
    /* Önceki ziyaret */
    var pv=prevVisit(co.id);
    if(pv){ var pvSpan=document.createElement('span'); pvSpan.style.cssText='font-size:10.5px;color:var(--muted);margin-left:6px;font-weight:500;'; pvSpan.textContent='(önceki: '+pv.date+')'; nm.appendChild(pvSpan); }
    nc.appendChild(nm); td0.appendChild(nc); tr.appendChild(td0);
    /* Hafta hücreleri */
    viewWeeks.forEach(function(col){
      var td=document.createElement('td');
      var wc=document.createElement('div'); wc.className='vt-wcell';
      wc.appendChild(buildDesktopCell(co, col, vis[co.id+'_'+col.k], co.id+'_'+col.k));
      td.appendChild(wc); tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody); wrap.appendChild(table); dc.appendChild(wrap);

  var dBtn = document.getElementById('desktopRaporBtn');
  if(dBtn) dBtn.style.display = 'flex';
}

/* ── Masaüstü hücre ── */
function buildDesktopCell(co, col, vd, vk){
  var btn = document.createElement('button'); btn.className='vt-cell';

  if (!BL.scheduled(co, col.wi)){
    btn.className+=' vt-cell-dash'; btn.disabled=true;
    btn.innerHTML='<span style="color:#E5E7EB;font-size:16px;">—</span>'; return btn;
  }
  if (vd && vd.status==='done'){
    var cnt=vd.count||1; btn.className+=' '+(cnt>1?'vt-cell-multi':'vt-cell-done');
    btn.innerHTML='<span style="font-size:15px;">'+svgLock()+'</span>'
      +'<span class="vt-cell-date">'+(cnt>1?cnt+'x · '+vd.date:vd.date+(vd.saat?' '+vd.saat:''))+'</span>'
      +'<span class="vt-cell-code">'+vd.tc+'</span>';
    var dc=0,dt; btn.addEventListener('click',function(){
      dc++;clearTimeout(dt);dt=setTimeout(function(){
        var vi=SD.visits;
        var ac=SD.actingTech(co),code=ac?ac.code:'—',mine=SD.visitEntryFor(vi[vk],code);
        if(dc===1){if(mine&&((mine.count||1)>1)){var dn=(mine.dates||[]).slice();dn.pop();vi[vk]=SD.putVisitEntry(vi[vk],code,{date:mine.date,saat:mine.saat,status:'done',count:(mine.count||1)-1,dates:dn});}else if(mine){vi[vk]=SD.putVisitEntry(vi[vk],code,{date:mine.date,saat:mine.saat,status:'pending',count:1,dates:mine.dates||[]});}}
        else{var cur=mine||{},n=new Date(),dA=(cur.dates||[cur.date||DT.ddmm(n)]).slice();dA.push(DT.ddmm(n));vi[vk]=SD.putVisitEntry(vi[vk],code,{date:DT.ddmm(n),count:(cur.count||1)+1,dates:dA,saat:DT.hhii(n),status:'done'});tToast((cur.count||1)+1+'. ziyaret!','success');}
        SD.visits=vi;dc=0;render();
      },260);
    });
  } else if (vd && vd.status==='pending'){
    btn.className+=' vt-cell-pending';
    btn.innerHTML='<span style="font-size:14px;">⏳</span>'
      +'<span class="vt-cell-date">'+vd.date+(vd.saat?' '+vd.saat:'')+'</span>'
      +'<span class="vt-cell-code">'+vd.tc+'</span>';
    btn.addEventListener('click',function(){var vi=SD.visits,ac=SD.actingTech(co),code=ac?ac.code:'—',mine=SD.visitEntryFor(vi[vk],code);if(mine)vi[vk]=SD.putVisitEntry(vi[vk],code,{date:mine.date,saat:mine.saat,count:mine.count||1,status:'done',dates:[mine.date],endDate:DT.ddmmyyyy(new Date()),endTime:DT.hhii(new Date())});SD.visits=vi;tToast('Onaylandı 🔒','success');render();});
  } else if (col.isCur){
    btn.className+=' vt-cell-empty';
    btn.innerHTML='<span style="font-size:18px;color:#D1D5DB;">○</span>';
    btn.addEventListener('click',function(){var vi=SD.visits,ac=SD.actingTech(co),n=new Date(),code=ac?ac.code:'—';vi[vk]=SD.putVisitEntry(vi[vk],code,{date:DT.ddmm(n),count:1,status:'pending',saat:DT.hhii(n)});SD.visits=vi;tToast('Planlandı ⏳','info');render();});
  } else if (col.isPast){
    btn.className+=' vt-cell-miss';
    btn.innerHTML='<span style="font-size:15px;font-weight:900;color:var(--red);">✕</span>';
    btn.addEventListener('click',function(){var vi=SD.visits,ac=SD.actingTech(co),n=new Date(),code=ac?ac.code:'—';vi[vk]=SD.putVisitEntry(vi[vk],code,{date:DT.ddmm(n),count:1,status:'pending',saat:DT.hhii(n)});SD.visits=vi;tToast('Planlandı','info');render();});
  } else {
    btn.className+=' vt-cell-future'; btn.disabled=true;
    btn.innerHTML='<span style="font-size:12px;color:#D1D5DB;font-weight:600;">Sonra</span>';
  }
  return btn;
}

/* ── Mobil Kart ── */
function makeMobileCard(co, vd, prevV, cwk, feats, viewWeeks){
  var card = document.createElement('div'); card.className='visit-card';
  var cnt = (vd&&vd.count)||0;
  if(vd&&vd.status==='done') card.classList.add('done-card');
  if(vd&&vd.status==='pending') card.classList.add('pending-card');

  var bg = BL.avatarColor(co.name||'?');

  /* Header */
  var weeks = (co.weeks||[1,2,3,4]).map(function(w){return w+'.H';}).join(', ');
  var statusBadge='';
  if(vd&&vd.status==='done'){
    statusBadge='<span class="status-pill '+(cnt>1?'pill-multi':'pill-done')+'">'+svgLock(14)+(cnt>1?cnt+'x · '+vd.date:' '+vd.date+(vd.saat?' '+vd.saat:''))+'</span>';
  } else if(vd&&vd.status==='pending'){
    statusBadge='<span class="status-pill pill-pending">⏳ '+vd.date+(vd.saat?' '+vd.saat:'')+'</span>';
  }

  var hd='<div class="vc-header">'
    +'<div class="vc-icon" style="background:linear-gradient(135deg,'+bg+','+shadeHex(bg,-25)+')">'
    +BL.getInitials(co.name)+'</div>'
    +'<div class="vc-info">'
    +'<div class="vc-name">'+co.name+'</div>'
    +'<div class="vc-meta">'
    +'<span class="vc-tag vc-tag-blue">'+(co.weeks||[1,2,3,4]).length+'x/ay</span>'
    +(co.bolge?'<span class="vc-tag vc-tag-gray">'+co.bolge+'</span>':'')
    +(co.truck?'<span class="vc-tag vc-tag-amber">🚚</span>':'')
    +'</div>'+'</div>'
    +(statusBadge?'<div class="vc-status">'+statusBadge+'</div>':'')
    +'</div>';

  /* Önceki ziyaret */
  var prevHtml='';
  if(prevV){
    prevHtml='<div class="vc-prev">'
      +'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
      +' Önceki ziyaret: <b>'+prevV.date+'</b>'+(prevV.tc?' · '+prevV.tc:'')
      +'</div>';
  }

  /* Aksiyon butonları */
  var acts = document.createElement('div'); acts.className='vc-actions';

  if (!vd){
    /* Planla */
    var planBtn = mkBtn('va-btn va-plan','📅 Planla',function(){
      var vi=SD.visits,ac=SD.actingTech(co),n=new Date(),code=ac?ac.code:'—';
      vi[co.id+'_'+cwk]=SD.putVisitEntry(vi[co.id+'_'+cwk],code,{date:DT.ddmm(n),count:1,status:'pending',saat:DT.hhii(n)});
      SD.visits=vi;tToast('Planlandı ⏳','info');render();
    });
    acts.appendChild(planBtn);
    if(co.truck&&co.email){
      acts.appendChild(mkBtn('va-btn va-map','🚚',function(){sendTruck(co);}));
    }
  } else if (vd.status==='pending'){
    acts.appendChild(mkBtn('va-btn va-confirm',svgCheck()+' Onayla',function(){
      var vi=SD.visits,ac=SD.actingTech(co),code=ac?ac.code:'—',mine=SD.visitEntryFor(vi[co.id+'_'+cwk],code);if(mine){vi[co.id+'_'+cwk]=SD.putVisitEntry(vi[co.id+'_'+cwk],code,{date:mine.date,saat:mine.saat,count:mine.count||1,status:'done',dates:mine.dates&&mine.dates.length?mine.dates:[mine.date],endDate:DT.ddmmyyyy(new Date()),endTime:DT.hhii(new Date())});}
      SD.visits=vi;tToast('Ziyaret tamamlandı 🔒','success');render();
    }));
    acts.appendChild(mkBtn('va-btn va-undo','←',function(){
      var today=new Date(),currentWeekKey=DT.wkey(today);
      if(cwk!==currentWeekKey){
        tToast('Geçmiş haftalardaki veriler silinemez!','error');
        return;
      }
      var vi=SD.visits,ac=SD.actingTech(co),code=ac?ac.code:'—';vi[co.id+'_'+cwk]=SD.removeVisitEntry(vi[co.id+'_'+cwk],code);SD.visits=vi;tToast('İptal edildi','warning');render();
    }));
  } else if (vd.status==='done'){
    /* Tamamlandı */
    var doneSpan=document.createElement('div');
    doneSpan.className='va-btn va-plan';
    doneSpan.style.cssText='background:var(--green-l);color:var(--green);border-color:var(--green-m);cursor:default;flex:1;justify-content:center;';
    doneSpan.innerHTML=svgCheck()+' Tamamlandı'+(cnt>1?' ('+cnt+'x)':'');
    acts.appendChild(doneSpan);
    acts.appendChild(mkBtn('va-btn va-add2','+2',function(){
      var vi=SD.visits,n=new Date(),ac=SD.actingTech(co),code=ac?ac.code:'—',cur=SD.visitEntryFor(vi[co.id+'_'+cwk],code)||{};
      var dA=(cur.dates||[cur.date||DT.ddmm(n)]).slice();dA.push(DT.ddmm(n));
      vi[co.id+'_'+cwk]=SD.putVisitEntry(vi[co.id+'_'+cwk],code,{date:DT.ddmm(n),count:(cur.count||1)+1,dates:dA,saat:DT.hhii(n),status:'done'});
      SD.visits=vi;tToast((cur.count||1)+1+'. ziyaret eklendi!','success');render();
    }));
    acts.appendChild(mkBtn('va-btn va-undo','←',function(){
      var vi=SD.visits,ac=SD.actingTech(co),code=ac?ac.code:'—',mine=SD.visitEntryFor(vi[co.id+'_'+cwk],code);
      if(mine&&((mine.count||1)>1)){var dates=(mine.dates||[]).slice();dates.pop();vi[co.id+'_'+cwk]=SD.putVisitEntry(vi[co.id+'_'+cwk],code,{date:mine.date,saat:mine.saat,count:(mine.count||1)-1,dates:dates,status:'done'});}
      else if(mine){vi[co.id+'_'+cwk]=SD.putVisitEntry(vi[co.id+'_'+cwk],code,{date:mine.date,saat:mine.saat,count:1,dates:mine.dates||[],status:'pending'});}
      SD.visits=vi;tToast('Geri alındı','warning');render();
    }));
  }

  if (co.lat){
    var mapA=document.createElement('a');
    mapA.href='https://www.google.com/maps?q='+co.lat+','+co.lng;
    mapA.target='_blank';mapA.rel='noopener';mapA.className='va-map';
    mapA.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
    acts.appendChild(mapA);
  }

  card.innerHTML = hd + prevHtml;
  if (acts.children.length) card.appendChild(acts);
  return card;
}

function mkBtn(cls, html, fn){
  var b=document.createElement('button');b.className=cls;
  if(typeof html==='string') b.innerHTML=html; else b.textContent=html;
  b.addEventListener('click',fn);return b;
}

/* ── Ziyaret Edilmeyenler Sheet ── */
function openMissedSheet(){
  var tech=SD.activeTech(),vis=SD.visits,cos=SD.companies,today=new Date();
  var cwk=DT.wkey(today),weeks=DT.monthWeeks(today.getFullYear(),today.getMonth());
  var cwi=weeks.findIndex(function(m){return m.getTime()===DT.monday(today).getTime();})+1;
  var missed=cos.filter(function(co){
    return co.techId===tech.id && BL.scheduled(co,cwi) && !vis[co.id+'_'+cwk];
  });
  var mt=document.getElementById('missedTitle');
  if(mt) mt.textContent='Ziyaret Edilmeyenler — '+tech.code+' ('+missed.length+')';
  var ml=document.getElementById('missedList'); if(!ml) return; ml.innerHTML='';
  if(!missed.length){
    ml.innerHTML='<div style="text-align:center;padding:24px;color:var(--muted);">Tüm firmalar ziyaret edildi 🎉</div>';
    openSheet('missedSheet');return;
  }
  missed.forEach(function(co,i){
    var row=document.createElement('div');
    row.style.cssText='display:flex;align-items:flex-start;gap:14px;background:var(--red-l);border:1px solid var(--red-m);border-radius:14px;padding:12px 16px;cursor:pointer;user-select:none;transition:all .15s;';
    var num=document.createElement('span');
    num.style.cssText='width:28px;height:28px;border-radius:50%;background:var(--red);color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;min-width:28px;';
    num.textContent=i+1;
    var body=document.createElement('div');
    body.innerHTML='<div style="font-size:13px;font-weight:700;color:var(--text);">'+co.name+'</div>'
      +(co.bolge?'<div style="font-size:12px;color:var(--text3);margin-top:2px;">'+co.bolge+'</div>':'');
    row.appendChild(num);row.appendChild(body);
    /* 2× tık → gidildi */
    var clicks=0,clickTimer;
    row.addEventListener('click',function(){
      clicks++;clearTimeout(clickTimer);
      if(clicks>=2){
        clicks=0;row.style.background='var(--green-l)';row.style.borderColor='var(--green-m)';num.style.background='var(--green)';
        var vi=SD.visits,ac=SD.actingTech(co),n=new Date(),code=ac?ac.code:'—';
        vi[co.id+'_'+cwk]=SD.putVisitEntry(vi[co.id+'_'+cwk],code,{date:DT.ddmm(n),count:1,status:'pending',saat:DT.hhii(n)});
        SD.visits=vi;tToast('Planlandı: '+co.name,'success');
        setTimeout(openMissedSheet,400);
      } else {
        row.style.opacity='.7';
        clickTimer=setTimeout(function(){clicks=0;row.style.opacity='1';},600);
      }
    });
    ml.appendChild(row);
  });
  openSheet('missedSheet');
}

/* ── Truck Mail ── */
function sendTruck(co){
  if(typeof _sendTruck!=='function'){tToast('Mail servisi hazır değil.','error');return;}
  _sendTruck(co);
}

/* ── Rapor ── */
function openRaporSheet(){ buildRapor(); openSheet('raporSheet'); }
function onFab(){
  T.step++;
  var fab=document.getElementById('fabBtn'),txt=document.getElementById('fabTxt');
  if(T.step===1){
    if(fab)fab.classList.add('step2');
    if(txt)txt.textContent='📤 Tekrar tıkla: Gönder!';
    buildRapor(); openSheet('raporSheet');
    T._fabTimer=setTimeout(function(){T.step=0;if(fab)fab.classList.remove('step2');if(txt)txt.textContent='Günlük Rapor Gönder';},8000);
  } else {
    T.step=0;clearTimeout(T._fabTimer);
    if(fab)fab.classList.remove('step2');if(txt)txt.textContent='Günlük Rapor Gönder';
    sendRapor();
  }
}

function buildRapor(){
  var tech=SD.activeTech(),vis=SD.visits,cos=SD.companies,today=new Date();
  var cwk=DT.wkey(today),weeks=DT.monthWeeks(today.getFullYear(),today.getMonth());
  var cwi=weeks.findIndex(function(m){return m.getTime()===DT.monday(today).getTime();})+1;
  var mf=cos.filter(function(c){return c.techId===tech.id&&BL.scheduled(c,cwi);});
  var doneL=mf.filter(function(c){var v=vis[c.id+'_'+cwk];return v&&v.status==='done';});
  var missL=mf.filter(function(c){var v=vis[c.id+'_'+cwk];return !v||v.status!=='done';});
  var NL=String.fromCharCode(10);
  var lines=['SERVİSDRAMA — GÜNLÜK RAPOR',DT.ddmmyyyy(today)+' · '+DT.isoWeek(today)+'. Hafta',
    '🔧 '+tech.name+' ('+tech.code+')','═'.repeat(38),'',
    '✅ Tamamlananlar ('+doneL.length+'/'+mf.length+'):'];
  doneL.forEach(function(c){var v=vis[c.id+'_'+cwk];lines.push('  ✓ '+c.name+(v&&v.saat?' ('+v.saat+')':''));});
  if(missL.length){lines.push('');lines.push('❌ Eksik ('+missL.length+'):');missL.forEach(function(c){lines.push('  ✗ '+c.name);});}
  var ta=document.getElementById('raporTa');if(ta)ta.value=lines.join(NL);
}

function previewRaporHTML(){
  var w=window.open('','RaporOnizle','width=900,height=700');
  var ta=document.getElementById('raporTa'),txt=ta?ta.value:'';
  w.document.write('<pre style="padding:20px;font-family:monospace;font-size:13px;line-height:1.6;white-space:pre-wrap;word-wrap:break-word;">'+txt.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</pre>');
  w.document.close();
  tToast('Rapor önizlemesi açıldı','success');
}

function copyRaporCode(){
  var ta=document.getElementById('raporTa'),txt=ta?ta.value:'';
  try{navigator.clipboard.writeText(txt);tToast('Kod kopyalandı!','success');}
  catch(e){tToast('Kopyalama hatası','error');}
}

function sendRapor(){
  if(!canSendReport()){
    tToast('Bu işlem için yetkiniz yok. Rapor gönderme izni sadece barkin.kayaci tarafından verilebilir.','error');
    return;
  }
  var cfg=SD.config,tech=SD.activeTech();
  var ta=document.getElementById('raporTa'),txt=ta?ta.value:'';
  var to=cfg.reportTo||'barkin.kayaci@dramamakine.com';
  var subj=encodeURIComponent((cfg.subjectPrefix||'ServisDrama')+' — '+(tech?tech.name:'')+' — '+DT.ddmmyyyy(new Date()));
  closeSheet();
  window.location.href='mailto:'+encodeURIComponent(to)+'?subject='+subj+'&body='+encodeURIComponent(txt);
  tToast('Mail penceresi açıldı ✓','success');
}

function copyRapor(){
  var ta=document.getElementById('raporTa');if(!ta)return;
  try{navigator.clipboard.writeText(ta.value);}catch(e){ta.select();document.execCommand('copy');}
  tToast('Kopyalandı!','success');
}

function updateTechSendMailButtonState(){
  var btn=document.getElementById('techSendMailBtn');
  if(!btn)return;
  var canSend=canSendReport();
  btn.disabled=!canSend;
  btn.title=canSend?'Mail Gönder':'Rapor gönderme izni yok (barkin.kayaci tarafından verilmesi gerekli)';
  btn.style.opacity=canSend?'1':'0.5';
  btn.style.cursor=canSend?'pointer':'not-allowed';
}

/* ── Yardımcılar ── */
function svgLock(sz){ sz=sz||14; return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'; }
function svgCheck(){ return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'; }
function shadeHex(hex,pct){
  var n=parseInt(hex.replace('#',''),16);
  var r=Math.max(0,Math.min(255,(n>>16)+pct));
  var g=Math.max(0,Math.min(255,((n>>8)&255)+pct));
  var b=Math.max(0,Math.min(255,(n&255)+pct));
  return '#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);
}

/* ═══ TECHNİSYEN LOGIN ═══ */
function techLogin(){
  var code=document.getElementById('techCode').value.trim();
  var pass=document.getElementById('techPass').value.trim();
  var errEl=document.getElementById('techLoginErr');

  if(!code||!pass){
    errEl.textContent='Kod ve şifre gerekli';
    errEl.style.display='block';
    return;
  }

  SD.seed();
  var techs=SD.technicians||[];
  var users=SD.users||[];
  var tech=techs.find(function(t){return t.code===code;});

  if(!tech){
    var user=users.find(function(u){return u.username===code && u.role==='tech';});
    if(user){
      tech=techs.find(function(t){return t.id===user.techId;});
      pass=user.password;
    }
  }

  if(!tech){
    errEl.textContent='Geçersiz teknisyen kodu veya kullanıcı adı';
    errEl.style.display='block';
    return;
  }

  if(tech.password!==document.getElementById('techPass').value.trim()){
    errEl.textContent='Şifre hatalı';
    errEl.style.display='block';
    return;
  }

  localStorage.setItem('sd_ac', tech.id);
  localStorage.setItem('techCode', code);
  document.getElementById('techLoginScreen').style.display='none';
  window.location.href='tech.html?v=20260804-sync';
}

function initTechPanel(){
  /* Ana giriş oturumunu eski, çalışan teknisyen ekranına bağla.
     Kullanıcı teknisyen rolündeyse ikinci kez kod/şifre isteme. */
  var sessionTech=null;
  try{
    if(typeof SD!=='undefined' && typeof SD.sessionTech==='function'){
      sessionTech=SD.sessionTech();
    }
  }catch(e){ sessionTech=null; }

  if(sessionTech && sessionTech.id){
    localStorage.setItem('sd_ac', sessionTech.id);
    localStorage.setItem('techCode', String(sessionTech.code||''));
    sessionStorage.setItem('sd_role_id', sessionTech.id);
    document.getElementById('techLoginScreen').style.display='none';
    return true;
  }

  /* Eski çalışan davranış: daha önce teknisyen kodu kaydedildiyse paneli aç. */
  var code=localStorage.getItem('techCode');
  if(code){
    var techs=(typeof SD!=='undefined' && SD.technicians)||[];
    var matched=techs.find(function(t){return String(t.code||'')===String(code);});
    if(matched){
      localStorage.setItem('sd_ac', matched.id);
      sessionStorage.setItem('sd_role_id', matched.id);
      document.getElementById('techLoginScreen').style.display='none';
      return true;
    }
    localStorage.removeItem('techCode');
  }

  document.getElementById('techLoginScreen').style.display='flex';
  return false;
}

function renderNumunePage(){
  var tech=SD.activeTech();
  var myFirms=SD.companies.filter(function(c){return c.techId===tech.id;});
  var el=document.getElementById('numuneList');
  if(!el) return;
  el.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--text2);padding:40px 20px;">📦 Henüz numune kaydı yok.<br><button onclick="alert(\'Firma seçerek numune ekle\')" style="margin-top:10px;padding:8px 16px;background:var(--blue);color:#fff;border:none;border-radius:6px;cursor:pointer;">+ Numune Ekle</button></div>';
}

function renderIstatistikPage(){
  var tech=SD.activeTech();
  var cos=SD.companies,vis=SD.visits||{};
  var myFirms=cos.filter(function(c){return c.techId===tech.id;});
  var today=new Date();
  var weeks=DT.monthWeeks(today.getFullYear(),today.getMonth());
  var cwk=DT.wkey(today);
  var cwi=weeks.findIndex(function(m){return m.getTime()===DT.monday(today).getTime();})+1;

  var ttl=document.getElementById('istatTitle');
  if(ttl) ttl.textContent='📈 İstatistiklerim — '+tech.name+' ('+tech.code+')';

  /* Bu hafta tamamlanan (yalnızca bu teknisyenin firmaları) */
  var thisWD=0;
  myFirms.forEach(function(c){
    if(BL.scheduled(c,cwi)&&vis[c.id+'_'+cwk]&&vis[c.id+'_'+cwk].status==='done')thisWD++;
  });

  /* Bu ay planlanan / tamamlanan (yalnızca bu teknisyenin firmaları) */
  var totS=0,totD=0;
  weeks.forEach(function(wm,i){
    var wk=DT.wkey(wm);
    myFirms.forEach(function(c){
      if(BL.scheduled(c,i+1)){
        totS++;
        if(vis[c.id+'_'+wk]&&vis[c.id+'_'+wk].status==='done')totD++;
      }
    });
  });
  var pct=totS?Math.round(totD/totS*100):0;

  /* Toplam ziyaret — tüm zamanlar, yalnızca bu teknisyenin firmaları */
  var totalVisits=0;
  myFirms.forEach(function(c){
    Object.keys(vis).forEach(function(k){
      if(k.indexOf(c.id+'_')===0&&vis[k]&&vis[k].status==='done')totalVisits++;
    });
  });

  var el=document.getElementById('istatContent');
  if(!el)return;

  var kpis=[
    {icon:'📅',lbl:'Bu Hafta',val:thisWD,sub:'tamamlanan',bg:'var(--blue-l)',c:'var(--blue)'},
    {icon:'📈',lbl:'Aylık %',val:pct+'%',sub:totD+'/'+totS,bg:'var(--green-l)',c:'var(--green)'},
    {icon:'✅',lbl:'Toplam Ziyaret',val:totalVisits,sub:'tüm zamanlar',bg:'var(--amber-l)',c:'var(--amber)'},
    {icon:'🏭',lbl:'Firmalarım',val:myFirms.length,sub:'atanmış firma',bg:'var(--purple-l)',c:'var(--purple)'}
  ];
  var kpiHtml='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:24px;">'
    +kpis.map(function(k){
      return '<div style="background:'+k.bg+';padding:18px;border-radius:var(--r-xl);border:1px solid rgba(0,0,0,.04);">'
        +'<div style="font-size:22px;margin-bottom:6px;">'+k.icon+'</div>'
        +'<div style="font-size:26px;font-weight:800;color:'+k.c+';line-height:1;">'+k.val+'</div>'
        +'<div style="font-size:12.5px;font-weight:700;color:var(--text2);margin-top:4px;">'+k.lbl+'</div>'
        +'<div style="font-size:11px;color:var(--muted);margin-top:1px;">'+k.sub+'</div>'
        +'</div>';
    }).join('')
    +'</div>';

  /* Firma bazlı liste — en uzun süredir ziyaret edilmeyen en üstte */
  var firmalar=myFirms.map(function(c){
    var prev=SD.getPreviousCompletedVisit(c.id,today);
    var daysAgo=null;
    if(prev.dateObject){
      var d1=new Date(prev.dateObject.getFullYear(),prev.dateObject.getMonth(),prev.dateObject.getDate());
      var d2=new Date(today.getFullYear(),today.getMonth(),today.getDate());
      daysAgo=Math.floor((d2-d1)/(1000*60*60*24));
    }
    return {name:c.name,bolge:c.bolge||'',lastVisit:prev.date,daysAgo:daysAgo,dateObject:prev.dateObject};
  }).sort(function(a,b){
    if(!a.dateObject&&!b.dateObject)return a.name.localeCompare(b.name);
    if(!a.dateObject)return -1;
    if(!b.dateObject)return 1;
    return a.dateObject-b.dateObject;
  });

  var listHtml='<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Firmalarım — Son Ziyaret Durumu</div>'
    +'<div style="display:flex;flex-direction:column;gap:8px;">'
    +firmalar.map(function(f){
      var overdue=f.daysAgo===null||f.daysAgo>14;
      var badgeBg=overdue?'var(--red-l)':'var(--green-l)';
      var badgeC=overdue?'var(--red)':'var(--green)';
      var badgeTxt=f.daysAgo===null?'Kayıt yok':f.daysAgo+' gün önce';
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);padding:12px 16px;">'
        +'<div style="min-width:0;"><div style="font-weight:700;font-size:13.5px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+f.name+'</div>'
        +(f.bolge?'<div style="font-size:11.5px;color:var(--text3);margin-top:2px;">'+f.bolge+'</div>':'')+'</div>'
        +'<div style="flex-shrink:0;font-size:11.5px;font-weight:700;padding:5px 10px;border-radius:99px;background:'+badgeBg+';color:'+badgeC+';white-space:nowrap;">'+badgeTxt+'</div>'
        +'</div>';
    }).join('')
    +'</div>';

  el.innerHTML=kpiHtml+listHtml;
}
