/* ================================================================
   ServisDrama Admin JS v9 — Tam Sistem
   ================================================================ */

var A = {
  page:'ziyaret', vy:new Date().getFullYear(), vm:new Date().getMonth(),
  sy:new Date().getFullYear(), sm:new Date().getMonth(),
  editId:null, selWeeks:[1,2,3,4], aMails:[],
  mapLat:null, mapLng:null, _mapPicker:null,
  vsearch:'', fsearch:'', extraFirmaId:'', extraFirmaAdi:'',
  isMobile:function(){return window.innerWidth<768;},
  isTablet:function(){return window.innerWidth>=768 && window.innerWidth<1024;}
};

function on(id,ev,fn){var el=document.getElementById(id);if(el)el.addEventListener(ev,fn);}

/* ═══ YETKİ: sadece Barkın Kayacı ═══ */
function currentUsername(){
  try{
    var sess=sessionStorage.getItem('sd_session')||localStorage.getItem('sd_session_persist');
    var s=JSON.parse(sess);
    return String((s&&s.userData&&s.userData.username)||'').toLowerCase();
  }catch(e){return '';}
}
function isSuperAdmin(){return currentUsername()==='barkin.kayaci';}
function getCurrentUserId(){
  try{
    var sess=sessionStorage.getItem('sd_session')||localStorage.getItem('sd_session_persist');
    var s=JSON.parse(sess);
    return s&&s.userData&&s.userData.id;
  }catch(e){return null;}
}
function canSendReport(){
  if(isSuperAdmin())return true;
  var cfg=SD.config||{};
  var userId=getCurrentUserId();
  if(!userId)return false;
  var perms=cfg.sendReportPermissions||{};
  return perms[userId]!==false;
}
function canSendMail(){
  if(isSuperAdmin())return true;
  var cfg=SD.config||{};
  var mf=cfg.moduleFeatures||{};
  return mf.truckMail!==false;
}

/* ═══ MOBILE DETECTION & RESPONSIVE ═══ */
function setupResponsive(){
  if(A.isMobile()){
    document.body.classList.add('mobile-view');
    var hamburger=document.getElementById('mobileMenuBtn');
    if(hamburger)hamburger.classList.add('show');
  }else{
    document.body.classList.remove('mobile-view');
    var hamburger=document.getElementById('mobileMenuBtn');
    if(hamburger)hamburger.classList.remove('show');
    closeMobileMenu();
  }
}

/* Menü artık üst panelde; mobilde hamburger üst paneli açıp linkleri alta indirir */
function setMobileMenu(open){
  var topbar=document.getElementById('topbar');
  var nav=document.getElementById('navTabs');
  var overlay=document.getElementById('mobileOverlay');
  var button=document.getElementById('mobileMenuBtn');
  open=!!open;
  if(topbar)topbar.classList.toggle('nav-open',open);
  if(nav){nav.classList.toggle('mobile-open',open);nav.setAttribute('aria-hidden',open?'false':'true');}
  if(overlay)overlay.classList.toggle('show',open);
  if(button)button.setAttribute('aria-expanded',open?'true':'false');
  document.body.classList.toggle('menu-open',open);
}
function toggleMobileMenu(event){
  if(event){event.preventDefault();event.stopPropagation();}
  var topbar=document.getElementById('topbar');
  setMobileMenu(!(topbar&&topbar.classList.contains('nav-open')));
  return false;
}
function closeMobileMenu(){setMobileMenu(false);}

/* Hamburger menü, API/Neon ve oturum yüklemesinden bağımsız olarak hemen bağlanır. */
function initMobileMenuControls(){
  var button=document.getElementById('mobileMenuBtn');
  var overlay=document.getElementById('mobileOverlay');
  if(button&&!button.dataset.menuBound){
    button.dataset.menuBound='1';
    button.setAttribute('aria-expanded','false');
    button.addEventListener('click',toggleMobileMenu,{passive:false});
  }
  if(overlay&&!overlay.dataset.menuBound){
    overlay.dataset.menuBound='1';
    overlay.addEventListener('click',function(e){e.preventDefault();closeMobileMenu();});
  }
}


window.addEventListener('resize',setupResponsive);
setupResponsive();

/* ═══ BOOT ═══ */
document.addEventListener('DOMContentLoaded',async function(){
  initMobileMenuControls();
  setupResponsive();
  /* Oturum kontrolü */
  var sess=sessionStorage.getItem('sd_session');
  if(!sess){
    /* Sekme/tarayıcı kapanınca sessionStorage silinir - "Beni Hatırla" ile kaydedilmiş kalıcı oturum var mı bak */
    var persisted=localStorage.getItem('sd_session_persist');
    if(persisted){
      sessionStorage.setItem('sd_session',persisted);
      sess=persisted;
    }else{
      /* Kalıcı oturum da yoksa index.html'e dön */
      location.href='index.html';
      return;
    }
  }
  try{var s=JSON.parse(sess);}
  catch(e){location.href='index.html';return;}

  await SD.remoteReady();
  SD.seed();
  var cfg=SD.config;cfg.mailAlicilar=loadMailRecipients();SD.config=cfg;

  /* Teknisyen girişinde ziyaret kapsamını kendi firmalarına sabitle; başka bir
     teknisyenden kalan seçim taşınmasın. ALL bilinçli bir tercih, korunur. */
  var sessTech=SD.sessionTech();
  if(sessTech&&SD.activeTechId!==SD.ALL_TECH&&SD.activeTechId!==sessTech.id)SD.activeTechId=sessTech.id;

  /* Logo */
  var nl=document.getElementById('navLogo');if(nl)nl.src='assets/email/servisdrama/drama-makine-logo.png';

  /* Kullanıcı bilgileri */
  var cu=SD.currentUser||{name:'Admin'};
  // sessionStorage'dan giriş yapan kullanıcının verilerini al
  try{
    var sessData=JSON.parse(sess);
    if(sessData.userData && sessData.userData.name){
      cu.name=sessData.userData.name;
      cu.username=sessData.userData.username;
      cu.role=sessData.userData.role;
      cu.email=sessData.userData.email;
    }
  }catch(e){}

  // initials belirle
  if(!cu.initials) cu.initials=BL.getInitials(cu.name);

  // Navbar'da kullanıcı adını ve avatar'ı güncelle
  var navLabels=document.querySelectorAll('#navUserLabel');
  navLabels.forEach(function(el){el.textContent=cu.name;});

  // Avatar baş harfleri güncelle
  var avatarElements=document.querySelectorAll('.nav-user-avatar');
  avatarElements.forEach(function(el){el.textContent=cu.initials;});

  initNavAvatar(cu);

  /* Nav tabs */
  document.querySelectorAll('.nav-tab[data-page]').forEach(function(btn){
    btn.addEventListener('click',function(){goto(btn.dataset.page);closeDropdown();closeMobileMenu();});
  });

  /* Ay nav */
  on('prevM','click',function(){A.vm--;if(A.vm<0){A.vm=11;A.vy--;}renderVisit();});
  on('nextM','click',function(){A.vm++;if(A.vm>11){A.vm=0;A.vy++;}renderVisit();});
  on('statPrev','click',function(){A.sm--;if(A.sm<0){A.sm=11;A.sy--;}renderStat();});
  on('statNext','click',function(){A.sm++;if(A.sm>11){A.sm=0;A.sy++;}renderStat();});

  /* Rapor — onclick handler in admin.html already attached */
  updateRaporButtonState();

  /* Firma */
  on('firmaEkleBtn','click',function(){openFirmaModal(null);});
  on('firmaSearch','input',function(){A.fsearch=this.value;renderFirma();});
  on('fFilterTech','change',renderFirma);
  on('fFilterFreq','change',renderFirma);
  on('fFilterTruck','change',renderFirma);
  on('fFilterStatus','change',renderFirma);
  on('fFilterClear','click',function(){
    document.getElementById('fFilterTech').value='';
    document.getElementById('fFilterFreq').value='';
    document.getElementById('fFilterTruck').checked=false;
    document.getElementById('fFilterStatus').value='';
    renderFirma();
  });
  on('firmaSaveBtn','click',saveFirma);
  on('indirBtn','click',exportFirmalar);
  on('yukleBtn','click',function(){var el=document.getElementById('yukleInput');if(el)el.click();});
  on('yukleInput','change',importFirmalar);
  on('fAMailEkle','click',addAMail);
  on('mapPickBtn','click',openMapModal);
  on('mapSearchBtn','click',searchMapAddress);
  on('mapSave','click',saveMap);
  on('mapCancel','click',function(){UI.closeModal('mapModal');UI.openModal('firmaModal');});
  on('mapX','click',function(){UI.closeModal('mapModal');UI.openModal('firmaModal');});
  document.querySelectorAll('.week-tog').forEach(function(b){
    b.addEventListener('click',function(){
      var w=parseInt(b.dataset.w),i=A.selWeeks.indexOf(w);
      if(i>=0)A.selWeeks.splice(i,1);else A.selWeeks.push(w);
      renderWeekToggles();
    });
  });

  /* Ziyaret */
  on('visitSearch','input',function(){A.vsearch=this.value;renderVisit();});
  on('warnBanner','click',openMissedModal);
  on('extraBtn','click',openExtraVisitModal);
  on('extraSaveBtn','click',saveExtraVisit);

  /* Program dışı firma autocomplete */
  initAutocomplete('extraFirmaInp','extraFirmaAC',function(co){
    A.extraFirmaId=co.id;A.extraFirmaAdi=co.name;
    var sel=document.getElementById('extraFirmaSelected');if(sel)sel.textContent=co.name;
  });
  setupUppercaseInput('extraFirmaInp');

  /* Numune */
  on('stEkleBtn','click',function(){if(typeof openStModal==='function')openStModal();});
  on('stSearch','input',function(){if(typeof renderSamples==='function')renderSamples();});
  on('stSaveBtn','click',function(){if(typeof saveNumune==='function')saveNumune();});
  on('stResultSaveBtn','click',function(){if(typeof saveResult==='function')saveResult();});

  /* Ekip */
  on('saveTechBtn','click',saveTech);
  on('addUserSaveBtn','click',addNewUser);
  on('setupTechSaveBtn','click',saveSetupTechPassword);

  /* Settings tabs */
  document.querySelectorAll('.stab[data-stab]').forEach(function(b){
    b.addEventListener('click',function(){
      document.querySelectorAll('.stab').forEach(function(x){x.classList.remove('active');});
      b.classList.add('active');
      renderSettingsTab(b.dataset.stab);
    });
  });

  /* Dropdown dışı tıklama kapat */
  document.addEventListener('click',function(e){
    var menu=document.getElementById('navUserMenu');
    if(menu&&!menu.contains(e.target))closeDropdown();
  });

  /* Mail Alıcıları Events */
  on('mailRecipientClose','click',function(){UI.closeModal('mailRecipientModal');});
  on('mailRecipientCancel','click',function(){UI.closeModal('mailRecipientModal');});
  on('addMailBtn','click',addMailRecipient);
  on('newMailInput','keypress',function(e){if(e.key==='Enter'){addMailRecipient();}});
  on('manuelHariciToggle','change',function(){saveMailRecipientsMode(this.checked);});

  /* Mail Alıcıları Modal açıldığında yükle */
  var mrm=document.getElementById('mailRecipientModal');
  if(mrm){
    var origOpen=mrm.style.display;
    mrm.addEventListener('modal-open',function(){renderMailList();});
  }
  renderMailList();

  /* Global modal close handlers — tüm modal-x ve cancel button'larını kontrol et */
  document.querySelectorAll('.modal-x, [onclick*="closeModal"]').forEach(function(btn){
    btn.removeAttribute('onclick');
    btn.onclick=null;
    btn.addEventListener('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      var modalId=btn.closest('.overlay');
      if(modalId)UI.closeModal(modalId.id);
    });
  });

  /* Modal overlay dışına tıklandığında kapatma (ama propagation'ı durdur) */
  document.querySelectorAll('.overlay').forEach(function(overlay){
    overlay.addEventListener('click',function(e){
      if(e.target===overlay){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        UI.closeModal(overlay.id);
      }else{
        e.stopPropagation();
      }
    });
  });

  /* BÜYÜK HARF Otomatiği - tüm .st-uppercase input'lar */
  document.querySelectorAll('.st-uppercase').forEach(function(inp){
    inp.addEventListener('input',function(){this.value=this.value.toUpperCase();});
  });

  renderAll();
  var lastPage=localStorage.getItem('lastPage')||'ziyaret';
  if(lastPage==='dashboard')lastPage='ziyaret';
  goto(lastPage);

  /* Arka planda bekleyen sekme/PWA öne geldiğinde ve her 15 dakikada bir
     ortak veriyi sunucudan tazele — kullanıcı elle "yenile" yapmasa da
     ekrandaki veri güncel kalsın. */
  function adminEditingInProgress(){
    var modal=document.querySelector('.overlay:not(.hidden)');
    var ae=document.activeElement,tag=ae&&ae.tagName;
    return !!modal || tag==='INPUT' || tag==='TEXTAREA' || tag==='SELECT' || (ae&&ae.isContentEditable);
  }
  function autoRefreshData(){
    if(SD.syncBusy()||adminEditingInProgress())return;
    SD.remoteReady().then(function(){if(!adminEditingInProgress()){SD.seed();goto(A.page||lastPage);}});
  }
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='visible')autoRefreshData();
  });
  setInterval(function(){if(!SD.syncBusy())autoRefreshData();},15000);
});

/* ═══ LOGOUT ═══ */
function doLogout(){
  sessionStorage.removeItem('sd_session');
  localStorage.removeItem('sd_session_persist');
  SD.currentUser=null;
  location.reload();
}

/* ═══ AVATAR MENÜ ═══ */
function initNavAvatar(cu){
  var img=document.getElementById('navAvatarImg');
  var dd=document.getElementById('navDdAvatar');
  var lbl=document.getElementById('navUserLabel');
  var ddName=document.getElementById('navDdName');
  if(lbl)lbl.textContent=cu.name||'';
  if(ddName)ddName.textContent=cu.name||'';
  var initials=cu.initials||BL.getInitials(cu.name||'BK');
  var color=BL.avatarColor(cu.name||'BK');
  if(img){img.textContent=initials;img.style.background=color;}
  if(dd){dd.textContent=initials;dd.style.background=color;}
  /* Avatar yüklü ise göster */
  if(cu.avatar&&cu.avatar.length>10){
    if(img)img.innerHTML='<img src="'+cu.avatar+'" alt="">';
    if(dd)dd.innerHTML='<img src="'+cu.avatar+'" alt="">';
  }
}
function toggleUserMenu(){
  var dd=document.getElementById('navDropdown');if(!dd)return;
  dd.classList.toggle('hidden');
}
function closeDropdown(){var dd=document.getElementById('navDropdown');if(dd)dd.classList.add('hidden');}

/* ═══ GOTO ═══ */
function goto(p){
  if(p==='dashboard')p='ziyaret';
  A.page=p;
  localStorage.setItem('lastPage',p);
  document.querySelectorAll('.nav-tab[data-page]').forEach(function(b){b.classList.toggle('active',b.dataset.page===p);});
  document.querySelectorAll('.pg').forEach(function(el){el.classList.toggle('hidden',el.id!=='pg-'+p);});
  var tabs=document.getElementById('navTabs');if(tabs)tabs.style.display='';
  if(p==='istatistik')renderStat();
  if(p==='numune')renderNumune();
  if(p==='ayarlar'){renderSettingsTab('genel');}
  if(p==='raporlar'&&typeof renderDetailedReports==='function')renderDetailedReports();
  if(p==='numune'&&typeof renderSamples==='function')renderSamples();
  var monthNav=document.getElementById('visitMonthNav');if(monthNav)monthNav.style.display=p==='ziyaret'?'':'none';
}

function updateRaporButtonState(){
  var btn=document.querySelector('.zt-rapor-btn');
  if(!btn)return;
  var canSend=canSendReport();
  btn.disabled=!canSend;
  btn.title=canSend?'Rapor gönder':'Rapor gönderme izni yok (barkin.kayaci tarafından verilmesi gerekli)';
  btn.style.opacity=canSend?'1':'0.5';
  btn.style.cursor=canSend?'pointer':'not-allowed';
}
function renderAll(){renderTechBtns();renderFirma();renderVisit();renderExtraVisits();renderSetupBanner();updateRaporButtonState();}

/* ═══ TEKNİSYEN BUTONLARI ═══ */
function renderTechBtns(){
  var ts=SD.technicians,ac=SD.activeTechId;
  var wrap=document.getElementById('ztBtns');if(!wrap)return;
  var me=SD.sessionTech();   /* teknisyen girişi ise kendi kaydı, admin ise null */
  wrap.innerHTML='';
  ts.forEach(function(t){
    /* Teknisyen yalnızca kendi kodunu görür; başkasının firmalarına ALL üzerinden erişir */
    if(me&&t.id!==me.id)return;
    /* Teknisyene atanmış AKTİF firma yoksa butonu gösterme */
    var coCount=SD.companies.filter(function(c){return c.techId===t.id&&c.aktif!==false;}).length;
    if(!coCount)return;
    var b=document.createElement('button');b.className='tech-btn'+(t.id===ac?' active':'');
    b.textContent=t.code;b.title=t.name;
    b.addEventListener('click',function(){SD.activeTechId=t.id;renderTechBtns();renderVisit();renderSetupBanner();});
    wrap.appendChild(b);
  });
  /* ALL — tüm teknisyenlerin firmaları. Başka birinin firmasına gidildiyse buradan işaretlenir;
     ziyaret giriş yapan teknisyenin adına kaydedilir ve raporda onun altında çıkar. */
  var allBtn=document.createElement('button');
  allBtn.className='tech-btn tech-btn-all'+(ac===SD.ALL_TECH?' active':'');
  allBtn.textContent='ALL';allBtn.title='Tüm firmalar — başka teknisyenin firmasını da işaretleyebilirsiniz';
  allBtn.addEventListener('click',function(){SD.activeTechId=SD.ALL_TECH;renderTechBtns();renderVisit();renderSetupBanner();});
  wrap.appendChild(allBtn);
  var lbl=document.getElementById('ztActiveLbl');
  if(lbl){var at=SD.activeTech();lbl.textContent=at?'Aktif: '+at.code:(ac===SD.ALL_TECH?'Aktif: Tüm firmalar':'');}
}

/* ═══ KURULUM BANNER ═══ */
function renderSetupBanner(){
  var banner=document.getElementById('setupBanner');if(!banner)return;
  var cos=SD.companies;
  var t=new Date(),todayStr=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
  var setup=cos.filter(function(c){return !!c.kurulumStart&&(!c.kurulumEnd||c.kurulumEnd>=todayStr);});
  if(!setup.length){banner.innerHTML='';return;}
  var html='<div class="setup-banner"><div class="setup-hd">'
    +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'
    +'<span class="setup-ttl">Kurulum Sürecindeki Firmalar</span>'
    +'<span class="setup-count">'+setup.length+'</span></div>';
  setup.forEach(function(c){
    var fmtSetupDate=function(v){if(!v)return '';var p=String(v).split('-');return p.length===3?p[2]+'.'+p[1]+'.'+p[0]:String(v);};
    var setupRange=fmtSetupDate(c.kurulumStart)+(c.kurulumStartTime?' · '+c.kurulumStartTime:'')+' → '+(c.kurulumEnd?fmtSetupDate(c.kurulumEnd)+(c.kurulumEndTime?' · '+c.kurulumEndTime:''):'Devam ediyor');
    html+='<div class="setup-row"><span class="setup-name">'+c.name+'</span><span class="setup-date">'+setupRange+'</span></div>';
  });
  html+='</div>';
  banner.innerHTML=html;
}

