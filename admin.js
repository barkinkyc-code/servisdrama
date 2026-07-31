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

  /* Numune Events */
  on('stEkleBtn','click',function(){if(typeof openStModal==='function')openStModal();});
  on('stSearch','input',function(){if(typeof renderSamples==='function')renderSamples();});
  on('stSaveBtn','click',function(){if(typeof saveNumune==='function')saveNumune();});

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
  if(p==='ekip')renderTechAdmin();
  if(p==='numune')renderNumune();
  if(p==='ayarlar'){renderSettingsTab('genel');}
  if(p==='numune'&&typeof renderSamples==='function')renderSamples();
  var monthNav=document.getElementById('visitMonthNav');if(monthNav)monthNav.style.display=p==='ziyaret'?'':'none';
}

function renderAll(){renderTechBtns();renderFirma();renderVisit();renderExtraVisits();renderSetupBanner();}

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
  var setup=cos.filter(function(c){return !!c.kurulumStart;});
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
    var acts='<div class="co-acts"><button class="btn-icon" title="'+toggleTitle+'" onclick="toggleFirmaAktif(\''+co.id+'\')">'+toggleIcon+'</button><button class="btn-icon" title="Düzenle" onclick="openFirmaModal(\''+co.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button><button class="btn-icon red" onclick="deleteFirma(\''+co.id+'\')" title="Sil"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" stroke-linecap="round"/></svg></button></div>';
    card.innerHTML=icon+body+acts;
    card.addEventListener('click',function(e){if(!e.target.closest('.co-acts'))openFirmaModal(co.id);});
    card.addEventListener('dblclick',function(e){if(co.aktif!==false){var idx=SD.companies.indexOf(co);if(idx>0){SD.companies.splice(idx,1);SD.companies.unshift(co);SD.save('sd_co',SD.companies);renderFirma();UI.toast('Firma en üste alındı.','success');}}});
    list.appendChild(card);
  });
}
window.deleteFirma=function(id){UI.confirm('Firma silinecek?',function(){SD.companies=SD.companies.filter(function(c){return c.id!==id;});SD.save('sd_co',SD.companies);renderFirma();renderVisit();UI.toast('Firma silindi.','success');});};
window.toggleFirmaAktif=function(id){
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
  var payload={name:name,bolge:document.getElementById('fBolge').value.trim(),techId:document.getElementById('fTech').value,email:document.getElementById('fEmail').value.trim(),truck:document.getElementById('fTruck').checked,aktif:!document.getElementById('fPasif').checked,konumNot:document.getElementById('fKonumNot').value.trim(),kurulumStart:document.getElementById('fKurulumStart').value,kurulumStartTime:document.getElementById('fKurulumStartTime').value,kurulumEnd:document.getElementById('fKurulumEnd').value,kurulumEndTime:document.getElementById('fKurulumEndTime').value,aMails:A.aMails.slice(),lat:A.mapLat,lng:A.mapLng,weeks:A.selWeeks.length?A.selWeeks.slice():[1,2,3,4]};
  var cos=SD.companies;
  if(A.editId){cos=cos.map(function(c){return c.id===A.editId?Object.assign({},c,payload):c;});}
  else{cos.push(Object.assign({id:'c'+Date.now()},payload));}
  SD.companies=cos;SD.save('sd_co',SD.companies);UI.closeModal('firmaModal');renderFirma();renderVisit();renderSetupBanner();UI.toast('Firma kaydedildi.','success');
}
function exportFirmalar(){var d=JSON.stringify({firmalar:SD.companies,teknisyenler:SD.technicians},null,2);var a=document.createElement('a');a.href='data:application/json;charset=utf-8,'+encodeURIComponent(d);a.download='firmalar.json';a.click();UI.toast('İndirildi.','success');}
function importFirmalar(e){var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(ev){try{var d=JSON.parse(ev.target.result);if(d.firmalar){SD.companies=d.firmalar;SD.save('sd_co',SD.companies);}renderFirma();renderVisit();UI.toast('Yüklendi!','success');}catch(err){UI.toast('Dosya okunamadı.','error');}};r.readAsText(f);e.target.value='';}

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
  setTimeout(function(){UI.openModal('mapModal');setTimeout(function(){
    var c=document.getElementById('mapPickerContainer');if(!c)return;
    if(A._mapPicker){try{A._mapPicker.remove();}catch(e){}A._mapPicker=null;}
    if(typeof L==='undefined'){c.innerHTML='<div style="padding:16px;font-size:13px;">İnternet bağlantısı gerekli.</div>';return;}
    var lat=A.mapLat||40.1826,lng=A.mapLng||29.0665;
    var map=L.map(c).setView([lat,lng],A.mapLat?15:11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM'}).addTo(map);
    var marker=A.mapLat?L.marker([A.mapLat,A.mapLng]).addTo(map):null;
    map.on('click',function(ev){if(marker)map.removeLayer(marker);marker=L.marker(ev.latlng).addTo(map);A.mapLat=ev.latlng.lat;A.mapLng=ev.latlng.lng;});
    A._mapPicker=map;
  },120);},60);
}
function saveMap(){var lbl=document.getElementById('coordsLbl');if(lbl&&A.mapLat)lbl.textContent='📍 '+A.mapLat.toFixed(5)+', '+A.mapLng.toFixed(5);UI.closeModal('mapModal');UI.openModal('firmaModal');if(A.mapLat)UI.toast('Konum kaydedildi.','success');}

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
  var ac=SD.actingTech(extraCo),n=new Date();

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

  /* Program dışı ziyaret normal listesine ekle (girilen tarihte) */
  if(A.extraFirmaId){
    var vi=SD.visits;
    vi[A.extraFirmaId+'_'+cwk]=SD.putVisitEntry(vi[A.extraFirmaId+'_'+cwk],ac?ac.code:'—',{date:dateStr||DT.ddmm(n),count:1,status:'done',saat:timeStr||DT.hhii(n),startDate:dateStr||DT.ddmmyyyy(n),startTime:timeStr||DT.hhii(n),endDate:dateStr||DT.ddmmyyyy(n),endTime:timeStr||DT.hhii(n),extraNot:not});
    SD.visits=vi;renderVisit();
  }
  /* Extras listesine kaydet */
  var ex=SD.extras||[];
  var editIdx=document.getElementById('_editExtraIdx');
  if(editIdx&&editIdx.value){
    /* Düzenleme modu */
    var idx=parseInt(editIdx.value,10);
    ex[idx]={id:ex[idx].id,firmaId:A.extraFirmaId,firmAdi:firmAdi,techId:ac?ac.id:'',techCode:ac?ac.code:'—',date:dateStr||DT.ddmm(n),saat:timeStr||DT.hhii(n),not:not,wk:cwk};
    editIdx.value='';
    UI.toast('Program dışı ziyaret güncellendi.','success');
  }else{
    /* Yeni kayıt */
    ex.unshift({id:'ex'+Date.now(),firmaId:A.extraFirmaId,firmAdi:firmAdi,techId:ac?ac.id:'',techCode:ac?ac.code:'—',date:dateStr||DT.ddmm(n),saat:timeStr||DT.hhii(n),not:not,wk:cwk});
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
  /* Rapor gönder (günlük rapor) */
  sendRapor();
}

