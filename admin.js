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
  return perms[userId]===true;
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

  SD.remoteReady();
  SD.seed();
  var cfg=SD.config;cfg.mailAlicilar=loadMailRecipients();SD.config=cfg;

  /* Teknisyen girişinde ziyaret kapsamını kendi firmalarına sabitle; başka bir
     teknisyenden kalan seçim taşınmasın. ALL bilinçli bir tercih, korunur. */
  var sessTech=SD.sessionTech();
  if(sessTech&&SD.activeTechId!==SD.ALL_TECH&&SD.activeTechId!==sessTech.id)SD.activeTechId=sessTech.id;

  /* Haftalık Rapor teknisyenlere kapalı — sadece admin görür/kullanır. */
  var haftalikBtn=document.getElementById('haftalikRaporBtn');
  if(haftalikBtn)haftalikBtn.style.display=sessTech?'none':'';

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
  on('fFilterSalesRep','change',renderFirma);
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
  on('gzSaveBtn','click',saveGecmisZiyaret);
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

  /* Program dışı firma autocomplete — kayıtlı firmalara EK olarak, daha önce
     manuel girilmiş (kayıtsız) program dışı firma adları da önerilir; aynı
     yere tekrar gidildiğinde teknisyen adı yazmaya başlayınca eski kaydı
     görüp seçebilsin diye. */
  initAutocomplete('extraFirmaInp','extraFirmaAC',function(co){
    A.extraFirmaId=co.id;A.extraFirmaAdi=co.name;
    var sel=document.getElementById('extraFirmaSelected');if(sel)sel.textContent=co.name;
  },function(manuelAdi){
    A.extraFirmaId='';A.extraFirmaAdi=manuelAdi;
    var sel=document.getElementById('extraFirmaSelected');if(sel)sel.textContent=manuelAdi+' (yeni)';
  },function(){
    var list=SD.companies.slice(),seen={};
    list.forEach(function(c){seen[c.name.toLocaleUpperCase('tr')]=true;});
    (SD.extras||[]).forEach(function(ex){
      if(ex.firmaId)return;
      var key=String(ex.firmAdi||'').toLocaleUpperCase('tr');
      if(!key||seen[key])return;
      seen[key]=true;
      list.push({id:'',name:ex.firmAdi});
    });
    return list;
  });
  setupUppercaseInput('extraFirmaInp');

  /* Numune */
  on('stEkleBtn','click',function(){if(typeof openStModal==='function')openStModal();});
  on('stSearch','input',function(){if(typeof renderSamples==='function')renderSamples();});
  on('stSaveBtn','click',function(){if(typeof saveNumune==='function')saveNumune();});
  on('stResultSaveBtn','click',function(){if(typeof saveResult==='function')saveResult();});

  /* Ekip */
  on('saveTechBtn','click',saveTech);
  on('saveSalesBtn','click',saveSales);
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

  /* İstatistikler alt-sekmeleri (Genel + admin-only Saha Planı/Performans/
     Denetim). Event delegation kullanılır: admin-only sekmeler ops-v2.js
     tarafından sayfa yüklendikten SONRA dinamik olarak eklenir, statik
     querySelectorAll bağlaması onları yakalayamaz. */
  var istatTabs=document.getElementById('istatTabs');
  if(istatTabs)istatTabs.addEventListener('click',function(e){
    var b=e.target.closest('[data-istat-tab]');if(!b)return;
    switchIstatTab(b.dataset.istatTab);
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

  /* Arka planda bekleyen sekme/PWA öne geldiğinde ve her 15 saniyede bir
     ortak veriyi sunucudan tazele — kullanıcı elle "yenile" yapmasa da
     ekrandaki veri güncel kalsın. */
  function adminEditingInProgress(){
    var modal=document.querySelector('.overlay:not(.hidden)');
    var ae=document.activeElement,tag=ae&&ae.tagName;
    return !!modal || tag==='INPUT' || tag==='TEXTAREA' || tag==='SELECT' || (ae&&ae.isContentEditable);
  }
  function autoRefreshData(){
    if(SD.syncBusy()||adminEditingInProgress())return;
    SD.remoteReady().then(function(){
      if(adminEditingInProgress())return;
      SD.seed();
      var p=A.page||lastPage;
      goto(p);
      /* goto() yalnızca istatistik/numune/ayarlar/raporlar sekmelerini render
         eder (bkz. goto tanımı). ziyaret ve firmalar için hiç render çağrısı
         yoktu — arka planda taze veri gelse de ekran donmuş kalıyordu, kullanıcı
         sekme değiştirmeden yeni veriyi göremiyordu. Yalnızca bu otomatik
         yenileme akışında ekleniyor; normal sekme tıklamasının davranışı
         (goto'nun kendisi) değişmiyor. */
      if(p==='ziyaret')renderVisit();
      if(p==='firmalar')renderFirma();
    });
  }
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='visible')autoRefreshData();
  });
  setInterval(function(){if(!SD.syncBusy())autoRefreshData();},15000);
});