/* ═══ FİRMALAR ═══ */
function _freqBucket(co){
  var n=(co.weeks||[1,2,3,4]).length;
  if(n===4)return'4';if(n===2)return'2';if(n===1)return'1';return'other';
}
function renderFirmaFilterOptions(){
  var sel=document.getElementById('fFilterTech');if(!sel||sel.options.length>1)return;
  SD.technicians.forEach(function(t){
    var o=document.createElement('option');o.value=t.id;o.textContent=t.code+' — '+t.name;sel.appendChild(o);
  });
}
function renderFirma(){
  var admOnly=isSuperAdmin();
  ['indirBtn','yukleBtn'].forEach(function(bid){var b=document.getElementById(bid);if(b)b.classList.toggle('hidden',!admOnly);});
  renderFirmaFilterOptions();
  var cos=SD.companies,ts=SD.technicians,tm={};
  ts.forEach(function(t){tm[t.id]=t;});
  var q=A.fsearch.toLocaleLowerCase('tr');
  var fTechEl=document.getElementById('fFilterTech'),fFreqEl=document.getElementById('fFilterFreq'),fTruckEl=document.getElementById('fFilterTruck'),fStatusEl=document.getElementById('fFilterStatus');
  var fTech=fTechEl?fTechEl.value:'',fFreq=fFreqEl?fFreqEl.value:'',fTruck=fTruckEl?fTruckEl.checked:false,fStatus=fStatusEl?fStatusEl.value:'';
  var filtered=cos.filter(function(c){
    if(q&&c.name.toLocaleLowerCase('tr').indexOf(q)<0)return false;
    if(fTech&&c.techId!==fTech)return false;
    if(fFreq&&_freqBucket(c)!==fFreq)return false;
    if(fTruck&&!c.truck)return false;
    if(fStatus==='active'&&c.aktif===false)return false;
    if(fStatus==='inactive'&&c.aktif!==false)return false;
    return true;
  });
  /* Pasif firmalar listenin en altına alınır (aktifler kendi sırasını korur) */
  var activeList=filtered.filter(function(c){return c.aktif!==false;});
  var inactiveList=filtered.filter(function(c){return c.aktif===false;});
  filtered=activeList.concat(inactiveList);
  var allCos=SD.companies,activeCos=allCos.filter(function(c){return c.aktif!==false;}),pasifCos=allCos.filter(function(c){return c.aktif===false;});
  var sub=document.getElementById('firmaSub');if(sub)sub.textContent=filtered.length+' / '+allCos.length+' firma ('+(activeCos.length)+'✓ / '+pasifCos.length+'🚫)';
  var list=document.getElementById('firmaList');if(!list)return;
  list.innerHTML='';
  var emp=document.getElementById('firmaEmpty');if(emp)emp.classList.toggle('hidden',filtered.length>0);
  filtered.forEach(function(co){
    var t=tm[co.techId];
    var weeks=(co.weeks||[1,2,3,4]).map(function(w){return w+'.H';}).join(', ');
    var isPasif=co.aktif===false;
    var card=document.createElement('div');card.className='co-card'+(isPasif?' co-card-pasif':'');
    var icon='<div class="co-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg></div>';
    var badges=(isPasif?'<span class="co-pasif-badge">PASİF</span> ':'')+(co.truck?'🚚 ':'')+' '+(co.lat?'📍 ':'')+' '+(co.kurulumStart?'🔧':'');
    var kurulum=co.kurulumStart?'<div class="co-kurulum"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>Kurulum: '+co.kurulumStart+' → '+co.kurulumEnd+'</div>':'';
    var body='<div class="co-body"><div style="display:flex;align-items:center;gap:7px;"><div class="co-name">'+co.name+'</div><span style="font-size:13px;">'+badges+'</span></div>'
      +'<div class="co-meta">'+(t?t.code+' · ':'')+((co.weeks||[1,2,3,4]).length)+'x/ay ('+weeks+')</div>'+kurulum+'</div>';
    var toggleTitle=isPasif?'Aktif Et':'Pasife Al';
    var toggleIcon=isPasif
      ?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>'
      :'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6" stroke-linecap="round"/></svg>';
    var toggleBtn=isSuperAdmin()?('<button class="btn-icon" title="'+toggleTitle+'" onclick="toggleFirmaAktif(\''+co.id+'\')">'+toggleIcon+'</button>'):'';
    var acts='<div class="co-acts">'+toggleBtn+'<button class="btn-icon" title="Düzenle" onclick="openFirmaModal(\''+co.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button><button class="btn-icon red" onclick="deleteFirma(\''+co.id+'\')" title="Sil"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" stroke-linecap="round"/></svg></button></div>';
    card.innerHTML=icon+body+acts;
    card.addEventListener('click',function(e){if(!e.target.closest('.co-acts'))openFirmaModal(co.id);});
    card.addEventListener('dblclick',function(e){if(co.aktif!==false){var idx=SD.companies.indexOf(co);if(idx>0){SD.companies.splice(idx,1);SD.companies.unshift(co);SD.save('sd_co',SD.companies);renderFirma();UI.toast('Firma en üste alındı.','success');}}});
    list.appendChild(card);
  });
}
window.deleteFirma=function(id){UI.confirm('Firma silinecek?',function(){SD.companies=SD.companies.filter(function(c){return c.id!==id;});SD.save('sd_co',SD.companies);renderFirma();renderVisit();UI.toast('Firma silindi.','success');});};
window.toggleFirmaAktif=function(id){
  if(!isSuperAdmin()){UI.toast('Bu işlem için yetkiniz yok.','error');return;}
  var cos=SD.companies,co=cos.find(function(c){return c.id===id;});if(!co)return;
  co.aktif=co.aktif===false;
  SD.companies=cos;SD.save('sd_co',SD.companies);renderFirma();renderVisit();
  UI.toast(co.aktif?'Firma aktifleştirildi.':'Firma pasife alındı.','success');
};

function openFirmaModal(id){
  A.editId=id;A.mapLat=null;A.mapLng=null;A.aMails=[];
  var ts=SD.technicians,sel=document.getElementById('fTech');
  sel.innerHTML=ts.map(function(t){return'<option value="'+t.id+'">'+t.code+' — '+t.name+'</option>';}).join('');
  var lbl=document.getElementById('coordsLbl');if(lbl)lbl.textContent='';
  document.getElementById('firmaModalTitle').textContent=id?'Firmayı Düzenle':'Firma Ekle';
  if(id){
    var co=SD.companies.find(function(c){return c.id===id;});if(!co)return;
    document.getElementById('fAdi').value=co.name||'';
    document.getElementById('fBolge').value=co.bolge||'';
    sel.value=co.techId||(ts[0]&&ts[0].id);
    document.getElementById('fEmail').value=co.email||'';
    document.getElementById('fTruck').checked=!!co.truck;
    document.getElementById('fPasif').checked=co.aktif===false;
    document.getElementById('fKonumNot').value=co.konumNot||'';
    document.getElementById('fKurulumStart').value=co.kurulumStart||'';
    document.getElementById('fKurulumStartTime').value=co.kurulumStartTime||'';
    document.getElementById('fKurulumEnd').value=co.kurulumEnd||'';
    document.getElementById('fKurulumEndTime').value=co.kurulumEndTime||'';
    A.selWeeks=(co.weeks||[1,2,3,4]).slice();
    A.aMails=(co.aMails||[]).slice();
    A.mapLat=co.lat||null;A.mapLng=co.lng||null;
    if(A.mapLat&&lbl)lbl.textContent='📍 '+A.mapLat.toFixed(5)+', '+A.mapLng.toFixed(5);
  }else{
    ['fAdi','fBolge','fEmail','fKonumNot','fKurulumStart','fKurulumStartTime','fKurulumEnd','fKurulumEndTime'].forEach(function(i){document.getElementById(i).value='';});
    document.getElementById('fTruck').checked=false;document.getElementById('fPasif').checked=false;A.selWeeks=[1,2,3,4];
  }
  var pasifChk=document.getElementById('fPasif');
  if(pasifChk){pasifChk.disabled=!isSuperAdmin();var pasifRow=pasifChk.closest('.fbox');if(pasifRow)pasifRow.style.display=isSuperAdmin()?'':'none';}
  renderWeekToggles();renderAMails();UI.openModal('firmaModal');
}
function renderWeekToggles(){document.querySelectorAll('.week-tog').forEach(function(b){b.classList.toggle('on',A.selWeeks.indexOf(parseInt(b.dataset.w))>=0);});}
function renderAMails(){
  var w=document.getElementById('fAMailChips');if(!w)return;w.innerHTML='';
  A.aMails.forEach(function(m,i){
    var c=document.createElement('span');c.className='chip';
    c.innerHTML=m+' <button class="chip-x">×</button>';
    c.querySelector('.chip-x').addEventListener('click',function(){A.aMails.splice(i,1);renderAMails();});
    w.appendChild(c);
  });
}
function addAMail(){var inp=document.getElementById('fAMail'),v=inp.value.trim();if(!v)return;A.aMails.push(v);inp.value='';renderAMails();}
function saveFirma(){
  var name=document.getElementById('fAdi').value.trim();if(!name){UI.toast('Firma adı gerekli.','error');return;}
  var existingCo=A.editId?SD.companies.find(function(c){return c.id===A.editId;}):null;
  var aktifVal=isSuperAdmin()?!document.getElementById('fPasif').checked:(existingCo?existingCo.aktif!==false:true);
  var payload={name:name,bolge:document.getElementById('fBolge').value.trim(),techId:document.getElementById('fTech').value,email:document.getElementById('fEmail').value.trim(),truck:document.getElementById('fTruck').checked,aktif:aktifVal,konumNot:document.getElementById('fKonumNot').value.trim(),kurulumStart:document.getElementById('fKurulumStart').value,kurulumStartTime:document.getElementById('fKurulumStartTime').value,kurulumEnd:document.getElementById('fKurulumEnd').value,kurulumEndTime:document.getElementById('fKurulumEndTime').value,aMails:A.aMails.slice(),lat:A.mapLat,lng:A.mapLng,weeks:A.selWeeks.length?A.selWeeks.slice():[1,2,3,4]};
  var cos=SD.companies;
  if(A.editId){cos=cos.map(function(c){return c.id===A.editId?Object.assign({},c,payload):c;});}
  else{cos.push(Object.assign({id:'c'+Date.now()},payload));}
  SD.companies=cos;SD.save('sd_co',SD.companies);UI.closeModal('firmaModal');renderFirma();renderVisit();renderSetupBanner();UI.toast('Firma kaydedildi.','success');
}
function exportFirmalar(){if(!isSuperAdmin()){UI.toast('Bu işlem için yetkiniz yok.','error');return;}var d=JSON.stringify({firmalar:SD.companies,teknisyenler:SD.technicians},null,2);var a=document.createElement('a');a.href='data:application/json;charset=utf-8,'+encodeURIComponent(d);a.download='firmalar.json';a.click();UI.toast('İndirildi.','success');}
function importFirmalar(e){if(!isSuperAdmin()){UI.toast('Bu işlem için yetkiniz yok.','error');e.target.value='';return;}var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(ev){try{var d=JSON.parse(ev.target.result);if(d.firmalar){SD.companies=d.firmalar;SD.save('sd_co',SD.companies);}renderFirma();renderVisit();UI.toast('Yüklendi!','success');}catch(err){UI.toast('Dosya okunamadı.','error');}};r.readAsText(f);e.target.value='';}

/* ═══ AUTOCOMPLETE YARDIMCISI ═══ */
function initAutocomplete(inputId,listId,onSelect){
  var inp=document.getElementById(inputId),lst=document.getElementById(listId);
  if(!inp||!lst)return;
  inp.addEventListener('input',function(){
    var q=inp.value.toLocaleLowerCase('tr');lst.innerHTML='';
    if(!q){lst.style.display='none';return;}
    var m=SD.companies.filter(function(c){return c.name.toLocaleLowerCase('tr').indexOf(q)>=0;}).slice(0,8);
    lst.style.display=m.length?'block':'none';
    m.forEach(function(c){var item=document.createElement('div');item.className='ac-item';item.textContent=c.name;item.addEventListener('click',function(){inp.value=c.name;lst.style.display='none';onSelect(c);});lst.appendChild(item);});
  });
  document.addEventListener('click',function(e){if(!inp.contains(e.target)&&!lst.contains(e.target))lst.style.display='none';});
}