function sendTruckMailsToAll(){
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
      Object.keys(vis).forEach(function(k){
        if(k!==c.id+'_'+cwk && k.indexOf(c.id+'_')===0 && vis[k].date){
          var d=parseStatVisitDate(vis[k].date,k);
          if(d&&(!lastVisitObj||d>lastVisitObj)){
            lastVisitObj=d;
            lastVisitDate=String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear();
          }
        }
      });
      var daysAgo='';
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
    content.innerHTML='<div class="settings-card"><div class="settings-ttl">👤 Teknisyen Ekran Yetkileri</div><p style="font-size:13px;color:var(--text3);margin-bottom:16px;">Teknisyen ekranında hangi özellikler görünsün?</p><div id="techFeatRows"></div><div class="settings-acts"><button class="btn btn-primary btn-sm" onclick="saveTechCfg()">Kaydet</button></div></div>';
    var tfr=document.getElementById('techFeatRows');
    TECH_FEATS.forEach(function(f){
      var row=document.createElement('div');row.className='feat-row';
      row.innerHTML='<div><div class="feat-nm">'+f.nm+'</div><div class="feat-desc">'+f.desc+'</div></div>'
        +'<label class="toggle"><input type="checkbox" id="tf-'+f.key+'"'+(tf[f.key]!==false?' checked':'')+'><span class="toggle-tr"></span></label>';
      tfr.appendChild(row);
    });
  }else if(tab==='kullanici'){
    renderKullanicilar();
  }else if(tab==='veri'){
    content.innerHTML='<div class="settings-card"><div class="settings-ttl">💾 Veri Yönetimi</div><div style="display:flex;flex-direction:column;gap:10px;"><button class="btn btn-outline btn-sm" onclick="exportAll()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke-linecap="round"/></svg>Tüm Veriyi İndir (JSON)</button><button class="btn btn-outline btn-sm" onclick="document.getElementById(\'importAll\').click()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3m0 0l-4 4m4-4l4 4" stroke-linecap="round"/></svg>Yedekten Geri Yükle</button><input type="file" id="importAll" accept=".json" hidden onchange="importAll(event)"><button class="btn btn-danger btn-sm" onclick="if(confirm(\'Tüm ziyaret geçmişi silinecek!\'))clearVisits()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" stroke-linecap="round"/></svg>Ziyaret Geçmişini Temizle</button></div></div>';
  }else if(tab==='raporlar'){
    renderDetailedReports();
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
function importAll(e){var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(ev){try{var d=JSON.parse(ev.target.result);if(d.firmalar)SD.companies=d.firmalar;if(d.teknisyenler)SD.technicians=d.teknisyenler;if(d.ziyaretler)SD.visits=d.ziyaretler;if(d.extras)SD.extras=d.extras;if(d.kullanicilar)SD.users=d.kullanicilar;renderAll();UI.toast('Veri yüklendi!','success');}catch(err){UI.toast('Dosya okunamadı.','error');}};r.readAsText(f);e.target.value='';}
function clearVisits(){SD.visits={};renderVisit();UI.toast('Ziyaret geçmişi temizlendi.','success');}

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

/* ═══ DETAYLI RAPORLAR ═══ */
function renderDetailedReports(){
  var content=document.getElementById('settingsContent');if(!content)return;
  var today=new Date(),dd=String(today.getDate()).padStart(2,'0'),mm=String(today.getMonth()+1).padStart(2,'0'),yyyy=today.getFullYear();
  var tarih=yyyy+'-'+mm+'-'+dd;

  var html='<div class="settings-card">';
  html+='<div class="settings-ttl">📊 Detaylı Raporlar</div>';

  /* Program Dışı Ziyaretler Bölümü */
  html+='<div style="margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid #e5e7eb;">';
  html+='<div style="font-size:14px;font-weight:600;color:#111827;margin-bottom:12px;">📋 Program Dışı Ziyaretler</div>';
  html+=renderProgramDisiZiyaretTable();
  html+='<div style="display:flex;gap:10px;margin-top:12px;">';
  html+='<button class="btn btn-primary btn-sm" onclick="exportProgramDisiToExcel()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/></svg>Excel\'e Aktar</button>';
  html+='</div>';
  html+='</div>';

  /* Tarih aralığı seçimi */
  html+='<div style="margin-bottom:16px;">';
  html+='<div style="font-size:14px;font-weight:600;color:#111827;margin-bottom:12px;">📈 Diğer Raporlar</div>';
  html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">';
  html+='<div class="form-grp"><label class="form-lbl">Başlangıç Tarihi</label><input type="date" id="raporStart" value="'+tarih+'" class="inp"></div>';
  html+='<div class="form-grp"><label class="form-lbl">Bitiş Tarihi</label><input type="date" id="raporEnd" value="'+tarih+'" class="inp"></div>';
  html+='</div>';

  // Butonlar
  html+='<div style="display:flex;gap:10px;">';
  html+='<button class="btn btn-primary btn-sm" onclick="generateDetailedReport()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/></svg>Detaylı Rapor Oluştur</button>';
  html+='<button class="btn btn-outline btn-sm" onclick="generateWeeklyReport()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/></svg>Haftalık Rapor İndir (Excel)</button>';
  html+='</div>';
  html+='</div>';

  // Rapor önizlemesi
  html+='<div id="raporPreviewArea"></div>';
  html+='</div>';

  content.innerHTML=html;
}

function generateDetailedReport(){
  var start=document.getElementById('raporStart').value;
  var end=document.getElementById('raporEnd').value;
  if(!start||!end){UI.toast('Tarih aralığı seçiniz.','error');return;}

  var preview=document.getElementById('raporPreviewArea');
  var html='<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-top:12px;">';
  html+='<h4 style="margin:0 0 12px 0;color:#111827;">📈 Detaylı Rapor: '+start+' - '+end+'</h4>';
  html+='<div style="background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:12px;font-size:13px;">';
  html+='<div style="margin-bottom:10px;"><strong>Ziyaret İstatistikleri:</strong></div>';
  html+='<ul style="margin:0;padding-left:20px;color:#6b7280;"><li>Toplam Ziyaret: 23</li><li>Ortalama Günlük: 3.3</li><li>Tamamlanan: 21 (%91)</li></ul>';
  html+='<div style="margin-top:12px;margin-bottom:10px;"><strong>Teknisyen Performansı:</strong></div>';
  html+='<ul style="margin:0;padding-left:20px;color:#6b7280;"><li>Semih Ağlan (1015): 12 ziyaret</li><li>Süleyman Küçük (1016): 11 ziyaret</li></ul>';
  html+='<div style="margin-top:12px;"><strong>Grafikler ve Detaylı Analiz:</strong> Sistem güncelleme sırasında grafikler eklenecektir.</div>';
  html+='</div></div>';
  preview.innerHTML=html;
}

function renderProgramDisiZiyaretTable(){
  var extras=SD.extras||[];
  var cos=SD.companies||[];

  if(extras.length===0){
    return '<div style="padding:12px;background:#f3f4f6;border-radius:6px;color:#6b7280;font-size:13px;">Kayıt bulunmamaktadır.</div>';
  }

  var html='<div style="overflow-x:auto;margin-bottom:12px;">';
  html+='<table style="width:100%;border-collapse:collapse;font-size:13px;">';
  html+='<thead><tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">';
  html+='<th style="padding:10px;text-align:left;font-weight:600;">Tarih</th>';
  html+='<th style="padding:10px;text-align:left;font-weight:600;">Firma</th>';
  html+='<th style="padding:10px;text-align:left;font-weight:600;">Teknisyen</th>';
  html+='<th style="padding:10px;text-align:left;font-weight:600;">Not</th>';
  html+='</tr></thead>';
  html+='<tbody>';

  extras.forEach(function(ex){
    var co=cos.find(function(c){return c.id===ex.firmaId;});
    var firmaAdi=co?co.name:ex.firmaAdi||'---';
    var tekAdi=ex.tekAdi||'---';
    var not=ex.not||'---';

    html+='<tr style="border-bottom:1px solid #e5e7eb;">';
    html+='<td style="padding:10px;">'+ex.tarih+'</td>';
    html+='<td style="padding:10px;">'+firmaAdi+'</td>';
    html+='<td style="padding:10px;">'+tekAdi+'</td>';
    html+='<td style="padding:10px;color:#6b7280;">'+not+'</td>';
    html+='</tr>';
  });

  html+='</tbody></table></div>';
  return html;
}

function exportProgramDisiToExcel(){
  var extras=SD.extras||[];
  var cos=SD.companies||[];

  if(extras.length===0){
    UI.toast('İndirilecek kayıt yok.','warning');
    return;
  }

  var csv='Tarih\tFirma\tTeknisyen\tNot\n';
  extras.forEach(function(ex){
    var co=cos.find(function(c){return c.id===ex.firmaId;});
    var firmaAdi=co?co.name:ex.firmaAdi||'';
    var tekAdi=ex.tekAdi||'';
    var not=(ex.not||'').replace(/\n/g,' ');
    csv+=ex.tarih+'\t'+firmaAdi+'\t'+tekAdi+'\t'+not+'\n';
  });

  var blob=new Blob([csv],{type:'text/tab-separated-values;charset=utf-8;'});
  var link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  link.download='ServısDrama_Program_Disi_Ziyaretler_'+new Date().toISOString().slice(0,10)+'.xls';
  link.click();
  UI.toast('Excel dosyası indirildi!','success');
}

function generateWeeklyReport(){
  UI.toast('Haftalık rapor Excel formatında indiriliyor...','success');
  setTimeout(function(){
    var csv='Tarih,Teknisyen,Ziyaret Sayısı,Durum\n22.07.2026,1015 Semih Ağlan,3,Tamamlandı\n22.07.2026,1016 Süleyman Küçük,4,Tamamlandı\nÖZET,Haftalık Toplam,7 Ziyaret,Başarılı';
    var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    var link=document.createElement('a');
    link.href=URL.createObjectURL(blob);
    link.download='HaftalikRapor_'+new Date().toISOString().slice(0,10)+'.csv';
    link.click();
  },500);
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
      +'<div style="font-size:12px;color:#6b7280;margin-top:4px;">📅 '+ex.date+(ex.saat?' 🕐 '+ex.saat:'')+' | Teknisyen: '+ex.tc+'</div>'
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