/* ═══ LOGOUT ═══ */
async function doLogout(){
  // Push aboneliği bu cihaz+tarayıcıya bağlıdır: çıkış öncesi kaldırılmazsa,
  // aynı cihazı kullanan bir sonraki kullanıcı öncekinin bildirimlerini almaya
  // devam eder. Ağ yavaşsa çıkışı sonsuza dek bekletmesin diye zaman sınırlı.
  try{ if(typeof pushUnsubscribeOnLogout==='function') await Promise.race([pushUnsubscribeOnLogout(),new Promise(function(r){setTimeout(r,1200);})]); }catch(e){}
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
function toggleUserMenu(event){
  /* stopPropagation: bu tıklama aynı anda document'a da kabarcıklanıp
     "dışarı tıklama kapat" dinleyicisini de tetikliyordu (satır ~246);
     iki mantık aynı anda dd.classList üzerinde çalışınca sıralamaya göre
     panel açılır açılmaz kapanabiliyor ya da tekrar açılmış gibi görünüyordu. */
  if(event)event.stopPropagation();
  var topbar=document.getElementById('topbar');
  if(topbar&&topbar.classList.contains('nav-open')){
    closeMobileMenu();
  }
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
  if(p==='istatistik')switchIstatTab(A.istatTab||'genel');
  if(p==='numune')renderNumune();
  if(p==='ayarlar'){renderSettingsTab(A.settingsTab||'mail');}
  if(p==='raporlar'&&typeof renderDetailedReports==='function')renderDetailedReports();
  if(p==='numune'&&typeof renderSamples==='function')renderSamples();
  var monthNav=document.getElementById('visitMonthNav');if(monthNav)monthNav.style.display=p==='ziyaret'?'':'none';
}
/* İstatistikler sayfası içindeki alt-sekmeyi değiştirir (Genel / admin-only
   Saha Planı / Performans / Denetim). Panel id'leri "istatPanel"+Baş harfi
   büyük sekme adı şeklindedir (istatPanelGenel, istatPanelSaha, ...). */
function switchIstatTab(tab){
  /* Hedef panel yoksa (ör. teknisyende admin sekmeleri hiç eklenmez) Genel'e düş. */
  if(!document.getElementById('istatPanel'+String(tab||'').charAt(0).toUpperCase()+String(tab||'').slice(1))&&tab!=='genel')tab='genel';
  /* Seçili alt sekme hatırlanır: 15 saniyelik otomatik yenileme goto()'yu tekrar
     çağırdığı için sabit 'genel' yazılıysa kullanıcı Erken Uyarı/Performans
     ekranındayken sürekli Genel'e atılıyordu. */
  A.istatTab=tab;
  document.querySelectorAll('#istatTabs [data-istat-tab]').forEach(function(x){x.classList.toggle('active',x.dataset.istatTab===tab);});
  document.querySelectorAll('.istat-tab-panel').forEach(function(p){p.classList.add('hidden');});
  var panel=document.getElementById('istatPanel'+tab.charAt(0).toUpperCase()+tab.slice(1));
  if(panel)panel.classList.remove('hidden');
  var monthNav=document.getElementById('istatMonthNavWrap');
  if(monthNav)monthNav.style.display=tab==='genel'?'':'none';
  if(tab==='genel')renderStat();
  if(typeof window.onIstatTabShow==='function')window.onIstatTabShow(tab);
}
/* Ayarlar sayfası içinde belirli bir alt-sekmeye atlar (ör. dropdown'daki
   "Profilim" kısayolu) — .stab tıklamasıyla AYNI şeyi yapar: aktif buton
   sınıfını günceller, o sekmenin içeriğini render eder. */
/* Ayarlar sayfasının tamamı admin'e özel; ama her kullanıcı kendi profiline ve
   şifre değiştirmeye erişebilmeli. Bu kısayol doğrudan Profilim sekmesini açar.
   A.settingsTab önce yazılır: enhancements.js'teki erişim kontrolü buna bakıp
   teknisyene yalnızca bu sekme için izin veriyor. */
function openMyProfile(){
  A.settingsTab='profil';
  goto('ayarlar');
  openSettingsSubTab('profil');
}
function openSettingsSubTab(tab){
  /* Eski sekme adlari (genel, modul, izinler...) yeni sekmeye cevrilir ki
     kayitli kisayollar ve eski linkler calismaya devam etsin. */
  tab=normalizeSettingsTab(tab);
  document.querySelectorAll('.stab').forEach(function(x){x.classList.toggle('active',x.dataset.stab===tab);});
  renderSettingsTab(tab);
}

function updateRaporButtonState(){
  // Rapor gönder butonu hep açık kalır
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
  var selSalesRep=document.getElementById('fFilterSalesRep');if(selSalesRep&&selSalesRep.options.length===1){
    var sts=SD.load('sd_st',[]);
    sts.forEach(function(s){
      var o=document.createElement('option');o.value=s.id;o.textContent=s.name;selSalesRep.appendChild(o);
    });
  }
}
function renderFirma(){
  var admOnly=isSuperAdmin();
  ['indirBtn','yukleBtn'].forEach(function(bid){var b=document.getElementById(bid);if(b)b.classList.toggle('hidden',!admOnly);});
  renderFirmaFilterOptions();
  var cos=SD.companies,ts=SD.technicians,tm={},sts=SD.load('sd_st',[]),sm={};
  ts.forEach(function(t){tm[t.id]=t;});
  sts.forEach(function(s){sm[s.id]=s;});
  var q=A.fsearch.toLocaleLowerCase('tr');
  var fTechEl=document.getElementById('fFilterTech'),fFreqEl=document.getElementById('fFilterFreq'),fTruckEl=document.getElementById('fFilterTruck'),fStatusEl=document.getElementById('fFilterStatus'),fSalesRepEl=document.getElementById('fFilterSalesRep');
  var fTech=fTechEl?fTechEl.value:'',fSalesRep=fSalesRepEl?fSalesRepEl.value:'',fFreq=fFreqEl?fFreqEl.value:'',fTruck=fTruckEl?fTruckEl.checked:false,fStatus=fStatusEl?fStatusEl.value:'';
  var filtered=cos.filter(function(c){
    if(q&&c.name.toLocaleLowerCase('tr').indexOf(q)<0)return false;
    if(fTech&&c.techId!==fTech)return false;
    if(fSalesRep&&c.salesRepId!==fSalesRep)return false;
    if(fFreq&&_freqBucket(c)!==fFreq)return false;
    if(fTruck&&!(c.lat&&c.lng))return false;
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
    var card=document.createElement('div');card.className='co-card'+(isPasif?' co-card-pasif':'');card.dataset.companyId=co.id;
    var icon='<div class="co-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg></div>';
    var badges=(isPasif?'<span class="co-pasif-badge">PASİF</span> ':'')+(co.lat?'🚚 📍 ':'')+' '+(co.kurulumStart?'🔧':'');
    var kurulum=co.kurulumStart?'<div class="co-kurulum"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>Kurulum: '+co.kurulumStart+' → '+co.kurulumEnd+'</div>':'';
    var s=sm[co.salesRepId];
    var body='<div class="co-body"><div style="display:flex;align-items:center;gap:7px;"><div class="co-name">'+co.name+'</div><span style="font-size:13px;">'+badges+'</span></div>'
      +'<div class="co-meta">'+(t?t.code+' · ':'')+((co.weeks||[1,2,3,4]).length)+'x/ay ('+weeks+')'+(s?' · 👤 '+s.name:'')+'</div>'+kurulum+'</div>';
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
  var sts=SD.load('sd_st',[]),selSalesRep=document.getElementById('fSalesRep');
  if(selSalesRep){
    selSalesRep.innerHTML='<option value="">Atanmamış</option>'+sts.map(function(s){return'<option value="'+s.id+'">'+s.name+' ('+s.username+')</option>';}).join('');
  }
  var lbl=document.getElementById('coordsLbl');if(lbl)lbl.textContent='';
  document.getElementById('firmaModalTitle').textContent=id?'Firmayı Düzenle':'Firma Ekle';
  if(id){
    var co=SD.companies.find(function(c){return c.id===id;});if(!co)return;
    document.getElementById('fAdi').value=co.name||'';
    document.getElementById('fBolge').value=co.bolge||'';
    sel.value=co.techId||(ts[0]&&ts[0].id);
    if(selSalesRep)selSalesRep.value=co.salesRepId||'';
    document.getElementById('fEmail').value=co.email||'';
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
    document.getElementById('fPasif').checked=false;if(selSalesRep)selSalesRep.value='';A.selWeeks=[1,2,3,4];
  }
  var pasifChk=document.getElementById('fPasif');
  if(pasifChk){pasifChk.disabled=!isSuperAdmin();var pasifRow=pasifChk.closest('.fbox');if(pasifRow)pasifRow.style.display=isSuperAdmin()?'':'none';}
  /* Geçmişe dönük ziyaret ekleme yalnızca zaten var olan bir firmada anlamlı
     (yeni firma henüz kaydedilmediği için id yok). */
  var gzBox=document.getElementById('gecmisZiyaretBox');
  if(gzBox){
    gzBox.style.display=id?'':'none';
    if(id){
      var gzSel=document.getElementById('gzTeknisyen');
      if(gzSel)gzSel.innerHTML=ts.map(function(t){return'<option value="'+t.id+'">'+t.code+' — '+t.name+'</option>';}).join('');
      var gzT=document.getElementById('gzTarih'),today=new Date();
      if(gzT)gzT.value=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
      var gzS=document.getElementById('gzSaat');if(gzS)gzS.value='';
      updateGecmisZiyaretInfo(id);
    }
  }
  renderWeekToggles();renderAMails();UI.openModal('firmaModal');
}
function updateGecmisZiyaretInfo(companyId){
  var info=document.getElementById('gzLastInfo');if(!info)return;
  var last=SD.getPreviousCompletedVisit(companyId,new Date());
  info.textContent=last&&last.date&&last.date!=='Kayıt yok'?('Son kayıtlı ziyaret: '+last.date+(last.tc?' · '+last.tc:'')):'Bu firma için henüz kayıtlı ziyaret yok.';
}
function saveGecmisZiyaret(){
  if(!A.editId){UI.toast('Önce firmayı kaydedin.','error');return;}
  var techSel=document.getElementById('gzTeknisyen'),tarihInp=document.getElementById('gzTarih'),saatInp=document.getElementById('gzSaat');
  var tech=SD.technicians.find(function(t){return t.id===(techSel&&techSel.value);});
  if(!tech){UI.toast('Teknisyen seçin.','error');return;}
  if(!tarihInp||!tarihInp.value){UI.toast('Tarih seçin.','error');return;}
  var tp=tarihInp.value.split('-');
  var visitDate=new Date(parseInt(tp[0],10),parseInt(tp[1],10)-1,parseInt(tp[2],10));
  if(visitDate>new Date()){UI.toast('Gelecek bir tarih girilemez.','error');return;}
  var timeStr=(saatInp&&saatInp.value)||'12:00';
  var cwk=DT.wkey(visitDate),dateShort=DT.ddmm(visitDate),dateFull=DT.ddmmyyyy(visitDate);
  var vi=SD.visits;
  /* startTime/endTime KASITLI olarak set edilmez: hücre bunlar doluysa
     "12:00–12:00" gibi bir saat ARALIĞI gösterir (teknisyenin normal
     başlat/bitir akışına özgü). Admin'in geçmişe dönük girişi tek bir an
     (tarih+saat) olduğundan, normal "tıklayıp tamamlanan" bir ziyaretle
     AYNI görünüme sahip olsun diye yalnızca date+saat set edilir. */
  vi[A.editId+'_'+cwk]=SD.putVisitEntry(vi[A.editId+'_'+cwk],tech.code,{date:dateShort,count:1,status:'done',saat:timeStr,dates:[dateShort],startDate:dateFull,endDate:dateFull,manualEntry:true});
  SD.visits=vi;
  renderVisit();
  updateGecmisZiyaretInfo(A.editId);
  UI.toast('Geçmiş ziyaret kaydedildi: '+dateFull+' — '+tech.code,'success');
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
  var salesRepEl=document.getElementById('fSalesRep'),salesRepId=salesRepEl?salesRepEl.value:null;
  var payload={name:name,bolge:document.getElementById('fBolge').value.trim(),techId:document.getElementById('fTech').value,email:document.getElementById('fEmail').value.trim(),aktif:aktifVal,konumNot:document.getElementById('fKonumNot').value.trim(),kurulumStart:document.getElementById('fKurulumStart').value,kurulumStartTime:document.getElementById('fKurulumStartTime').value,kurulumEnd:document.getElementById('fKurulumEnd').value,kurulumEndTime:document.getElementById('fKurulumEndTime').value,aMails:A.aMails.slice(),lat:A.mapLat,lng:A.mapLng,weeks:A.selWeeks.length?A.selWeeks.slice():[1,2,3,4],salesRepId:salesRepId||null};
  var cos=SD.companies;
  if(A.editId){cos=cos.map(function(c){return c.id===A.editId?Object.assign({},c,payload):c;});}
  else{cos.push(Object.assign({id:'c'+Date.now()},payload));}
  SD.companies=cos;SD.save('sd_co',SD.companies);UI.closeModal('firmaModal');renderFirma();renderVisit();renderSetupBanner();UI.toast('Firma kaydedildi.','success');
}
function exportFirmalar(){if(!isSuperAdmin()){UI.toast('Bu işlem için yetkiniz yok.','error');return;}var d=JSON.stringify({firmalar:SD.companies,teknisyenler:SD.technicians},null,2);var a=document.createElement('a');a.href='data:application/json;charset=utf-8,'+encodeURIComponent(d);a.download='firmalar.json';a.click();UI.toast('İndirildi.','success');}
function importFirmalar(e){if(!isSuperAdmin()){UI.toast('Bu işlem için yetkiniz yok.','error');e.target.value='';return;}var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(ev){try{var d=JSON.parse(ev.target.result);if(d.firmalar){SD.companies=d.firmalar;SD.save('sd_co',SD.companies);}renderFirma();renderVisit();UI.toast('Yüklendi!','success');}catch(err){UI.toast('Dosya okunamadı.','error');}};r.readAsText(f);e.target.value='';}

/* ═══ AUTOCOMPLETE YARDIMCISI ═══
   onNoMatch (opsiyonel) verilirse, eşleşme yokken "listede yok, ekle" seçeneği
   gösterir — extraFirmaInp bunu kullanır, diğer çağıranlar (varsa) etkilenmez. */
function initAutocomplete(inputId,listId,onSelect,onNoMatch,sourceFn){
  var inp=document.getElementById(inputId),lst=document.getElementById(listId);
  if(!inp||!lst)return;
  inp.addEventListener('input',function(){
    var q=inp.value.toLocaleLowerCase('tr');lst.innerHTML='';
    if(!q){lst.style.display='none';return;}
    var source=sourceFn?sourceFn():SD.companies;
    var m=source.filter(function(c){return c.name.toLocaleLowerCase('tr').indexOf(q)>=0;}).slice(0,8);
    if(!m.length&&onNoMatch){
      lst.style.display='block';
      var item=document.createElement('div');item.className='ac-item';item.style.fontStyle='italic';item.style.color='var(--text3)';
      item.textContent='↵ "'+inp.value+'" olarak ekle (listede yok)';
      item.addEventListener('click',function(){lst.style.display='none';onNoMatch(inp.value);});
      lst.appendChild(item);return;
    }
    lst.style.display=m.length?'block':'none';
    m.forEach(function(c){var item=document.createElement('div');item.className='ac-item';item.textContent=c.name;item.addEventListener('click',function(){inp.value=c.name;lst.style.display='none';onSelect(c);});lst.appendChild(item);});
  });
  document.addEventListener('click',function(e){if(!inp.contains(e.target)&&!lst.contains(e.target))lst.style.display='none';});
}

/* ═══ HARİTA ═══
   leaflet.css+js (~162 KB) admin.html açılışında DEĞİL, "Haritadan Seç" ilk
   tıklandığında yüklenir — sayfa ziyaretlerinin çoğunda hiç açılmıyordu.
   __leafletLoading aynı promise'i döndürerek tekrar tıklamada script'i iki kez
   eklemeyi önler; başarısızlıkta sıfırlanır ki tekrar denenebilsin. CSS
   yüklenemezse (örn. reklam engelleyici) harita yine de çalışsın diye CSS
   hatası sessizce yutulur — asıl işlevi engelleyen JS'tir. */
var __leafletLoading=null;
function loadCssOnce(href){
  return new Promise(function(res){
    var l=document.createElement('link');l.rel='stylesheet';l.href=href;
    l.onload=function(){res();};l.onerror=function(){res();};
    document.head.appendChild(l);
  });
}
function loadScriptOnce(src){
  return new Promise(function(res,rej){
    var s=document.createElement('script');s.src=src;
    s.onload=function(){res();};s.onerror=function(){rej(new Error('Harita motoru yüklenemedi'));};
    document.head.appendChild(s);
  });
}
function ensureLeaflet(){
  if(typeof L!=='undefined')return Promise.resolve();
  if(__leafletLoading)return __leafletLoading;
  __leafletLoading=Promise.all([
    loadCssOnce('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'),
    loadScriptOnce('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js')
  ]).catch(function(e){__leafletLoading=null;throw e;});
  return __leafletLoading;
}
function openMapModal(){
  UI.closeModal('firmaModal');
  var si=document.getElementById('mapSearchInp');if(si)si.value='';
  var sr=document.getElementById('mapSearchResults');if(sr){sr.innerHTML='';sr.style.display='none';}
  setTimeout(function(){UI.openModal('mapModal');setTimeout(async function(){
    var c=document.getElementById('mapPickerContainer');if(!c)return;
    if(A._mapPicker){try{A._mapPicker.remove();}catch(e){}A._mapPicker=null;}
    if(typeof L==='undefined'){
      c.innerHTML='<div style="padding:16px;font-size:13px;">Harita yükleniyor...</div>';
      try{await ensureLeaflet();}catch(e){c.innerHTML='<div style="padding:16px;font-size:13px;">İnternet bağlantısı gerekli.</div>';return;}
    }
    if(typeof L==='undefined'){c.innerHTML='<div style="padding:16px;font-size:13px;">İnternet bağlantısı gerekli.</div>';return;}
    c.innerHTML='';
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
  var tarihInp=document.getElementById('extraTarih');
  if(tarihInp)tarihInp.value=nowExtra.getFullYear()+'-'+String(nowExtra.getMonth()+1).padStart(2,'0')+'-'+String(nowExtra.getDate()).padStart(2,'0');
  var saatInp=document.getElementById('extraSaat');
  if(saatInp)saatInp.value=DT.hhii(nowExtra);
  var ac=document.getElementById('extraFirmaAC');if(ac)ac.innerHTML='';
  /* Düzenleme modundan iptal edilip "Ekle" ile yeniden açılırsa eski kayıt
     üzerine yazılmasın diye düzenleme işaretçisi burada da sıfırlanır. */
  var editIdInput=document.getElementById('_editExtraIdx');if(editIdInput)editIdInput.value='';
  /* Firma autocomplete + manuel giriş: initAutocomplete('extraFirmaInp',...)
     ile sayfa açılışında BİR KEZ kuruldu (bkz. yukarıda ~215. satır civarı).
     Burada tekrar addEventListener yapmıyoruz — eskiden her modal açılışında
     input'a yeni bir 'input' dinleyicisi ekleniyordu (eskisi hiç silinmeden),
     modal N kez açılınca her tuş vuruşu N kez işleniyordu. */
  UI.openModal('extraVisitModal');
}
/* Kayıtlı olmayan (manuel) program dışı firma adına, sonunda zaten bir şirket
   türü ibaresi yoksa otomatik "LTD. ŞTİ." eklenir. */
function ensureCompanySuffix(name){
  var n=String(name||'').trim();
  if(!n)return n;
  var upper=n.toLocaleUpperCase('tr');
  if(upper.indexOf('LTD')>=0||upper.indexOf('ŞTİ')>=0||upper.indexOf('STI')>=0||upper.indexOf('A.Ş')>=0||upper.indexOf('AŞ.')>=0)return n;
  return n+' LTD. ŞTİ.';
}
function saveExtraVisit(){
  var fInp=document.getElementById('extraFirmaInp');
  if(!A.extraFirmaAdi&&fInp&&fInp.value.trim())A.extraFirmaAdi=fInp.value.trim();
  var manuelAdi=(document.getElementById('extraManuelAdi')||{}).value||'';
  var firmAdi=(A.extraFirmaAdi||manuelAdi).toUpperCase();
  if(!firmAdi){UI.toast('Firma adı veya seçimi gerekli.','error');return;}
  if(!A.extraFirmaId)firmAdi=ensureCompanySuffix(firmAdi);
  var not=(document.getElementById('extraNot')||{}).value||'';
  var tarihInp=document.getElementById('extraTarih'),saatInp=document.getElementById('extraSaat');
  var n=new Date();
  var extraCo=A.extraFirmaId?SD.companies.find(function(c){return c.id===A.extraFirmaId;}):null;
  var ac=SD.actingTech(extraCo)||(SD.technicians||[])[0]||null;

  /* Girilen tarih için hafta hesapla, yoksa bugünün haftası */
  var visitDate=n;
  if(tarihInp&&tarihInp.value){
    var tp=tarihInp.value.split('-');
    if(tp.length===3)visitDate=new Date(parseInt(tp[0],10),parseInt(tp[1],10)-1,parseInt(tp[2],10));
  }
  var timeStr=(saatInp&&saatInp.value)||DT.hhii(n);
  var cwk=DT.wkey(visitDate);
  var dateShort=DT.ddmm(visitDate);

  /* Program dışı ziyaret KASITLI OLARAK SD.visits'e (normal ziyaret ızgarası)
     yazılmaz — bu bir program dışı ziyarettir, planlı ziyaret sayılmamalı.
     Eskiden kayıtlı firma seçilince hem SD.visits hem SD.extras'a yazılıyordu,
     bu da "Ziyaret Takibi" ekranında aynı ziyaretin hem normal hem program
     dışı olarak iki kez görünmesine yol açıyordu. */
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
  var modal=document.getElementById('raporModal');
  var iframe=document.getElementById('raporIframe');

  // Responsive modal boyutları ayarla
  if(modal){
    var modalEl=modal.querySelector('.modal');
    if(A.isMobile()){
      if(modalEl){
        modalEl.style.maxWidth='calc(100vw - 8px)';
        modalEl.style.width='100%';
      }
      if(iframe)iframe.style.height='70vh';
    }else if(A.isTablet()){
      if(modalEl)modalEl.style.maxWidth='calc(100vw - 64px)';
      if(iframe)iframe.style.height='65vh';
    }else{
      if(modalEl)modalEl.style.maxWidth='600px';
      if(iframe)iframe.style.height='65vh';
    }
  }

  if(iframe){iframe.removeAttribute('src');iframe.srcdoc=buildOutlookRaporHTMLPreview();}
  updateMailRaporButtonState();
  UI.openModal('raporModal');
}
function updateMailRaporButtonState(){
  var btn=document.getElementById('mailRaporBtn');
  if(!btn)return;
  var canSend=canSendReport();
  btn.disabled=!canSend;
  btn.style.opacity=canSend?'1':'0.5';
  btn.style.cursor=canSend?'pointer':'not-allowed';
  btn.title=canSend?'Mail Gönder':'Rapor gönderme izni yok';
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
  /* Listeler RAPOR_TO_LIST/RAPOR_CC_LIST'ten okunur — haftalık rapor da aynı
     listeyi kullandığı için adresler tek yerde tutulur. Davranış değişmedi:
     günlük rapor her zaman tüm alıcılara gider. */
  var to=uniqMails(RAPOR_TO_LIST.slice());
  var cc=uniqMails(RAPOR_CC_LIST.slice());
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
function openHtmlRapor(){var html=buildOutlookRaporHTMLPreview();var w=window.open();w.document.write(html);w.document.close();}

/* ═══ HAFTALIK RAPOR ═══
   Aynı veri/şablon kodu hem "Rapor Gönder" modalında hem Raporlar sayfasında
   kullanılır — ikisi de aynı düzeni göstersin diye start/end id'leri parametrik. */
function haftalikRaporRange(startId,endId){
  var sEl=document.getElementById(startId||'haftalikRaporStart'),eEl=document.getElementById(endId||'haftalikRaporEnd');
  var today=new Date(),monday=DT.monday(today),friday=new Date(monday);friday.setDate(friday.getDate()+4);
  var toIso=function(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
  if(sEl&&!sEl.value)sEl.value=toIso(monday);
  if(eEl&&!eEl.value)eEl.value=toIso(friday);
  var start=sEl&&sEl.value?new Date(sEl.value+'T00:00:00'):monday;
  var end=eEl&&eEl.value?new Date(eEl.value+'T00:00:00'):friday;
  return {start:start,end:end};
}
function haftalikRaporData(start,end){
  if(!start||!end){var r=haftalikRaporRange();start=r.start;end=r.end;}
  return collectWeeklyDataWithTrend(start,end,{SD:SD,DT:DT,BL:BL});
}
function haftalikRaporPreviewHTML(start,end){
  var d=haftalikRaporData(start,end);
  return buildWeeklyReportMailHTML(d,weeklyReportGrade)
    .replace(/cid:drama-makine-logo/g,'assets/email/technical-service/drama-makine-logo.png')
    .replace(/cid:stat-visits/g,'assets/email/servisdrama/stat-icons/stat-visits.png')
    .replace(/cid:stat-companies/g,'assets/email/servisdrama/stat-icons/stat-companies.png')
    .replace(/cid:stat-check/g,'assets/email/servisdrama/stat-icons/stat-check.png')
    .replace(/cid:stat-alert/g,'assets/email/servisdrama/stat-icons/stat-alert.png')
    .replace(/cid:stat-calendar/g,'assets/email/servisdrama/stat-icons/stat-calendar.png')
    .replace(/cid:stat-score/g,'assets/email/servisdrama/stat-icons/stat-score.png')
    .replace(/cid:stat-target/g,'assets/email/servisdrama/stat-icons/stat-target.png');
}
function refreshHaftalikRaporPreview(){
  var iframe=document.getElementById('haftalikRaporIframe');
  if(iframe){iframe.removeAttribute('src');iframe.srcdoc=haftalikRaporPreviewHTML();}
  var btn=document.getElementById('mailHaftalikRaporBtn');
  if(btn){
    var canSend=canSendReport();
    btn.disabled=!canSend;
    btn.style.opacity=canSend?'1':'0.5';
    btn.style.cursor=canSend?'pointer':'not-allowed';
    btn.title=canSend?'Mail Gönder':'Rapor gönderme izni yok';
  }
}
function openHaftalikRapor(){
  if(SD.sessionTech()){UI.toast('Bu işlem için yetkiniz yok.','error');return;}
  var modal=document.getElementById('haftalikRaporModal');
  if(modal){
    var modalEl=modal.querySelector('.modal');
    if(A.isMobile()){
      if(modalEl){modalEl.style.maxWidth='calc(100vw - 8px)';modalEl.style.width='100%';}
    }else if(A.isTablet()){
      if(modalEl)modalEl.style.maxWidth='calc(100vw - 64px)';
    }else{
      if(modalEl)modalEl.style.maxWidth='760px';
    }
  }
  haftalikRaporRange();
  refreshHaftalikRaporPreview();
  syncWeeklyMailAllToggles();
  UI.openModal('haftalikRaporModal');
}
function haftalikRaporPdfFilename(r){
  var iso=function(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
  return 'Teknik_Servis_Haftalik_Rapor_'+iso(r.start)+'_'+iso(r.end)+'.pdf';
}
async function downloadHaftalikRaporPdf(startId,endId){
  try{
    var r=haftalikRaporRange(startId,endId);
    var d=haftalikRaporData(r.start,r.end);
    if(!d.total){UI.toast('Seçilen tarih aralığında tamamlanmış ziyaret yok.','warning');return;}
    UI.toast('PDF raporu hazırlanıyor...','info');
    await window.downloadWeeklyReportPdf(d,haftalikRaporPdfFilename(r));
    UI.toast('PDF raporu indirildi.','success');
  }catch(e){
    console.error(e);
    UI.toast(e.message||'PDF oluşturulamadı.','error');
  }
}
/* skipPdf=true → PDF eki üretilmez, sadece HTML gövde gönderilir. */
async function sendHaftalikRapor(startId,endId,skipPdf){
  if(!canSendReport()){
    UI.toast('Bu işlem için yetkiniz yok. Rapor gönderme izni sadece barkin.kayaci yönetim panelinden verilebilir.','error');
    return;
  }
  var cfg=SD.config;
  var mc=weeklyMailToCc();
  var to=mc.to,cc=mc.cc;
  var r=haftalikRaporRange(startId,endId);
  var fmt=function(dt){return String(dt.getDate()).padStart(2,'0')+'.'+String(dt.getMonth()+1).padStart(2,'0')+'.'+dt.getFullYear();};
  var subject='ServisDrama - Haftalık Servis Raporu ('+fmt(r.start)+' - '+fmt(r.end)+')';
  var d=haftalikRaporData(r.start,r.end);
  /* ÖNEMLİ: gerçek mailde ham (cid: referanslı) HTML kullanılmalı — haftalikRaporPreviewHTML()
     sadece admin panelindeki iframe önizlemesi için cid: yerine yerel dosya yoluna çevirir;
     o yollar alıcının mail istemcisinde çözümlenemez ve tüm görseller kırık gelir. */
  var html=buildWeeklyReportMailHTML(d,weeklyReportGrade);
  var attachmentNames=['drama-makine-logo','stat-visits','stat-companies','stat-check','stat-alert','stat-calendar','stat-score','stat-target'];

  var attachments=[];
  if(!skipPdf){
    UI.toast('PDF eki hazırlanıyor...','info');
    var pdfBase64=null;
    try{pdfBase64=await window.weeklyReportPdfBase64(d);}catch(e){console.error(e);UI.toast('PDF eki oluşturulamadı, mail PDF olmadan gönderiliyor: '+(e.message||''),'warning');}
    if(pdfBase64)attachments.push({filename:haftalikRaporPdfFilename(r),contentBase64:pdfBase64,contentType:'application/pdf'});
  }else{
    UI.toast('Mail gönderiliyor (PDF eki olmadan)...','info');
  }

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
      attachmentNames:attachmentNames,
      attachments:attachments
    })
  })
  .then(function(r){return r.json();})
  .then(function(d){
    if(d.success){
      UI.closeModal('haftalikRaporModal');
      UI.toast('✓ Haftalık rapor başarıyla gönderildi ('+to.join(', ')+(cc.length?' | CC: '+cc.join(', '):'')+')','success');
    }else{
      UI.toast('Mail gönderme hatası: '+d.error,'error');
    }
  })
  .catch(function(e){
    UI.toast('Server bağlantı hatası: '+e.message,'error');
  });
}

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

  /* Teknisyen girişinde istatistikler yalnızca kendi firmalarına özgü olsun;
     admin girişinde (sessTech=null) tüm teknisyenler değişmeden görünür. */
  var sessTech=SD.sessionTech();
  var scopedCos=sessTech?cos.filter(function(c){return c.techId===sessTech.id;}):cos;
  var scopedTs=sessTech?[sessTech]:ts;

  var titleEl=document.querySelector('#pg-istatistik .pg-title');
  if(titleEl)titleEl.textContent=sessTech?'İstatistiklerim':'İstatistikler';
  var ml=document.getElementById('statMonth');if(ml)ml.textContent=DT.MONTHS[A.sm]+' '+A.sy;
  var rl=document.getElementById('istatSub');if(rl)rl.textContent=DT.MONTHS[A.sm]+' '+A.sy+' · '+DT.isoWeek(today)+'. Hafta'+(sessTech?' · '+sessTech.name+' ('+sessTech.code+')':'');
  var totS=0,totD=0;
  weeks.forEach(function(wm,i){var wk=DT.wkey(wm);scopedCos.forEach(function(co){if(BL.scheduled(co,i+1)){totS++;if(vis[co.id+'_'+wk]&&vis[co.id+'_'+wk].status==='done')totD++;}});});
  var pct=totS?Math.round(totD/totS*100):0;
  var numuneler=typeof stLoad==='function'?stLoad():[];
  if(sessTech){
    var myCoIds=scopedCos.map(function(c){return c.id;});
    numuneler=numuneler.filter(function(s){return myCoIds.indexOf(s.firmaId)!==-1;});
  }
  var thisWD=0;scopedCos.forEach(function(co){if(BL.scheduled(co,cwi)&&vis[co.id+'_'+cwk]&&vis[co.id+'_'+cwk].status==='done')thisWD++;});
  var kr=document.getElementById('kpiRow');if(!kr)return;kr.innerHTML='';
  var firmaKpi=sessTech
    ?{icon:'🏭',lbl:'Firmalarım',val:scopedCos.length,sub:'atanmış firma',bg:'#FFFBEB',c:'#D97706'}
    :{icon:'🏭',lbl:'Toplam Firma',val:cos.length,sub:ts.length+' teknisyen',bg:'#FFFBEB',c:'#D97706'};
  [{icon:'📅',lbl:'Bu Hafta',val:thisWD,sub:'tamamlanan',bg:'#EFF6FF',c:'#2563EB'},{icon:'📈',lbl:'Aylık %',val:pct+'%',sub:totD+'/'+totS,bg:'#DCFCE7',c:'#16A34A'},{icon:'🧪',lbl:'Bekleyen Numune',val:numuneler.filter(function(s){return!s.result;}).length,sub:'analiz bekliyor',bg:'#F5F3FF',c:'#7C3AED'},firmaKpi].forEach(function(k){
    var c=document.createElement('div');c.className='kpi-card';
    c.innerHTML='<div class="kpi-icon" style="background:'+k.bg+';">'+k.icon+'</div><div class="kpi-val" style="color:'+k.c+';">'+k.val+'</div><div class="kpi-lbl">'+k.lbl+'</div><div class="kpi-sub">'+k.sub+'</div>';
    kr.appendChild(c);
  });
  var tg=document.getElementById('techStatGrid');if(!tg)return;tg.innerHTML='';
  tg.style.gridTemplateColumns=sessTech?'1fr':'';
  scopedTs.forEach(function(t){
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
          /* 31.07.2026 milat tarihini yoksay */
          if(d&&d.getDate()===31&&d.getMonth()===6&&d.getFullYear()===2026)return;
          if(d&&d<todayNorm&&(!lastVisitObj||d>lastVisitObj)){
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
      }else{
        lastVisitDate='Kayıt yok';
      }
      return {name:c.name,lastVisit:lastVisitDate,lastVisitObj:lastVisitObj,daysAgo:daysAgo};
    }).sort(function(a,b){
      if(!a.lastVisitObj&&!b.lastVisitObj)return 0;
      if(!a.lastVisitObj)return 1;
      if(!b.lastVisitObj)return -1;
      return b.lastVisitObj-a.lastVisitObj;
    });

    var isMob=sessTech?false:window.matchMedia('(max-width: 768px)').matches;
    var card=document.createElement('div');
    card.className='tech-stat-card';
    card.style.cssText='background:#fff;border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);';
    var header='<button type="button" class="tech-stat-header" aria-expanded="'+(!isMob)+'" style="width:100%;border:0;background:linear-gradient(135deg,#1A2952,#2563EB);padding:16px 18px;color:#fff;cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none;text-align:left;"><span style="font-weight:800;font-size:15px;">'+t.name+' ('+t.code+'): '+allTechCos.length+' firma</span><span class="tech-stat-arrow" style="font-size:18px;transition:transform .2s;display:inline-flex;">▼</span></button>';
    var body='<div class="tech-stat-body" style="padding:12px 0;display:'+(isMob?'none':'block')+';">';
    firmalar.forEach(function(f){
      var visitText=f.lastVisit&&f.lastVisit!=='Kayıt yok'?'Son ziyaret: '+f.lastVisit+(f.daysAgo||''):f.lastVisit||'Kayıt yok';
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
    var row=document.createElement('div');row.className='user-card';
    var color=BL.avatarColor(t.name);
    var initials=BL.getInitials(t.name);
    var av=document.createElement('div');av.className='user-av';av.style.cssText='background:'+color+';';av.textContent=initials;
    var info=document.createElement('div');info.className='user-info';
    var leaveText=(t.leaveStart||t.leaveEnd)?(' · 🌴 İzin: '+(t.leaveStart||'—')+' ~ '+(t.leaveEnd||'—')):'';
    info.innerHTML='<div class="user-name">'+salesEsc(t.name)+' <span class="user-role-badge role-tech" style="background:var(--blue-l);color:var(--blue);margin-left:6px;">'+salesEsc(t.code)+'</span><span class="user-role-badge role-tech" style="margin-left:4px;">Teknisyen</span></div>'
      +'<div class="user-meta"><span>📞 '+(salesEsc(t.phone)||'Telefon yok')+'</span><span>✉️ '+(salesEsc(t.email)||'E-posta yok')+'</span><span>'+leaveText+'</span></div>';

    var fields=document.createElement('div');fields.className='tech-fields';fields.style.cssText='display:flex;flex-direction:column;gap:5px;min-width:220px;';
    ['name','phone','email'].forEach(function(f){
      var inp=document.createElement('input');
      inp.className='inp inp-sm';
      inp.style.cssText='padding:5px 8px;font-size:12px;';
      inp.value=t[f]||'';inp.placeholder={name:'Ad Soyad',phone:'Telefon',email:'E-posta'}[f];
      inp.addEventListener('change',function(){var arr=SD.technicians,tech=arr.find(function(x){return x.id===t.id;});if(tech)tech[f]=inp.value.trim();SD.technicians=arr;UI.toast('Güncellendi.','success');});
      fields.appendChild(inp);
    });
    var leaveWrap=document.createElement('div');
    leaveWrap.style.cssText='display:flex;align-items:center;gap:6px;';
    var leaveLbl=document.createElement('span');leaveLbl.textContent='🌴 İzin:';leaveLbl.style.cssText='font-size:11.5px;font-weight:700;color:var(--text3);white-space:nowrap;';
    leaveWrap.appendChild(leaveLbl);
    ['leaveStart','leaveEnd'].forEach(function(f){
      var inp=document.createElement('input');inp.type='date';inp.className='inp inp-sm';
      inp.style.cssText='padding:3px 6px;font-size:11px;flex:1;min-width:0;';
      inp.value=t[f]||'';inp.title=f==='leaveStart'?'İzin başlangıcı':'İzin bitişi';
      inp.addEventListener('change',function(){
        var arr=SD.technicians,tech=arr.find(function(x){return x.id===t.id;});
        if(tech)tech[f]=inp.value;
        SD.technicians=arr;
        renderTechAdmin();
        UI.toast(inp.value?'İzin tarihi kaydedildi.':'İzin tarihi kaldırıldı.','success');
      });
      leaveWrap.appendChild(inp);
    });
    fields.appendChild(leaveWrap);

    var db=document.createElement('button');db.className='btn-icon red';db.title='Sil';
    db.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" stroke-linecap="round"/></svg>';
    (function(tid){db.addEventListener('click',function(){if(SD.technicians.length<=1){UI.toast('En az 1 teknisyen gerekli.','warning');return;}UI.confirm('Teknisyeni sil?',function(){var arr=SD.technicians.filter(function(x){return x.id!==tid;});SD.technicians=arr;if(SD.activeTechId===tid)SD.activeTechId=arr[0].id;renderTechAdmin();});});})(t.id);

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

/* ═══ SATIŞÇI YÖNETİMİ ═══
   sd_st = satışçı kayıtları. Satışçının panele girebilmesi için buradaki
   username, sunucudaki users tablosundaki hesapla aynı olmalıdır — oturum
   eşlemesi (sessionSalesRep / routes/state.js) bu alan üzerinden yapılır. */
function salesEsc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
function salesApiHeaders(){return {'Content-Type':'application/json','Authorization':'Bearer '+(localStorage.getItem('token')||sessionStorage.getItem('token')||'')};}
/* Düzenleme SATIR İÇİNDE yapılır — eskiden arka arkaya açılan prompt() kutuları
   vardı; hem kaç adım kaldığı görünmüyor hem de yanlış yazılan bir alan
   düzeltilemeden zincir ilerliyordu. Ayrıca satışçı KODU o akışta hiç
   düzenlenemiyordu (s.code olduğu gibi geri gönderiliyordu), yani yanlış atanan
   bir kod panelden düzeltilemiyordu.
   salesEditId: o an düzenlenen satır (aynı anda tek satır açılır).
   salesCache: sunucudan gelen son liste — Vazgeç'te yeniden istek atmamak için. */
var salesEditId=null,salesCache=[];
function salesCompanyCount(s){
  return (SD.companies||[]).filter(function(c){
    return String(c.salesRepId||'')===String(s.id)||String(c.salesRepUserId||'')===String(s.userId||'');
  }).length;
}
async function renderSalesAdmin(){
  var list=document.getElementById('salesAdminList');if(!list)return;
  list.innerHTML='<div style="padding:14px;color:var(--text3)">Satışçılar yükleniyor…</div>';
  try{
    var r=await fetch('/api/sales',{headers:salesApiHeaders(),cache:'no-store'}),j=await r.json();if(!r.ok)throw new Error(j.error||'Satışçılar alınamadı');
    salesCache=j.sales||[];try{localStorage.setItem('sd_st',JSON.stringify(salesCache));}catch(_){}
    paintSalesAdmin();
    renderFirmaFilterOptions();
  }catch(e){list.innerHTML='<div style="padding:14px;color:var(--danger)">'+salesEsc(e.message)+'</div>';}
}
/* Yeniden çizim sunucuya gitmez — düzenleme aç/kapa anında olur. */
function paintSalesAdmin(){
  var list=document.getElementById('salesAdminList');if(!list)return;
  if(!salesCache.length){list.innerHTML='<div style="padding:18px;color:var(--text3)">Henüz satışçı yok.</div>';return;}
  list.innerHTML=salesCache.map(function(s){
    return String(s.id)===String(salesEditId)?salesEditRowHtml(s):salesViewRowHtml(s);
  }).join('');
  var f=document.getElementById('salesEditCode');if(f){f.focus();f.select();}
}
function salesViewRowHtml(s){
  var pasif=s.status==='inactive',id=salesEsc(s.id);
  var color=BL.avatarColor(s.name||s.username||'?');
  var initials=BL.getInitials(s.name||s.username||'?');
  var count=salesCompanyCount(s);
  return '<div class="user-card" style="'+(pasif?'opacity:.65;':'')+'">'
    +'<div class="user-av" style="background:'+color+';">'+initials+'</div>'
    +'<div class="user-info">'
      +'<div class="user-name">'+salesEsc(s.name)+' <span class="user-role-badge role-tech" style="background:var(--amber-l);color:var(--amber-d);margin-left:6px;">'+salesEsc(s.code||'KOD YOK')+'</span>'
      +(pasif?' <span class="user-role-badge" style="background:var(--red-l);color:var(--red);margin-left:4px;">Pasif</span>':' <span class="user-role-badge role-tech" style="background:var(--green-l);color:var(--green);margin-left:4px;">Satış Temsilcisi</span>')+'</div>'
      +'<div class="user-meta">'
        +'<span>@'+salesEsc(s.username)+'</span>'
        +(s.phone?'<span>📞 '+salesEsc(s.phone)+'</span>':'')
        +(s.email?'<span>✉️ '+salesEsc(s.email)+'</span>':'')
        +'<span>💼 '+count+' firma</span>'
      +'</div>'
    +'</div>'
    +'<div class="user-acts">'
      +'<button class="btn-icon" title="Düzenle" onclick="openSalesEdit(\''+id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
      +(pasif
        ?'<button class="btn-icon" title="Aktif Yap" onclick="reactivateSales(\''+id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></button>'
        :'<button class="btn-icon red" title="Pasif Yap" onclick="deactivateSales(\''+id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></button>')
    +'</div>'
    +'</div>';
}
function salesEditRowHtml(s){
  var id=salesEsc(s.id);
  var fld=function(lbl,inputId,val,type,ph){
    return '<div style="flex:1;min-width:150px"><label class="form-lbl" style="font-size:11px">'+lbl+'</label>'
      +'<input class="inp inp-sm" id="'+inputId+'" type="'+(type||'text')+'" value="'+salesEsc(val||'')+'"'
      +(ph?' placeholder="'+salesEsc(ph)+'"':'')+'></div>';
  };
  return '<div class="settings-row" style="flex-direction:column;align-items:stretch;gap:10px;background:var(--surface2);">'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap">'
    +fld('Satışçı Kodu','salesEditCode',s.code,'text','örn. S01')
    +fld('Ad Soyad','salesEditName',s.name)
    +fld('Giriş Kullanıcı Adı','salesEditUsername',s.username)
    +'</div>'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap">'
    +fld('E-posta','salesEditEmail',s.email,'email')
    +fld('Telefon','salesEditPhone',s.phone)
    +fld('Yeni Şifre','salesEditPassword','','password','boş bırakılırsa değişmez')
    +'</div>'
    +'<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
    +'<span style="flex:1;min-width:180px;font-size:11.5px;color:var(--text3)">'
    +salesCompanyCount(s)+' firma bu satışçıya bağlı. Kod değişse de firma atamaları korunur.</span>'
    +'<button class="btn btn-ghost btn-sm" onclick="cancelSalesEdit()">Vazgeç</button>'
    +'<button class="btn btn-primary btn-sm" id="salesEditSaveBtn" onclick="saveSalesEdit(\''+id+'\')">Kaydet</button>'
    +'</div></div>';
}
function openSalesEdit(id){salesEditId=id;paintSalesAdmin();}
function cancelSalesEdit(){salesEditId=null;paintSalesAdmin();}
async function saveSales(){
  var payload={code:(document.getElementById('newSalesCode')||{}).value.trim(),name:(document.getElementById('newSalesName')||{}).value.trim(),phone:(document.getElementById('newSalesPhone')||{}).value.trim(),email:(document.getElementById('newSalesEmail')||{}).value.trim(),username:(document.getElementById('newSalesUsername')||{}).value.trim(),password:(document.getElementById('newSalesPassword')||{}).value};
  if(!payload.code||!payload.name||!payload.username||!payload.password){UI.toast('Kod, ad, kullanıcı adı ve şifre zorunlu.','warning');return;}
  try{var r=await fetch('/api/sales',{method:'POST',headers:salesApiHeaders(),body:JSON.stringify(payload)}),j=await r.json();if(!r.ok)throw new Error(j.error||j.details||'Satışçı oluşturulamadı');['newSalesCode','newSalesName','newSalesPhone','newSalesEmail','newSalesUsername','newSalesPassword'].forEach(function(i){var e=document.getElementById(i);if(e)e.value='';});UI.closeModal('addSalesModal');await SD.remoteReady({force:true});await renderSalesAdmin();UI.toast('Satışçı hesabı ve giriş şifresi oluşturuldu.','success');}catch(e){UI.toast(e.message,'error');}
}
/* Tek PUT ile hem profil (sd_st) hem giriş hesabı (users) güncellenir. */
async function putSales(id,body,okMsg){
  var btn=document.getElementById('salesEditSaveBtn');
  if(btn){btn.disabled=true;btn.textContent='Kaydediliyor…';}
  try{
    var r=await fetch('/api/sales/'+encodeURIComponent(id),{method:'PUT',headers:salesApiHeaders(),body:JSON.stringify(body)});
    var j=await r.json();
    if(!r.ok)throw new Error(j.error||j.details||'Satışçı güncellenemedi');
    salesEditId=null;
    await SD.remoteReady({force:true});
    await renderSalesAdmin();
    UI.toast(okMsg,'success');
  }catch(e){
    UI.toast(e.message,'error');
    if(btn){btn.disabled=false;btn.textContent='Kaydet';}
  }
}
async function saveSalesEdit(id){
  var s=salesCache.find(function(x){return String(x.id)===String(id);});if(!s)return;
  var g=function(i){var e=document.getElementById(i);return e?e.value.trim():'';};
  var code=g('salesEditCode'),name=g('salesEditName'),username=g('salesEditUsername').toLowerCase();
  var passEl=document.getElementById('salesEditPassword'),password=passEl?passEl.value:'';
  if(!code||!name||!username){UI.toast('Kod, ad ve kullanıcı adı zorunlu.','warning');return;}
  if(password&&password.length<6){UI.toast('Şifre en az 6 karakter olmalı.','warning');return;}
  /* Kod firma atamasında kullanılmaz (bağ salesRepId üzerinden kurulur) ama
     raporlarda "Satış Temsilcisi" sütununda GÖSTERİLEN değer budur — iki
     satışçı aynı kodu taşırsa rapor satırları ayırt edilemez. Sunucu da aynı
     kontrolü yapar; buradaki kopya sadece anında geri bildirim için. */
  if(salesCache.some(function(x){return String(x.id)!==String(id)&&String(x.code||'').toLowerCase()===code.toLowerCase();})){
    UI.toast('Bu kod başka bir satışçıda kullanılıyor.','warning');return;
  }
  await putSales(id,{code:code,name:name,username:username,email:g('salesEditEmail'),phone:g('salesEditPhone'),
    password:password,status:s.status||'active'},'Satışçı güncellendi.');
}
/* Pasif yapılan satışçıyı geri açar — eskiden panelde bunun yolu yoktu,
   yanlışlıkla pasife alınan hesap kalıcı olarak kapalı kalıyordu. */
async function reactivateSales(id){
  var s=salesCache.find(function(x){return String(x.id)===String(id);});if(!s)return;
  await putSales(id,{code:s.code,name:s.name,username:s.username,email:s.email,phone:s.phone,
    password:'',status:'active'},'Satışçı yeniden aktif edildi.');
}
async function deactivateSales(id){if(!confirm('Satışçı hesabı pasif yapılacak. Firma atamaları korunacak. Devam edilsin mi?'))return;try{var r=await fetch('/api/sales/'+encodeURIComponent(id),{method:'DELETE',headers:salesApiHeaders()}),j=await r.json();if(!r.ok)throw new Error(j.error||j.details);await SD.remoteReady({force:true});await renderSalesAdmin();UI.toast('Satışçı pasif yapıldı.','success');}catch(e){UI.toast(e.message,'error');}}
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

/* ═══ AYARLAR ═══
   Sekmeler 10'dan 5'e indirildi: aynı konuyu paylaşan bölümler tek sekmede
   kart kart toplandı (Mail = eski Genel + Mail + Mail Alıcıları, Ekip = eski
   Teknisyen Yetkileri + Satışçılar + Kullanıcılar, Yetkiler = eski Modüller +
   Teknisyen Ekran Yetkileri + Raporlama İzinleri). Hiçbir ayar anahtarı
   değişmedi; eski sekme adları alias ile yeni sekmeye yönlendirilir. */
var SETTINGS_TAB_ALIAS={genel:'mail',mailAlicilar:'mail',modul:'yetkiler',teknik:'yetkiler',izinler:'yetkiler',satisci:'ekip',kullanici:'ekip'};
function normalizeSettingsTab(tab){return SETTINGS_TAB_ALIAS[tab]||tab||'mail';}

function renderSettingsTab(tab){
  tab=normalizeSettingsTab(tab);
  A.settingsTab=tab;   /* otomatik yenilemede aynı sekmede kalınsın */
  var cfg=SD.config,content=document.getElementById('settingsContent');if(!content)return;
  content.innerHTML='';
  var esc=salesEsc;
  /* Teknisyen/satışçı yalnızca Profilim sekmesini görür; diğer sekme düğmeleri
     gizlenir ki erişemeyeceği bir yere tıklamasın. */
  var tamYetki=isSuperAdmin();
  document.querySelectorAll('#settingsTabs .stab[data-stab]').forEach(function(b){
    b.style.display=(tamYetki||b.dataset.stab==='profil')?'':'none';
  });
  if(!tamYetki)tab='profil';
  if(tab==='mail'){
    /* Gönderici kimliği artık TEK yerde. Eskiden "Genel"deki senderName ve
       "Mail"deki senderEmail alanları hiçbir yerde OKUNMUYORDU — mail her zaman
       smtpSenderName/smtpSenderEmail ile gönderiliyordu. İki ayrı "Gönderici
       Adı" alanı hangisinin geçerli olduğunu belirsizleştiriyordu. Eski alanda
       değer varsa buraya taşınıp gösterilir; kaydedilince canlı ayara yazılır. */
    var sName=cfg.smtpSenderName||cfg.senderName||'';
    var sEmail=cfg.smtpSenderEmail||cfg.senderEmail||'';
    content.innerHTML='<div class="settings-card">'
      +'<div class="settings-ttl">✉️ Gönderici ve Konu</div>'
      +'<p style="font-size:13px;color:var(--text3);margin-bottom:14px;">Giden tüm raporlarda görünen gönderici bilgisi ve mail konu öneki.</p>'
      +'<div class="settings-row"><label class="form-lbl">Gönderici Adı</label><input class="inp" id="cfg-smtpSenderName" value="'+esc(sName)+'" placeholder="Drama Makine Teknik Servis"></div>'
      +'<div class="settings-row"><label class="form-lbl">Gönderici E-posta</label><input class="inp" type="email" id="cfg-smtpSenderEmail" value="'+esc(sEmail)+'" placeholder="servis@dramamakine.com"></div>'
      +'<div class="settings-row"><label class="form-lbl">Rapor Mail Konusu Öneki</label><input class="inp" id="cfg-subjectPrefix" value="'+esc(cfg.subjectPrefix||'')+'" placeholder="ServisDrama | Günlük Rapor"></div>'
      +'<div class="settings-acts"><button class="btn btn-outline btn-sm" onclick="buildAndPreview()">HTML Rapor Önizle</button><button class="btn btn-primary btn-sm" onclick="saveGonderici()">Kaydet</button></div>'
      +'</div>'
      +'<div id="previewFrame" style="margin-top:16px;border:1px solid var(--border);border-radius:var(--r-xl);overflow:hidden;"></div>'
      +'<div class="settings-card">'
      +'<div class="settings-ttl">📧 SMTP Sunucu</div>'
      +'<p style="font-size:13px;color:var(--text3);margin-bottom:14px;">Mailler bu sunucu üzerinden gönderilir.</p>'
      +'<div class="settings-row"><label class="form-lbl">Giden Sunucu (SMTP)</label><input class="inp" id="cfg-smtpHost" value="'+esc(cfg.smtpHost||'')+'" placeholder="mail.dramagroup.com.tr"></div>'
      +'<div class="settings-row"><label class="form-lbl">SMTP Port</label><input class="inp" type="number" id="cfg-smtpPort" value="'+esc(cfg.smtpPort||587)+'" placeholder="587"></div>'
      +'<div class="settings-row"><label class="form-lbl">Kullanıcı Adı</label><input class="inp" id="cfg-smtpUser" value="'+esc(cfg.smtpUser||'')+'" placeholder="kimyaservis@dramagroup.com"></div>'
      +'<div class="settings-row"><label class="form-lbl">Parola</label><input class="inp" type="password" id="cfg-smtpPass" value="'+esc(cfg.smtpPass||'')+'" placeholder="••••••••"></div>'
      +'<div class="settings-row"><label class="form-lbl">Sertifika</label><select class="inp" id="cfg-smtpTls"><option value="tls"'+(cfg.smtpTls==="starttls"?"":' selected')+'>TLS</option><option value="starttls"'+(cfg.smtpTls==="starttls"?" selected":'')+'>STARTTLS</option></select></div>'
      +'<div class="settings-acts"><button class="btn btn-outline btn-sm" onclick="testSmtpMail()">📨 Test Maili Gönder</button><button class="btn btn-primary btn-sm" onclick="saveSmtpCfg()">Kaydet</button></div>'
      +'</div>'
      +'<div class="settings-card">'
      +'<div class="settings-ttl">👥 Mail Alıcıları</div>'
      +'<p style="font-size:13px;color:var(--text3);margin-bottom:14px;">Rapor gönderildiğinde bu adresler alıcı olarak eklenir.</p>'
      +'<div style="display:flex;gap:10px;margin-bottom:10px;"><input class="inp" id="mailAliciInp" type="email" placeholder="ornek@dramamakine.com" style="flex:1;"><button onclick="addMailAlici()" style="width:42px;height:40px;background:var(--blue);color:#fff;border:none;border-radius:var(--r-lg);font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:700;">+</button></div>'
      +'<div id="mailAliciList"></div>'
      +'<div class="feat-row" style="margin-top:14px;">'
      +'<div><div class="feat-nm">Tüm alıcılara gönder</div><div class="feat-desc">Kapalıyken yalnızca barkin.kayaci@dramamakine.com adresine gönderilir.</div></div>'
      +'<label class="toggle"><input type="checkbox" id="manuelHariciToggle"'+(loadMailRecipientsMode()?' checked':'')+' onchange="saveMailRecipientsMode(this.checked);"><span class="toggle-tr"></span></label>'
      +'</div>'
      +'</div>';
    var mcfg=SD.config;mcfg.mailAlicilar=loadMailRecipients();SD.config=mcfg;
    renderMailAlicilar();
  }else if(tab==='ekip'){
    content.innerHTML='<div class="settings-card">'
      +'<div class="settings-ttl" style="display:flex;align-items:center;justify-content:space-between;"><span>🔧 Teknisyenler</span><button class="btn btn-primary btn-sm" onclick="UI.openModal(\'addTechModal\')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Teknisyen Ekle</button></div>'
      +'<p style="font-size:13px;color:var(--text3);margin-bottom:16px;">İletişim bilgileri ve izin tarihleri. İzinli haftalar firma skorundan düşülür.</p>'
      +'<div id="techAdminList"></div></div>'
      +'<div class="settings-card">'
      +'<div class="settings-ttl" style="display:flex;align-items:center;justify-content:space-between;"><span>💼 Satışçılar</span><button class="btn btn-primary btn-sm" onclick="UI.openModal(\'addSalesModal\')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Satışçı Ekle</button></div>'
      +'<p style="font-size:13px;color:var(--text3);margin-bottom:16px;">Firmalara atama, Firmalar sekmesindeki firma formundan yapılır.</p>'
      +'<div id="salesAdminList"></div></div>'
      +'<div id="kullaniciCards"></div>';
    renderTechAdmin();
    renderSalesAdmin();
    renderKullanicilar();
  }else if(tab==='yetkiler'){
    var mf=cfg.moduleFeatures||{},tf=cfg.techFeatures||{},users=SD.users||[];
    content.innerHTML='<div class="settings-card">'
      +'<div class="settings-ttl">🧩 Modüller</div>'
      +'<p style="font-size:13px;color:var(--text3);margin-bottom:16px;">Hangi özellikler uygulamada aktif olsun?</p>'
      +'<div id="modulFeatRows"></div></div>'
      +'<div class="settings-card">'
      +'<div class="settings-ttl">👤 Teknisyen Ekranı</div>'
      +'<p style="font-size:13px;color:var(--text3);margin-bottom:16px;">Teknisyen girişinde hangi bölümler görünsün?</p>'
      +'<div id="techFeatRows"></div></div>'
      +'<div class="settings-card">'
      +'<div class="settings-ttl">🔐 Rapor Gönderme İzni</div>'
      +'<p style="font-size:13px;color:var(--text3);margin-bottom:16px;">Hangi kullanıcılar rapor gönderebilsin? (barkin.kayaci her zaman gönderebilir)</p>'
      +'<div id="permissionsGrid"></div></div>'
      +'<div style="display:flex;justify-content:flex-end;"><button class="btn btn-primary" onclick="saveYetkiler()">Tüm Yetkileri Kaydet</button></div>';
    var addFeatRow=function(host,id,nm,desc,checked,disabled){
      if(!host)return;
      var row=document.createElement('div');row.className='feat-row';
      row.innerHTML='<div><div class="feat-nm">'+nm+'</div><div class="feat-desc">'+desc+'</div></div>'
        +'<label class="toggle"><input type="checkbox" id="'+id+'"'+(checked?' checked':'')+(disabled?' disabled style="cursor:not-allowed;"':'')+'><span class="toggle-tr"></span></label>';
      host.appendChild(row);
    };
    var mfr=document.getElementById('modulFeatRows');
    MODULE_FEATS.forEach(function(f){addFeatRow(mfr,'mf-'+f.key,f.nm,f.desc,mf[f.key]!==false,false);});
    var tfr=document.getElementById('techFeatRows');
    TECH_FEATS.forEach(function(f){addFeatRow(tfr,'tf-'+f.key,f.nm,f.desc,tf[f.key]!==false,false);});
    var grid=document.getElementById('permissionsGrid');
    users.forEach(function(u){
      var can=!(cfg.sendReportPermissions&&cfg.sendReportPermissions[u.id]===false);
      addFeatRow(grid,'perm-'+u.id,esc(u.name)+' <span style="font-size:11px;color:var(--text3);">('+esc(u.username||'—')+')</span>',
        u.role==='admin'?'Admin · Her zaman gönderebilir':'Kullanıcı',can,u.role==='admin');
    });
  }else if(tab==='veri'){
    content.innerHTML='<div class="settings-card"><div class="settings-ttl">💾 Veri Yönetimi</div><div style="display:flex;flex-direction:column;gap:10px;"><button class="btn btn-outline btn-sm" onclick="exportAll()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke-linecap="round"/></svg>Tüm Veriyi İndir (JSON)</button><button class="btn btn-outline btn-sm" onclick="document.getElementById(\'importAll\').click()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3m0 0l-4 4m4-4l4 4" stroke-linecap="round"/></svg>Yedekten Geri Yükle</button><input type="file" id="importAll" accept=".json" hidden onchange="importAll(event)"><button class="btn btn-danger btn-sm" onclick="if(confirm(\'Tüm ziyaret geçmişi silinecek!\'))clearVisits()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" stroke-linecap="round"/></svg>Ziyaret Geçmişini Temizle</button></div></div>';
  }else if(tab==='profil'){
    var cu=SD.currentUser||{};
    var rolLbl=cu.role==='admin'?'Yönetici · Admin':(cu.role||'—');
    content.innerHTML='<div class="settings-card">'
      +'<div class="settings-ttl">👤 Profil Bilgileri</div>'
      +'<div class="settings-row"><label class="form-lbl">Ad Soyad</label><input class="inp" value="'+esc(cu.name||'')+'" disabled></div>'
      +'<div class="settings-row"><label class="form-lbl">Kullanıcı Adı</label><input class="inp" value="'+esc(cu.username||'')+'" disabled></div>'
      +'<div class="settings-row"><label class="form-lbl">E-posta</label><input class="inp" value="'+esc(cu.email||'—')+'" disabled></div>'
      +'<div class="settings-row"><label class="form-lbl">Rol</label><input class="inp" value="'+esc(rolLbl)+'" disabled></div>'
      +'</div>'
      +'<div class="settings-card">'
      +'<div class="settings-ttl">🔒 Şifre Değiştir</div>'
      +'<div class="settings-row"><label class="form-lbl">Mevcut Şifre</label><input class="inp" type="password" id="pfCurrentPw" autocomplete="current-password"></div>'
      +'<div class="settings-row"><label class="form-lbl">Yeni Şifre</label><input class="inp" type="password" id="pfNewPw" minlength="6" autocomplete="new-password"></div>'
      +'<div class="settings-row"><label class="form-lbl">Yeni Şifre (Tekrar)</label><input class="inp" type="password" id="pfNewPw2" minlength="6" autocomplete="new-password"></div>'
      +'<div class="settings-acts"><button class="btn btn-primary btn-sm" onclick="changeMyPassword()">Şifreyi Güncelle</button></div>'
      +'</div>';
  }
}
/* Gönderici adı/e-postası + konu öneki. Değerler mailin FİİLEN kullandığı
   smtpSenderName/smtpSenderEmail anahtarlarına yazılır. */
function saveGonderici(){
  var cfg=SD.config;
  cfg.smtpSenderName=(document.getElementById('cfg-smtpSenderName')||{}).value||'';
  cfg.smtpSenderEmail=(document.getElementById('cfg-smtpSenderEmail')||{}).value||'';
  cfg.subjectPrefix=(document.getElementById('cfg-subjectPrefix')||{}).value||'';
  SD.config=cfg;UI.toast('Gönderici ayarları kaydedildi.','success');
}
/* Modül + teknisyen ekranı + rapor izinleri tek düğmeyle kaydedilir; üç ayrı
   sekmede üç ayrı "Kaydet" aramak yerine hepsi aynı yerde. */
function saveYetkiler(){
  var cfg=SD.config;
  if(!cfg.moduleFeatures)cfg.moduleFeatures={};
  if(!cfg.techFeatures)cfg.techFeatures={};
  if(!cfg.sendReportPermissions)cfg.sendReportPermissions={};
  MODULE_FEATS.forEach(function(f){var el=document.getElementById('mf-'+f.key);if(el)cfg.moduleFeatures[f.key]=el.checked;});
  TECH_FEATS.forEach(function(f){var el=document.getElementById('tf-'+f.key);if(el)cfg.techFeatures[f.key]=el.checked;});
  /* Kutu render edilmediyse o kullanıcıya DOKUNULMAZ. Eski savePermissions()
     eksik kutuyu false sayıp izni sessizce kaldırabiliyordu. */
  (SD.users||[]).forEach(function(u){
    if(u.role==='admin')return;
    var chk=document.getElementById('perm-'+u.id);
    if(chk)cfg.sendReportPermissions[u.id]=chk.checked;
  });
  SD.config=cfg;
  updateRaporButtonState();
  UI.toast('Yetkiler kaydedildi.','success');
}

/* /api/auth/change-password zaten sunucuda vardı (sales.js'te kullanılıyordu,
   admin tarafında hiç bağlanmamıştı) — sunucu tarafında değişiklik gerekmedi. */
function changeMyPassword(){
  var cur=document.getElementById('pfCurrentPw'),nw=document.getElementById('pfNewPw'),nw2=document.getElementById('pfNewPw2');
  if(!cur||!nw||!nw2)return;
  if(!cur.value||!nw.value){UI.toast('Mevcut ve yeni şifre gerekli.','error');return;}
  if(nw.value.length<6){UI.toast('Yeni şifre en az 6 karakter olmalı.','error');return;}
  if(nw.value!==nw2.value){UI.toast('Yeni şifreler eşleşmiyor.','error');return;}
  fetch('/api/auth/change-password',{
    method:'PUT',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+(localStorage.getItem('token')||sessionStorage.getItem('token')||'')},
    body:JSON.stringify({currentPassword:cur.value,newPassword:nw.value})
  }).then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});})
    .then(function(res){
      if(!res.ok){UI.toast(res.j.error||'Şifre güncellenemedi.','error');return;}
      UI.toast('Şifreniz güncellendi.','success');
      cur.value='';nw.value='';nw2.value='';
    })
    .catch(function(e){UI.toast('Sunucu hatası: '+e.message,'error');});
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

/* Ekip sekmesindeki #kullaniciCards kabina yazar. Eskiden settingsContent-i
   komple ezerdi; artik ayni sekmedeki Teknisyen/Satisci kartlari korunur.
   Sifre kurulum butonlari da sabit 1015/1016 yerine teknisyen listesinden
   uretilir — yeni teknisyen eklendiginde otomatik gelir. */
function renderKullanicilar(){
  var content=document.getElementById('kullaniciCards');
  if(!content){var host=document.getElementById('settingsContent');if(!host)return;content=host;}
  var users=SD.users;
  var html='<div class="settings-card"><div class="settings-ttl">🔑 Şifre Kurulumu</div>';
  html+='<p style="font-size:13px;color:var(--text3);margin-bottom:12px;">Teknisyenin panele giriş şifresini belirleyin.</p>';
  html+='<div style="display:flex;gap:10px;flex-wrap:wrap;">'
    +(SD.technicians||[]).map(function(t){
      return '<button class="btn btn-outline btn-sm" onclick="setupTechCode(&#39;'+salesEsc(t.code)+'&#39;)">'+salesEsc(t.code)+' · '+salesEsc(t.name||'')+'</button>';
    }).join('')
    +'</div></div>';
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
  var html=buildOutlookRaporHTMLPreview(),frame=document.getElementById('previewFrame');if(!frame)return;
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

  /* select'in kendisi her açılışta yeniden kullanılıyor (yalnızca <option>'lar
     yenileniyor) — addEventListener yerine .onchange=: yeni atama eskisinin
     ÜZERİNE yazar, eskiden olduğu gibi her açılışta bir tane daha eklenip
     birikmez. */
  ysel.onchange=function(){dpTempYear=parseInt(this.value);};
  msel.onchange=function(){dpTempMonth=parseInt(this.value);};

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

/* ═══ RAPORLAR SAYFASI — mail ile birebir aynı haftalık rapor düzeni ═══
   NOT: goto() her 15 saniyelik otomatik senkronizasyonda da çağrılır. İlk
   açılışta iframe'i doldururuz; sonraki otomatik tetiklemelerde SADECE
   sayfa bu an görünürse ve kullanıcı "Yenile"ye basmadıysa dokunmayız —
   yoksa iframe.srcdoc her 15 saniyede sıfırlanıp kullanıcının scroll
   konumunu yukarı fırlatıyordu. */
function renderDetailedReports(){
  var content=document.getElementById('raporlarPageContent');
  if(!content)return;
  if(!document.getElementById('raporlarPageStart')){
    content.innerHTML='<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px;">'
      +'<div><label class="form-lbl" style="font-size:11px;">Başlangıç</label><input type="date" class="inp" id="raporlarPageStart" onchange="refreshDetailedReportsPreview()"></div>'
      +'<div><label class="form-lbl" style="font-size:11px;">Bitiş</label><input type="date" class="inp" id="raporlarPageEnd" onchange="refreshDetailedReportsPreview()"></div>'
      +'<button class="btn btn-outline btn-sm" onclick="refreshDetailedReportsPreview()">Yenile</button>'
      +'<button class="btn btn-outline btn-sm" onclick="downloadHaftalikRaporPdf(\'raporlarPageStart\',\'raporlarPageEnd\')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg> PDF İndir</button>'
      +'<button class="btn btn-outline btn-sm" onclick="sendHaftalikRapor(\'raporlarPageStart\',\'raporlarPageEnd\',true)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M4 6l8 7 8-7"/></svg> Mail Gönder (PDF\'siz)</button>'
      +'<button class="btn btn-primary btn-sm" id="mailDetailedReportsBtn" onclick="sendHaftalikRapor(\'raporlarPageStart\',\'raporlarPageEnd\')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M4 6l8 7 8-7"/></svg> Mail Gönder (PDF ekiyle)</button>'
      +'</div>'
      +'<div style="display:flex;margin-bottom:14px;">'+weeklyMailAllToggleHtml('raporlar')+'</div>'
      +'<div style="border:1px solid var(--border);border-radius:var(--r);overflow:hidden;height:75vh;"><iframe id="raporlarPageIframe" src="" style="width:100%;height:100%;border:none;background:#f3f6fa;"></iframe></div>';
    syncWeeklyMailAllToggles();
    refreshDetailedReportsPreview();
  }
}
function refreshDetailedReportsPreview(){
  var iframe=document.getElementById('raporlarPageIframe');
  if(!iframe)return;
  var r=haftalikRaporRange('raporlarPageStart','raporlarPageEnd');
  iframe.removeAttribute('src');
  iframe.srcdoc=haftalikRaporPreviewHTML(r.start,r.end);
  var btn=document.getElementById('mailDetailedReportsBtn');
  if(btn){
    var canSend=canSendReport();
    btn.disabled=!canSend;
    btn.style.opacity=canSend?'1':'0.5';
    btn.style.cursor=canSend?'pointer':'not-allowed';
    btn.title=canSend?'Mail Gönder':'Rapor gönderme izni yok';
  }
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
var RAPOR_SOLO_TO='barkin.kayaci@dramamakine.com';
function uniqMails(list){return list.filter(function(v,i,a){return v&&a.indexOf(v)===i;});}
function getMailToCc(){
  var mode=loadMailRecipientsMode();
  if(mode){
    /* Manuel Harici seçiliyse: sabit TO/CC listesi */
    return {to:RAPOR_TO_LIST.slice(), cc:RAPOR_CC_LIST.slice()};
  }else{
    /* Seçili değilse: sadece barkin.kayaci@dramamakine.com, CC yok */
    return {to:[RAPOR_SOLO_TO], cc:[]};
  }
}

/* ═══ HAFTALIK RAPOR ALICILARI ═══
   Haftalık rapor artık GÜNLÜK raporla AYNI TO/CC listesini kullanır
   (RAPOR_TO_LIST / RAPOR_CC_LIST) — iki rapor farklı adres kümesine gitmesin.
   Hangi kümeye gideceğini modaldeki "Tüm alıcılara gönder" kutusu belirler.
   Kutu GÜNLÜK maildeki "Manuel Harici" anahtarından AYRI tutulur: haftalık
   raporun alıcısını değiştirmek günlük raporu sessizce etkilememeli.
   Varsayılan KAPALI — mail yanlışlıkla tüm ekibe gitmesin. */
var WEEKLY_MAIL_ALL_KEY='haftalikRaporTumAlicilar';
function loadWeeklyMailAllMode(){return localStorage.getItem(WEEKLY_MAIL_ALL_KEY)==='true';}
function saveWeeklyMailAllMode(enabled){
  localStorage.setItem(WEEKLY_MAIL_ALL_KEY,String(!!enabled));
  syncWeeklyMailAllToggles();
}
function weeklyMailToCc(){
  if(!loadWeeklyMailAllMode())return{to:[RAPOR_SOLO_TO],cc:[]};
  return{to:uniqMails(RAPOR_TO_LIST.slice()),cc:uniqMails(RAPOR_CC_LIST.slice())};
}
/* Aynı kutu hem haftalık rapor modalında hem Raporlar sayfasında duruyor; biri
   değişince diğeri de güncellenmeli, yoksa kullanıcı hangisinin geçerli olduğunu
   bilemez. Yanındaki ipucu satırı mailin GERÇEKTE kime gideceğini yazar. */
function syncWeeklyMailAllToggles(){
  var on=loadWeeklyMailAllMode(),mc=weeklyMailToCc();
  var hint=on?('TO: '+mc.to.join(', ')+'  |  CC: '+mc.cc.join(', ')):('Yalnızca '+RAPOR_SOLO_TO);
  ['haftalikTumAliciToggle','raporlarTumAliciToggle'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.checked=on;
  });
  ['haftalikTumAliciHint','raporlarTumAliciHint'].forEach(function(id){
    var el=document.getElementById(id);if(el){el.textContent=hint;el.title=hint;}
  });
}
/* Kutunun HTML'i modalda ve Raporlar sayfasında birebir aynı olsun diye tek
   yerden üretilir. */
function weeklyMailAllToggleHtml(idPrefix){
  return '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-right:auto;">'
    +'<input type="checkbox" id="'+idPrefix+'TumAliciToggle" style="width:17px;height:17px;cursor:pointer;flex-shrink:0;" onchange="saveWeeklyMailAllMode(this.checked)">'
    +'<span style="display:flex;flex-direction:column;line-height:1.35;min-width:0;">'
    +'<span style="font-size:12.5px;font-weight:600;color:var(--text);">Tüm alıcılara gönder (TO + CC)</span>'
    +'<span id="'+idPrefix+'TumAliciHint" style="font-size:11px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:420px;">Yalnızca '+RAPOR_SOLO_TO+'</span>'
    +'</span></label>';
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