/* ═══ HARİTA ═══ */
function openMapModal(){
  UI.closeModal('firmaModal');
  var si=document.getElementById('mapSearchInp');if(si)si.value='';
  var sr=document.getElementById('mapSearchResults');if(sr){sr.innerHTML='';sr.style.display='none';}
  setTimeout(function(){UI.openModal('mapModal');setTimeout(function(){
    var c=document.getElementById('mapPickerContainer');if(!c)return;
    if(A._mapPicker){try{A._mapPicker.remove();}catch(e){}A._mapPicker=null;}
    if(typeof L==='undefined'){c.innerHTML='<div style="padding:16px;font-size:13px;">İnternet bağlantısı gerekli.</div>';return;}
    var lat=A.mapLat||40.1826,lng=A.mapLng||29.0665;
    var map=L.map(c).setView([lat,lng],A.mapLat?15:11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM'}).addTo(map);
    A._mapMarker=A.mapLat?L.marker([A.mapLat,A.mapLng]).addTo(map):null;
    map.on('click',function(ev){if(A._mapMarker)map.removeLayer(A._mapMarker);A._mapMarker=L.marker(ev.latlng).addTo(map);A.mapLat=ev.latlng.lat;A.mapLng=ev.latlng.lng;});
    A._mapPicker=map;
  },120);},60);
}
function setMapPosition(lat,lng,zoom){
  A.mapLat=lat;A.mapLng=lng;
  if(!A._mapPicker)return;
  if(A._mapMarker){try{A._mapPicker.removeLayer(A._mapMarker);}catch(e){}}
  A._mapMarker=L.marker([lat,lng]).addTo(A._mapPicker);
  A._mapPicker.setView([lat,lng],zoom||16);
}
function searchMapAddress(){
  var inp=document.getElementById('mapSearchInp'),results=document.getElementById('mapSearchResults');
  if(!inp||!results)return;
  var q=inp.value.trim();if(!q)return;
  results.innerHTML='<div class="ac-item" style="font-style:italic;color:var(--text3);">Aranıyor...</div>';results.style.display='block';
  fetch('https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=tr&q='+encodeURIComponent(q))
    .then(function(r){return r.json();})
    .then(function(list){
      results.innerHTML='';
      if(!list||!list.length){results.innerHTML='<div class="ac-item" style="font-style:italic;color:var(--text3);">Sonuç bulunamadı.</div>';return;}
      list.forEach(function(item){
        var el=document.createElement('div');el.className='ac-item';el.textContent=item.display_name;
        el.addEventListener('click',function(){
          setMapPosition(parseFloat(item.lat),parseFloat(item.lon),16);
          results.style.display='none';inp.value=item.display_name;
        });
        results.appendChild(el);
      });
    })
    .catch(function(){results.innerHTML='<div class="ac-item" style="color:var(--red);">Arama başarısız, internet bağlantısını kontrol edin.</div>';});
}
async function saveMap(){
  var lbl=document.getElementById('coordsLbl');
  if(lbl&&A.mapLat&&A.mapLng)lbl.textContent='📍 '+A.mapLat.toFixed(5)+', '+A.mapLng.toFixed(5);
  UI.closeModal('mapModal');
  UI.openModal('firmaModal');
  if(!A.mapLat||!A.mapLng)return;

  // Teknisyen mevcut firmasındayken haritadan aldığı konumu doğrudan kaydeder.
  // Diğer firma alanları değiştirilmez; backend de yalnızca atanmış firmanın
  // lat/lng alanlarını kabul eder.
  if(!isSuperAdmin()&&A.editId){
    var me=SD.sessionTech&&SD.sessionTech();
    var companies=SD.companies;
    var company=companies.find(function(c){return c.id===A.editId;});
    if(!me||!company||String(company.techId)!==String(me.id)){
      UI.toast('Yalnızca size atanmış firmanın konumunu kaydedebilirsiniz.','error');
      return;
    }
    var now=new Date().toISOString();
    companies=companies.map(function(c){
      return c.id===A.editId?Object.assign({},c,{lat:A.mapLat,lng:A.mapLng,locationUpdatedAt:now,locationUpdatedBy:me.code||currentUsername(),locationSource:'technician-gps'}):c;
    });
    SD.save('sd_co',companies,false);
    var saved=await SD.pushRemote({force:true});
    if(saved){
      UI.toast('Firma konumu sunucuya kaydedildi.','success');
      if(typeof renderFirma==='function')renderFirma();
    }else{
      UI.toast('Konum cihazda bekliyor; bağlantı gelince yeniden gönderilecek.','error');
    }
    return;
  }

  UI.toast('Konum seçildi. Firma kaydını tamamlamak için Kaydet’e basın.','success');
}

/* ═══ ZİYARET TABLOSU ═══ */
function renderVisit(){
  var ml=document.getElementById('monthLabel');if(ml)ml.textContent=DT.MONTHS[A.vm]+' '+A.vy;
  renderVisitDashboard();
  var at=SD.activeTech();
  SD.buildVisitTable({containerId:'visitContainer',techId:at?at.id:null,year:A.vy,month:A.vm,editable:true,onUpdate:function(needsFirmaRender){renderVisit();if(needsFirmaRender)renderFirma();},warnBannerId:'warnBanner',warnTitleId:'warnTitle',warnBadgeId:'warnBadge',progFillId:'progFill',countLabelId:'visitSub',searchVal:A.vsearch});
}

/* ═══ ZİYARET EDİLMEYENLER ═══ */
function openMissedModal(){
  var cos=SD.companies,vis=SD.visits,today=new Date();
  var cwk=DT.wkey(today),weeks=DT.monthWeeks(today.getFullYear(),today.getMonth());
  var cwi=weeks.findIndex(function(m){return m.getTime()===DT.monday(today).getTime();})+1;
  var at=SD.activeTech();
  /* "Ziyaret edilmeyenler" izleyen teknisyenin KENDİ girişine göre hesaplanır:
     başka teknisyenin aynı firmaya girmesi bu listeden düşürmez. */
  var me=SD.sessionTech();
  var viewerCode=me?me.code:(at?at.code:null);
  var missed=cos.filter(function(co){
    if(co.aktif===false||(at&&co.techId!==at.id)||!BL.scheduled(co,cwi))return false;
    return !SD.visitEntryFor(vis[co.id+'_'+cwk],viewerCode);
  });
  var title=document.getElementById('missedTitle');if(title)title.textContent='Ziyaret Edilmeyenler'+(at?' — '+at.code:'')+' ('+missed.length+')';
  var list=document.getElementById('missedList');list.innerHTML='';
  if(!missed.length){list.innerHTML='<p style="text-align:center;color:var(--muted);padding:24px;">Tüm firmalar ziyaret edildi 🎉</p>';UI.openModal('missedModal');return;}
  missed.forEach(function(co,i){
    var row=document.createElement('div');row.className='miss-item';
    row.innerHTML='<span class="miss-num">'+(i+1)+'</span><div><div class="miss-nm">'+co.name+'</div>'+(co.bolge?'<div class="miss-rg">'+co.bolge+'</div>':'')+'</div>';
    list.appendChild(row);
  });
  UI.openModal('missedModal');
}

/* ═══ PROGRAM DIŞI ZİYARET ═══ */
function openExtraVisitModal(){
  A.extraFirmaId='';A.extraFirmaAdi='';
  var inp=document.getElementById('extraFirmaInp');if(inp)inp.value='';
  var sel=document.getElementById('extraFirmaSelected');if(sel)sel.textContent='—';
  var mn=document.getElementById('extraManuelAdi');if(mn)mn.value='';
  var nt=document.getElementById('extraNot');if(nt)nt.value='';
  var nowExtra=new Date();
  var ac=document.getElementById('extraFirmaAC');if(ac)ac.innerHTML='';
  /* Firma autocomplete + manuel giriş */
  var fInp=document.getElementById('extraFirmaInp'),fAc=document.getElementById('extraFirmaAC');
  if(fInp&&fAc){
    fInp.addEventListener('input',function(){
      var q=fInp.value.toLocaleLowerCase('tr');fAc.innerHTML='';
      if(!q){fAc.style.display='none';return;}
      var m=SD.companies.filter(function(c){return c.name.toLocaleLowerCase('tr').indexOf(q)>=0;}).slice(0,8);
      fAc.style.display='block';
      if(!m.length){
        var item=document.createElement('div');item.className='ac-item';item.style.fontStyle='italic';item.style.color='var(--text3)';
        item.textContent='↵ "'+fInp.value+'" olarak ekle (listede yok)';
        item.addEventListener('click',function(){A.extraFirmaId='';A.extraFirmaAdi=fInp.value;var s=document.getElementById('extraFirmaSelected');if(s)s.textContent=fInp.value+' (yeni)';fAc.style.display='none';});
        fAc.appendChild(item);return;
      }
      m.forEach(function(c){
        var item=document.createElement('div');item.className='ac-item';item.textContent=c.name;
        item.addEventListener('click',function(){A.extraFirmaId=c.id;A.extraFirmaAdi=c.name;fInp.value=c.name;fAc.style.display='none';var s=document.getElementById('extraFirmaSelected');if(s)s.textContent=c.name;});
        fAc.appendChild(item);
      });
    });
  }
  UI.openModal('extraVisitModal');
}
function saveExtraVisit(){
  var fInp=document.getElementById('extraFirmaInp');
  if(!A.extraFirmaAdi&&fInp&&fInp.value.trim())A.extraFirmaAdi=fInp.value.trim();
  var manuelAdi=(document.getElementById('extraManuelAdi')||{}).value||'';
  var firmAdi=(A.extraFirmaAdi||manuelAdi).toUpperCase();
  if(!firmAdi){UI.toast('Firma adı veya seçimi gerekli.','error');return;}
  var not=(document.getElementById('extraNot')||{}).value||'';
  var dateISO='';
  var dateStr=DT.ddmmyyyy(new Date());
  var timeStr=DT.hhii(new Date());
  var extraCo=A.extraFirmaId?SD.companies.find(function(c){return c.id===A.extraFirmaId;}):null;
  var ac=SD.actingTech(extraCo)||(SD.technicians||[])[0]||null,n=new Date();

  /* Girilen tarih için hafta hesapla, yoksa bugünün haftası */
  var visitDate=n;
  if(dateISO){
    visitDate=new Date(dateISO+'T12:00:00');
  }else if(dateStr){
    var parts=dateStr.split('.');
    if(parts.length>=2){
      visitDate=new Date(parseInt(parts[2]||new Date().getFullYear()),parseInt(parts[1])-1,parseInt(parts[0]));
    }
  }
  var cwk=DT.wkey(visitDate);
  var dateShort=DT.ddmm(visitDate);

  /* Program dışı ziyaret normal listesine ekle (girilen tarihte) */
  if(A.extraFirmaId){
    var vi=SD.visits;
    vi[A.extraFirmaId+'_'+cwk]=SD.putVisitEntry(vi[A.extraFirmaId+'_'+cwk],ac?ac.code:'—',{date:dateShort,count:1,status:'done',saat:timeStr||DT.hhii(n),startDate:dateStr||DT.ddmmyyyy(n),startTime:timeStr||DT.hhii(n),endDate:dateStr||DT.ddmmyyyy(n),endTime:timeStr||DT.hhii(n),extraNot:not});
    SD.visits=vi;renderVisit();
  }
  /* Extras listesine kaydet */
  var ex=SD.extras||[];
  var editIdx=document.getElementById('_editExtraIdx');
  if(editIdx&&editIdx.value){
    /* Düzenleme modu */
    var idx=parseInt(editIdx.value,10);
    ex[idx]={id:ex[idx].id,firmaId:A.extraFirmaId,firmAdi:firmAdi,techId:ac?ac.id:'',techCode:ac?ac.code:'—',date:dateShort,saat:timeStr||DT.hhii(n),not:not,wk:cwk};
    editIdx.value='';
    UI.toast('Program dışı ziyaret güncellendi.','success');
  }else{
    /* Yeni kayıt */
    ex.unshift({id:'ex'+Date.now(),firmaId:A.extraFirmaId,firmAdi:firmAdi,techId:ac?ac.id:'',techCode:ac?ac.code:'—',date:dateShort,saat:timeStr||DT.hhii(n),not:not,wk:cwk});
    UI.toast('Program dışı ziyaret kaydedildi: '+firmAdi,'success');
  }
  SD.extras=ex;
  renderExtraVisits();
  UI.closeModal('extraVisitModal');
}

/* ═══ RAPOR ═══ */
function openRapor(){
  var iframe=document.getElementById('raporIframe');
  if(iframe){iframe.removeAttribute('src');iframe.srcdoc=buildOutlookRaporHTML();}
  UI.openModal('raporModal');
}
function sendOutlookRapor(){
  if(!canSendReport()){
    UI.toast('Bu işlem için yetkiniz yok. Rapor gönderme izni sadece barkin.kayaci yönetim panelinden verilebilir.','error');
    return;
  }
  sendRapor();
}

function sendTruckMailsToAll(){
  if(!canSendMail()){
    UI.toast('Bu işlem için yetkiniz yok. Mail gönderme izni sadece barkin.kayaci yönetim panelinden verilebilir.','error');
    return;
  }
  var cfg=SD.config,cos=SD.companies,vis=SD.visits,ts=SD.technicians,exs=SD.extras||[];
  var recipients=loadMailRecipients();
  var to=recipients.filter(function(v,i,a){return v&&a.indexOf(v)===i;}).join(',');
  if(!to){UI.toast('Mail alıcıları tanımlanmamış!','error');return;}

  /* Verilen 8 firma adı ile eşleş (fuzzy match) */
  var targetFirmas=['DURMAZLAR','BURÇAK','FENESE','F.S.S. FREN','AKYAPAK','CANEL','DİŞLİ MAKİNA','ODOKSAN'];
  var mailCount=0;

  targetFirmas.forEach(function(targetName){
    /* Tam veya fuzzy match */
    var co=cos.find(function(c){return c.name.toUpperCase().indexOf(targetName)!==-1;});
    if(!co)return;

    /* Yalnızca tamamlanmış en son ziyareti gerçek tarih sırasıyla bul. */
    var previousVisit=SD.getPreviousCompletedVisit(co.id,new Date());
    var lastVisitDate=previousVisit?previousVisit.date:'';

    /* Program dışı NOT bul */
    var extraNote='';
    var ex=exs.find(function(e){return e.firmaId===co.id;});
    if(ex&&ex.not)extraNote=ex.not;

    /* Teknisyen bul (ziyaret kaydından) */
    var techCode='1015',techName='Semih Ağlan',techPhone='+90 533 209 25 99',techEmail='semih@dramamakine.com';
    if(previousVisit){
      var tc=ts.find(function(t){return t.code===previousVisit.tc;});
      if(tc){techCode=tc.code;techName=tc.name;techPhone=tc.phone;techEmail=tc.email;}
    }

    /* Mail HTML oluştur */
    var html=SD.buildTruckServiceMailHTML(
      co.name,techCode,techName,DT.ddmmyyyy(new Date()),'',0,
      techPhone,techEmail,lastVisitDate,'',extraNote
    );

    /* CC listesi */
    var cc=['emin.ertas@dramamakine.com','barkin.kayaci@dramamakine.com','ibrahim.nuhoglu@dramakimya.com'];
    cc=cc.filter(function(v,i,a){return v&&a.indexOf(v)===i;});

    /* Mail gönder */
    fetch('/api/send-test-mail',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        to:to,
        cc:cc,
        subject:'ServisDrama - Teknik Servis Ziyareti Bildirim ('+co.name.substring(0,20)+')',
        html:html,
        smtpHost:cfg.smtpHost||'',
        smtpPort:cfg.smtpPort||'',
        smtpUser:cfg.smtpUser||'',
        smtpPass:cfg.smtpPass||'',
        smtpTls:cfg.smtpTls||'tls',
        from:(cfg.smtpSenderName||'Drama Makine')+' <'+(cfg.smtpSenderEmail||'servis@dramamakine.com')+'>',
        attachmentNames:['drama-makine-logo','icon-phone','icon-mail']
      })
    })
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.success){mailCount++;if(mailCount===targetFirmas.length){UI.closeModal('raporModal');UI.toast('✓ Tüm mailer gönderildi!','success');}}
    })
    .catch(function(e){console.error('Mail hatası:',e);});
  });
}
function buildRaporText(){
  var cos=SD.companies,vis=SD.visits,today=new Date();
  var cwk=DT.wkey(today),weeks=DT.monthWeeks(today.getFullYear(),today.getMonth());
  var cwi=weeks.findIndex(function(m){return m.getTime()===DT.monday(today).getTime();})+1;
  var ts=SD.technicians,NL=String.fromCharCode(10);
  var lines=['SERVİSDRAMA — '+DT.isoWeek(today)+'. HAFTA RAPORU | '+DT.ddmmyyyy(today),'═'.repeat(48),''];
  ts.forEach(function(t){
    var tV=[],tM=[];
    cos.forEach(function(co){if(co.techId!==t.id||!BL.scheduled(co,cwi))return;var v=vis[co.id+'_'+cwk];if(v&&v.status==='done')tV.push('  ✓ '+co.name+(v.saat?' ('+v.saat+')':''));else tM.push('  ✗ '+co.name);});
    if(tV.length+tM.length>0){lines.push('🔧 '+t.code+' — '+t.name);lines.push('─'.repeat(38));tV.forEach(function(l){lines.push(l);});if(tM.length){lines.push('  [Eksik]');tM.forEach(function(l){lines.push(l);});}lines.push('');}
  });
  var ta=document.getElementById('raporTa');if(ta)ta.value=lines.join(NL);
}
function sendRapor(){
  var cfg=SD.config;
  // TO/CC listesi doğrudan hardcode
  var to=['esra.onur@dramamakine.com','ersin.ertugen@dramamakine.com','yagiz.erel@dramamakine.com','suleyman.kucuk@dramamakine.com','semih.aglan@dramamakine.com'];
  var cc=['emin.ertas@dramamakine.com','barkin.kayaci@dramamakine.com','ibrahim.nuhoglu@dramakimya.com'];
  to=to.filter(function(v,i,a){return v&&a.indexOf(v)===i;});
  cc=cc.filter(function(v,i,a){return v&&a.indexOf(v)===i;});
  var tarih=new Date();
  var subject='ServisDrama - Günlük Ziyaret Raporu ('+DT.ddmmyyyy(tarih)+')';
  var attachmentNames=['drama-makine-logo','icon-star','servisdrama-calendar-white'];
  var html=buildOutlookRaporHTML();

  fetch('/api/send-test-mail',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      to:to,
      cc:cc,
      subject:subject,
      html:html,
      smtpHost:cfg.smtpHost||'',
      smtpPort:cfg.smtpPort||'',
      smtpUser:cfg.smtpUser||'',
      smtpPass:cfg.smtpPass||'',
      smtpTls:cfg.smtpTls||'tls',
      from:(cfg.smtpSenderName||'Drama Makine')+' <'+(cfg.smtpSenderEmail||'servis@dramamakine.com')+'>',
      attachmentNames:attachmentNames
    })
  })
  .then(function(r){return r.json();})
  .then(function(d){
    if(d.success){
      UI.closeModal('raporModal');
      UI.toast('✓ Rapor başarıyla gönderildi ('+to.join(', ')+(cc.length?' | CC: '+cc.join(', '):'')+')','success');
    }else{
      UI.toast('Mail gönderme hatası: '+d.error,'error');
    }
  })
  .catch(function(e){
    UI.toast('Server bağlantı hatası: '+e.message,'error');
  });
}
function copyRapor(){var ta=document.getElementById('raporTa');if(!ta)return;ta.select();document.execCommand('copy');UI.toast('Kopyalandı!','success');}
function openHtmlRapor(){var html=buildOutlookRaporHTML();var w=window.open();w.document.write(html);w.document.close();}

/* ═══ İSTATİSTİK ═══ */
function parseStatVisitDate(value,weekKey){
  if(!value)return null;
  var parts=String(value).split('.');
  var year=parts[2]?Number(parts[2]):Number((String(weekKey).match(/(20\d{2})/)||[])[1]);
  if(parts.length<2||!year)return null;
  var d=new Date(year,Number(parts[1])-1,Number(parts[0]));
  return isNaN(d.getTime())?null:d;
}
function renderStat(){
  var today=new Date(),cos=SD.companies,vis=SD.visits,ts=SD.technicians;
  var weeks=DT.monthWeeks(A.sy,A.sm),cwk=DT.wkey(today),todayMon=DT.monday(today);
  var cwi=weeks.findIndex(function(m){return m.getTime()===todayMon.getTime();})+1;
  var ml=document.getElementById('statMonth');if(ml)ml.textContent=DT.MONTHS[A.sm]+' '+A.sy;
  var rl=document.getElementById('istatSub');if(rl)rl.textContent=DT.MONTHS[A.sm]+' '+A.sy+' · '+DT.isoWeek(today)+'. Hafta';
  var totS=0,totD=0;
  weeks.forEach(function(wm,i){var wk=DT.wkey(wm);cos.forEach(function(co){if(BL.scheduled(co,i+1)){totS++;if(vis[co.id+'_'+wk]&&vis[co.id+'_'+wk].status==='done')totD++;}});});
  var pct=totS?Math.round(totD/totS*100):0;
  var numuneler=typeof stLoad==='function'?stLoad():[];
  var thisWD=0;cos.forEach(function(co){if(BL.scheduled(co,cwi)&&vis[co.id+'_'+cwk]&&vis[co.id+'_'+cwk].status==='done')thisWD++;});
  var kr=document.getElementById('kpiRow');if(!kr)return;kr.innerHTML='';
  [{icon:'📅',lbl:'Bu Hafta',val:thisWD,sub:'tamamlanan',bg:'#EFF6FF',c:'#2563EB'},{icon:'📈',lbl:'Aylık %',val:pct+'%',sub:totD+'/'+totS,bg:'#DCFCE7',c:'#16A34A'},{icon:'🧪',lbl:'Bekleyen Numune',val:numuneler.filter(function(s){return!s.result;}).length,sub:'analiz bekliyor',bg:'#F5F3FF',c:'#7C3AED'},{icon:'🏭',lbl:'Toplam Firma',val:cos.length,sub:ts.length+' teknisyen',bg:'#FFFBEB',c:'#D97706'}].forEach(function(k){
    var c=document.createElement('div');c.className='kpi-card';
    c.innerHTML='<div class="kpi-icon" style="background:'+k.bg+';">'+k.icon+'</div><div class="kpi-val" style="color:'+k.c+';">'+k.val+'</div><div class="kpi-lbl">'+k.lbl+'</div><div class="kpi-sub">'+k.sub+'</div>';
    kr.appendChild(c);
  });
  var tg=document.getElementById('techStatGrid');if(!tg)return;tg.innerHTML='';
  ts.forEach(function(t){
    /* Tüm haftalardaki ziyaretleri kontrol et (sadece bu hafta değil) */
    var visCos=cos.filter(function(c){
      if(c.techId!==t.id)return false;
      /* Herhangi bir haftada ziyaret varsa say - tüm haftalara bak (1-52) */
      for(var i=0;i<=52;i++){
        if(vis[c.id+'_'+i]&&vis[c.id+'_'+i].status==='done')return true;
      }
      return false;
    });
    var misCos=cos.filter(function(c){
      if(c.techId!==t.id||!BL.scheduled(c,cwi))return false;
      return !visCos.includes(c);
    });
    var p=(visCos.length+misCos.length)?Math.round(visCos.length/(visCos.length+misCos.length)*100):0;

    /* Firma detayları */
    var allTechCos=cos.filter(function(c){return c.techId===t.id;});
    var firmalar=allTechCos.map(function(c){
      var lastVisitDate='',lastVisitObj=null;
      var todayNorm=new Date(today.getFullYear(),today.getMonth(),today.getDate());
      Object.keys(vis).forEach(function(k){
        if(k!==c.id+'_'+cwk && k.indexOf(c.id+'_')===0 && vis[k].date){
          var d=parseStatVisitDate(vis[k].date,k);
          if(d&&d<todayNorm&&(!lastVisitObj||d>lastVisitObj)){
            lastVisitObj=d;
            lastVisitDate=String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear();
          }
        }
      });
      var daysAgo='';
      if(!lastVisitObj){
        var milatDate=new Date(2026,6,31);
        lastVisitObj=milatDate;
        lastVisitDate='31.07.2026';
      }
      if(lastVisitObj){
        var lastDate=new Date(lastVisitObj.getFullYear(),lastVisitObj.getMonth(),lastVisitObj.getDate());
        var todayDate=new Date();
        var todayNorm=new Date(todayDate.getFullYear(),todayDate.getMonth(),todayDate.getDate());
        var calendarDays=Math.floor((todayNorm-lastDate)/(1000*60*60*24));
        var businessDays=0;
        var current=new Date(lastDate);
        while(current.getTime()<=todayNorm.getTime()){
          var day=current.getDay();
          if(day!==0&&day!==6)businessDays++;
          current.setDate(current.getDate()+1);
        }
        daysAgo=' • '+calendarDays+' gün geçti ('+businessDays+' iş günü)';
      }
      return {name:c.name,lastVisit:lastVisitDate,lastVisitObj:lastVisitObj,daysAgo:daysAgo};
    }).sort(function(a,b){
      if(!a.lastVisitObj&&!b.lastVisitObj)return 0;
      if(!a.lastVisitObj)return 1;
      if(!b.lastVisitObj)return -1;
      return b.lastVisitObj-a.lastVisitObj;
    });

    var isMob=window.matchMedia('(max-width: 768px)').matches;
    var card=document.createElement('div');
    card.className='tech-stat-card';
    card.style.cssText='background:#fff;border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);';
    var header='<button type="button" class="tech-stat-header" aria-expanded="'+(!isMob)+'" style="width:100%;border:0;background:linear-gradient(135deg,#1A2952,#2563EB);padding:16px 18px;color:#fff;cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none;text-align:left;"><span style="font-weight:800;font-size:15px;">'+t.name+' ('+t.code+'): '+allTechCos.length+' firma</span><span class="tech-stat-arrow" style="font-size:18px;transition:transform .2s;display:inline-flex;">▼</span></button>';
    var body='<div class="tech-stat-body" style="padding:12px 0;display:'+(isMob?'none':'block')+';">';
    firmalar.forEach(function(f){
      var visitText=f.lastVisit?'Son ziyaret: '+f.lastVisit+(f.daysAgo||''):' Kayıt yok';
      body+='<div style="padding:8px 16px;border-bottom:1px solid #f0f0f0;font-size:13px;"><div style="font-weight:600;color:#1E293B;">'+f.name+'</div><div style="font-size:12px;color:#64748B;margin-top:2px;">'+visitText+'</div></div>';
    });
    body+='</div>';
    card.innerHTML=header+body;
    var headerEl=card.querySelector('.tech-stat-header');
    var bodyEl=card.querySelector('.tech-stat-body');
    headerEl.addEventListener('click',function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      var willOpen=bodyEl.hidden || bodyEl.style.display==='none';
      bodyEl.hidden=!willOpen;
      bodyEl.style.display=willOpen?'block':'none';
      headerEl.setAttribute('aria-expanded',String(willOpen));
      card.classList.toggle('is-open',willOpen);
      var arrow=headerEl.querySelector('.tech-stat-arrow');
      if(arrow)arrow.style.transform=willOpen?'rotate(180deg)':'rotate(0deg)';
    },{passive:false});
    tg.appendChild(card);
  });

}

/* ═══ EKİP ═══ */
function renderTechAdmin(){
  var ts=SD.technicians,list=document.getElementById('techAdminList');if(!list)return;list.innerHTML='';
  ts.forEach(function(t){
    var row=document.createElement('div');row.className='tech-row';
    row.style.cssText='display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--border);border-radius:var(--r-xl);padding:14px 16px;margin-bottom:8px;box-shadow:var(--sh-xs);';
    var av=document.createElement('div');av.className='tech-avatar';av.style.cssText='width:42px;height:42px;border-radius:50%;background:'+BL.avatarColor(t.name)+';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0;';av.textContent=BL.getInitials(t.name);
    var info=document.createElement('div');info.className='tech-info';info.style.cssText='flex:1;min-width:0;';
    info.innerHTML='<div style="font-weight:700;font-size:14px;color:var(--text);">'+t.name+' <span style="background:var(--blue-l);color:var(--blue);font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:99px;">'+t.code+'</span></div>'
      +'<div style="font-size:12px;color:var(--muted);margin-top:3px;">'+(t.phone||'Telefon yok')+' · '+(t.email||'E-posta yok')+'</div>';
    var fields=document.createElement('div');fields.className='tech-fields';fields.style.cssText='display:flex;flex-direction:column;gap:5px;min-width:220px;';
    ['name','phone','email'].forEach(function(f){
      var inp=document.createElement('input');
      inp.style.cssText='padding:7px 10px;font-size:12.5px;border:1.5px solid var(--border);border-radius:var(--r);outline:none;font-family:inherit;transition:border-color .15s;';
      inp.value=t[f]||'';inp.placeholder={name:'Ad Soyad',phone:'Telefon',email:'E-posta'}[f];
      inp.addEventListener('focus',function(){inp.style.borderColor='#2563EB';});
      inp.addEventListener('blur',function(){inp.style.borderColor='';});
      inp.addEventListener('change',function(){var arr=SD.technicians,tech=arr.find(function(x){return x.id===t.id;});if(tech)tech[f]=inp.value.trim();SD.technicians=arr;UI.toast('Güncellendi.','success');});
      fields.appendChild(inp);
    });
    var db=document.createElement('button');db.className='btn-icon red';db.title='Sil';
    db.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" stroke-linecap="round"/></svg>';
    (function(tid){db.addEventListener('click',function(){if(SD.technicians.length<=1){UI.toast('En az 1 teknisyen gerekli.','warning');return;}UI.confirm('Teknisyeni sil?',function(){var arr=SD.technicians.filter(function(x){return x.id!==tid;});SD.technicians=arr;if(SD.activeTechId===tid)SD.activeTechId=arr[0].id;renderTechAdmin();});});})( t.id);
    row.appendChild(av);row.appendChild(info);row.appendChild(fields);row.appendChild(db);list.appendChild(row);
  });
}
function saveTech(){
  var code=document.getElementById('newCode').value.trim();if(!code){UI.toast('Kod gerekli.','error');return;}
  var arr=SD.technicians;
  var newTech={id:'t'+Date.now(),code:code,name:document.getElementById('newName').value.trim()||code,phone:document.getElementById('newPhone').value.trim(),email:document.getElementById('newEmail').value.trim(),avatar:''};
  arr.push(newTech);SD.technicians=arr;
  /* Kullanıcı oluştur */
  var un=(document.getElementById('newUsername')||{}).value||'';
  var pw=(document.getElementById('newPassword')||{}).value||code;
  if(un){var users=SD.users;users.push({id:'u'+Date.now(),username:un,name:newTech.name,role:'tech',password:pw,avatar:'',email:newTech.email,techId:newTech.id});SD.users=users;}
  ['newCode','newName','newPhone','newEmail','newUsername','newPassword'].forEach(function(i){var el=document.getElementById(i);if(el)el.value='';});
  UI.closeModal('addTechModal');renderTechAdmin();renderTechBtns();UI.toast('Teknisyen eklendi.','success');
}

/* ═══ AYARLAR ═══ */
var MODULE_FEATS=[
  {key:'numuneAktif',nm:'Numune Takip Modülü',desc:'Numune takip sekmesini göster'},
  {key:'kurulumBanner',nm:'Kurulum Süreci Banneri',desc:'Kurulum sürecindeki firmaları göster'},
  {key:'truckMail',nm:'Truck Bildirimi',desc:'Ziyaret öncesi otomatik e-posta'},
  {key:'programDisi',nm:'Program Dışı Ziyaret',desc:'Programda olmayan ziyaret ekleme'},
  {key:'cokluZiyaret',nm:'Çoklu Ziyaret',desc:'Aynı haftada 2. ziyaret girme'},
  {key:'gecmisGorunum',nm:'Geçmiş Görünümü',desc:'Geçmiş haftalara bakma'}
];
var TECH_FEATS=[
  {key:'showStats',nm:'İstatistikleri Göster',desc:'Teknisyen kendi istatistiklerini görür'},
  {key:'showAllFirms',nm:'Tüm Firmaları Göster',desc:'Sadece atanan firmalar değil tümü'},
  {key:'showMap',nm:'Harita Görünümü',desc:'Firma konum haritasına erişim'},
  {key:'canSendReport',nm:'Rapor Gönderebilir',desc:'Günlük rapor oluşturma ve mail atma'},
  {key:'showHistory',nm:'Geçmiş Ziyaretler',desc:'Önceki haftalara ait ziyaret kayıtları'}
];

function renderSettingsTab(tab){
  var cfg=SD.config,content=document.getElementById('settingsContent');if(!content)return;
  content.innerHTML='';
  if(tab==='genel'){
    content.innerHTML='<div class="settings-card">'
      +'<div class="settings-ttl">⚙️ Genel Bilgiler</div>'
      +'<div class="settings-row"><label class="form-lbl">Gönderici Adı</label><input class="inp" id="cfg-senderName" value="'+(cfg.senderName||'')+'" placeholder="Drama Makine Teknik Servis"></div>'
      +'<div class="settings-row"><label class="form-lbl">Rapor Mail Konusu Öneki</label><input class="inp" id="cfg-subjectPrefix" value="'+(cfg.subjectPrefix||'')+'" placeholder="ServisDrama | Günlük Rapor"></div>'
      +'<div class="settings-acts"><button class="btn btn-outline btn-sm" onclick="buildAndPreview()">HTML Rapor Önizle</button><button class="btn btn-primary btn-sm" onclick="saveGenelCfg()">Kaydet</button></div>'
      +'</div>'
      +'<div id="previewFrame" style="margin-top:16px;border:1px solid var(--border);border-radius:var(--r-xl);overflow:hidden;min-height:60px;"></div>';
  }else if(tab==='mail'){
    content.innerHTML='<div class="settings-card" style="margin-top:0;">'
      +'<div class="settings-ttl">🔔 SMTP / Otomatik Gönderim</div>'
      +'<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:var(--r-lg);padding:12px 14px;font-size:13px;color:#92400E;margin-bottom:14px;">Bu uygulama file:// tabanlı çalıştığı için SMTP entegrasyonu JavaScript mail kütüphanesi (EmailJS) veya bir backend ile yapılabilir. Aşağıdaki bilgileri kaydedin.</div>'
      +'<div class="settings-row"><label class="form-lbl">Gönderici E-posta</label><input class="inp" id="cfg-senderEmail" value="'+(cfg.senderEmail||'')+'" placeholder="servis@dramamakine.com"></div>'
      +'<div class="settings-row"><label class="form-lbl">EmailJS Service ID</label><input class="inp" id="cfg-emailjsService" value="'+(cfg.emailjsService||'')+'" placeholder="service_xxxxx"></div>'
      +'<div class="settings-row"><label class="form-lbl">EmailJS Template ID</label><input class="inp" id="cfg-emailjsTemplate" value="'+(cfg.emailjsTemplate||'')+'" placeholder="template_xxxxx"></div>'
      +'<div class="settings-row"><label class="form-lbl">EmailJS Public Key</label><input class="inp" id="cfg-emailjsKey" value="'+(cfg.emailjsKey||'')+'" placeholder="public_key_xxxxx"></div>'
      +'<div class="settings-acts"><button class="btn btn-primary btn-sm" onclick="saveMailCfg()">Kaydet</button></div>'
      +'</div>'
      +'<div class="settings-card" style="margin-top:0;">'
      +'<div class="settings-ttl">📧 SMTP Sunucu Ayarları</div>'
      +'<div class="settings-row"><label class="form-lbl">Gönderici Adı</label><input class="inp" id="cfg-smtpSenderName" value="'+(cfg.smtpSenderName||'')+'" placeholder="Drama Kimya"></div>'
      +'<div class="settings-row"><label class="form-lbl">E-Posta Adresi</label><input class="inp" type="email" id="cfg-smtpSenderEmail" value="'+(cfg.smtpSenderEmail||'')+'" placeholder="kimyaservis@dramamakine.com"></div>'
      +'<div class="settings-row"><label class="form-lbl">Giden Sunucu (SMTP)</label><input class="inp" id="cfg-smtpHost" value="'+(cfg.smtpHost||'')+'" placeholder="mail.dramagroup.com.tr"></div>'
      +'<div class="settings-row"><label class="form-lbl">SMTP Port</label><input class="inp" type="number" id="cfg-smtpPort" value="'+(cfg.smtpPort||587)+'" placeholder="587"></div>'
      +'<div class="settings-row"><label class="form-lbl">Kullanıcı Adı</label><input class="inp" id="cfg-smtpUser" value="'+(cfg.smtpUser||'')+'" placeholder="kimyaservis@dramagroup.com"></div>'
      +'<div class="settings-row"><label class="form-lbl">Parola</label><input class="inp" type="password" id="cfg-smtpPass" value="'+(cfg.smtpPass||'')+'" placeholder="••••••••"></div>'
      +'<div class="settings-row"><label class="form-lbl">Sertifika</label><select class="inp" id="cfg-smtpTls"><option value="tls"'+(cfg.smtpTls==="starttls"?"":' selected')+'>TLS</option><option value="starttls"'+(cfg.smtpTls==="starttls"?" selected":'')+'>STARTTLS</option></select></div>'
      +'<div class="settings-acts"><button class="btn btn-outline btn-sm" onclick="testSmtpMail()">📨 Test Maili Gönder</button><button class="btn btn-primary btn-sm" onclick="saveSmtpCfg()">Kaydet</button></div>'
      +'</div>';
  }else if(tab==='mailAlicilar'){
    content.innerHTML='<div class="settings-card">'
      +'<div class="settings-ttl">👥 Mail Alıcıları</div>'
      +'<p style="font-size:13px;color:var(--text3);margin-bottom:14px;">Her gün rapor gönderildiğinde bu adresler alıcı olarak eklenir.</p>'
      +'<div style="display:flex;gap:10px;margin-bottom:10px;"><input class="inp" id="mailAliciInp" type="email" placeholder="ornek@dramamakine.com" style="flex:1;"><button onclick="addMailAlici()" style="width:42px;height:40px;background:var(--blue);color:#fff;border:none;border-radius:var(--r-lg);font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:700;">+</button></div>'
      +'<div id="mailAliciList"></div>'
      +'</div>'
      +'<div class="settings-card" style="margin-top:0;">'
      +'<div class="settings-ttl">⚙️ Gönderim Modu</div>'
      +'<div style="display:flex;align-items:center;gap:12px;padding:12px 0;">'
      +'<label class="toggle"><input type="checkbox" id="manuelHariciToggle"'+(loadMailRecipientsMode()?' checked':'')+' onchange="saveMailRecipientsMode(this.checked);"><span class="toggle-tr"></span></label>'
      +'<div><div style="font-weight:500;font-size:13px;">Manuel Harici - Tüm alıcılara mail gönder</div>'
      +'<div style="font-size:12px;color:var(--text3);">Seçiliyse: tüm tanımlı adresler | Seçili değilse: sadece barkin.kayaci@dramamakine.com</div></div>'
      +'</div>'
      +'</div>';
    var cfg=SD.config;cfg.mailAlicilar=loadMailRecipients();SD.config=cfg;
    renderMailAlicilar();
  }else if(tab==='modul'){
    var mf=cfg.moduleFeatures||{};
    content.innerHTML='<div class="settings-card"><div class="settings-ttl">🧩 Modül Ayarları</div><p style="font-size:13px;color:var(--text3);margin-bottom:16px;">Hangi özellikler aktif olsun?</p><div id="modulFeatRows"></div><div class="settings-acts"><button class="btn btn-primary btn-sm" onclick="saveModulCfg()">Kaydet</button></div></div>';
    var mfr=document.getElementById('modulFeatRows');
    MODULE_FEATS.forEach(function(f){
      var row=document.createElement('div');row.className='feat-row';
      row.innerHTML='<div><div class="feat-nm">'+f.nm+'</div><div class="feat-desc">'+f.desc+'</div></div>'
        +'<label class="toggle"><input type="checkbox" id="mf-'+f.key+'"'+(mf[f.key]!==false?' checked':'')+'><span class="toggle-tr"></span></label>';
      mfr.appendChild(row);
    });
  }else if(tab==='teknik'){
    var tf=cfg.techFeatures||{};
    content.innerHTML='<div class="settings-card"><div class="settings-ttl" style="display:flex;align-items:center;justify-content:space-between;"><span>👥 Ekip Yönetimi</span><button class="btn btn-primary btn-sm" onclick="UI.openModal(\'addTechModal\')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Teknisyen Ekle</button></div><p style="font-size:13px;color:var(--text3);margin-bottom:16px;">Teknisyen bilgileri ve erişim kontrolü</p><div id="techAdminList"></div></div>'
      +'<div class="settings-card" style="margin-top:16px;"><div class="settings-ttl">👤 Teknisyen Ekran Yetkileri</div><p style="font-size:13px;color:var(--text3);margin-bottom:16px;">Teknisyen ekranında hangi özellikler görünsün?</p><div id="techFeatRows"></div><div class="settings-acts"><button class="btn btn-primary btn-sm" onclick="saveTechCfg()">Kaydet</button></div></div>';
    var tfr=document.getElementById('techFeatRows');
    TECH_FEATS.forEach(function(f){
      var row=document.createElement('div');row.className='feat-row';
      row.innerHTML='<div><div class="feat-nm">'+f.nm+'</div><div class="feat-desc">'+f.desc+'</div></div>'
        +'<label class="toggle"><input type="checkbox" id="tf-'+f.key+'"'+(tf[f.key]!==false?' checked':'')+'><span class="toggle-tr"></span></label>';
      tfr.appendChild(row);
    });
    renderTechAdmin();
  }else if(tab==='kullanici'){
    renderKullanicilar();
  }else if(tab==='izinler'){
    var users=SD.users||[];
    content.innerHTML='<div class="settings-card"><div class="settings-ttl">🔐 Raporlama İzinleri</div><p style="font-size:13px;color:var(--text3);margin-bottom:16px;">Hangi kullanıcılar rapor gönderebilsin? (barkin.kayaci her zaman gönderebilir)</p><div id="permissionsGrid"></div><div class="settings-acts"><button class="btn btn-primary btn-sm" onclick="savePermissions()">Kaydet</button></div></div>';
    var grid=document.getElementById('permissionsGrid');
    users.forEach(function(u){
      var row=document.createElement('div');row.className='feat-row';
      var canSendReportPerm=!(cfg.sendReportPermissions&&cfg.sendReportPermissions[u.id]===false);
      row.innerHTML='<div><div class="feat-nm">'+u.name+' <span style="font-size:11px;color:var(--text3);">('+(u.username||'—')+')</span></div>'
        +'<div class="feat-desc">'+(u.role==='admin'?'Admin · Her zaman gönderebilir':'Kullanıcı')+' · Teknik Servis'+'</div></div>'
        +'<label class="toggle"><input type="checkbox" id="perm-'+u.id+'"'+(canSendReportPerm?' checked':'')+' '+(u.role==='admin'?' disabled':'')+' style="cursor:'+(u.role==='admin'?'not-allowed':'pointer')+';" ><span class="toggle-tr"></span></label>';
      grid.appendChild(row);
    });
  }else if(tab==='veri'){
    content.innerHTML='<div class="settings-card"><div class="settings-ttl">💾 Veri Yönetimi</div><div style="display:flex;flex-direction:column;gap:10px;"><button class="btn btn-outline btn-sm" onclick="exportAll()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke-linecap="round"/></svg>Tüm Veriyi İndir (JSON)</button><button class="btn btn-outline btn-sm" onclick="document.getElementById(\'importAll\').click()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3m0 0l-4 4m4-4l4 4" stroke-linecap="round"/></svg>Yedekten Geri Yükle</button><input type="file" id="importAll" accept=".json" hidden onchange="importAll(event)"><button class="btn btn-danger btn-sm" onclick="if(confirm(\'Tüm ziyaret geçmişi silinecek!\'))clearVisits()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" stroke-linecap="round"/></svg>Ziyaret Geçmişini Temizle</button></div></div>';
  }
}

function saveGenelCfg(){
  var cfg=SD.config;
  cfg.senderName=(document.getElementById('cfg-senderName')||{}).value||'';
  cfg.subjectPrefix=(document.getElementById('cfg-subjectPrefix')||{}).value||'';
  SD.config=cfg;UI.toast('Kaydedildi.','success');
}
function saveMailCfg(){
  var cfg=SD.config;
  cfg.senderEmail=(document.getElementById('cfg-senderEmail')||{}).value||'';
  cfg.emailjsService=(document.getElementById('cfg-emailjsService')||{}).value||'';
  cfg.emailjsTemplate=(document.getElementById('cfg-emailjsTemplate')||{}).value||'';
  cfg.emailjsKey=(document.getElementById('cfg-emailjsKey')||{}).value||'';
  SD.config=cfg;UI.toast('Mail ayarları kaydedildi.','success');
}
function saveSmtpCfg(){
  var cfg=SD.config;
  cfg.smtpSenderName=(document.getElementById('cfg-smtpSenderName')||{}).value||'';
  cfg.smtpSenderEmail=(document.getElementById('cfg-smtpSenderEmail')||{}).value||'';
  cfg.smtpHost=(document.getElementById('cfg-smtpHost')||{}).value||'';
  cfg.smtpPort=parseInt((document.getElementById('cfg-smtpPort')||{}).value||587);
  cfg.smtpUser=(document.getElementById('cfg-smtpUser')||{}).value||'';
  cfg.smtpPass=(document.getElementById('cfg-smtpPass')||{}).value||'';
  cfg.smtpTls=(document.getElementById('cfg-smtpTls')||{}).value||'tls';
  SD.config=cfg;UI.toast('SMTP ayarları kaydedildi.','success');
}
function testSmtpMail(){
  var cfg=SD.config;
  if(!cfg.smtpHost||!cfg.smtpUser||!cfg.smtpPass){UI.toast('Tüm SMTP alanları gerekli.','warning');return;}
  var to='barkin.kayaci@dramamakine.com';
  var subject='ServisDrama - SMTP Test Maili';
  var htmlBody='<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">'
    +'<h2 style="color:#1a2332;">🧪 SMTP Test Maili</h2>'
    +'<p>Merhaba,</p>'
    +'<p>ServisDrama sistemi SMTP yapılandırması başarıyla test edildi!</p>'
    +'<hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">'
    +'<p style="font-size:12px;color:#666;"><strong>Sunucu Bilgileri:</strong><br>'+cfg.smtpHost+':'+cfg.smtpPort+'<br>Gönderici: '+cfg.smtpSenderEmail+'</p>'
    +'<p style="font-size:11px;color:#999;">Bu test maili Drama Makine Teknik Servis tarafından otomatik olarak gönderilmiştir.</p>'
    +'</div>';

  var cc=['emin.ertas@dramamakine.com','barkin.kayaci@dramamakine.com','ibrahim.nuhoglu@dramakimya.com'];
  cc=cc.filter(function(v,i,a){return v&&a.indexOf(v)===i;});

  if(typeof emailjs!=='undefined'&&cfg.emailjsKey&&cfg.emailjsService&&cfg.emailjsTemplate){
    emailjs.send(cfg.emailjsService,cfg.emailjsTemplate,{to_email:to,subject:subject,html_content:htmlBody});
    UI.toast('Test maili EmailJS ile gönderildi (barkin.kayaci@dramamakine.com) ✓','success');
  }else{
    /* Backend API üzerinden SMTP ile gönder (form verisini gönder) */
    fetch('/api/send-test-mail',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        to:to,
        cc:cc,
        subject:subject,
        html:htmlBody,
        smtpHost:cfg.smtpHost,
        smtpPort:cfg.smtpPort,
        smtpUser:cfg.smtpUser,
        smtpPass:cfg.smtpPass,
        smtpTls:cfg.smtpTls,
        from:cfg.smtpSenderName+' <'+cfg.smtpSenderEmail+'>'
      })
    })
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.success){UI.toast('Test maili SMTP ile başarıyla gönderildi (barkin.kayaci@dramamakine.com) ✓','success');}
      else{UI.toast('Mail gönderme hatası: '+d.error+' ('+d.details+')','error');}
    })
    .catch(function(e){UI.toast('Server bağlantı hatası: '+e.message,'error');});
  }
}
function saveModulCfg(){
  var cfg=SD.config;if(!cfg.moduleFeatures)cfg.moduleFeatures={};
  MODULE_FEATS.forEach(function(f){var el=document.getElementById('mf-'+f.key);if(el)cfg.moduleFeatures[f.key]=el.checked;});
  SD.config=cfg;UI.toast('Modül ayarları kaydedildi.','success');
}
function saveTechCfg(){
  var cfg=SD.config;if(!cfg.techFeatures)cfg.techFeatures={};
  TECH_FEATS.forEach(function(f){var el=document.getElementById('tf-'+f.key);if(el)cfg.techFeatures[f.key]=el.checked;});
  SD.config=cfg;UI.toast('Teknisyen yetkileri kaydedildi.','success');
}
function savePermissions(){
  var cfg=SD.config;if(!cfg.sendReportPermissions)cfg.sendReportPermissions={};
  var users=SD.users||[];
  users.forEach(function(u){
    if(u.role==='admin')return;
    var chk=document.getElementById('perm-'+u.id);
    cfg.sendReportPermissions[u.id]=chk?chk.checked:false;
  });
  SD.config=cfg;
  updateRaporButtonState();
  UI.toast('Raporlama izinleri kaydedildi.','success');
}

/* Mail alıcılar */
function addMailAlici(){var inp=document.getElementById('mailAliciInp');if(!inp||!inp.value.trim())return;var cfg=SD.config;if(!cfg.mailAlicilar)cfg.mailAlicilar=loadMailRecipients();cfg.mailAlicilar.push(inp.value.trim());saveMailRecipients(cfg.mailAlicilar);inp.value='';UI.toast('Alıcı eklendi.','success');}
function removeMailAlici(i){var cfg=SD.config;if(!cfg.mailAlicilar)cfg.mailAlicilar=loadMailRecipients();if(cfg.mailAlicilar)cfg.mailAlicilar.splice(i,1);saveMailRecipients(cfg.mailAlicilar);}
function renderMailAlicilar(){
  var el=document.getElementById('mailAliciList');if(!el)return;
  var arr=(SD.config.mailAlicilar)||[];
  if(!arr.length){el.innerHTML='<p style="font-size:13px;color:var(--muted);padding:8px 0;">Henüz alıcı eklenmedi.</p>';return;}
  el.innerHTML='';
  arr.forEach(function(m,i){
    var row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);';
    row.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M4 6l8 7 8-7"/></svg>'
      +'<span style="flex:1;font-size:13px;font-weight:500;">'+m+'</span>'
      +'<button onclick="removeMailAlici('+i+')" style="background:none;border:none;cursor:pointer;color:var(--muted);padding:4px;border-radius:5px;" title="Sil"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" stroke-linecap="round"/></svg></button>';
    el.appendChild(row);
  });
}

/* Kullanıcılar */
function syncUsersFromDB(){
  fetch('/api/auth/users')
    .then(r => r.json())
    .then(d => {
      if(d.success && d.users){
        // localStorage'ı veritabanı kullanıcılarıyla güncelle
        var users = d.users.map(u => ({
          id: 'u'+u.id,
          username: u.username,
          name: u.name,
          role: u.role,
          password: '', // şifre localStorage'da saklanmaz
          avatar: '',
          email: u.email || ''
        }));
        SD.users = users;
        renderKullanicilar();
        UI.toast('Kullanıcılar veritabanından yüklendi.','success');
      } else {
        UI.toast('Hata: '+d.error,'error');
      }
    })
    .catch(e => UI.toast('Sunucu hatası: '+e.message,'error'));
}

function renderKullanicilar(){
  var content=document.getElementById('settingsContent');if(!content)return;
  var users=SD.users;
  var html='<div class="settings-card"><div class="settings-ttl">🧑‍💼 Teknisyen Kurulumu</div>';
  html+='<p style="font-size:13px;color:var(--text3);margin-bottom:12px;">Technician kod 1015 ve 1016 için şifre atayın ve firma aktiviteleri düzenleyin.</p>';
  html+='<div style="display:flex;gap:10px;"><button class="btn btn-outline btn-sm" onclick="setupTechCode(\'1015\')">1015 - Semih Ağlan Kurulumu</button><button class="btn btn-outline btn-sm" onclick="setupTechCode(\'1016\')">1016 - Süleyman Küçük Kurulumu</button></div></div>';
  html+='<div class="settings-card"><div class="settings-ttl" style="justify-content:space-between;">🔑 Kullanıcı Hesapları<div style="display:flex;gap:8px;"><button class="btn btn-outline btn-xs" onclick="syncUsersFromDB()" style="font-size:11px;">🔄 DB\'den Yükle</button><button class="btn btn-primary btn-sm" onclick="openAddUserModal()">+ Kullanıcı Ekle</button></div></div>';
  html+='<div id="userList"></div></div>';
  content.innerHTML=html;
  var ul=document.getElementById('userList');
  users.forEach(function(u,i){
    var row=document.createElement('div');row.className='user-card';
    var initials=BL.getInitials(u.name||u.username||'?');
    var color=BL.avatarColor(u.name||u.username||'?');
    var avHtml=u.avatar&&u.avatar.length>10?'<img src="'+u.avatar+'" alt="">':initials;
    row.innerHTML='<div class="user-av" style="background:'+color+';">'+avHtml+'</div>'
      +'<div class="user-info"><div class="user-name">'+u.name+'</div>'
      +'<div class="user-meta"><span class="user-role '+(u.role==='admin'?'role-admin':'role-tech')+'">'+(u.role==='admin'?'Yönetici':'Teknisyen')+'</span>'
      +'<span>@'+u.username+'</span>'
      +(u.email?'<span>'+u.email+'</span>':'')
      +'</div></div>'
      +'<div class="user-acts">'
      +'<button class="btn-icon" title="Şifre Değiştir" onclick="changeUserPw('+i+')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></button>'
      +(u.id!=='u0'?'<button class="btn-icon red" title="Sil" onclick="deleteUser(\''+u.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" stroke-linecap="round"/></svg></button>':'')
      +'</div>';
    ul.appendChild(row);
  });
}
window.changeUserPw=function(i){var pw=prompt('Yeni şifre:');if(!pw)return;var users=SD.users;users[i].password=pw;SD.users=users;UI.toast('Şifre değiştirildi.','success');};
window.deleteUser=function(id){UI.confirm('Kullanıcı silinecek?',function(){SD.users=SD.users.filter(function(u){return u.id!==id;});renderKullanicilar();UI.toast('Silindi.','success');});};
function openAddUserModal(){
  document.getElementById('addUserName').value='';
  document.getElementById('addUserUsername').value='';
  document.getElementById('addUserPassword').value='';
  document.getElementById('addUserEmail').value='';
  document.getElementById('addUserRole').value='tech';
  UI.openModal('addUserModal');
}
function addNewUser(){
  var n=document.getElementById('addUserName').value.trim();
  var un=document.getElementById('addUserUsername').value.trim();
  var pw=document.getElementById('addUserPassword').value;
  var em=document.getElementById('addUserEmail').value.trim();
  var role=document.getElementById('addUserRole').value;
  if(!n){UI.toast('Ad Soyad gerekli.','error');return;}
  if(!un){UI.toast('Kullanıcı adı gerekli.','error');return;}
  if(!pw){UI.toast('Şifre gerekli.','error');return;}

  // Veritabanına kaydet
  fetch('/api/auth/register', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({username:un, password:pw, name:n, email:em, role:role})
  })
  .then(r => r.json())
  .then(d => {
    if(d.success){
      var users=SD.users;users.push({id:'u'+Date.now(),username:un,name:n,role:role,password:pw,avatar:'',email:em});
      SD.users=users;UI.closeModal('addUserModal');renderKullanicilar();UI.toast('Kullanıcı eklendi.','success');
    } else {
      UI.toast('Hata: ' + (d.error||'Bilinmeyen hata'),'error');
    }
  })
  .catch(e => UI.toast('Sunucu hatası: '+e.message,'error'));
}

function buildAndPreview(){
  var html=buildOutlookRaporHTML(),frame=document.getElementById('previewFrame');if(!frame)return;
  frame.innerHTML='';var blob=new Blob([html],{type:'text/html;charset=utf-8'});
  var iframe=document.createElement('iframe');iframe.style.cssText='width:100%;height:280px;border:none;';
  iframe.src=URL.createObjectURL(blob);frame.appendChild(iframe);
}
function exportAll(){
  var d=JSON.stringify({firmalar:SD.companies,teknisyenler:SD.technicians,ziyaretler:SD.visits,extras:SD.extras,ayarlar:SD.config,kullanicilar:SD.users},null,2);
  var a=document.createElement('a');a.href='data:application/json;charset=utf-8,'+encodeURIComponent(d);a.download='servisdrama_yedek_'+new Date().toISOString().slice(0,10)+'.json';a.click();UI.toast('Yedek indirildi.','success');
}
function importAll(e){var f=e.target.files[0];if(!f)return;if(!confirm('İçe aktarma mevcut verilerin üzerine yazabilir. Devam edilsin mi?')){e.target.value='';return;}var r=new FileReader();r.onload=function(ev){try{var d=JSON.parse(ev.target.result);localStorage.setItem('sd_import_backup_'+Date.now(),JSON.stringify({firmalar:SD.companies,teknisyenler:SD.technicians,ziyaretler:SD.visits,extras:SD.extras,ayarlar:SD.config,kullanicilar:SD.users}));if(d.firmalar)SD.companies=d.firmalar;if(d.teknisyenler)SD.technicians=d.teknisyenler;if(d.ziyaretler)SD.visits=d.ziyaretler;if(d.extras)SD.extras=d.extras;if(d.kullanicilar)SD.users=d.kullanicilar;renderAll();UI.toast('Veri yüklendi! Önceki durum tarayıcıda yedeklendi.','success');}catch(err){UI.toast('Dosya okunamadı.','error');}};r.readAsText(f);e.target.value='';}
function clearVisits(){if(!confirm('Tüm ziyaret geçmişi silinecek. Devam edilsin mi?'))return;localStorage.setItem('sd_visit_backup_'+Date.now(),JSON.stringify(SD.visits));SD.visits={};renderVisit();UI.toast('Ziyaret geçmişi temizlendi. Önceki kayıtlar tarayıcıda yedeklendi.','success');}

/* ═══ TAKVİM WidGET ═══ */
var dpTempYear=null, dpTempMonth=null;
function openDatePicker(type){
  dpTempYear=A.vy;
  dpTempMonth=A.vm;
  var ysel=document.getElementById('dpYear'), msel=document.getElementById('dpMonth');
  if(!ysel||!msel)return;

  ysel.innerHTML='';
  for(var y=2020;y<=2030;y++){
    var o=document.createElement('option');o.value=y;o.textContent=y;if(y===dpTempYear)o.selected=true;ysel.appendChild(o);
  }

  var ay=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  msel.innerHTML='';
  ay.forEach(function(a,i){
    var o=document.createElement('option');o.value=i;o.textContent=a;if(i===dpTempMonth)o.selected=true;msel.appendChild(o);
  });

  ysel.addEventListener('change',function(){dpTempYear=parseInt(this.value);});
  msel.addEventListener('change',function(){dpTempMonth=parseInt(this.value);});

  UI.openModal('datePickerModal');
}
function saveDatePicker(){
  A.vy=dpTempYear;
  A.vm=dpTempMonth;
  renderVisit();
  UI.closeModal('datePickerModal');
  UI.toast('Ay seçildi.','success');
}

/* ═══ BÜYÜK HARF DÖNÜŞÜMÜ ═══ */
function setupUppercaseInput(inputId){
  var el=document.getElementById(inputId);
  if(!el)return;
  el.addEventListener('input',function(){this.value=this.value.toUpperCase();});
  el.addEventListener('blur',function(){this.value=this.value.toUpperCase();});
}

/* ═══ RAPORLAR SAYFASI - EXCEL RAPOR FORMATINDA ═══ */
function renderRaporlar(){
  var content=document.getElementById('raporlarContent');
  if(!content)return;

  var today=new Date(),dd=String(today.getDate()).padStart(2,'0'),mm=String(today.getMonth()+1).padStart(2,'0'),yyyy=today.getFullYear();
  var tarih=dd+'.'+mm+'.'+yyyy;
  var hafta='30'; // Örnek hafta

  var visits=SD.visits||{},techs=SD.technicians||[],companies=SD.companies||[];
  var visitCount=Object.keys(visits).length,setupCount=0,staffCount=techs.length;

  var html='<div style="max-width:1000px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;border:1px solid #e5e7eb;">';

  // Başlık
  html+='<div style="border-bottom:2px solid #1d4ed8;padding-bottom:16px;margin-bottom:20px;">';
  html+='<h2 style="color:#1d4ed8;margin:0 0 8px 0;">📊 SERVİSDRAMA GÜNLÜK RAPOR</h2>';
  html+='<p style="margin:0;color:#6b7280;font-size:13px;">Tarih: '+tarih+' | '+hafta+'. Hafta</p>';
  html+='</div>';

  // Özet Kartları
  html+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">';
  html+='<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:12px;">';
  html+='<div style="font-size:24px;font-weight:bold;color:#1d4ed8;">'+visitCount+'</div>';
  html+='<div style="font-size:12px;color:#6b7280;">Teknik Ziyaret</div>';
  html+='</div>';
  html+='<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:12px;">';
  html+='<div style="font-size:24px;font-weight:bold;color:#d97706;">'+setupCount+'</div>';
  html+='<div style="font-size:12px;color:#6b7280;">Kurulum</div>';
  html+='</div>';
  html+='<div style="background:#dcfce7;border:1px solid #bbf7d0;border-radius:6px;padding:12px;">';
  html+='<div style="font-size:24px;font-weight:bold;color:#16a34a;">'+staffCount+'</div>';
  html+='<div style="font-size:12px;color:#6b7280;">Personel</div>';
  html+='</div>';
  html+='</div>';

  // Teknisyen Özet Tablosu
  html+='<div style="margin-bottom:24px;">';
  html+='<h3 style="font-size:14px;font-weight:600;color:#111827;margin-bottom:12px;">👥 Teknisyen Özeti</h3>';
  html+='<table style="width:100%;border-collapse:collapse;font-size:13px;">';
  html+='<thead><tr style="background:#f3f4f6;border-bottom:1px solid #e5e7eb;"><th style="padding:10px;text-align:left;font-weight:600;">Kod</th><th style="padding:10px;text-align:left;font-weight:600;">Adı</th><th style="padding:10px;text-align:center;font-weight:600;">Ziyaret</th></tr></thead>';
  html+='<tbody>';

  // Test teknisyenler
  var testTechs=[{code:'1015',name:'Semih Ağlan'},{code:'1016',name:'Süleyman Küçük'}];
  testTechs.forEach(function(t){
    html+='<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:10px;">'+t.code+'</td><td style="padding:10px;">'+t.name+'</td><td style="padding:10px;text-align:center;"><strong>3</strong></td></tr>';
  });

  html+='</tbody></table></div>';

  // Firma Ziyaretleri Tablosu
  html+='<div style="margin-bottom:24px;">';
  html+='<h3 style="font-size:14px;font-weight:600;color:#111827;margin-bottom:12px;">🏢 Firma Ziyaretleri</h3>';
  html+='<table style="width:100%;border-collapse:collapse;font-size:13px;">';
  html+='<thead><tr style="background:#f3f4f6;border-bottom:1px solid #e5e7eb;"><th style="padding:10px;text-align:left;font-weight:600;">Firma</th><th style="padding:10px;text-align:left;font-weight:600;">Teknisyen</th><th style="padding:10px;text-align:center;font-weight:600;">Tarih</th><th style="padding:10px;text-align:center;font-weight:600;">Saat</th><th style="padding:10px;text-align:center;font-weight:600;">Durum</th></tr></thead>';
  html+='<tbody>';

  // Test verisi
  var testVisits=[
    {firma:'NSK OTOMOTİV',tech:'1015',tarih:'22.07',saat:'14:30',durum:'✓ Tamamlandı'},
    {firma:'TEKNOFORM MAKİNA',tech:'1015',tarih:'22.07',saat:'10:26',durum:'✓ Tamamlandı'},
    {firma:'ŞAHİNCE OTOMOTİV',tech:'1016',tarih:'22.07',saat:'09:45',durum:'✓ Tamamlandı'}
  ];

  testVisits.forEach(function(v){
    html+='<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:10px;">'+v.firma+'</td><td style="padding:10px;">'+v.tech+'</td><td style="padding:10px;text-align:center;">'+v.tarih+'</td><td style="padding:10px;text-align:center;">'+v.saat+'</td><td style="padding:10px;text-align:center;color:#16a34a;">'+v.durum+'</td></tr>';
  });

  html+='</tbody></table></div>';

  // Export Butonu
  html+='<div style="display:flex;gap:10px;padding-top:16px;border-top:1px solid #e5e7eb;">';
  html+='<button onclick="exportRaporToExcel()" style="padding:10px 16px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;">📥 Excel\'e Aktar</button>';
  html+='<button onclick="printRapor()" style="padding:10px 16px;background:#6b7280;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;">🖨️ Yazdır</button>';
  html+='</div>';

  html+='</div>';
  content.innerHTML=html;
}

function exportRaporToExcel(){
  var table='<table><tr><th>Kod</th><th>Adı</th><th>Ziyaret</th></tr><tr><td>1015</td><td>Semih Ağlan</td><td>3</td></tr><tr><td>1016</td><td>Süleyman Küçük</td><td>4</td></tr></table>';
  var csv='Kod,Adı,Ziyaret\n1015,Semih Ağlan,3\n1016,Süleyman Küçük,4\n';
  var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  var link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  link.download='ServısDrama_Rapor_'+new Date().toISOString().slice(0,10)+'.csv';
  link.click();
  UI.toast('Rapor indirildi!','success');
}

function printRapor(){
  window.print();
}

/* ═══ TECHNİCİYEN KURULUMU ═══ */
function setupTechCode(code){
  document.getElementById('setupTechCode').value = code;
  document.getElementById('setupTechPassword').value = '';
  document.getElementById('setupTechTitle').textContent = code + ' - Şifre Belirle';
  window._setupTechCodeValue = code;
  UI.openModal('setupTechModal');
}
function saveSetupTechPassword(){
  var code = window._setupTechCodeValue;
  var pw = document.getElementById('setupTechPassword').value;
  if(!pw){UI.toast('Şifre gerekli.','error');return;}

  // Veritabanına kaydet
  fetch('/api/auth/setup-tech-password', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({code:code, password:pw})
  })
  .then(r => r.json())
  .then(d => {
    if(d.success){
      var techs = SD.technicians || [];
      var tech = techs.find(function(t){return t.code === code;});
      if(tech) {
        tech.password = pw;
        var idx = techs.indexOf(tech);
        techs[idx] = tech;
      } else {
        techs.push({id:'t'+code, code:code, password:pw, name:'Tech '+code});
      }
      SD.technicians = techs;
      UI.closeModal('setupTechModal');
      UI.toast(code + ' şifresi atandı.','success');
      renderKullanicilar();
    } else {
      UI.toast('Hata: ' + (d.error||'Bilinmeyen hata'),'error');
    }
  })
  .catch(e => UI.toast('Sunucu hatası: '+e.message,'error'));
}


/* ═══ NUMUNE ŞABLONLARI ═══ */
function renderNumune(){
  if(typeof renderSamples==='function'){
    renderSamples();
  } else {
    var content=document.getElementById('numuneContent');if(!content)return;
    var templates=[
      {name:'Haftalık Özet',icon:'📊',desc:'Tüm teknisyenlerin haftalık özeti',onClick:'generateWeeklyReport()'},
      {name:'Teknikyen Performansı',icon:'👤',desc:'Bireysel teknisyen raporları',onClick:'alert("Teknikyen raporu seçildi")'},
      {name:'Firma Ziyaretleri',icon:'🏢',desc:'Firma bazında ziyaret detayları',onClick:'alert("Firma raporu seçildi")'},
      {name:'Aylık İstatistikler',icon:'📈',desc:'Aylık trend ve istatistikler',onClick:'alert("Aylık rapor seçildi")'},
      {name:'Eksik Ziyaretler',icon:'⚠️',desc:'Yapılmayan ziyaretlerin listesi',onClick:'alert("Eksik ziyaret raporu seçildi")'},
      {name:'Personel Özeti',icon:'👥',desc:'Ekip performans özeti',onClick:'alert("Personel raporu seçildi")'}
    ];
    content.innerHTML='';
    templates.forEach(function(t){
      var card=document.createElement('div');
      card.style.cssText='background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;cursor:pointer;transition:all .2s;';
      card.onmouseover=function(){this.style.background='#f9fafb';this.style.borderColor='#1d4ed8';};
      card.onmouseout=function(){this.style.background='#fff';this.style.borderColor='#e5e7eb';};
      card.onclick=function(){eval(t.onClick);};
      card.innerHTML='<div style="font-size:28px;margin-bottom:8px;">'+t.icon+'</div>'
        +'<div style="font-size:15px;font-weight:600;color:#111827;margin-bottom:4px;">'+t.name+'</div>'
        +'<div style="font-size:13px;color:#6b7280;">'+t.desc+'</div>';
      content.appendChild(card);
    });
  }
}

/* ═══ MAIL ALICILAR YÖNETIMI ═══ */
function loadMailRecipients(){
  var stored=localStorage.getItem('mailRecipients');
  return stored ? JSON.parse(stored) : ['barkin.kayaci@dramamakine.com'];
}

function loadMailRecipientsMode(){
  return localStorage.getItem('manuelHariciEnabled')==='true';
}

function saveMailRecipients(list){
  localStorage.setItem('mailRecipients',JSON.stringify(list));
  renderMailList();
}

function saveMailRecipientsMode(enabled){
  localStorage.setItem('manuelHariciEnabled',String(enabled));
}

function getEmailsForSending(){
  var mode=loadMailRecipientsMode();
  if(mode){
    /* Manuel Harici seçiliyse: tüm tanımlı emailler */
    return loadMailRecipients();
  }else{
    /* Seçili değilse: sadece barkin.kayaci@dramamakine.com */
    return ['barkin.kayaci@dramamakine.com'];
  }
}

var RAPOR_TO_LIST=['esra.onur@dramamakine.com','ersin.ertugen@dramamakine.com','yagiz.erel@dramamakine.com','suleyman.kucuk@dramamakine.com','semih.aglan@dramamakine.com'];
var RAPOR_CC_LIST=['emin.ertas@dramamakine.com','barkin.kayaci@dramamakine.com','ibrahim.nuhoglu@dramakimya.com'];
function getMailToCc(){
  var mode=loadMailRecipientsMode();
  if(mode){
    /* Manuel Harici seçiliyse: sabit TO/CC listesi */
    return {to:RAPOR_TO_LIST.slice(), cc:RAPOR_CC_LIST.slice()};
  }else{
    /* Seçili değilse: sadece barkin.kayaci@dramamakine.com, CC yok */
    return {to:['barkin.kayaci@dramamakine.com'], cc:[]};
  }
}

function renderMailList(){
  var list=loadMailRecipients();
  var container=document.getElementById('mailList');
  var toggle=document.getElementById('manuelHariciToggle');
  if(!container)return;

  /* Checkbox state'i yükle */
  if(toggle){
    toggle.checked=loadMailRecipientsMode();
  }

  if(list.length===0){
    container.innerHTML='<div style="padding:16px;text-align:center;color:var(--text3);">Henüz e-posta eklenmedi</div>';
    return;
  }

  container.innerHTML='';
  list.forEach(function(mail,idx){
    var item=document.createElement('div');
    item.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--border);';
    if(idx===list.length-1)item.style.borderBottom='none';
    item.innerHTML='<div style="color:#111827;font-size:14px;">'+mail+'</div>'
      +'<button class="btn" style="padding:6px 10px;background:#fee2e2;color:#dc2626;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;" onclick="removeMailRecipient('+idx+')">Sil</button>';
    container.appendChild(item);
  });
}

function addMailRecipient(){
  var input=document.getElementById('newMailInput');
  if(!input||!input.value.trim()){
    UI.toast('E-posta adresi girin.','error');
    return;
  }

  var mail=input.value.trim().toLowerCase();
  if(!mail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)){
    UI.toast('Geçerli bir e-posta adresi girin.','error');
    return;
  }

  var list=loadMailRecipients();
  if(list.indexOf(mail)!==-1){
    UI.toast('Bu e-posta zaten tanımlı.','error');
    return;
  }

  list.push(mail);
  saveMailRecipients(list);
  input.value='';
  UI.toast('E-posta eklendi.','success');
}

function removeMailRecipient(idx){
  var list=loadMailRecipients();
  if(idx<0||idx>=list.length)return;
  var removed=list.splice(idx,1);
  if(list.length===0){
    list=['barkin.kayaci@dramamakine.com'];
    UI.toast('Varsayılan e-posta geri eklendi.','info');
  }
  saveMailRecipients(list);
}

/* ═══ PROGRAM DIŞI ZİYARETLER YÖNETIMI ═══ */
function renderExtraVisits(){
  var extras=SD.extras||[];
  var container=document.getElementById('extraVisitList');
  var emptyMsg=document.getElementById('extraEmpty');
  if(!container)return;

  if(extras.length===0){
    container.innerHTML='';
    if(emptyMsg)emptyMsg.style.display='block';
    return;
  }

  if(emptyMsg)emptyMsg.style.display='none';
  container.innerHTML='';

  extras.forEach(function(ex,idx){
    var card=document.createElement('div');
    card.style.cssText='background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:14px;display:flex;justify-content:space-between;align-items:center;';

    var info=document.createElement('div');
    info.innerHTML='<div style="font-weight:700;color:#111827;font-size:14px;">'+ex.firmAdi+'</div>'
      +'<div style="font-size:12px;color:#6b7280;margin-top:4px;">📅 '+ex.date+(ex.saat?' 🕐 '+ex.saat:'')+' | Teknisyen: '+(ex.techCode||'—')+'</div>'
      +(ex.not?'<div style="font-size:12px;color:#666;margin-top:6px;">💬 '+ex.not+'</div>':'');
    card.appendChild(info);

    var btns=document.createElement('div');
    btns.style.cssText='display:flex;gap:8px;';

    var editBtn=document.createElement('button');
    editBtn.className='btn btn-outline btn-sm';
    editBtn.textContent='✏️ Düzenle';
    editBtn.addEventListener('click',function(){editExtraVisit(idx);});
    btns.appendChild(editBtn);

    var delBtn=document.createElement('button');
    delBtn.className='btn btn-outline btn-sm';
    delBtn.style.color='#dc2626';
    delBtn.textContent='🗑️ Sil';
    delBtn.addEventListener('click',function(){deleteExtraVisit(idx);});
    btns.appendChild(delBtn);

    card.appendChild(btns);
    container.appendChild(card);
  });
}

function editExtraVisit(idx){
  var extras=SD.extras||[];
  if(idx<0||idx>=extras.length)return;
  var ex=extras[idx];

  /* Form'u önceden doldur */
  var firmInp=document.getElementById('extraFirmaInp');
  var manuelInp=document.getElementById('extraManuelAdi');
  var tarihInp=document.getElementById('extraTarih');
  var saarInp=document.getElementById('extraSaat');
  var notInp=document.getElementById('extraNot');

  if(firmInp)firmInp.value=ex.firmaId?'':ex.firmAdi;
  if(manuelInp)manuelInp.value=ex.firmAdi;
  if(tarihInp){var ep=String(ex.date||'').split('.');tarihInp.value=ep.length===3?(ep[2]+'-'+ep[1]+'-'+ep[0]):'';}
  if(saarInp)saarInp.value=ex.saat||'';
  if(notInp)notInp.value=ex.not||'';

  /* Modal'ı düzenleme modu'nda aç */
  var editIdInput=document.getElementById('_editExtraIdx');
  if(!editIdInput){
    editIdInput=document.createElement('input');
    editIdInput.id='_editExtraIdx';
    editIdInput.type='hidden';
    document.body.appendChild(editIdInput);
  }
  editIdInput.value=idx;

  UI.openModal('extraVisitModal');
}

function deleteExtraVisit(idx){
  var extras=SD.extras||[];
  if(idx<0||idx>=extras.length)return;
  var firmAdi=extras[idx].firmAdi;

  UI.confirm('Program dışı ziyareti sil: '+firmAdi+'?',function(){
    extras.splice(idx,1);
    SD.extras=extras;
    renderExtraVisits();
    UI.toast('Ziyaret silindi.','success');
  });
}


/* ═══ ZİYARET EKRANI OPERASYON ÖZETİ ═══ */
function dashboardEscape(value){
  return String(value==null?'':value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}
function _visitRecordDate(record,key){
  if(!record)return null;
  if(record.dateISO){var iso=new Date(record.dateISO+'T12:00:00');if(!isNaN(iso.getTime()))return iso;}
  return SD.parseVisitDate?SD.parseVisitDate(record.date,key):null;
}
/* İstatistikler için premium kart seti — Ziyaret Takibi ile aynı yapı, beyaz tema.
   Beyaz zeminde kontrast tutsun diye vurgu renkleri koyu tonlardan seçilir. */
function renderStatPremium(host,d){
  var pct=Math.max(0,Math.min(100,d.pct||0));
  var radius=69,circ=2*Math.PI*radius,offset=circ-(circ*pct/100);
  var key='st'+Date.now().toString(36);
  host.innerHTML=''
    +'<div class="premium-visit-summary pvs-light" style="--visit-progress:'+pct+';--ring-circ:'+circ.toFixed(2)+';--ring-offset:'+offset.toFixed(2)+'">'
      +'<article class="pvs-card pvs-ring-card">'
        +'<div class="pvs-card-top"><div class="pvs-eyebrow">BU AY</div><span class="pvs-info" title="Aylık tamamlanma oranı">i</span></div>'
        +'<div class="pvs-ring" role="img" aria-label="Yüzde '+pct+' tamamlandı">'
          +'<svg viewBox="0 0 160 160" aria-hidden="true"><circle class="pvs-ring-track" cx="80" cy="80" r="69"/><circle class="pvs-ring-value" cx="80" cy="80" r="69"/></svg>'
          +'<div class="pvs-ring-core"><strong>'+d.totD+'</strong><span>/ '+d.totS+' tamamlandı</span><b>%'+pct+'</b></div>'
          +'<i class="pvs-ring-end" aria-hidden="true"></i>'
        +'</div>'
      +'</article>'
      +'<article class="pvs-card pvs-metric pvs-blue">'
        +'<div class="pvs-card-top"><div class="pvs-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/></svg></div><span class="pvs-info" title="Sistemdeki toplam firma">i</span></div>'
        +'<strong>'+d.firma+'</strong><span>TOPLAM FİRMA</span><small>'+d.teknisyen+' teknisyen</small>'+pvsSparkline('stBlue','#2563EB',Math.max(12,pct),'rise',key)
      +'</article>'
      +'<article class="pvs-card pvs-metric pvs-green">'
        +'<div class="pvs-card-top"><div class="pvs-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.6 2.6L16.5 9"/></svg></div><span class="pvs-info" title="Bu hafta tamamlanan ziyaret">i</span></div>'
        +'<strong>'+d.thisWD+'</strong><span>BU HAFTA</span><small>tamamlanan</small>'+pvsSparkline('stGreen','#059669',pct,'flow',key)
      +'</article>'
      +'<article class="pvs-card pvs-metric pvs-orange">'
        +'<div class="pvs-card-top"><div class="pvs-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/></svg></div><span class="pvs-info" title="Sonucu bekleyen numune">i</span></div>'
        +'<strong>'+d.numune+'</strong><span>BEKLEYEN NUMUNE</span><small>analiz bekliyor</small>'+pvsSparkline('stOrange','#D97706',pct,'calm',key)
      +'</article>'
    +'</div>';
  host.classList.add('pvs-settled');
}

function pvsSparkline(id,color,progress,variant,renderKey){
  var paths={
    calm:'M0 42 C48 43 72 39 104 41 C142 44 166 25 206 25 C242 25 267 39 300 36',
    rise:'M0 43 C45 45 80 43 112 39 C150 34 174 20 211 23 C249 26 273 40 300 37',
    flow:'M0 41 C44 45 82 43 113 38 C150 32 169 19 205 23 C239 28 266 40 300 35'
  };
  var path=paths[variant]||paths.calm;
  var p=Math.max(0,Math.min(100,Number(progress)||0));
  var uid=id+'_'+String(renderKey||'0').replace(/[^a-zA-Z0-9_-]/g,'');
  return '<svg class="pvs-spark" viewBox="0 0 300 54" preserveAspectRatio="none" aria-hidden="true">'
    +'<defs><linearGradient id="'+uid+'Fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+color+'" stop-opacity=".24"/><stop offset="100%" stop-color="'+color+'" stop-opacity="0"/></linearGradient><filter id="'+uid+'Glow" x="-20%" y="-80%" width="140%" height="260%"><feGaussianBlur stdDeviation="2.8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
    +'<path class="pvs-spark-area" d="'+path+' L300 54 L0 54 Z" fill="url(#'+uid+'Fill)"/>'
    +'<path class="pvs-spark-track" d="'+path+'" pathLength="100"/>'
    +'<path class="pvs-spark-value" d="'+path+'" pathLength="100" style="--pvs-value:'+p+'" stroke="'+color+'" filter="url(#'+uid+'Glow)"/>'
    +'<circle class="pvs-spark-dot" r="3.8" fill="#fff" stroke="'+color+'" stroke-width="2" style="--pvs-value:'+p+';offset-path:path(\''+path+'\')"/>'
    +'</svg>';
}
function renderVisitDashboard(){
  var host=document.getElementById('visitDashboardContent');if(!host)return;
  var isMobile=window.innerWidth<768;
  if(isMobile){host.innerHTML='';return;}

  var cos=SD.companies||[],vis=SD.visits||{};
  var now=new Date(),month=now.getMonth(),year=now.getFullYear();
  var cwk=DT.wkey(now),weeks=DT.monthWeeks(year,month);
  var cwi=weeks.findIndex(function(m){return m.getTime()===DT.monday(now).getTime();})+1;
  var scheduled=cos.filter(function(c){return c.aktif!==false&&BL.scheduled(c,cwi);});
  var completed=scheduled.filter(function(c){var v=vis[c.id+'_'+cwk];return v&&v.status==='done';}).length;
  var progress=scheduled.length>0?Math.round((completed/scheduled.length)*100):0;
  var safeProgress=Math.max(0,Math.min(100,progress));
  var firstDashboardRender=host.dataset.pvsInitialized!=='1';
  var renderKey=Date.now().toString(36);
  var radius=69,circ=2*Math.PI*radius,offset=circ-(circ*safeProgress/100);

  host.innerHTML=''
    +'<div class="premium-visit-summary pvs-light" style="--visit-progress:'+safeProgress+';--ring-circ:'+circ.toFixed(2)+';--ring-offset:'+offset.toFixed(2)+'">'
      +'<article class="pvs-card pvs-ring-card">'
        +'<div class="pvs-card-top"><div class="pvs-eyebrow">BU HAFTA</div><span class="pvs-info" title="Haftalık tamamlanma oranı">i</span></div>'
        +'<div class="pvs-ring" role="img" aria-label="Yüzde '+safeProgress+' tamamlandı">'
          +'<svg viewBox="0 0 160 160" aria-hidden="true"><defs><linearGradient id="pvsRingGradient_'+renderKey+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ce796"/><stop offset=".48" stop-color="#55d8ff"/><stop offset="1" stop-color="#5f9dff"/></linearGradient><filter id="pvsRingGlow_'+renderKey+'" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><circle class="pvs-ring-track" cx="80" cy="80" r="69"/><circle class="pvs-ring-value" cx="80" cy="80" r="69"/></svg>'
          +'<div class="pvs-ring-core"><strong>'+completed+'</strong><span>tamamlandı</span><b>%'+safeProgress+'</b></div>'
          +'<i class="pvs-ring-end" aria-hidden="true"></i>'
        +'</div>'
      +'</article>'
      +'<article class="pvs-card pvs-metric pvs-blue">'
        +'<div class="pvs-card-top"><div class="pvs-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg></div><span class="pvs-info" title="Bu hafta planlanan toplam ziyaret">i</span></div>'
        +'<strong>'+scheduled.length+'</strong><span>PLANLANDI ZİYARET</span><small>Bu hafta</small>'+pvsSparkline('pvsBlue','#5f9dff',Math.max(12,safeProgress),'rise',renderKey)
      +'</article>'
      +'<article class="pvs-card pvs-metric pvs-green">'
        +'<div class="pvs-card-top"><div class="pvs-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.6 2.6L16.5 9"/></svg></div><span class="pvs-info" title="Bu hafta tamamlanan ziyaret">i</span></div>'
        +'<strong>'+completed+'</strong><span>TAMAMLANDI</span><small>Bu hafta</small>'+pvsSparkline('pvsGreen','#5ce796',safeProgress,'flow',renderKey)
      +'</article>'
      +'<article class="pvs-card pvs-metric pvs-orange">'
        +'<div class="pvs-card-top"><div class="pvs-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 16l5-5 4 3 7-8"/><path d="M15 6h5v5"/></svg></div><span class="pvs-info" title="Haftalık ilerleme yüzdesi">i</span></div>'
        +'<strong>%'+safeProgress+'</strong><span>İLERLEME ORANI</span><small>Bu hafta</small>'+pvsSparkline('pvsOrange','#ffae42',safeProgress,'calm',renderKey)
      +'</article>'
    +'</div>';

  host.classList.remove('pvs-ready','pvs-settled');
  if(firstDashboardRender){
    host.dataset.pvsInitialized='1';
    window.requestAnimationFrame(function(){host.classList.add('pvs-ready');});
    window.setTimeout(function(){host.classList.remove('pvs-ready');host.classList.add('pvs-settled');},1750);
  }else{
    host.classList.add('pvs-settled');
  }
}
function renderDashboard(){renderVisitDashboard();}

/* ═══════════════════════════════════════════════════════════════════════
   SERVİSDRAMA PROFESYONEL HAFTALIK RAPOR MERKEZİ
   Gerçek ziyaretler + firma periyodu + Excel + mail eki
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  function escR(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
  function mondayR(d){var x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x;}
  function addDaysR(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x;}
  function isoR(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function trR(d){return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear();}
  function weekOfMonthR(d){var first=new Date(d.getFullYear(),d.getMonth(),1),firstMon=mondayR(first);return Math.floor((mondayR(d)-firstMon)/604800000)+1;}
  function periodTextR(w){w=(w||[1,2,3,4]).map(Number).filter(Boolean).sort();var key=w.join(',');if(key==='1,2,3,4')return'Her hafta';if(w.length===1)return w[0]+'. hafta';return w.map(function(x,i){return x+'.'+(i===w.length-1?' hafta':'');}).join(', ').replace(/, ([0-9]+)\. hafta$/, ' ve $1. hafta');}
  function techByCodeR(code){var ts=SD.technicians||[];return ts.find(function(t){return String(t.code)===String(code);})||{name:code||'—',code:code||'—'};}
  function entryListR(rec){if(!rec)return[];if(rec.by&&typeof rec.by==='object')return Object.keys(rec.by).map(function(k){return rec.by[k];});return[rec];}
  function reportDataR(start,end){
    start=new Date(start+'T00:00:00');end=new Date(end+'T23:59:59');
    var companies=SD.companies||[], visits=SD.visits||{}, rows=[];
    Object.keys(visits).forEach(function(key){
      var pos=key.lastIndexOf('_');if(pos<0)return;var cid=key.slice(0,pos),wk=key.slice(pos+1),co=companies.find(function(c){return String(c.id)===String(cid);});if(!co)return;
      entryListR(visits[key]).forEach(function(v){
        if(!v||v.status!=='done')return;
        var dates=(v.dates&&v.dates.length?v.dates:[v.date]).filter(Boolean);
        dates.forEach(function(ds){
          var parts=String(ds).match(/(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{4}))?/);if(!parts)return;
          var y=parts[3]?Number(parts[3]):start.getFullYear(),dt=new Date(y,Number(parts[2])-1,Number(parts[1]));
          if(dt<start||dt>end)return;
          var t=techByCodeR(v.tc), wom=weekOfMonthR(dt), weeks=(co.weeks||[1,2,3,4]).map(Number);
          var setupInfo='';
          if(co.kurulumStart){
            var setupEnd=co.kurulumEnd||co.kurulumStart;
            var isActive=(!co.kurulumEnd||new Date(setupEnd+'T23:59:59')>=dt);
            setupInfo=isActive?' (🔧 Kurulum: '+co.kurulumStart+(co.kurulumEnd?' → '+co.kurulumEnd:' Devam')+')':'';
          }
          rows.push({firma:co.name||'—',teknisyen:t.name||v.tc||'—',tarih:trR(dt),date:dt,durum:'Tamamlandı',periyot:periodTextR(weeks),plan:weeks.indexOf(wom)>=0?'Plana Uygun':'Plan Dışı',setupInfo:setupInfo,firmaId:co.id,techCode:v.tc||t.code||'—'});
        });
      });
    });
    (SD.extras||[]).forEach(function(ex){
      var ds=ex.tarih||ex.date,parts=String(ds||'').match(/(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{4}))?/);if(!parts)return;
      var y=parts[3]?Number(parts[3]):start.getFullYear(),dt=new Date(y,Number(parts[2])-1,Number(parts[1]));if(dt<start||dt>end)return;
      var co=companies.find(function(c){return String(c.id)===String(ex.firmaId);});
      var exTech=(SD.technicians||[]).find(function(t){return t.id===ex.techId;})||techByCodeR(ex.techCode);
      var weeks=co?(co.weeks||[1,2,3,4]):[];
      rows.push({firma:co?co.name:(ex.firmAdi||'Program Dışı Firma'),teknisyen:exTech.name||ex.techCode||'—',tarih:trR(dt),date:dt,durum:'Tamamlandı',periyot:co?periodTextR(weeks):'Kayıtlı periyot yok',plan:'Program Dışı',firmaId:co?co.id:'extra',techCode:ex.techCode||exTech.code||'—',not:ex.not||''});
    });
    rows.sort(function(a,b){return a.date-b.date||String(a.techCode||'').localeCompare(String(b.techCode||''),'tr');});
    var unique={};rows.forEach(function(r){unique[r.firmaId||r.firma]=1;});
    var tech={};rows.forEach(function(r){tech[r.teknisyen]=(tech[r.teknisyen]||0)+1;});
    var days={};rows.forEach(function(r){days[r.tarih]=(days[r.tarih]||0)+1;});
    return{rows:rows,total:rows.length,unique:Object.keys(unique).length,tech:tech,days:days,uygun:rows.filter(function(r){return r.plan==='Plana Uygun';}).length,disi:rows.filter(function(r){return r.plan==='Plan Dışı'||r.plan==='Program Dışı';}).length,planDisi:rows.filter(function(r){return r.plan==='Plan Dışı';}).length,programDisi:rows.filter(function(r){return r.plan==='Program Dışı';}).length,start:start,end:end};
  }
  function barsR(obj){var keys=Object.keys(obj),max=Math.max.apply(null,keys.map(function(k){return obj[k];}).concat([1]));return keys.map(function(k){return'<div class="wr-bar-row"><span>'+escR(k)+'</span><div><i style="width:'+Math.max(8,Math.round(obj[k]/max*100))+'%"></i></div><b>'+obj[k]+'</b></div>';}).join('')||'<div class="wr-empty">Kayıt yok</div>';}
  function iconR(type){
    var icons={visit:'<svg viewBox="0 0 24 24"><path d="M4 20v-9l8-5 8 5v9M9 20v-6h6v6"/></svg>',company:'<svg viewBox="0 0 24 24"><path d="M4 21V5h10v16M14 9h6v12M7 8h2M7 12h2M7 16h2M17 12h1M17 16h1"/></svg>',user:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',sample:'<svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M8 15h8"/></svg>',warn:'<svg viewBox="0 0 24 24"><path d="M12 3 2 21h20L12 3z"/><path d="M12 9v5M12 18h.01"/></svg>',ok:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>'};return icons[type]||icons.visit;
  }
  function kpiR(label,value,type,cls){return'<div class="wr-kpi '+(cls||'')+'"><span class="wr-kpi-icon">'+iconR(type)+'</span><div><small>'+escR(label)+'</small><b>'+value+'</b></div></div>';}
  function donutR(ok,bad,total){var pct=total?Math.round(ok/total*100):0;return'<div class="wr-donut" style="--pct:'+pct+'"><div><b>'+total+'</b><span>Toplam</span></div></div><div class="wr-legend"><span><i class="lg-green"></i>Plana Uygun <b>'+ok+'</b></span><span><i class="lg-orange"></i>Plan Dışı <b>'+bad+'</b></span></div>';}
  function dashboardR(d){
    var _SD=(typeof SD!=='undefined')?SD:{companies:[],visits:{}},_DT=(typeof DT!=='undefined')?DT:{monthWeeks:function(){return[]},monday:function(){return new Date();}},_BL=(typeof BL!=='undefined')?BL:{scheduled:function(){return false;}};
    var missedCos=[];
    var today=new Date(),weeks=_DT.monthWeeks(today.getFullYear(),today.getMonth());
    var weekIndex=weeks.findIndex(function(m){return m.getTime()===_DT.monday(today).getTime();})+1;
    if(weekIndex>0){
      (_SD.companies||[]).forEach(function(co){
        if(!_BL.scheduled(co,weekIndex)||co.aktif===false)return;
        var visited=false;
        for(var i=0;i<=52;i++){
          if((_SD.visits||{})[co.id+'_'+i]&&(_SD.visits||{})[co.id+'_'+i].status==='done'){visited=true;break;}
        }
        if(!visited)missedCos.push(co.name);
      });
    }
    var missedId='missed_'+Date.now();
    var setupList='';
    d.rows.forEach(function(r){if(r.setupInfo)setupList+='<div style="margin:6px 0;font-size:12px;">'+escR(r.firma)+': '+escR(r.setupInfo)+'</div>';});
    var missedWarning=missedCos.length?'<div style="background:#fef3c7;border-left:5px solid #f59a00;margin:16px;border-radius:6px;overflow:hidden;"><div style="padding:16px;cursor:pointer;user-select:none;display:flex;justify-content:space-between;align-items:center;" onclick="var el=document.getElementById(\''+missedId+'\');el.style.display=el.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'span\').textContent=el.style.display===\'none\'?\'▸\':\'▾\';"><div><div style="font-weight:bold;color:#92400e;">⚠️ Planlanmış Ama Ziyaret Edilmemiş ('+missedCos.length+')</div></div><span style="font-size:18px;color:#92400e;">▸</span></div><div id="'+missedId+'" style="display:none;padding:0 16px 16px;border-top:1px solid #f3d9a8;font-size:13px;color:#78350f;">'+missedCos.join('<br>')+'</div></div>':'';
    var setupSection=setupList?'<div style="background:#fffbeb;border-left:5px solid #f59a00;padding:16px;margin:16px;border-radius:6px;"><div style="font-weight:bold;color:#92400e;">🔧 Kurulum & Devreye Alma</div><div style="margin-top:8px;font-size:12px;color:#78350f;">'+setupList+'</div></div>':'';
    var rows=d.rows.map(function(r){var planCls=r.plan==='Plana Uygun'?'ok':(r.plan==='Program Dışı'?'off':'warn');return'<tr><td>'+escR(r.firma)+'</td><td>'+escR(r.teknisyen)+'</td><td>'+r.tarih+'</td><td><span class="wr-badge ok">'+r.durum+'</span></td><td>'+escR(r.periyot)+'</td><td><span class="wr-badge '+planCls+'">'+r.plan+'</span></td><td>'+escR(r.not||'')+'</td></tr>';}).join('');
    var techKeys=Object.keys(d.tech), sampleCount=d.rows.filter(function(r){return /numune/i.test(r.firma+' '+r.durum);}).length;
    return'<div class="weekly-report" style="font-family:Arial,Helvetica,sans-serif;color:#0c2854;background:#f7f9fc;">'
      +'<div class="wr-top" style="display:flex;align-items:center;justify-content:space-between;background:#102b50;color:#fff;padding:24px;">'
        +'<div style="flex:1;"><img src="assets/email/servisdrama/drama-makine-logo.png" alt="Drama Makine" style="height:44px;margin-bottom:12px;display:block;"><h3 style="margin:0;font-size:24px;">Haftalık Teknik Servis Raporu</h3><div style="margin-top:12px;font-size:13px;color:#d8e5f3;">Dönem: <b>'+trR(d.start)+' - '+trR(d.end)+'</b> | Rapor Tarihi: <b>'+trR(new Date())+'</b></div></div>'
        +'<div style="text-align:right;"><div style="font-size:32px;font-weight:bold;">'+d.total+'</div><div style="font-size:13px;color:#a0b4d4;">Teknik Ziyaret</div></div>'
      +'</div>'
      +'<div class="wr-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;padding:16px;background:#fff;">'
        +kpiR('Toplam Ziyaret',d.total,'visit','blue')+kpiR('Ziyaret Edilen Firma',d.unique,'company','navy')+kpiR('Plana Uygun',d.uygun,'ok','green')+kpiR('Plan Dışı',d.disi,'warn','red')
      +'</div>'
      +setupSection
      +'<div class="wr-charts" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;padding:16px;background:#fff;"><section style="background:#fff;border:1px solid #dbe3ee;border-radius:8px;padding:12px;"><h3 style="margin:0 0 12px;font-size:13px;text-align:center;">Teknisyene Göre Ziyaret</h3>'+barsR(d.tech)+'</section><section style="background:#fff;border:1px solid #dbe3ee;border-radius:8px;padding:12px;"><h3 style="margin:0 0 12px;font-size:13px;text-align:center;">Günlere Göre Dağılım</h3>'+barsR(d.days)+'</section><section style="background:#fff;border:1px solid #dbe3ee;border-radius:8px;padding:12px;"><h3 style="margin:0 0 12px;font-size:13px;text-align:center;">Plan Durumu</h3>'+donutR(d.uygun,d.disi,d.total)+'</section></div>'
      +missedWarning
      +'<div class="wr-table" style="background:#fff;border:1px solid #dbe3ee;border-radius:8px;margin:16px;overflow:auto;"><h3 style="margin:0;background:#0c3c78;color:#fff;padding:12px;font-size:13px;">HAFTALIK ZİYARET LİSTESİ</h3><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#0c3c78;color:#fff;"><th style="padding:8px;text-align:left;">Firma</th><th style="padding:8px;text-align:left;">Teknisyen</th><th style="padding:8px;text-align:center;">Ziyaret Tarihi</th><th style="padding:8px;text-align:center;">Durum</th><th style="padding:8px;text-align:left;">Periyot</th><th style="padding:8px;text-align:center;">Plan Durumu</th><th style="padding:8px;text-align:left;">Not</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
      +'<div class="wr-bottom" style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin:16px;background:#fff;border:1px solid #dbe3ee;border-radius:8px;overflow:hidden;">'+kpiR('Toplam Ziyaret',d.total,'visit','blue')+kpiR('Ziyaret Edilen Firma',d.unique,'company','navy')+kpiR('Plan Dışı',d.disi,'warn','red')+kpiR('Plana Uygun',d.uygun,'ok','green')+'</div></div>';
  }
  function rangeR(){var s=document.getElementById('raporStart'),e=document.getElementById('raporEnd'),now=new Date(),m=mondayR(now),f=addDaysR(m,4);return{start:s&&s.value?s.value:isoR(m),end:e&&e.value?e.value:isoR(f)};}
  window.renderDetailedReports=function(){
    var content=document.getElementById('raporlarPageContent');if(!content)return;var now=new Date(),m=mondayR(now),f=addDaysR(m,4);
    content.innerHTML="<style>\n.weekly-report{font-family:Inter,Arial,sans-serif;color:#0c2854;background:#f7f9fc;border:1px solid #d9e1ec;border-radius:12px;overflow:hidden}.wr-top{display:flex;align-items:stretch;background:#fff;border-bottom:1px solid #dbe3ee}.wr-logo{width:116px;min-height:92px;background:#082b61;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:39px;font-weight:800;letter-spacing:-3px}.wr-logo small{font-size:13px;letter-spacing:3px;margin-top:-4px}.wr-title{flex:1;padding:16px 22px}.wr-title h2{margin:0 0 15px;font-size:25px;letter-spacing:.2px;color:#0b2f67}.wr-meta{display:flex;gap:22px;flex-wrap:wrap;font-size:12px;color:#41546f}.wr-actions{display:flex;align-items:center;gap:8px;padding:14px}.wr-actions button{border:1px solid #cbd5e1;background:#fff;border-radius:7px;padding:10px 13px;font-weight:700;cursor:pointer}.wr-actions .primary{background:#0b3a78;color:#fff;border-color:#0b3a78}.wr-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;padding:14px}.wr-kpi{min-height:76px;background:#fff;border:1px solid #dbe3ee;border-radius:10px;display:flex;align-items:center;gap:12px;padding:11px 14px}.wr-kpi-icon{width:42px;height:42px;border-radius:50%;background:#e8f1ff;display:grid;place-items:center;flex:0 0 auto}.wr-kpi-icon svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.8}.wr-kpi small{display:block;font-size:11px;font-weight:800;color:#17355f}.wr-kpi b{display:block;font-size:25px;line-height:1.1;margin-top:4px;color:#0a2f67}.wr-kpi.green .wr-kpi-icon{background:#e4f5eb;color:#13804b}.wr-kpi.purple .wr-kpi-icon{background:#eee8ff;color:#6f42c1}.wr-kpi.red .wr-kpi-icon{background:#fdeaea;color:#d43f4d}.wr-charts{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:0 14px 12px}.wr-charts section{min-height:210px;background:#fff;border:1px solid #dbe3ee;border-radius:10px;padding:13px}.wr-charts h3{font-size:12px;text-align:center;margin:0 0 15px;color:#17355f}.wr-bar-row{display:grid;grid-template-columns:95px 1fr 28px;gap:7px;align-items:center;font-size:11px;margin:12px 0}.wr-bar-row>div{height:14px;background:#edf2f8;border-radius:2px;overflow:hidden}.wr-bar-row i{display:block;height:100%;background:linear-gradient(90deg,#0d3a78,#2d75c7)}.wr-donut,.wr-simple-donut{--pct:75;width:126px;height:126px;margin:6px auto;border-radius:50%;background:conic-gradient(#33945f calc(var(--pct)*1%),#f58220 0);display:grid;place-items:center}.wr-simple-donut{background:conic-gradient(#2875c7 0 75%,#7b52c7 75% 100%)}.wr-donut:after,.wr-simple-donut:after{content:\"\";width:78px;height:78px;background:#fff;border-radius:50%;grid-area:1/1}.wr-donut>div,.wr-simple-donut>div{z-index:1;grid-area:1/1;text-align:center}.wr-donut b,.wr-simple-donut b{display:block;font-size:24px}.wr-donut span,.wr-simple-donut span{font-size:11px}.wr-legend{display:flex;flex-direction:column;gap:7px;font-size:11px;align-items:flex-start;width:max-content;margin:8px auto}.wr-legend i{display:inline-block;width:9px;height:9px;margin-right:6px}.lg-green{background:#33945f}.lg-orange{background:#f58220}.lg-blue{background:#2875c7}.lg-purple{background:#7b52c7}.wr-table{margin:0 14px 12px;background:#fff;border:1px solid #dbe3ee;border-radius:9px;overflow:hidden}.wr-table h3{margin:0;background:#082f67;color:#fff;padding:7px 13px;font-size:13px}.wr-table>div{overflow:auto}.wr-table table{width:100%;border-collapse:collapse;font-size:11px}.wr-table th{background:#0c3c78;color:#fff;padding:7px 8px;text-align:center;white-space:nowrap;border-right:1px solid rgba(255,255,255,.25)}.wr-table td{padding:6px 8px;border-bottom:1px solid #e4e9f0;border-right:1px solid #edf0f4}.wr-table tbody tr:nth-child(even){background:#fbfcfe}.wr-badge{display:inline-block;min-width:86px;text-align:center;padding:3px 8px;border-radius:5px;color:#fff;font-weight:700}.wr-badge.ok{background:#3d9b61}.wr-badge.warn{background:#f58220}.wr-badge.off{background:#7c3aed}.wr-bottom{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin:0 14px 14px;background:#fff;border:1px solid #dbe3ee;border-radius:10px;overflow:hidden}.wr-bottom .wr-kpi{border:0;border-radius:0;justify-content:center;border-right:1px solid #dbe3ee}.wr-bottom .wr-kpi:last-child{border-right:0}.wr-filter{display:flex;gap:10px;align-items:end;justify-content:space-between;background:#fff;border:1px solid #dce4ef;border-radius:10px;padding:12px;margin-bottom:12px}.wr-filter label{font-size:12px;font-weight:700;color:#475569}.wr-filter input{display:block;margin-top:5px;padding:8px;border:1px solid #cbd5e1;border-radius:7px}.wr-filter-inputs{display:flex;gap:20px;align-items:end}.wr-filter-btns{display:flex;gap:8px;align-items:center}@media(max-width:1200px){.wr-charts{grid-template-columns:repeat(2,1fr)}}@media(max-width:800px){.wr-top{flex-direction:column}.wr-logo{width:100%;min-height:70px}.wr-charts{grid-template-columns:1fr}.wr-bottom{grid-template-columns:repeat(2,1fr)}.wr-title h2{font-size:20px}}\n</style>"
      +'<div class="wr-filter"><div class="wr-filter-inputs"><label>Başlangıç Tarihi<input type="date" id="raporStart" value="'+isoR(m)+'"></label><label>Bitiş Tarihi<input type="date" id="raporEnd" value="'+isoR(f)+'"></label><button style="background:#6b7280;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;margin-left:8px;" onclick="previewWeeklyReport()">Raporu Getir</button></div><div class="wr-filter-btns"><button style="background:#22c55e;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;" onclick="mailWeeklyReport()">📧 Mail Gönder</button><button style="background:#3b82f6;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;" onclick="generateWeeklyReport()">📥 Excel İndir</button></div></div><div id="raporPreviewArea"></div>';
    window.previewWeeklyReport();
  };
  window.previewWeeklyReport=function(){var r=rangeR(),d=reportDataR(r.start,r.end),p=document.getElementById('raporPreviewArea');if(p)p.innerHTML=dashboardR(d);};
  async function workbookR(d){
    if(typeof ExcelJS==='undefined')throw new Error('ExcelJS yüklenemedi. İnternet bağlantısını kontrol edin.');
    var wb=new ExcelJS.Workbook();wb.creator='DK Portal';wb.created=new Date();
    var ws=wb.addWorksheet('Teknik Servis Raporu',{views:[{state:'frozen',ySplit:6}]});ws.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:1,paperSize:9};
    var NAVY='FF102B50',ACCENT='FF3B82F6',MUTED='FF7A8799';
    /* Satır 1: koyu lacivert marka şeridi — logo + rapor başlığı */
    ws.getRow(1).height=42;['A1','B1','C1','D1','E1','F1','G1'].forEach(function(a){ws.getCell(a).fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}};});
    ws.mergeCells('C1:G1');ws.getCell('C1').value='TEKNİK SERVİS HAFTALIK RAPORU';ws.getCell('C1').font={size:20,bold:true,color:{argb:'FFFFFFFF'}};ws.getCell('C1').alignment={vertical:'middle',horizontal:'right'};
    try{
      var logoResp=await fetch('assets/email/servisdrama/drama-makine-logo.png');
      if(logoResp.ok){
        var logoBuf=await logoResp.arrayBuffer();
        var logoImgId=wb.addImage({buffer:logoBuf,extension:'png'});
        ws.addImage(logoImgId,{tl:{col:0.15,row:0.12},ext:{width:120,height:34}});
      }
    }catch(e){}
    /* Satır 2: eyebrow marka adı (sol) + dönem bilgisi (sağ) */
    ws.getRow(2).height=20;
    ws.getCell('A2').value='SERVİSDRAMA';ws.getCell('A2').font={bold:true,size:10,color:{argb:ACCENT}};ws.getCell('A2').alignment={vertical:'middle'};
    ws.mergeCells('C2:G2');ws.getCell('C2').value='Dönem: '+trR(d.start)+' - '+trR(d.end)+'   •   Rapor Tarihi: '+trR(new Date());ws.getCell('C2').font={bold:true,size:11,color:{argb:'FF334155'}};ws.getCell('C2').alignment={vertical:'middle',horizontal:'right'};
    /* Satır 3: ince marka rengi ayraç */
    ws.getRow(3).height=4;['A3','B3','C3','D3','E3','F3','G3'].forEach(function(a){ws.getCell(a).fill={type:'pattern',pattern:'solid',fgColor:{argb:ACCENT}};});
    /* Satır 4: KPI kartları — her biri kendi anlam rengiyle */
    var kpis=[
      ['A4','Toplam Ziyaret',d.total,'FF1565D8','FFEFF6FF'],
      ['B4','Ziyaret Edilen Firma',d.unique,'FF078578','FFE6F7F5'],
      ['C4','Plana Uygun',d.uygun,'FF16A34A','FFECFDF5'],
      ['D4','Plan Dışı',d.planDisi,'FFD97706','FFFFF7ED'],
      ['E4','Program Dışı',d.programDisi,'FF7C3AED','FFF5F3FF']
    ];
    kpis.forEach(function(x){var c=ws.getCell(x[0]);c.value=x[1]+'\n'+x[2];c.alignment={wrapText:true,horizontal:'center',vertical:'middle'};c.font={bold:true,size:14,color:{argb:x[3]}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:x[4]}};c.border={top:{style:'thin',color:{argb:'FFCBD5E1'}},left:{style:'thin',color:{argb:'FFCBD5E1'}},bottom:{style:'thin',color:{argb:'FFCBD5E1'}},right:{style:'thin',color:{argb:'FFCBD5E1'}}};});
    ws.getRow(4).height=46;['F4','G4'].forEach(function(a){ws.getCell(a).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF7F9FC'}};});
    ws.getRow(5).height=6;
    var head=['Firma','Teknisyen (Kod)','Ziyaret Tarihi','Durum','Firma Kayıtlı Periyodu','Plan Durumu / Kurulum','Not'];ws.addRow(head);var hr=ws.lastRow;hr.height=22;hr.font={bold:true,color:{argb:'FFFFFFFF'}};hr.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}};hr.alignment={horizontal:'center',vertical:'middle'};
    var planColors={'Plana Uygun':'FF16A34A','Plan Dışı':'FFD97706','Program Dışı':'FF7C3AED'};
    d.rows.forEach(function(r,i){
      var row=ws.addRow([r.firma,r.teknisyen+' ('+r.techCode+')',r.tarih,r.durum,r.periyot,r.plan+(r.setupInfo||''),r.not||'']);
      var zebra=i%2?'FFF7FAFC':'FFFFFFFF';
      row.eachCell({includeEmpty:true},function(c){c.fill={type:'pattern',pattern:'solid',fgColor:{argb:zebra}};});
      var planCell=row.getCell(6);planCell.fill={type:'pattern',pattern:'solid',fgColor:{argb:planColors[r.plan]||'FF64748B'}};planCell.font={bold:true,color:{argb:'FFFFFFFF'}};planCell.alignment={horizontal:'center',vertical:'middle'};
      var durumCell=row.getCell(4);durumCell.font={bold:true,color:{argb:'FF16A34A'}};durumCell.alignment={horizontal:'center',vertical:'middle'};
    });
    ws.columns=[{width:42},{width:23},{width:16},{width:16},{width:25},{width:20},{width:32}];ws.autoFilter={from:'A6',to:'G6'};
    ws.eachRow(function(row,no){if(no>=6){row.alignment=row.alignment||{vertical:'middle'};row.eachCell(function(c){c.border=Object.assign({},c.border,{bottom:{style:'hair',color:{argb:'FFD9E2F0'}}});});}});
    var lastRow=6+d.rows.length;
    ws.getRow(lastRow+1).height=6;
    ws.mergeCells('A'+(lastRow+2)+':G'+(lastRow+2));
    var footCell=ws.getCell('A'+(lastRow+2));
    footCell.value={richText:[{font:{bold:true,size:10,color:{argb:'FF1565D8'}},text:'ServisDrama'},{font:{size:10,color:{argb:MUTED}},text:' • Haftalık Rapor • Powered by BKAYACI'}]};
    footCell.alignment={horizontal:'center',vertical:'middle'};
    return wb;
  }
  function downloadR(buf,name){var blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);}
  window.generateWeeklyReport=async function(){try{var r=rangeR(),d=reportDataR(r.start,r.end);if(!d.total){UI.toast('Seçilen tarih aralığında tamamlanmış ziyaret yok.','warning');return;}UI.toast('Profesyonel Excel hazırlanıyor...','info');var wb=await workbookR(d),buf=await wb.xlsx.writeBuffer();downloadR(buf,'Teknik_Servis_Haftalik_Rapor_'+r.start+'_'+r.end+'.xlsx');UI.toast('Excel raporu indirildi.','success');}catch(e){console.error(e);UI.toast(e.message||'Excel oluşturulamadı.','error');}};
  function b64R(buffer){var bytes=new Uint8Array(buffer),binary='',chunk=0x8000;for(var i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode.apply(null,bytes.subarray(i,Math.min(i+chunk,bytes.length)));return btoa(binary);}
  window.mailWeeklyReport=async function(){try{var r=rangeR(),d=reportDataR(r.start,r.end);if(!d.total){UI.toast('Mail için rapor kaydı yok.','warning');return;}var cfg=SD.config||{},mc=typeof getMailToCc==='function'?getMailToCc():{to:['barkin.kayaci@dramamakine.com'],cc:[]};UI.toast('Excel eki hazırlanıyor...','info');var wb=await workbookR(d),buf=await wb.xlsx.writeBuffer(),filename='Teknik_Servis_Haftalik_Rapor_'+r.start+'_'+r.end+'.xlsx';var missedCompanies=[];var missedNames={};d.rows.forEach(function(r){if(r.firma)missedNames[r.firma]=true;});var wMon=mondayR(new Date(r.start)),wWeeks=DT.monthWeeks(wMon.getFullYear(),wMon.getMonth()),wIndex=wWeeks.findIndex(function(w){return w.getTime()===wMon.getTime();})+1;(SD.companies||[]).forEach(function(co){if(!missedNames[co.name]&&co.aktif!==false&&wIndex>0&&BL.scheduled(co,wIndex)){var lastVisitDate=null;Object.keys(SD.visits||{}).forEach(function(key){if(key.indexOf(co.id+'_')===0){var rec=(SD.visits||{})[key];if(rec&&rec.status==='done'&&rec.date){var vparts=String(rec.date).split('.');if(vparts.length>=2){var vd=new Date(Number(vparts[2]||new Date().getFullYear()),Number(vparts[1])-1,Number(vparts[0]));if(!lastVisitDate||vd>lastVisitDate)lastVisitDate=vd;}}}});var tech=(SD.technicians||[]).find(function(t){return t.id===co.techId;});missedCompanies.push({name:co.name,tech:tech?tech.name:'-',lastVisit:lastVisitDate||null});}});missedCompanies.sort(function(a,b){if(!a.lastVisit&&!b.lastVisit)return 0;if(!a.lastVisit)return 1;if(!b.lastVisit)return -1;return b.lastVisit-a.lastVisit;});var missedHTML='';var tableRows=missedCompanies.map(function(mc){return'<tr><td style="padding:12px;border-bottom:1px solid #e4e9f0;font-size:13px;">'+escR(mc.name)+'</td><td style="padding:12px;border-bottom:1px solid #e4e9f0;font-size:13px;">'+escR(mc.tech)+'</td><td style="padding:12px;border-bottom:1px solid #e4e9f0;font-size:13px;text-align:center;">'+(mc.lastVisit?trR(mc.lastVisit):'Hiç ziyaret edilmemiş')+'</td><td style="padding:12px;border-bottom:1px solid #e4e9f0;text-align:center;"><span style="display:inline-block;padding:4px 8px;background:#fce4d6;color:#d96b00;border-radius:4px;font-size:11px;font-weight:bold;">Ziyaret Edilmedi</span></td></tr>';}).join('');
var html='<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>ServisDrama Haftalık Rapor</title><!--[if mso]><style>table,td,p,a,h1{font-family:Arial,Helvetica,sans-serif!important}</style><![endif]--><style>table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse}img{border:0;outline:none;text-decoration:none;display:block}@media only screen and (max-width:600px){.shell{width:100%!important}.pad{padding-left:18px!important;padding-right:18px!important}.brand-logo{width:148px!important;height:54px!important}.hero-title{font-size:28px!important;line-height:34px!important}.metric{font-size:12px!important}}</style></head><body style="margin:0;padding:0;background-color:#f3f6fa;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Haftalık Teknik Servis Raporu - '+trR(d.start)+' / '+trR(d.end)+'</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f6fa"><tr><td align="center" style="padding:24px 10px;"><table role="presentation" class="shell" width="680" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:680px;max-width:680px;background-color:#ffffff;border:1px solid #dbe3ec;"><tr><td class="pad" style="padding:18px 30px;"><table role="presentation" width="100%"><tr><td class="brand-cell" width="185" valign="middle"><img src="cid:drama-makine-logo" width="158" height="58" alt="Drama Makine" style="display:block;width:158px;height:58px;object-fit:contain;"></td><td valign="middle" align="right"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr><td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:15px;letter-spacing:1.3px;font-weight:bold;color:#13233f;border:1px solid #13233f;padding:10px 13px;white-space:nowrap;">HAFTALIK RAPOR</td></tr></table></td></tr></table></td></tr><tr><td class="pad" bgcolor="#102b50" style="padding:34px 30px;background-color:#102b50;"><table role="presentation" width="100%"><tr><td valign="middle"><div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;letter-spacing:2px;font-weight:bold;color:#42a1ff;">SERVİSDRAMA</div><h1 class="hero-title" style="margin:8px 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:34px;line-height:40px;color:#ffffff;">Haftalık Ziyaret Raporu</h1><div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#d8e5f3;">Sahadaki teknik ekip faaliyetlerinin özeti.</div></td><td valign="middle" align="right"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr><td valign="middle" style="padding-right:14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;font-weight:bold;color:#ffffff;white-space:nowrap;">'+trR(d.start)+' - '+trR(d.end)+'</td></tr></table></td></tr></table></td></tr><tr><td class="pad" style="padding:26px 30px 12px;"><table role="presentation" width="100%" style="border:1px solid #dbe3ec;"><tr><td width="25%" align="center" style="padding:20px 8px;border-right:1px solid #dbe3ec;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:24px;line-height:28px;font-weight:bold;color:#1565d8;">'+d.total+'</div><div class="metric" style="font-size:14px;line-height:20px;font-weight:bold;color:#13233f;">Teknik Ziyaret</div></td><td width="25%" align="center" style="padding:20px 8px;border-right:1px solid #dbe3ec;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:24px;line-height:28px;font-weight:bold;color:#078578;">'+d.unique+'</div><div class="metric" style="font-size:14px;line-height:20px;font-weight:bold;color:#13233f;">Ziyaret Firma</div></td><td width="25%" align="center" style="padding:20px 8px;border-right:1px solid #dbe3ec;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:24px;line-height:28px;font-weight:bold;color:#16a34a;">'+d.uygun+'</div><div class="metric" style="font-size:14px;line-height:20px;font-weight:bold;color:#13233f;">Plana Uygun</div></td><td width="25%" align="center" style="padding:20px 8px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:24px;line-height:28px;font-weight:bold;color:#d97706;">'+d.disi+'</div><div class="metric" style="font-size:14px;line-height:20px;font-weight:bold;color:#13233f;">Plan Dışı</div></td></tr></table></td></tr><tr><td class="pad" style="padding:14px 30px 12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="200" valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:24px;font-weight:bold;color:#13233f;white-space:nowrap;">Ziyaret Edilmeyen Firmalar</td><td valign="middle" style="padding-left:12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" bgcolor="#cbd5e1" style="height:1px;background-color:#cbd5e1;font-size:1px;line-height:1px;">&nbsp;</td></tr></table></td></tr></table></td></tr><tr><td class="pad" style="padding:0 30px 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dbe3ec;"><thead><tr style="background:#0c3c78;color:#fff;"><th style="padding:10px;text-align:left;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;border-right:1px solid rgba(255,255,255,.2);">Firma</th><th style="padding:10px;text-align:left;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;border-right:1px solid rgba(255,255,255,.2);">Teknisyen</th><th style="padding:10px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;border-right:1px solid rgba(255,255,255,.2);">Son Ziyaret</th><th style="padding:10px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;">Durum</th></tr></thead><tbody>'+tableRows+'</tbody></table></td></tr>'+missedHTML+'<tr><td class="pad" align="center" style="padding:22px 30px;border-top:1px solid #dbe3ec;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#7a8799;"><strong style="color:#1565d8;">ServisDrama</strong> • Haftalık Rapor • Powered by BKAYACI<br><span style="color:#98a4b4;">Bu e-posta gizlidir ve yalnızca ilgili kişilerle paylaşılmalıdır.</span></td></tr></table></td></tr></table></body></html>';
      var res=await fetch('/api/send-test-mail',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:mc.to,cc:mc.cc,subject:'Teknik Servis Haftalık Raporu | '+trR(d.start)+' - '+trR(d.end),html:html,smtpHost:cfg.smtpHost,smtpPort:cfg.smtpPort,smtpUser:cfg.smtpUser,smtpPass:cfg.smtpPass,from:'ServisDrama <'+(cfg.smtpSenderEmail||cfg.smtpUser||'kimyaservis@dramamakine.com')+'>',attachmentNames:['drama-makine-logo'],attachments:[{filename:filename,contentBase64:b64R(buf),contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}]})});var out=await res.json();if(!res.ok)throw new Error(out.details||out.error||'Mail gönderilemedi');UI.toast('Haftalık rapor Excel ekiyle gönderildi.','success');
    }catch(e){console.error(e);UI.toast(e.message||'Mail gönderilemedi.','error');}}
})();
