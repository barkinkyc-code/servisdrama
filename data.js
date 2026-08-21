/* ================================================================
   ServisDrama — Ortak Veri Katmanı v10
   ================================================================ */
var SD=(function(){
  var store;
  try{localStorage.setItem('__t','1');localStorage.removeItem('__t');store=localStorage;}
  catch(e){var mem={};store={getItem:function(k){return k in mem?mem[k]:null;},setItem:function(k,v){mem[k]=String(v);},removeItem:function(k){delete mem[k];}};}
  /* sd_ac (seçili teknisyen/ALL kapsamı) bilinçli olarak listede DEĞİL: bu bir kullanıcı
     arayüz tercihi, ortak iş verisi değil. Paylaşılırsa bir teknisyenin ALL seçimi
     diğerinin ekranını da değiştirir. */
  var SHARED_KEYS=['sd_co','sd_te','sd_vi','sd_ex','sd_dp','sd_cfg','sd_users','sd_samples','sd_st','sd_notifications','sd_actions','sd_audit','sd_visit_requests'];
  var remoteLoaded=false, syncTimer=null, syncInFlight=false, syncPending=false, remoteReadInFlight=null;
  var DIRTY_KEY='sd_sync_dirty_v2';
  function load(k,fb){try{var r=store.getItem(k);return r!=null?JSON.parse(r):fb;}catch(e){return fb;}}
  function dirtyMap(){return load(DIRTY_KEY,{});}
  function markDirty(k){var d=dirtyMap();d[k]=Date.now();store.setItem(DIRTY_KEY,JSON.stringify(d));emitSync('pending');}
  function clearDirty(){store.removeItem(DIRTY_KEY);}
  function clearDirtySnapshot(sent){
    var now=dirtyMap(),changed=false;
    Object.keys(sent||{}).forEach(function(k){if(now[k]===sent[k]){delete now[k];changed=true;}});
    if(changed){if(Object.keys(now).length)store.setItem(DIRTY_KEY,JSON.stringify(now));else clearDirty();}
  }
  function cleanupVisitTombstones(){
    var vi=load('sd_vi',{}),changed=false;
    Object.keys(vi).forEach(function(k){var r=vi[k];if(r&&r._tombstone===true){delete vi[k];changed=true;}});
    if(changed)store.setItem('sd_vi',JSON.stringify(vi));
  }
  function hasDirty(){return Object.keys(dirtyMap()).length>0;}
  function emitSync(status,message){
    try{
      window.dispatchEvent(new CustomEvent('sd-sync-status',{detail:{status:status,message:message||'',at:new Date().toISOString()}}));
      var el=document.getElementById('sdSyncState');
      if(!el&&document.body){el=document.createElement('div');el.id='sdSyncState';el.style.cssText='position:fixed;right:12px;bottom:12px;z-index:99999;padding:7px 10px;border-radius:10px;font:600 11px/1.2 system-ui;background:#111827;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.18);opacity:0;pointer-events:none;transition:opacity .2s';document.body.appendChild(el);}
      if(el){
        var labels={pending:'Kaydedilmeyi bekliyor',saving:'Kaydediliyor…',saved:'Sunucuya kaydedildi',error:'Bağlantı yok · tekrar denenecek'};
        el.textContent=labels[status]||message||status;
        el.style.opacity=status==='saved'?'0': '1';
        if(status==='saved'){setTimeout(function(){if(el)el.style.opacity='0';},900);}
      }
    }catch(e){}
  }
  function snapshot(){var out={};SHARED_KEYS.forEach(function(k){var v=load(k,null);if(v!==null)out[k]=v;});return out;}
  function token(){return localStorage.getItem('token')||'';}
  function pushRemote(options){
    options=options||{};
    if(!remoteLoaded||!token())return Promise.resolve(false);
    if(syncInFlight){syncPending=true;return Promise.resolve(false);}
    if(!hasDirty()&&!options.force)return Promise.resolve(true);
    if(syncTimer){clearTimeout(syncTimer);syncTimer=null;}
    var sentDirty=dirtyMap();
    syncInFlight=true;emitSync('saving');
    return fetch('/api/state',{method:'PUT',cache:'no-store',keepalive:!!options.keepalive,headers:{'Content-Type':'application/json','Authorization':'Bearer '+token()},body:JSON.stringify({state:snapshot()})})
      .then(function(r){if(r.status===401){try{localStorage.removeItem('token');}catch(_){} throw new Error('Oturum süresi doldu');}if(!r.ok)throw new Error('Ortak veri kaydedilemedi ('+r.status+')');return r.json();})
      .then(function(){clearDirtySnapshot(sentDirty);cleanupVisitTombstones();store.setItem('sd_last_sync',new Date().toISOString());emitSync('saved');return true;})
      .catch(function(e){console.error(e);emitSync('error',e.message);return false;})
      .finally(function(){syncInFlight=false;if(syncPending){syncPending=false;pushRemote({force:true});}});
  }
  function scheduleSync(delay){clearTimeout(syncTimer);syncTimer=setTimeout(function(){pushRemote();},typeof delay==='number'?delay:350);}
  function save(k,v,immediate){try{
    var oldRaw=store.getItem(k);
    store.setItem(k,JSON.stringify(v));
    if(k!=='sd_audit'&&['sd_co','sd_vi','sd_ex','sd_samples','sd_actions','sd_st','sd_users','sd_te'].indexOf(k)>=0&&oldRaw!==JSON.stringify(v)){
      try{
        var logs=load('sd_audit',[]);if(!Array.isArray(logs))logs=[];
        var u=load('sd_cur_user',null)||{};var labels={sd_co:'Firma',sd_vi:'Ziyaret',sd_ex:'Program dışı ziyaret',sd_samples:'Numune',sd_actions:'Aksiyon',sd_st:'Satışçı',sd_users:'Kullanıcı',sd_te:'Teknisyen'};
        logs.unshift({id:'aud_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),at:new Date().toISOString(),userId:u.id||'',user:u.name||u.username||'Sistem',role:u.role||'',key:k,action:labels[k]+' verisi güncellendi'});
        if(logs.length>1000)logs=logs.slice(0,1000);store.setItem('sd_audit',JSON.stringify(logs));
        if(remoteLoaded&&SHARED_KEYS.indexOf('sd_audit')>=0)markDirty('sd_audit');
      }catch(_auditErr){}
    }
    if(remoteLoaded&&SHARED_KEYS.indexOf(k)>=0){markDirty(k);if(immediate)pushRemote({force:true});else scheduleSync();}
  }catch(e){}}
  function remove(k,immediate){try{store.removeItem(k);if(remoteLoaded&&SHARED_KEYS.indexOf(k)>=0){markDirty(k);if(immediate)pushRemote({force:true});else scheduleSync();}}catch(e){}}
  function remoteReady(options){
    options=options||{};
    if(!token()){remoteLoaded=true;return Promise.resolve(false);}
    if(remoteReadInFlight&&!options.force)return remoteReadInFlight;
    var before=snapshot(),dirty=dirtyMap();
    remoteReadInFlight=fetch('/api/state',{cache:'no-store',headers:{'Authorization':'Bearer '+token()}})
      .then(function(r){if(r.status===401){try{localStorage.removeItem('token');}catch(_){} throw new Error('Oturum süresi doldu');}if(!r.ok)throw new Error('Ortak veri okunamadı ('+r.status+')');return r.json();})
      .then(function(data){
        var remote=data.state||{};
        var remoteHasData=Object.keys(remote).length>0&&((remote.sd_co&&remote.sd_co.length)||(remote.sd_te&&remote.sd_te.length)||Object.keys(remote.sd_vi||{}).length);
        if(remoteHasData){
          SHARED_KEYS.forEach(function(k){
            if(dirty[k])return; // Sunucuya ulaşmamış yerel değişikliği eski veriyle ezme.
            if(Object.prototype.hasOwnProperty.call(remote,k))store.setItem(k,JSON.stringify(remote[k]));
          });
          remoteLoaded=true;store.setItem('sd_last_sync',new Date().toISOString());
          if(hasDirty())return pushRemote({force:true}).then(function(){return true;});
          emitSync('saved');return true;
        }
        remoteLoaded=true;
        var localHasData=(before.sd_co&&before.sd_co.length)||(before.sd_te&&before.sd_te.length)||Object.keys(before.sd_vi||{}).length;
        if(localHasData){SHARED_KEYS.forEach(function(k){if(before[k]!==undefined)markDirty(k);});return pushRemote({force:true}).then(function(){return true;});}
        return true;
      })
      .catch(function(e){console.error(e);remoteLoaded=true;emitSync('error',e.message);return false;})
      .finally(function(){remoteReadInFlight=null;});
    return remoteReadInFlight;
  }
  function flushRemote(){return pushRemote({force:true});}
  function syncBusy(){return syncInFlight||hasDirty();}
  /* Oturum kapanışında / kullanıcı değişiminde ortak iş verisini tarayıcıdan siler.
     Aksi halde farklı yetkideki bir sonraki kullanıcı, sunucudan kendi (kısıtlı)
     verisi gelene kadar öncekinin verisini görür; dirty bayrağı varsa kalıcı olarak. */
  function clearSharedData(){
    SHARED_KEYS.forEach(function(k){try{store.removeItem(k);}catch(e){}});
    clearDirty();
    try{store.removeItem('sd_last_sync');store.removeItem('sd_ac');}catch(e){}
    remoteLoaded=false;
  }
  if(typeof window!=='undefined'){
    window.addEventListener('online',function(){if(remoteLoaded&&hasDirty())pushRemote({force:true});});
    window.addEventListener('pagehide',function(){if(remoteLoaded&&hasDirty())pushRemote({force:true,keepalive:true});});
  }
  var DATA_VER='v12';
  function checkVersion(){if(store.getItem('sd_ver')!==DATA_VER)store.setItem('sd_ver',DATA_VER);}
  function seed(){
    checkVersion();
    if(!store.getItem('sd_te'))save('sd_te',[
      {id:'t1',code:'1015',password:'1015',name:'Semih Ağlan',phone:'+90 533 209 25 99',email:'semih.aglan@dramamakine.com',avatar:''},
      {id:'t2',code:'1016',password:'1016',name:'Süleyman Küçük',phone:'+90 533 209 25 99',email:'suleyman.kucuk@dramamakine.com',avatar:''},
      {id:'t3',code:'1019',password:'1019',name:'Teknisyen 1019',phone:'',email:'',avatar:''},
      {id:'t4',code:'1014',password:'1014',name:'Teknisyen 1014',phone:'',email:'',avatar:''}
    ]);
    if(!store.getItem('sd_co'))save('sd_co',SD_COMPANIES);
    if(!store.getItem('sd_vi'))save('sd_vi',{});
    if(!store.getItem('sd_ex'))save('sd_ex',[]);
    if(!store.getItem('sd_dp'))save('sd_dp',[]);
    if(!store.getItem('sd_users'))save('sd_users',[
      {id:'u0',username:'barkin.kayaci',name:'Barkın Kayacı',role:'admin',password:'1452580000',avatar:'',email:'barkin.kayaci@dramamakine.com'},
      {id:'u1',username:'semih.aglan',name:'Semih Ağlan',role:'tech',password:'1015',avatar:'',email:'semih.aglan@dramamakine.com',techId:'t1'},
      {id:'u2',username:'suleyman.kucuk',name:'Süleyman Küçük',role:'tech',password:'1016',avatar:'',email:'suleyman.kucuk@dramamakine.com',techId:'t2'},
      {id:'u3',username:'esra.onur',name:'Esra Onur',role:'sales',avatar:'',email:'esra.onur@dramamakine.com',salesRepId:'s1'},
      {id:'u4',username:'ersin.ertugen',name:'Ersin Ertügen',role:'sales',avatar:'',email:'ersin.ertugen@dramamakine.com',salesRepId:'s2'},
      {id:'u5',username:'yagiz.erel',name:'Yağız Erel',role:'sales',avatar:'',email:'yagiz.erel@dramamakine.com',salesRepId:'s3'}
    ]);
    if(!store.getItem('sd_cfg'))save('sd_cfg',{
      senderName:'Drama Makine Teknik Servis',senderEmail:'',
      reportTo:'',subjectPrefix:'ServisDrama | Günlük Rapor',
      mailAlicilar:[],emailjsService:'',emailjsTemplate:'',emailjsKey:'',
      moduleFeatures:{numuneAktif:true,kurulumBanner:true,truckMail:true,programDisi:true,cokluZiyaret:true},
      techFeatures:{showStats:true,showAllFirms:false,showMap:true,canSendReport:true,showHistory:true}
    });
    if(!store.getItem('sd_ac')){var ts=load('sd_te',[]);save('sd_ac',ts.length?ts[0].id:null);}
    /* Satışçı kayıtları — id/username/email sunucudaki users tablosuyla
       eşleşmeli, aksi halde sessionSalesRep() profili bulamaz. */
    if(!store.getItem('sd_st'))save('sd_st',[
      {id:'s1',code:'S01',username:'esra.onur',name:'Esra Onur',phone:'',email:'esra.onur@dramamakine.com'},
      {id:'s2',code:'S02',username:'ersin.ertugen',name:'Ersin Ertügen',phone:'',email:'ersin.ertugen@dramamakine.com'},
      {id:'s3',code:'S03',username:'yagiz.erel',name:'Yağız Erel',phone:'',email:'yagiz.erel@dramamakine.com'}
    ]);
    if(!store.getItem('sd_notifications'))save('sd_notifications',[]);
    if(!store.getItem('sd_actions'))save('sd_actions',[]);
    if(!store.getItem('sd_audit'))save('sd_audit',[]);
    patchVisitFrequencies();
    patchExactWeeks();
    patchVisitWeekMigration();
    patchHistoricalCompanies();
    patchLastVisits();
    patchVisitByMigration();
    patchExtraVisits();
    patchSalesRepFields();
  }

  /* Tek seferlik düzeltme: gerçek ziyaret sıklığı/bölge listesiyle mevcut firmaları
     günceller (sadece bolge+weeks — email/truck/kurulum gibi elle girilmiş alanlara dokunmaz) */
  var FREQ_PATCH={"c1":{"bolge":"KARACABEY","weeks":[1,2,3,4]},"c4":{"bolge":"OSB","weeks":[1,2,3,4]},"c77":{"bolge":"HOSAB","weeks":[1,2,3,4]},"c3":{"bolge":"ESKİŞEHİR","weeks":[1,2,3,4]},"c12":{"bolge":"ESKİŞEHİR","weeks":[1,2,3,4]},"c2":{"bolge":"NOSAB","weeks":[1,2,3,4]},"c6":{"bolge":"ÇALI","weeks":[2,4]},"c5":{"bolge":"OSB","weeks":[1,2,3,4]},"c11":{"bolge":"NOSAB","weeks":[1,2,3,4]},"c13":{"bolge":"NOSAB","weeks":[1,2,3,4]},"c14":{"bolge":"HOSAB","weeks":[2,4]},"c26":{"bolge":"ESKİŞEHİR","weeks":[1,2,3,4]},"c18":{"bolge":"BANDIRMA","weeks":[1,3,4]},"c34":{"bolge":"YILDIRIM","weeks":[1]},"c10":{"bolge":"ESKİŞEHİR","weeks":[1,2,3,4]},"c23":{"bolge":"KARACABEY","weeks":[1,2,3,4]},"c25":{"bolge":"BANDIRMA OSB","weeks":[1,2,3,4]},"c22":{"bolge":"NOSAB","weeks":[1]},"c21":{"bolge":"NOSAB","weeks":[2,4]},"c15":{"bolge":"ALTINOVA","weeks":[2,4]},"c58":{"bolge":"OSB","weeks":[1]},"c24":{"bolge":"BAŞKÖY","weeks":[2,4]},"c38":{"bolge":"ÇALI","weeks":[2,4]},"c17":{"bolge":"KÜÇÜKBALIKLI","weeks":[2,4]},"c49":{"bolge":"OSB","weeks":[2,4]},"c54":{"bolge":"ESKİŞEHİR","weeks":[1]},"c57":{"bolge":"BALIKESİR","weeks":[1]},"c16":{"bolge":"BALIKESİR","weeks":[2,4]},"c31":{"bolge":"NOSAB","weeks":[2,4]},"c42":{"bolge":"NOSAB","weeks":[1,2,3,4]},"c37":{"bolge":"TEKNOSAB","weeks":[2,4]},"c73":{"bolge":"KAYAPA","weeks":[1]},"c33":{"bolge":"KAYAPA","weeks":[2,4]},"c63":{"bolge":"HOSAB","weeks":[1,2,3,4]},"c51":{"bolge":"OSB","weeks":[2,4]},"c53":{"bolge":"BALIKESİR","weeks":[2,4]},"c39":{"bolge":"BANDIRMA OSB","weeks":[1,2,3,4]},"c29":{"bolge":"OSB","weeks":[2,4]},"c28":{"bolge":"GEMLİK SERBEST BÖLGE","weeks":[2,4]},"c65":{"bolge":"OSB","weeks":[2,4]},"c55":{"bolge":"KAYAPA","weeks":[2,4]},"c60":{"bolge":"OSB","weeks":[2,4]},"c66":{"bolge":"İNEGÖL","weeks":[2,4]},"c76":{"bolge":"KAYAPA","weeks":[1]},"c52":{"bolge":"BALIKESİR","weeks":[2,4]},"c20":{"bolge":"OSB","weeks":[2,4]},"c47":{"bolge":"OSB","weeks":[2,4]},"c40":{"bolge":"OSB","weeks":[]},"c67":{"bolge":"ESKİŞEHİR","weeks":[1]},"c62":{"bolge":"KARACABEY","weeks":[1]},"c32":{"bolge":"OSB","weeks":[1,3,4]},"c7":{"bolge":"OSB","weeks":[1,2,3,4]},"c44":{"bolge":"OSB","weeks":[1]},"c59":{"bolge":"BALIKESİR","weeks":[2,4]},"c75":{"bolge":"İNEGÖL","weeks":[2,4]},"c35":{"bolge":"ESKİŞEHİR","weeks":[2,4]},"c41":{"bolge":"ESKİŞEHİR","weeks":[2,4]},"c46":{"bolge":"BALIKESİR","weeks":[2,4]},"c56":{"bolge":"NİLÜFERKÖY","weeks":[1]},"c50":{"bolge":"OSB","weeks":[2,4]},"c36":{"bolge":"ÇALI","weeks":[1]},"c45":{"bolge":"HOSAB","weeks":[1]},"c43":{"bolge":"TEKNOSAB","weeks":[2,4]},"c74":{"bolge":"BİLECİK","weeks":[1,2,3,4]},"c8":{"bolge":"DEMİRTAŞ","weeks":[1,2,3,4]},"c61":{"bolge":"OSB","weeks":[1]},"c71":{"bolge":"HOSAB","weeks":[2,4]},"c30":{"bolge":"YILDIRIM","weeks":[2,4]},"c27":{"bolge":"ESKİŞEHİR","weeks":[2,4]},"c72":{"bolge":"ALTINOVA","weeks":[1]},"c48":{"bolge":"DEMİRTAŞ","weeks":[1]},"c69":{"bolge":"OSB","weeks":[1]},"c70":{"bolge":"BALIKESİR","weeks":[2,4]},"c19":{"bolge":"BALIKESİR","weeks":[2,4]}};
  function patchVisitFrequencies(){
    if(store.getItem('sd_freq_patch_v1'))return;
    var cos=load('sd_co',[]),changed=false;
    cos.forEach(function(co){
      var p=FREQ_PATCH[co.id];
      if(p){co.bolge=p.bolge;co.weeks=p.weeks.slice();changed=true;}
    });
    if(changed)save('sd_co',cos);
    store.setItem('sd_freq_patch_v1','1');
  }

  /* Tek seferlik düzeltme #2: teknisyenden gelen kesin haftalık program (hangi hafta
     kolonunda X var) + doğru teknisyen ataması. Önceki tahmini desenin üzerine yazar. */
  var EXACT_PATCH={"c1":{"weeks":[1,2,3,4],"techId":"t1"},"c2":{"weeks":[1,2,3,4],"techId":"t1"},"c3":{"weeks":[1,2,3,4],"techId":"t2"},"c4":{"weeks":[1,2,3,4],"techId":"t1"},"c5":{"weeks":[1,2,3,4],"techId":"t1"},"c6":{"weeks":[1,3],"techId":"t2"},"c7":{"weeks":[1,2,3,4],"techId":"t1"},"c8":{"weeks":[1,2,3,4],"techId":"t1"},"c9":{"weeks":[1,2,3,4],"techId":"t2"},"c10":{"weeks":[1,2,3,4],"techId":"t2"},"c11":{"weeks":[1,2,3,4],"techId":"t1"},"c12":{"weeks":[1,2,3,4],"techId":"t2"},"c13":{"weeks":[1,2,3,4],"techId":"t2"},"c14":{"weeks":[2,4],"techId":"t2"},"c15":{"weeks":[2,4],"techId":"t2"},"c16":{"weeks":[1,3],"techId":"t1"},"c17":{"weeks":[1,3],"techId":"t1"},"c18":{"weeks":[1,3],"techId":"t1"},"c19":{"weeks":[1,3],"techId":"t1"},"c20":{"weeks":[2,4],"techId":"t2"},"c21":{"weeks":[2,4],"techId":"t1"},"c22":{"weeks":[2,4],"techId":"t1"},"c23":{"weeks":[1,2,3,4],"techId":"t1"},"c24":{"weeks":[1,3],"techId":"t1"},"c25":{"weeks":[1,3],"techId":"t1"},"c26":{"weeks":[1,2,3,4],"techId":"t2"},"c28":{"weeks":[1,3],"techId":"t1"},"c29":{"weeks":[1,3],"techId":"t2"},"c30":{"weeks":[2,4],"techId":"t2"},"c31":{"weeks":[2,4],"techId":"t2"},"c32":{"weeks":[1,3,4],"techId":"t1"},"c33":{"weeks":[2,4],"techId":"t1"},"c34":{"weeks":[1],"techId":"t2"},"c35":{"weeks":[3],"techId":"t2"},"c36":{"weeks":[1,3],"techId":"t1"},"c37":{"weeks":[1,3],"techId":"t1"},"c38":{"weeks":[1,3],"techId":"t1"},"c39":{"weeks":[1,3],"techId":"t1"},"c40":{"weeks":[],"techId":"t2"},"c42":{"weeks":[1,2,3,4],"techId":"t1"},"c43":{"weeks":[1,3],"techId":"t1"},"c44":{"weeks":[2,4],"techId":"t1"},"c45":{"weeks":[2,4],"techId":"t1"},"c46":{"weeks":[1,3],"techId":"t1"},"c47":{"weeks":[1,3],"techId":"t2"},"c48":{"weeks":[1],"techId":"t2"},"c49":{"weeks":[1,3],"techId":"t2"},"c50":{"weeks":[1,4],"techId":"t1"},"c51":{"weeks":[1,3],"techId":"t2"},"c52":{"weeks":[1,3],"techId":"t1"},"c53":{"weeks":[1,4],"techId":"t1"},"c54":{"weeks":[1],"techId":"t2"},"c55":{"weeks":[1,4],"techId":"t1"},"c56":{"weeks":[1],"techId":"t2"},"c57":{"weeks":[2],"techId":"t1"},"c58":{"weeks":[2,4],"techId":"t1"},"c59":{"weeks":[1,3],"techId":"t1"},"c60":{"weeks":[1,3],"techId":"t2"},"c61":{"weeks":[1],"techId":"t2"},"c62":{"weeks":[1,3],"techId":"t1"},"c63":{"weeks":[1,2,3,4],"techId":"t2"},"c64":{"weeks":[2,4],"techId":"t1"},"c65":{"weeks":[1,2],"techId":"t2"},"c66":{"weeks":[3],"techId":"t1"},"c67":{"weeks":[1],"techId":"t2"},"c68":{"weeks":[2],"techId":"t1"},"c69":{"weeks":[1],"techId":"t2"},"c70":{"weeks":[1],"techId":"t1"},"c71":{"weeks":[1,3],"techId":"t2"},"c73":{"weeks":[2],"techId":"t1"},"c75":{"weeks":[2,3],"techId":"t1"},"c76":{"weeks":[1],"techId":"t2"},"c77":{"weeks":[1,2,3,4],"techId":"t2"}};
  function patchExactWeeks(){
    if(store.getItem('sd_exact_weeks_v1'))return;
    var cos=load('sd_co',[]),changed=false;
    cos.forEach(function(co){
      var p=EXACT_PATCH[co.id];
      if(p){co.weeks=p.weeks.slice();co.techId=p.techId;changed=true;}
    });
    if(changed)save('sd_co',cos);
    store.setItem('sd_exact_weeks_v1','1');
  }

  /* Eksik geçmiş firma kayıtlarını mevcut kullanıcı verisini silmeden tamamlar. */
  function patchVisitWeekMigration(){
    if(store.getItem('sd_visit_week_migration_v1'))return;
    var vi=load('sd_vi',{}),changed=false;
    if(vi['c5_2026-W29']&&!vi['c5_2026-W30']){vi['c5_2026-W30']=vi['c5_2026-W29'];changed=true;}
    if(vi['c8_2026-W29']&&!vi['c8_2026-W30']){vi['c8_2026-W30']=vi['c8_2026-W29'];changed=true;}
    if(changed)save('sd_vi',vi);
    store.setItem('sd_visit_week_migration_v1','1');
  }

  function patchHistoricalCompanies(){
    if(store.getItem('sd_history_companies_v1'))return;
    var cos=load('sd_co',[]),changed=false;
    var canel=cos.find(function(c){return c.id==='c77'||String(c.name||'').toLocaleUpperCase('tr-TR').indexOf('CANEL OTOMOTİV')>=0;});
    if(canel&&canel.name!=='CANEL OTOMOTİV SAN. VE TİC. A.Ş.'){
      canel.name='CANEL OTOMOTİV SAN. VE TİC. A.Ş.';changed=true;
    }
    function ensureCompany(id,name){
      var found=cos.find(function(c){return String(c.name||'').toLocaleUpperCase('tr-TR')===name.toLocaleUpperCase('tr-TR');});
      if(found)return;
      var used=cos.some(function(c){return c.id===id;});
      if(used){
        var max=cos.reduce(function(n,c){var m=String(c.id||'').match(/^c(\d+)$/);return m?Math.max(n,parseInt(m[1],10)):n;},0);
        id='c'+(max+1);
      }
      cos.push({id:id,name:name,bolge:'',techId:'t2',email:'',truck:false,weeks:[1,2,3,4],aMails:[],lat:null,lng:null,konumNot:''});
      changed=true;
    }
    ensureCompany('c79','DİŞLİ MAKİNA SAN. VE TİC.LTD.ŞTİ.');
    ensureCompany('c80','ODOKSAN MAKİNA SAN. VE TİC. LTD. ŞTİ.');
    if(changed)save('sd_co',cos);
    store.setItem('sd_history_companies_v1','1');
  }

  /* Tarih ve işlev yardımcıları */
  var DT={
    monday:function(d){var x=new Date(d),n=(x.getDay()+6)%7;x.setDate(x.getDate()-n);x.setHours(0,0,0,0);return x;},
    isoWeek:function(d){var x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));var day=(x.getUTCDay()+6)%7;x.setUTCDate(x.getUTCDate()-day+3);var t4=new Date(Date.UTC(x.getUTCFullYear(),0,4));return 1+Math.round(((x-t4)/864e5-3+((t4.getUTCDay()+6)%7))/7);},
    wkey:function(d){return d.getFullYear()+'-W'+String(DT.isoWeek(d)).padStart(2,'0');},
    ddmm:function(d){return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0');},
    ddmmyyyy:function(d){return DT.ddmm(d)+'.'+d.getFullYear();},
    hhii:function(d){return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');},
    monthWeeks:function(y,m){var first=new Date(y,m,1),last=new Date(y,m+1,0),weeks=[],cur=DT.monday(first);while(cur<=last){weeks.push(new Date(cur));cur=new Date(cur);cur.setDate(cur.getDate()+7);}return weeks;},
    sunday:function(mondayDate){var d=new Date(mondayDate);d.setDate(d.getDate()+6);d.setHours(23,59,59,0);return d;},
    MONTHS:['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
  };

  function parseVisitDate(value,key){
    if(value instanceof Date&&!isNaN(value.getTime()))return new Date(value.getTime());
    var p=String(value||'').trim().split('.');
    if(p.length<2)return null;
    var day=parseInt(p[0],10),month=parseInt(p[1],10),year=p.length>=3?parseInt(p[2],10):NaN;
    if(!year){
      var km=String(key||'').match(/_(\d{4})-W\d{2}/);
      year=km?parseInt(km[1],10):new Date().getFullYear();
    }
    var d=new Date(year,month-1,day);
    if(isNaN(d.getTime())||d.getFullYear()!==year||d.getMonth()!==month-1||d.getDate()!==day)return null;
    return d;
  }

  function fullDate(d){
    return d?DT.ddmmyyyy(d):'';
  }

  /* Başlangıç günü sayılmaz; bitiş günü uygunsa sayılır. Hafta sonları,
     Türkiye'deki sabit resmî tatiller ve ayarlara eklenen özel tatiller düşülür. */
  function businessDaysBetween(fromDate,toDate){
    var from=parseVisitDate(fromDate),to=parseVisitDate(toDate);
    if(!from||!to||to<=from)return 0;
    from.setHours(0,0,0,0);to.setHours(0,0,0,0);
    var fixedHolidays={'01-01':true,'04-23':true,'05-01':true,'05-19':true,'07-15':true,'08-30':true,'10-29':true};
    var configured=(load('sd_cfg',{}).officialHolidays||[]).reduce(function(map,value){
      var d=parseVisitDate(value);
      if(d)map[d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')]=true;
      return map;
    },{});
    var count=0,current=new Date(from);
    current.setDate(current.getDate()+1);
    while(current<=to){
      var day=current.getDay();
      var monthDay=String(current.getMonth()+1).padStart(2,'0')+'-'+String(current.getDate()).padStart(2,'0');
      var fullKey=current.getFullYear()+'-'+monthDay;
      if(day>=1&&day<=5&&!fixedHolidays[monthDay]&&!configured[fullKey])count++;
      current.setDate(current.getDate()+1);
    }
    return count;
  }

  /* Yalnızca tamamlanmış ziyaretleri gerçek Date değeriyle sıralar. Pending
     yola çıkış kaydı "son ziyaret" sayılmaz. */
  function getPreviousCompletedVisit(companyId,beforeDate){
    var vi=load('sd_vi',{}),before=beforeDate instanceof Date?new Date(beforeDate.getTime()):new Date();
    var best=null;
    Object.keys(vi).forEach(function(k){
      if(k.indexOf(companyId+'_')!==0)return;
      var rec=vi[k]||{};
      if(rec.status!=='done')return;
      var values=Array.isArray(rec.dates)&&rec.dates.length?rec.dates:[rec.date];
      values.forEach(function(value){
        var d=parseVisitDate(value,k);
        if(!d)return;
        /* 31.07.2026 milat tarihini yoksay */
        if(d.getDate()===31&&d.getMonth()===6&&d.getFullYear()===2026)return;
        if(rec.saat&&value===rec.date){
          var hm=String(rec.saat).match(/^(\d{1,2}):(\d{2})$/);
          if(hm)d.setHours(parseInt(hm[1],10),parseInt(hm[2],10),0,0);
        }
        if(d>=before)return;
        if(!best||d>best.dateObject){
          best={date:fullDate(d),dateObject:d,tc:rec.tc||'',saat:rec.saat||'',key:k,record:rec};
        }
      });
    });
    if(!best){
      best={date:'Kayıt yok',dateObject:null,tc:'',saat:'',key:'',record:{}};
    }
    return best;
  }

  /* Truck/Yola Çık tıklamasını gün ve saat bazında saklar. Aynı haftadaki
     tamamlanmış ziyaretin üzerine yazmaz; yeni yola çıkışlar ayrı geçmiştedir. */
  function recordDeparture(company,technician,when){
    var at=when instanceof Date?new Date(when.getTime()):new Date();
    var entry={
      id:'dp_'+at.getTime()+'_'+String(company&&company.id||'unknown'),
      companyId:company&&company.id||'',
      companyName:company&&company.name||'',
      technicianCode:technician&&technician.code||'—',
      date:fullDate(at),
      dayKey:at.getFullYear()+'-'+String(at.getMonth()+1).padStart(2,'0')+'-'+String(at.getDate()).padStart(2,'0'),
      weekday:['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'][at.getDay()],
      time:DT.hhii(at),
      timestamp:at.toISOString()
    };
    var departures=load('sd_dp',[]);
    departures.push(entry);
    if(departures.length>1000)departures=departures.slice(departures.length-1000);
    save('sd_dp',departures,true);

    var vi=load('sd_vi',{}),key=entry.companyId+'_'+DT.wkey(at),current=vi[key];
    if(!current||current.status==='pending'){
      vi[key]=Object.assign({},current||{},{
        date:entry.date,
        tc:entry.technicianCode,
        count:current&&current.count||1,
        status:'pending',
        saat:entry.time,
        departureAt:entry.timestamp,
        weekday:entry.weekday
      });
      save('sd_vi',vi);
    }
    return entry;
  }

  /* Teknisyenlere ait doğrulanmış son ziyaret verileri. */
  function patchLastVisits(){
    if(store.getItem('sd_last_visits_v2'))return;
    var vi=load('sd_vi',{}),cos=load('sd_co',[]);

    /* Eski hatalı yamanın başka firmalara yazdığı kayıtları yalnızca birebir
       eşleşiyorsa temizle; kullanıcının sonradan değiştirdiği kayıt korunur. */
    var wrongSeeds=[
      {compId:'c48',date:'17.07.2026',saat:'14:00',tc:'1015'},
      {compId:'c24',date:'13.07.2026',saat:'10:00',tc:'1015'},
      {compId:'c31',date:'17.07.2026',saat:'15:30',tc:'1015'},
      {compId:'c6',date:'30.06.2026',saat:'11:00',tc:'1016'},
      {compId:'c43',date:'03.07.2026',saat:'13:45',tc:'1016'},
      {compId:'c51',date:'30.06.2026',saat:'09:15',tc:'1016'},
      {compId:'c66',date:'01.07.2026',saat:'10:45',tc:'1016'}
    ];
    wrongSeeds.forEach(function(seed){
      Object.keys(vi).forEach(function(k){
        var r=vi[k];
        if(k.indexOf(seed.compId+'_')===0&&r&&r.date===seed.date&&r.saat===seed.saat&&r.tc===seed.tc&&r.status==='done'){
          delete vi[k];
        }
      });
    });

    var lastVisits=[
      {name:'DURMAZLAR MAKİNA SANAYİİ VE TİCARET A.Ş.',date:'17.07.2026',tc:'1015'},
      {name:'BURÇAK METAL OTO. YAN SAN. TEKS. TUR. GIDA İNŞ. TİC. VE SAN. LTD. ŞTİ.',date:'17.06.2026',tc:'1015'},
      {name:'FENESE KALIP PLASTİK METAL SAN. TİC. LTD.ŞTİ.',date:'13.07.2026',tc:'1015'},
      {name:'F.S.S. FREN SİSTEMLERİ SAN. VE TİC LTD. ŞTİ.',date:'17.07.2026',tc:'1015'},
      {name:'AKYAPAK ULUSLAR ARASI DIŞ TİC.MAK.SAN.TİC.A.Ş.',date:'30.06.2026',tc:'1016'},
      {name:'CANEL OTOMOTİV SAN. VE TİC. A.Ş.',date:'03.07.2026',tc:'1016'},
      {name:'DİŞLİ MAKİNA SAN. VE TİC.LTD.ŞTİ.',date:'30.06.2026',tc:'1016'},
      {name:'ODOKSAN MAKİNA SAN. VE TİC. LTD. ŞTİ.',date:'01.07.2026',tc:'1016'}
    ];
    lastVisits.forEach(function(lv){
      var co=cos.find(function(c){return String(c.name||'').toLocaleUpperCase('tr-TR')===lv.name.toLocaleUpperCase('tr-TR');});
      var visitDate=parseVisitDate(lv.date);
      if(!co||!visitDate)return;
      var wk=DT.wkey(visitDate);
      var seededEntry={
        date:lv.date,
        tc:lv.tc,
        status:'done',
        saat:'',
        count:1,
        dateISO:visitDate.getFullYear()+'-'+String(visitDate.getMonth()+1).padStart(2,'0')+'-'+String(visitDate.getDate()).padStart(2,'0'),
        weekday:['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'][visitDate.getDay()],
        historySeed:true
      };
      vi[co.id+'_'+wk]=putVisitEntry(vi[co.id+'_'+wk],lv.tc,seededEntry);
    });
    save('sd_vi',vi);
    store.setItem('sd_last_visits_v2','1');
  }

  /* Eski üst-seviye ziyaret kayıtlarını teknisyen bazlı `by` yapısına geçirir.
     Yeni sürüm anahtarı sayesinde mevcut cihazlarda bir kez çalışır. */
  function patchVisitByMigration(){
    if(store.getItem('sd_visit_by_migration_v1'))return;
    var vi=load('sd_vi',{}),changed=false;
    Object.keys(vi).forEach(function(key){
      var rec=vi[key];
      if(!rec||typeof rec!=='object'||rec.__delete)return;
      var entries=visitEntries(rec);
      var normalized={by:{}};
      Object.keys(entries).forEach(function(code){
        if(!entries[code])return;
        normalized.by[String(code)]=Object.assign({},entries[code],{tc:String(code)});
      });
      var codes=Object.keys(normalized.by);
      if(!codes.length)return;
      var preferredCode=rec.tc&&normalized.by[String(rec.tc)]?String(rec.tc):codes[codes.length-1];
      var latest=normalized.by[preferredCode]||normalized.by[codes[0]];
      Object.assign(normalized,latest||{});
      if(JSON.stringify(rec)!==JSON.stringify(normalized)){
        vi[key]=normalized;
        changed=true;
      }
    });
    if(changed)save('sd_vi',vi);
    store.setItem('sd_visit_by_migration_v1','1');
  }

  /* Program dışı ziyaret verilerini seed et */
  function patchExtraVisits(){
    if(store.getItem('sd_extra_visits_v1'))return;
    var extras=load('sd_ex',[]),cos=load('sd_co',[]);

    var extraData=[
      {id:'ex1',firmaId:'c5',firmAdi:'DURMAZLAR MAKİNA SANAYİİ VE TİCARET A.Ş.',techId:'t1',techCode:'1015',date:'24.07',saat:'14:30',not:'DURMAZLAR NUMUNE'},
      {id:'ex2',firmaId:'c79',firmAdi:'DİŞLİ MAKİNA SAN. VE TİC.LTD.ŞTİ.',techId:'t2',techCode:'1016',date:'23.07',saat:'10:45',not:'DİŞLİ MAKİNA cihaz kontrol'},
      {id:'ex3',firmaId:'c80',firmAdi:'ODOKSAN MAKİNA SAN. VE TİC. LTD. ŞTİ.',techId:'t1',techCode:'1015',date:'22.07',saat:'16:00',not:'ODOKSAN bakım hizmeti'}
    ];

    /* Bayrak yalnızca bu tarayıcıda tutulur; yeni bir cihazdan girildiğinde seed
       yeniden çalışır. Bu yüzden id bazlı kontrol şart — aksi halde sunucudaki
       kayıtlar her yeni tarayıcıda bir kez daha çoğalır. */
    var mevcut={};extras.forEach(function(x){if(x&&x.id)mevcut[x.id]=true;});
    var eklenecek=extraData.filter(function(x){return !mevcut[x.id];});
    if(eklenecek.length){extras.push.apply(extras,eklenecek);save('sd_ex',extras);}
    store.setItem('sd_extra_visits_v1','1');
  }

  function patchSalesRepFields(){
    if(store.getItem('sd_sales_rep_fields_v1'))return;
    var cos=load('sd_co',[]),changed=false;
    cos.forEach(function(co){
      if(!co.salesRepId){
        co.salesRepId=null;
        co.salesRepCode=null;
        co.salesRepName=null;
        changed=true;
      }
    });
    if(changed)save('sd_co',cos);
    store.setItem('sd_sales_rep_fields_v1','1');
  }

  /* ── ZİYARET KAYDI: TEKNİSYEN BAZLI ───────────────────────────────
     Kayıt yine tek anahtarda (firmaId_hafta) durur, ama içinde her teknisyenin
     KENDİ girişi vardır:
       { by:{ '1015':{date,saat,status,count,...}, '1016':{...} },
         ...son giren teknisyenin verisi üst seviyede kopya }
     Üst seviye alanlar geriye dönük uyumluluk içindir (istatistik, geçmiş,
     truck maili "bu firma bu hafta gidildi mi" diye bakar) ve DAİMA en son
     giren teknisyenin verisini yansıtır — "son ziyaret" gösterimi buradan gelir.
     Böylece 1015 ile 1016 aynı firmaya girdiğinde biri diğerini ezmez. */
  function visitEntries(rec){
    if(!rec)return{};
    if(rec.by&&typeof rec.by==='object')return rec.by;
    if(rec.tc){var o={};o[rec.tc]=rec;return o;}   /* eski tek teknisyenli kayıt */
    return{};
  }
  /* Tek bir teknisyen perspektifi olmayan görünüm (admin + ALL): herhangi bir
     teknisyen tamamladıysa tamamlanmış say, ziyaret sayılarını topla. */
  function visitAggregate(rec){
    if(!rec)return null;
    var out={};for(var k in rec){if(k!=='by')out[k]=rec[k];}
    var es=visitEntries(rec),codes=Object.keys(es);
    if(!codes.length)return out;
    var total=0,anyDone=false;
    codes.forEach(function(c){total+=(es[c].count||1);if(es[c].status==='done')anyDone=true;});
    if(anyDone)out.status='done';
    out.count=total;out.techCodes=codes;
    return out;
  }
  /* code verilirse o teknisyenin kendi girişi, verilmezse toplam görünüm */
  function visitEntryFor(rec,code){
    if(!rec)return null;
    if(!code)return visitAggregate(rec);
    return visitEntries(rec)[code]||null;
  }
  function putVisitEntry(rec,code,patch){
    var prev=visitEntries(rec),es={};for(var k in prev)es[k]=prev[k];
    var entry={};for(var p in patch)entry[p]=patch[p];
    entry.tc=code;entry.ts=Date.now();
    es[code]=entry;
    var out={};for(var f in entry)out[f]=entry[f];   /* üst seviye = son giren */
    out.by=es;return out;
  }
  /* Teknisyenin kendi girişini siler; başka giriş kalmadıysa null (kayıt komple gider) */
  function removeVisitEntry(rec,code){
    var prev=visitEntries(rec),es={},left=[];
    for(var k in prev){if(k!==code){es[k]=prev[k];left.push(k);}}
    if(!left.length)return {by:{},_tombstone:true,deletedCode:code,ts:Date.now()};
    var last=es[left[left.length-1]],out={};
    for(var f in last)out[f]=last[f];
    out.by=es;return out;
  }
  /* tech.html gibi eski yazıcılar kaydı komple değiştirebilir; başka teknisyenin
     girişini sessizce silmemek için üst seviye yazımı by haritasına geri işlenir. */
  function mergeVisitMap(prev,next){
    if(!next||typeof next!=='object')return next;
    Object.keys(next).forEach(function(k){
      var p=prev[k],n=next[k];
      if(!p||!p.by||!n||n.by||!n.tc)return;
      next[k]=putVisitEntry(p,n.tc,n);
    });
    return next;
  }

  /* ── OTURUM / KAPSAM ──────────────────────────────────────────────
     ALL_TECH: ziyaret ekranında "tüm firmalar" kapsamı. Teknisyen başka bir
     teknisyenin firmasına gittiyse ziyareti buradan işaretler. */
  var ALL_TECH='ALL';

  /* index.html giriş yaptığında sd_session'a {token,user,userData} yazar.
     userData sunucudan gelir: {id,username,name,role,email} — techId içermez. */
  function sessionUser(){
    var raw=null;
    try{raw=sessionStorage.getItem('sd_session')||localStorage.getItem('sd_session_persist');}catch(e){}
    if(!raw)return null;
    try{var s=JSON.parse(raw);return s.userData||null;}catch(e){return null;}
  }

  /* Giriş yapan kullanıcının teknisyen kaydı. Admin veya eşleşme yoksa null.
     Sunucudaki users tablosunda techId olmadığı için sırayla:
     yerel kullanıcı kaydındaki techId → e-posta → kullanıcı adı → ad soyad. */
  function sessionTech(){
    var u=sessionUser();if(!u)return null;
    if(String(u.role||'').toLowerCase()==='admin')return null;
    var ts=load('sd_te',[]);if(!ts.length)return null;
    var uname=String(u.username||'').toLowerCase(),email=String(u.email||'').toLowerCase(),name=String(u.name||'').toLowerCase();
    var local=load('sd_users',[]).find(function(x){
      return String(x.username||'').toLowerCase()===uname||String(x.email||'').toLowerCase()===email;
    });
    if(local&&local.techId){
      var byId=ts.find(function(t){return t.id===local.techId;});
      if(byId)return byId;
    }
    return ts.find(function(t){return String(t.email||'').toLowerCase()===email;})
        || ts.find(function(t){return String(t.email||'').split('@')[0].toLowerCase()===uname;})
        || ts.find(function(t){return String(t.name||'').toLowerCase()===name;})
        || null;
  }

  function activeTech(){
    var id=load('sd_ac',null);
    if(id===ALL_TECH)return null;               /* ALL kapsamı: tek bir teknisyen yok */
    var ts=load('sd_te',[]);
    return ts.find(function(t){return t.id===id;})||ts[0]||null;
  }

  /* Ziyareti FİİLEN yapan teknisyen — kayda bu kod yazılır ve mail bu koda göre gruplar.
     1) Teknisyen girişi varsa her zaman o kişi (ALL'dan başkasının firmasını
        işaretlese bile ziyaret kendi adına geçer)
     2) Admin ise ekranda seçili teknisyen
     3) Admin + ALL kapsamı ise firmanın sorumlusu */
  function actingTech(co){
    var me=sessionTech();if(me)return me;
    var at=activeTech();if(at)return at;
    if(co&&co.techId){
      var ts=load('sd_te',[]);
      return ts.find(function(t){return t.id===co.techId;})||null;
    }
    return null;
  }

  /* Giriş yapan kullanıcının satışçı kaydı. Satışçı değilse null. */
  function sessionSalesRep(){
    var u=sessionUser();if(!u)return null;
    if(String(u.role||'').toLowerCase()!=='sales')return null;
    var sts=load('sd_st',[]);if(!sts.length)return null;
    var uid=String(u.id||'').toLowerCase(),uname=String(u.username||'').toLowerCase(),email=String(u.email||'').toLowerCase();
    return sts.find(function(s){
      return String(s.userId||'').toLowerCase()===uid||String(s.id||'').toLowerCase()===uid||String(s.username||'').toLowerCase()===uname||String(s.email||'').toLowerCase()===email;
    })||null;
  }

  /* Bildirim Oluştur: Gecikme, Aksiyon, Ziyaret bazlı */
  function generateNotifications(){
    var today=new Date();var notifs=load('sd_notifications',[]);var changed=false;
    var cos=load('sd_co',[]),sts=load('sd_st',[]),vi=load('sd_vi',{}),ex=load('sd_ex',[]);
    var stMap={};sts.forEach(function(s){stMap[s.id]=s;});

    /* Gecikmiş ziyaretler */
    cos.forEach(function(c){
      if(!c.salesRepId)return;var lastVisit=null;var lastTs=0;
      Object.entries(vi).forEach(function(entry){
        var key=entry[0],rec=entry[1];if(!rec.by)return;
        var coId=key.split('|')[0];if(coId!==c.id)return;
        Object.values(rec.by).forEach(function(v){
          if((v.ts||0)>lastTs){lastTs=v.ts||0;lastVisit=v;}
        });
      });
      if(Array.isArray(ex)){
        ex.forEach(function(e){
          if(e.firmaId!==c.id)return;if((e.ts||0)>lastTs){lastTs=e.ts||0;lastVisit=e;}
        });
      }
      var daysSince=lastVisit?Math.floor((today-new Date(lastVisit.date||'2000-01-01'))/(24*60*60*1000)):999;
      var expectedDays=(c.weeks&&c.weeks.length)?Math.min.apply(null,c.weeks.map(function(w){return w*7;})):30;
      if(daysSince>expectedDays){
        var notifId='delay_'+c.id+'_'+today.toISOString().split('T')[0];
        if(!notifs.find(function(n){return n.id===notifId;})){
          notifs.push({
            id:notifId,type:'delay',title:'Gecikmiş Ziyaret',
            message:c.name+' firmasına '+daysSince+' gün ziyaret yok',
            recipientUserId:c.salesRepId,createdAt:today.toISOString(),read:false
          });changed=true;
        }
      }
    });

    /* Aksiyon ve numune eskalasyonları — mevcut kayıtları değiştirmez, yalnızca bildirim ekler. */
    var actions=load('sd_actions',[]),samples=load('sd_samples',[]),todayKey=today.toISOString().slice(0,10);
    (Array.isArray(actions)?actions:[]).forEach(function(a){
      if(a.status==='done'||a.status==='cancelled'||!a.dueDate)return;
      var due=new Date(a.dueDate+'T23:59:59');var diff=Math.ceil((due-today)/86400000);
      var kind=diff<0?'action_overdue':(diff<=1?'action_due':null);if(!kind)return;
      var id=kind+'_'+a.id+'_'+todayKey;if(notifs.some(function(n){return n.id===id;}))return;
      var co=cos.find(function(c){return String(c.id)===String(a.companyId||'');});
      notifs.push({id:id,type:kind,title:diff<0?'Gecikmiş Aksiyon':'Aksiyon Yaklaşıyor',message:(co?co.name+' · ':'')+(a.title||a.description||'Aksiyon')+(diff<0?' · '+Math.abs(diff)+' gün gecikmiş':' · yarın/bugün'),recipientUserId:a.assignedToUserId||a.createdByUserId||'',createdAt:today.toISOString(),read:false});changed=true;
    });
    (Array.isArray(samples)?samples:[]).forEach(function(s){
      var st=String(s.status||'').toLowerCase();if(st==='done'||st==='completed'||st==='closed'||st==='tamamlandı')return;
      var created=new Date(s.createdAt||s.date||s.ts||0);if(isNaN(created))return;var age=Math.floor((today-created)/86400000);if(age<7)return;
      var id='sample_wait_'+s.id+'_'+todayKey;if(notifs.some(function(n){return n.id===id;}))return;
      var co=cos.find(function(c){return String(c.id)===String(s.companyId||s.firmaId||'');});
      notifs.push({id:id,type:'sample_wait',title:'Numune Bekliyor',message:(co?co.name+' · ':'')+'Numune '+age+' gündür açık',recipientUserId:s.salesRepId||'',createdAt:today.toISOString(),read:false});changed=true;
    });

    if(changed)save('sd_notifications',notifs);
  }

  return{
    load:load,save:save,remove:remove,seed:seed,remoteReady:remoteReady,pushRemote:pushRemote,flushRemote:flushRemote,syncBusy:syncBusy,clearSharedData:clearSharedData,DT:DT,
    ALL_TECH:ALL_TECH,sessionUser:sessionUser,sessionTech:sessionTech,sessionSalesRep:sessionSalesRep,actingTech:actingTech,generateNotifications:generateNotifications,
    visitEntryFor:visitEntryFor,visitEntries:visitEntries,visitAggregate:visitAggregate,
    putVisitEntry:putVisitEntry,removeVisitEntry:removeVisitEntry,
    get companies(){return load('sd_co',[]);},
    get technicians(){return load('sd_te',[]);},
    get visits(){return load('sd_vi',{});},
    get extras(){return load('sd_ex',[]);},
    get departures(){return load('sd_dp',[]);},
    get visitRequests(){return load('sd_visit_requests',[]);},
    get config(){return load('sd_cfg',{});},
    get activeTechId(){return load('sd_ac',null);},
    get users(){return load('sd_users',[]);},
    get currentUser(){return load('sd_cur_user',null);},
    set companies(v){save('sd_co',v);},set technicians(v){save('sd_te',v);},
    set visits(v){save('sd_vi',mergeVisitMap(load('sd_vi',{}),v),true);},set extras(v){save('sd_ex',v,true);},set departures(v){save('sd_dp',v,true);},
    set config(v){save('sd_cfg',v);},set activeTechId(v){save('sd_ac',v);},
    set users(v){save('sd_users',v);},set currentUser(v){save('sd_cur_user',v);},
    activeTech:activeTech,
    login:function(u,p){return load('sd_users',[]).find(function(x){return x.username===u&&x.password===p;})||null;},
    parseVisitDate:parseVisitDate,
    businessDaysBetween:businessDaysBetween,
    getPreviousCompletedVisit:getPreviousCompletedVisit,
    recordDeparture:recordDeparture,
    buildVisitTable:buildVisitTable,
    buildTruckServiceMailHTML:buildTruckServiceMailHTML
  };
})();

/* Global references */
var DT=SD.DT,BL=SD.BL;

/* Bir Pazartesi tarihinin KENDİ ayı içindeki hafta sırası (1-4) — ay sınırını aşan
   rolling pencerelerde her haftanın doğru ay-haftasına göre planlanıp planlanmadığını bulmak için */
function _weekOfMonth(mondayDate){
  var mw=DT.monthWeeks(mondayDate.getFullYear(),mondayDate.getMonth());
  var idx=mw.findIndex(function(w){return w.getTime()===mondayDate.getTime();});
  /* Hafta sırası 1-5 olabilir. Pattern tekrarlama BL.scheduled'da yapılır. */
  return idx>=0?idx+1:1;
}

var BL={
  scheduled:function(co,wi){
    /* 4'lü pattern tekrarlama: hafta 5+ geldiğinde 1-4 pattern'i tekrar başlar */
    var pattern=co.weeks||[1,2,3,4];
    var idx=((wi-1)%4);
    return pattern.indexOf(idx+1)>=0;
  },
  getInitials:function(name){if(!name)return'?';var p=name.trim().split(' ');return p.length>=2?(p[0][0]+p[1][0]).toUpperCase():name.slice(0,2).toUpperCase();},
  avatarColor:function(str){if(!str)return'#0B5FE8';if(str.indexOf('Semih')>=0||str.indexOf('1015')>=0)return'#0B5FE8';if(str.indexOf('Süleyman')>=0||str.indexOf('Suleyman')>=0||str.indexOf('1016')>=0)return'#F59E0B';var cols=['#0B5FE8','#059669','#F59E0B','#DC2626','#7C3AED','#06B6D4','#8B5CF6','#0EA5E9'];var h=0;for(var i=0;i<str.length;i++)h=(h*31+str.charCodeAt(i))&0xffff;return cols[h%cols.length];}
};

var UI={
  toast:function(msg,type){
    var t=document.getElementById('toast');if(!t)return;
    t.textContent=msg;t.className='toast toast-'+(type||'info')+' show';
    clearTimeout(UI._tt);UI._tt=setTimeout(function(){t.classList.remove('show');},3200);
  },
  openModal:function(id){var el=document.getElementById(id);if(el){el.classList.remove('hidden');el._uiModalOpen=Date.now();}},
  closeModal:function(id){var el=document.getElementById(id);if(!el)return;var now=Date.now();var opened=el._uiModalOpen||0;if(now-opened<300)return;el.classList.add('hidden');},
  confirm:function(msg,cb){if(window.confirm(msg))cb();}
};

/* ================================================================
   ZİYARET TABLOSU MOTORU
   Geçmiş haftalar GÖSTERILMEZ — sadece bu hafta + sonrası
   ================================================================ */
function buildVisitTable(opts){
  var cos=SD.companies.filter(function(c){return c.aktif!==false;});var vis=SD.visits;
  var today=new Date(),todayMon=DT.monday(today);
  var y=opts.year,m=opts.month;
  var isCurrentMonth=(y===today.getFullYear()&&m===today.getMonth());
  console.log('DEBUG buildVisitTable: y='+y+' m='+m+' isCurrentMonth='+isCurrentMonth+' todayMon='+todayMon.toISOString().split('T')[0]);
  console.log('DEBUG buildVisitTable: y='+y+' m='+m+' isCurrentMonth='+isCurrentMonth+' todayMon='+todayMon.toISOString().split('T')[0]);

  /* Başlangıç haftası: ayın ilk haftasından başla (geçmiş haftaları da göster) */
  var startMon=DT.monday(new Date(y,m,1));

  /* 4 hafta: bu hafta + sonraki 3 hafta (geçmiş haftalar hariç) */
  var allWeeks=[];
  if(isCurrentMonth){
    /* Güncel ayda: bu hafta'dan başla (todayMon) + sonraki 3 hafta */
    for(var i=0;i<4;i++){
      var w=new Date(todayMon.getTime());w.setDate(w.getDate()+i*7);
      allWeeks.push({m:w,k:DT.wkey(w),wn:DT.isoWeek(w),wi:_weekOfMonth(w),
        isCur:w.getTime()===todayMon.getTime(),
        isPast:false});
    }
  }else{
    /* Geçmiş/gelecek ay: ayın ilk haftası + sonraki 3 hafta */
    var indices=[3,4,5,6];
    for(var i=0;i<4;i++){
      var j=indices[i];
      var w=new Date(startMon.getTime());w.setDate(w.getDate()+j*7);
      allWeeks.push({m:w,k:DT.wkey(w),wn:DT.isoWeek(w),wi:_weekOfMonth(w),
        isCur:false,
        isPast:false});
    }
  }
  var cols=allWeeks;

  var q=(opts.searchVal||'').toLocaleLowerCase('tr');
  var at=opts.techId?SD.technicians.find(function(t){return t.id===opts.techId;}):null;
  var filtered=cos.filter(function(c){
    return(!at||c.techId===at.id)&&(!q||c.name.toLocaleLowerCase('tr').indexOf(q)>=0);
  });

  /* Hücreler KİMİN gözünden gösterilecek:
     - Teknisyen girişi varsa daima kendisi (ALL listesinde de yalnızca kendi
       ziyaretini yeşil görür; başkasının girdiği ziyaret onu yeşile boyamaz)
     - Admin ise ekranda seçili teknisyen
     - Admin + ALL ise tek perspektif yok, toplam görünüm (null) */
  var me=SD.sessionTech();
  var viewerCode=me?me.code:(at?at.code:null);

  /* Sıra: (0) bu hafta planı olan ve henüz gidilmeyenler — üstte, yerinde kalır;
     (1) bu hafta planı OLMAYANLAR (vc-dash) — kendi aralarında toplu, ortada;
     (2) tamamlanmış (yeşil) ziyaretler — en altta.
     !! şart: kayıt yokken "va&&..." false değil undefined döner, undefined===false yanlış
     olduğu için karşılaştırıcı tutarsızlaşır ve sarıya çevrilen satır da alta kayardı. */
  var cwk=DT.wkey(today),cwi=_weekOfMonth(todayMon);
  function _sortBucket(co,viewerVd){
    if(viewerVd&&viewerVd.status==='done')return 2;
    if(!BL.scheduled(co,cwi))return 1;
    return 0;
  }
  filtered.sort(function(a,b){
    if(!isCurrentMonth)return 0;
    var va=SD.visitEntryFor(vis[a.id+'_'+cwk],viewerCode),vb=SD.visitEntryFor(vis[b.id+'_'+cwk],viewerCode);
    var ba=_sortBucket(a,va),bb=_sortBucket(b,vb);
    if(ba===bb)return 0;
    return ba-bb;
  });

  /* Progress — sadece bu haftaya ve izleyen teknisyenin kendi ziyaretlerine göre */
  var tot=0,don=0;
  if(isCurrentMonth){
    cos.filter(function(c){return!at||c.techId===at.id;}).forEach(function(co){
      if(BL.scheduled(co,cwi)){tot++;var v=SD.visitEntryFor(vis[co.id+'_'+cwk],viewerCode);if(v&&v.status==='done')don++;}
    });
  }
  var pf=opts.progFillId?document.getElementById(opts.progFillId):null;
  if(pf)pf.style.width=(tot?Math.round(don/tot*100):0)+'%';
  var cl=opts.countLabelId?document.getElementById(opts.countLabelId):null;
  if(cl)cl.textContent=don+' / '+tot+' ziyaret tamamlandı';
  var miss=tot-don;
  var wb=opts.warnBannerId?document.getElementById(opts.warnBannerId):null;
  if(wb){
    if(isCurrentMonth&&miss>0){
      wb.classList.remove('hidden');
      var wt=opts.warnTitleId?document.getElementById(opts.warnTitleId):null;
      if(wt)wt.textContent='Bu hafta '+miss+' firma ziyaret edilmedi'+(at?' ('+at.code+')':'');
      var wbg=opts.warnBadgeId?document.getElementById(opts.warnBadgeId):null;
      if(wbg)wbg.textContent=miss;
    }else if(wb)wb.classList.add('hidden');
  }

  var container=opts.containerId?document.getElementById(opts.containerId):null;
  if(!container)return;
  container.innerHTML='';

  var gridTpl='minmax(240px,1fr) repeat(4,minmax(120px,140px))';
  var wrap=document.createElement('div');
  wrap.className='vt-wrap';

  /* HEAD */
  var head=document.createElement('div');head.className='vt-head';
  head.style.gridTemplateColumns=gridTpl;
  var h0=document.createElement('div');h0.className='vt-hc';h0.textContent='Firma';head.appendChild(h0);
  cols.forEach(function(col){
    var hc=document.createElement('div');hc.className='vt-hc'+(col.isCur?' vt-hc-cur':'');
    /* Hafta numarasının altında o haftanın kapsadığı tarih aralığı (Pzt – Paz) */
    var wEnd=new Date(col.m.getTime());wEnd.setDate(wEnd.getDate()+6);
    hc.innerHTML='<span class="vt-hc-wk">'+col.wn+'. Hafta</span>'
      +'<span class="vt-hc-dates">'+DT.ddmm(col.m)+' – '+DT.ddmm(wEnd)+'</span>';
    head.appendChild(hc);
  });
  wrap.appendChild(head);

  if(!filtered.length){
    var em=document.createElement('div');em.className='vt-empty-msg';em.textContent='Firma bulunamadı.';
    wrap.appendChild(em);container.appendChild(wrap);return;
  }

  filtered.forEach(function(co){
    var row=document.createElement('div');row.className='vt-row';
    row.style.gridTemplateColumns=gridTpl;
    /* Firma */
    var nc=document.createElement('div');nc.className='vt-nc';
    var nm=document.createElement('div');nm.className='vt-name';nm.textContent=co.name;nc.appendChild(nm);
    if(co.lat&&co.lng){
      var tb=document.createElement('button');tb.className='vt-truck';tb.title='2× Truck mail';
      tb.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';
      var tc2=0,tt2;
      tb.addEventListener('click',function(e){e.stopPropagation();tc2++;clearTimeout(tt2);if(tc2>=2){tc2=0;_sendTruck(co);}else tt2=setTimeout(function(){tc2=0;},650);});
      nc.appendChild(tb);
    }
    row.appendChild(nc);
    cols.forEach(function(col){
      var wc=document.createElement('div');wc.className='vt-wc';
      wc.appendChild(_buildCell(co,col,SD.visitEntryFor(vis[co.id+'_'+col.k],viewerCode),co.id+'_'+col.k,opts));
      row.appendChild(wc);
    });
    wrap.appendChild(row);
  });
  container.appendChild(wrap);
}

function _buildCell(co,col,vd,vk,opts){
  var btn=document.createElement('button');btn.className='vc';btn.dataset.visitKey=vk;btn.dataset.companyId=co.id;
  if(!BL.scheduled(co,col.wi)){btn.className='vc vc-dash';btn.disabled=true;btn.innerHTML=_wkBadge(col)+'<span class="vc-dash-line"></span>';return btn;}
  var st=vd?vd.status:'';
  if(st==='done'){
    var cnt=vd.count||1;
    btn.className='vc '+(cnt>1?'vc-multi':'vc-done');
    if(cnt>1){
      btn.innerHTML=_wkBadge(col)
        +'<div class="vc-double"><div class="vc-lock-icon">'+_lockSvg()+'</div><div class="vc-lock-icon vc-lock-2">'+_lockSvg()+'</div></div>'
        +'<span class="vc-d1">'+cnt+'x · '+vd.date+'</span>'
        +'<span class="vc-d2">'+vd.tc+'</span>';
    }else{
      btn.innerHTML=_wkBadge(col)
        +'<div class="vc-lock-icon">'+_lockSvg()+'</div>'
        +'<span class="vc-d1">'+(vd.startTime&&vd.endTime&&vd.startTime!==vd.endTime?(vd.startTime+'–'+vd.endTime):(vd.date+(vd.saat?' '+vd.saat:'')))+'</span>'
        +'<span class="vc-d2">'+vd.tc+'</span>';
    }
    if(opts.editable){
      var _longPressTimer,_longPressActive=false;
      /* Tamamlanmış bir hücreye tıklamak HER ZAMAN yeni bir ziyaret ekler
         (sayaç artar, o günün tarihi dates dizisine eklenir).
         ÖNCEDEN: tek tıklama "pending"e geri alıyordu, yalnızca 500ms içinde
         gelen İKİNCİ tıklama yeni ziyaret sayıyordu. Gerçek kullanıcı iki
         tıklaması arasında neredeyse hiçbir zaman 500ms'den az geçmediği için
         bu pencere kaçırılıyor, ilk tık sessizce ziyareti "beklemede"ye
         düşürüyor, ikinci tık de orijinal tarihi koruyarak sadece "done"a geri
         dönüyordu — aynı hafta içindeki ikinci ziyaretin tarihi hiç
         kaydedilmiyordu (mailde/raporda "son ziyaret" hep ilk tarihte kalıyordu). */
      btn.addEventListener('click',function(){
        if(_longPressActive)return;
        /* Sarı flash */
        btn.style.opacity='.6';btn.style.background='#F59E0B';
        setTimeout(function(){
          btn.style.opacity='';btn.style.background='';
          var vi=SD.visits;
          var myCode=(SD.actingTech(co)||{}).code||'—';
          var cur=SD.visitEntryFor(vi[vk],myCode)||{},n=new Date();
          var dA=(cur.dates||[cur.date||DT.ddmm(n)]).slice();dA.push(DT.ddmm(n));
          vi[vk]=SD.putVisitEntry(vi[vk],myCode,{date:DT.ddmm(n),count:(cur.count||1)+1,dates:dA,saat:DT.hhii(n),status:'done'});
          UI.toast((cur.count||1)+1<=2?'2. ziyaret eklendi!':((cur.count||1)+1)+'. ziyaret eklendi!','success');
          /* Firmayı en alta taşı */
          var allCompanies=SD.companies;var idx=-1;for(var i=0;i<allCompanies.length;i++){if(allCompanies[i].id===co.id){idx=i;break;}}if(idx>0){var item=allCompanies[idx];allCompanies.splice(idx,1);allCompanies.unshift(item);SD.save('sd_co',allCompanies);}
          SD.visits=vi;if(opts.onUpdate)opts.onUpdate(true);
        },200);
      });
      /* Long press silme (4 saniye) */
      btn.addEventListener('mousedown',function(){_startLongPress();});
      btn.addEventListener('touchstart',function(){_startLongPress();});
      btn.addEventListener('mouseup',function(){_endLongPress();});
      btn.addEventListener('touchend',function(){_endLongPress();});
      btn.addEventListener('mouseleave',function(){_endLongPress();});
      function _startLongPress(){
        clearTimeout(_longPressTimer);
        _longPressActive=false;
        var startTime=Date.now();
        var initialBg=btn.style.background;
        var initialOpacity=btn.style.opacity;
        _longPressTimer=setInterval(function(){
          var elapsed=Date.now()-startTime;
          var progress=Math.min(elapsed/1000,1);
          btn.style.opacity=(1-progress*0.5);
          btn.style.background='#EF4444';
          if(progress>=1){
            clearInterval(_longPressTimer);
            _longPressActive=true;
            /* Geçmiş haftalardaki veriyi silmeyi engelle */
            if(!col.isCur){
              btn.style.background='';
              btn.style.opacity='';
              btn.innerHTML=_wkBadge(col)+'<div class="vc-lock-icon">'+_lockSvg()+'</div><span class="vc-d1">'+(vd.startTime&&vd.endTime&&vd.startTime!==vd.endTime?(vd.startTime+'–'+vd.endTime):(vd.date+(vd.saat?' '+vd.saat:'')))+'</span><span class="vc-d2">'+vd.tc+'</span>';
              UI.toast('Geçmiş haftalardaki veriler silinemez!','error');
              _longPressActive=false;
              return;
            }
            btn.style.background='#FECACA';
            btn.innerHTML='<div style="font-size:11px;color:#991B1B;font-weight:700;">Siliniyor...</div>';
            setTimeout(function(){
              var vi=SD.visits;
              /* Yalnızca kendi girişini sil; aynı firmaya giren diğer teknisyenin kaydı kalsın */
              var rest=SD.removeVisitEntry(vi[vk],(SD.actingTech(co)||{}).code||'—');
              if(rest)vi[vk]=rest;else delete vi[vk];
              SD.visits=vi;
              btn.style.opacity='0.3';
              btn.innerHTML='<span class="vc-empty-ring"></span>';
              btn.disabled=true;
              UI.toast('Ziyaret silindi','success');
              if(opts.onUpdate)opts.onUpdate();
            },600);
          }
        },50);
      }
      function _endLongPress(){
        clearInterval(_longPressTimer);
        if(!_longPressActive){
          btn.style.opacity='';
          btn.style.background='';
        }
      }
    }
  }else if(st==='pending'){
    btn.className='vc vc-pending';
    btn.innerHTML=_wkBadge(col)
      +'<div class="vc-pend-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>'
      +'<span class="vc-d1">'+(vd.startTime&&vd.endTime&&vd.startTime!==vd.endTime?(vd.startTime+'–'+vd.endTime):(vd.date+(vd.saat?' '+vd.saat:'')))+'</span>'
      +'<span class="vc-d2">'+vd.tc+'</span>';
    if(opts.editable){
      var _longPressTimer2,_longPressActive2=false;
      btn.addEventListener('click',function(){
        if(_longPressActive2)return; /* Long press yürüyorsa tıklama yok */
        var vi=SD.visits,myCode=(SD.actingTech(co)||{}).code||'—';
        var mine=SD.visitEntryFor(vi[vk],myCode);
        if(mine)vi[vk]=SD.putVisitEntry(vi[vk],myCode,{date:mine.date,saat:mine.saat,count:mine.count||1,status:'done',dates:[mine.date],endDate:DT.ddmmyyyy(new Date()),endTime:DT.hhii(new Date())});
        SD.visits=vi;UI.toast('Onaylandı','success');if(opts.onUpdate)opts.onUpdate();
      });
      /* Long press silme (4 saniye) */
      btn.addEventListener('mousedown',function(){_startLongPress2();});
      btn.addEventListener('touchstart',function(){_startLongPress2();});
      btn.addEventListener('mouseup',function(){_endLongPress2();});
      btn.addEventListener('touchend',function(){_endLongPress2();});
      btn.addEventListener('mouseleave',function(){_endLongPress2();});
      function _startLongPress2(){
        clearTimeout(_longPressTimer2);
        _longPressActive2=false;
        var startTime=Date.now();
        _longPressTimer2=setInterval(function(){
          var elapsed=Date.now()-startTime;
          var progress=Math.min(elapsed/2500,1);
          btn.style.opacity=(1-progress*0.5);
          btn.style.background='#EF4444';
          if(progress>=1){
            clearInterval(_longPressTimer2);
            _longPressActive2=true;
            /* Geçmiş haftalardaki veriyi silmeyi engelle */
            if(!col.isCur){
              btn.style.background='';
              btn.style.opacity='';
              btn.innerHTML=_wkBadge(col)+'<div class="vc-pend-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><span class="vc-d1">'+(vd.startTime&&vd.endTime&&vd.startTime!==vd.endTime?(vd.startTime+'–'+vd.endTime):(vd.date+(vd.saat?' '+vd.saat:'')))+'</span><span class="vc-d2">'+vd.tc+'</span>';
              UI.toast('Geçmiş haftalardaki veriler silinemez!','error');
              _longPressActive2=false;
              return;
            }
            btn.style.background='#FECACA';
            btn.innerHTML='<div style="font-size:11px;color:#991B1B;font-weight:700;">Siliniyor...</div>';
            setTimeout(function(){
              var vi=SD.visits;
              /* Yalnızca kendi girişini sil; aynı firmaya giren diğer teknisyenin kaydı kalsın */
              var rest=SD.removeVisitEntry(vi[vk],(SD.actingTech(co)||{}).code||'—');
              if(rest)vi[vk]=rest;else delete vi[vk];
              SD.visits=vi;
              btn.style.opacity='0.3';
              btn.innerHTML='<span class="vc-empty-ring"></span>';
              btn.disabled=true;
              UI.toast('Ziyaret silindi','success');
              if(opts.onUpdate)opts.onUpdate();
            },600);
          }
        },50);
      }
      function _endLongPress2(){
        clearInterval(_longPressTimer2);
        if(!_longPressActive2){
          btn.style.opacity='';
          btn.style.background='';
        }
      }
    }
  }else if(col.isCur){
    btn.className='vc vc-empty';
    btn.innerHTML=_wkBadge(col)+'<div class="vc-empty-ring"></div><span class="vc-empty-lbl">Ziyaret Et</span>';
    if(opts.editable){
      var _longPressTimer3,_longPressActive3=false;
      btn.addEventListener('click',function(){
        if(_longPressActive3)return; /* Long press yürüyorsa tıklama yok */
        var vi=SD.visits,ac=SD.actingTech(co),n=new Date();
        vi[vk]=SD.putVisitEntry(vi[vk],ac?ac.code:'—',{date:DT.ddmm(n),count:1,status:'pending',saat:DT.hhii(n),startDate:DT.ddmmyyyy(n),startTime:DT.hhii(n)});
        SD.visits=vi;UI.toast('Planlandı','info');if(opts.onUpdate)opts.onUpdate();
      });
      /* Long press silme (4 saniye) - empty state'i silme (zaten boş ama placeholder kaldırabilir) */
      btn.addEventListener('mousedown',function(){_startLongPress3();});
      btn.addEventListener('touchstart',function(){_startLongPress3();});
      btn.addEventListener('mouseup',function(){_endLongPress3();});
      btn.addEventListener('touchend',function(){_endLongPress3();});
      btn.addEventListener('mouseleave',function(){_endLongPress3();});
      function _startLongPress3(){
        clearTimeout(_longPressTimer3);
        _longPressActive3=false;
        var startTime=Date.now();
        _longPressTimer3=setInterval(function(){
          var elapsed=Date.now()-startTime;
          var progress=Math.min(elapsed/2500,1);
          btn.style.opacity=(1-progress*0.5);
          btn.style.background='#EF4444';
          if(progress>=1){
            clearInterval(_longPressTimer3);
            _longPressActive3=true;
            btn.style.background='#FECACA';
            btn.style.color='#991B1B';
            btn.innerHTML='<div style="font-size:11px;font-weight:700;">Boşa çekildi</div>';
            setTimeout(function(){
              btn.style.opacity='0.2';
              btn.style.pointerEvents='none';
              if(opts.onUpdate)opts.onUpdate();
            },600);
          }
        },50);
      }
      function _endLongPress3(){
        clearInterval(_longPressTimer3);
        if(!_longPressActive3){
          btn.style.opacity='';
          btn.style.background='';
          btn.style.color='';
        }
      }
    }
  }else if(col.isPast){
    btn.className='vc vc-miss';
    btn.innerHTML='<div class="vc-miss-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg></div>'
      +'<span class="vc-miss-lbl">Eksik</span>';
    if(opts.editable){
      btn.addEventListener('click',function(){
        var vi=SD.visits,ac=SD.actingTech(co),n=new Date();
        vi[vk]=SD.putVisitEntry(vi[vk],ac?ac.code:'—',{date:DT.ddmm(n),count:1,status:'pending',saat:DT.hhii(n),startDate:DT.ddmmyyyy(n),startTime:DT.hhii(n)});
        SD.visits=vi;UI.toast('Planlandı','info');if(opts.onUpdate)opts.onUpdate();
      });
    }
  }else{
    btn.className='vc vc-future';btn.disabled=true;
    btn.innerHTML=_wkBadge(col)+'<div class="vc-future-ring">'+_lockSvg()+'</div><span class="vc-future-lbl">Planlandı</span><span class="vc-future-lbl-mobile">Sonra</span>';
  }
  return btn;
}

/* Hücre hafta rozeti — mobilde başlık satırı gizli olduğu için tarih rozetin altına iner */
function _wkBadge(col){
  return '<span class="vc-wk">H'+col.wn+'<i class="vc-wk-date">'+DT.ddmm(col.m)+'</i></span>';
}
function _lockSvg(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="3"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';}
/* İki koordinat arası kuş uçuşu mesafe (km) — Haversine formülü. */
function _haversineKm(lat1,lng1,lat2,lng2){
  var R=6371,dLat=(lat2-lat1)*Math.PI/180,dLng=(lng2-lng1)*Math.PI/180;
  var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
/* Mesafeye göre ortalama hız tahmini: kısa mesafede şehir içi trafik yavaş,
   uzun mesafede otoyol ağırlıklı olduğu için ortalama hız yükselir. Sabit
   tek bir hız (ör. 35 km/s) uzun mesafelerde süreyi olduğundan çok uzun
   gösteriyordu (2 saatlik yolu 6 saat gibi). */
function _estimateSpeedKmh(distKm){
  if(distKm<=10)return 28;
  if(distKm<=30)return 42;
  if(distKm<=80)return 62;
  return 82;
}
/* Teknisyenin anlık konumunu tarayıcıdan ister; izin yoksa/zaman aşımında null döner (maili engellemez). */
function _getGeoPosition(timeoutMs){
  return new Promise(function(resolve){
    if(!navigator.geolocation){resolve(null);return;}
    var done=false,timer=setTimeout(function(){if(!done){done=true;resolve(null);}},timeoutMs||8000);
    navigator.geolocation.getCurrentPosition(
      function(pos){if(done)return;done=true;clearTimeout(timer);resolve({lat:pos.coords.latitude,lng:pos.coords.longitude});},
      function(){if(done)return;done=true;clearTimeout(timer);resolve(null);},
      {enableHighAccuracy:true,timeout:timeoutMs||8000,maximumAge:60000}
    );
  });
}
async function _sendTruck(co){
  if(!co.email&&!(co.aMails&&co.aMails.length)){UI.toast('E-posta tanımlı değil.','warning');return;}
  var at=SD.actingTech(co);
  var subject='Teknik Servis Ziyareti - Drama Makine';
  var departureAt=new Date();
  var plannedDate=DT.ddmmyyyy(departureAt);
  var techPhone=at&&at.phone?at.phone:'+90 533 209 25 99';
  var techEmail=at&&at.email?at.email:'';
  var techCode=at?at.code:'-';
  var techName=at?at.name:'Teknisyen';

  /* Tahmini varış saati: teknisyenin anlık konumu ile firmanın kayıtlı
     konumu arasındaki kuş uçuşu mesafeden yola çıkarak hesaplanır (ortalama
     şehir içi hız + %30 rota payı ile). İkisinden biri yoksa hesaplanamaz. */
  var estimatedTime='',estimatedMinutes=0;
  if(co.lat&&co.lng){
    var pos=await _getGeoPosition();
    if(pos){
      var distKm=_haversineKm(pos.lat,pos.lng,co.lat,co.lng);
      estimatedMinutes=Math.max(5,Math.round(distKm/_estimateSpeedKmh(distKm)*60*1.15));
      var arrival=new Date(departureAt.getTime()+estimatedMinutes*60000);
      estimatedTime=String(arrival.getHours()).padStart(2,'0')+':'+String(arrival.getMinutes()).padStart(2,'0');
    }
  }

  /* Mailde yalnızca yola çıkıştan önceki tamamlanmış ziyaret gösterilir. */
  var previousVisit=SD.getPreviousCompletedVisit(co.id,departureAt);
  var lastVisitDate=previousVisit?previousVisit.date:'';

  /* Notları bul: Regular ziyaretler veya program dışı ziyaretler */
  var notes='';
  /* Regular ziyaretlerden not bul */
  var vi=SD.visits;
  Object.keys(vi).forEach(function(k){
    if(k.indexOf(co.id+'_')===0 && vi[k].extraNot){
      notes=vi[k].extraNot;
    }
  });
  /* Program dışı ziyaretlerden not bul - isim eşleşmesi esnek */
  var extras=SD.extras||[];
  extras.forEach(function(ex){
    var nameMatch=ex.firmAdi&&co.name&&(co.name.toUpperCase().indexOf(ex.firmAdi.toUpperCase())>=0||ex.firmAdi.toUpperCase().indexOf(co.name.toUpperCase())>=0);
    if((ex.firmaId===co.id||nameMatch)&&ex.not){
      notes=ex.not;
    }
  });

  var htmlBody=buildTruckServiceMailHTML(co.name,techCode,techName,plannedDate,estimatedTime,estimatedMinutes,techPhone,techEmail,lastVisitDate,notes);

  /* Yola çıkış gününü ve gerçek tıklama saatini kaydet. Pending kayıt mailde
     son ziyaret sayılmaz; tamamlanan geçmiş ziyaretin üzerine yazılmaz. */
  SD.recordDeparture(co,at,departureAt);
  if(typeof renderVisit==='function')setTimeout(function(){renderVisit();},0);

  /* Backend API üzerinden Nodemailer ile gönder — firmaya kayıtlı tüm e-postalara. */
  var cfg=SD.config||{};
  var allEmails=[co.email].concat(co.aMails||[]).filter(function(v,i,a){return v&&a.indexOf(v)===i;});
  fetch('/api/send-test-mail',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      to:allEmails.join(','),
      subject:subject,
      html:htmlBody,
      smtpHost:cfg.smtpHost||'',
      smtpPort:cfg.smtpPort||'',
      smtpUser:cfg.smtpUser||'',
      smtpPass:cfg.smtpPass||'',
      smtpTls:cfg.smtpTls||'tls',
      from:(cfg.smtpSenderName||'Drama Makine')+' <'+(cfg.smtpSenderEmail||cfg.smtpUser||'servis@dramamakine.com')+'>',
      attachmentNames:['drama-makine-logo','icon-phone','icon-mail']
    })
  })
  .then(function(r){return r.json();})
  .then(function(d){
    if(d.success){
      UI.toast('Truck maili gönderildi ✓','success');
    }else{
      UI.toast('Mail gönderme hatası: '+(d.details||d.error||'Bilinmeyen hata'),'error');
    }
  })
  .catch(function(e){
    UI.toast('Mail gönderim hatası: '+e.message,'error');
    console.log('_sendTruck fetch hatası:',e);
  });
}

/* ================================================================
   OTOMATİK MAIL SİSTEMİ
   Her gün akşam 20:00 — ve hafta bitiminde özet rapor
   ================================================================ */
function initAutoMail(){
  var cfg=SD.config;
  /* EmailJS yüklü mü? */
  if(!cfg.emailjsKey||!cfg.emailjsService||!cfg.emailjsTemplate)return;
  try{
    if(typeof emailjs!=='undefined'){
      emailjs.init(cfg.emailjsKey);
    }
  }catch(e){}
  /* Son gönderim kontrolü */
  var lastSent=SD.load('sd_last_mail',null);
  var now=new Date();
  var todayKey=now.toISOString().slice(0,10);
  /* Akşam 20:00'dan sonra — günlük rapor */
  if(now.getHours()>=20&&lastSent!==todayKey){
    sendAutoMail('daily');
    SD.save('sd_last_mail',todayKey);
  }
  /* Cuma veya hafta sonu — haftalık özet */
  var lastWeekly=SD.load('sd_last_weekly',null);
  var cwk=DT.wkey(now);
  if((now.getDay()===5||now.getDay()===6)&&now.getHours()>=18&&lastWeekly!==cwk){
    sendAutoMail('weekly');
    SD.save('sd_last_weekly',cwk);
  }
}

function sendAutoMail(type){
  var cfg=SD.config;
  var to=(cfg.mailAlicilar||[]).join(',');
  if(!to)return;
  var html=type==='weekly'?buildWeeklyReportHTML():buildDailyReportHTML();
  var subject=type==='weekly'
    ?'ServisDrama | Haftalık Özet — '+DT.ddmmyyyy(new Date())
    :(cfg.subjectPrefix||'ServisDrama')+' — '+DT.ddmmyyyy(new Date());
  /* EmailJS ile gönder */
  if(typeof emailjs!=='undefined'&&cfg.emailjsKey){
    try{
      emailjs.send(cfg.emailjsService,cfg.emailjsTemplate,{
        to_email:to,subject:subject,html_content:html
      });
    }catch(e){console.log('EmailJS hatası:',e);}
  }else{
    /* Fallback: mailto */
    window.location.href='mailto:'+encodeURIComponent(to)+'?subject='+encodeURIComponent(subject);
  }
}

/* Günlük rapor HTML */
function buildDailyReportHTML(){
  return _buildReport('daily');
}
/* Haftalık özet HTML */
function buildWeeklyReportHTML(){
  return _buildReport('weekly');
}

function _buildReport(type){
  var cos=SD.companies,vis=SD.visits,ts=SD.technicians,today=new Date();
  var cwk=DT.wkey(today),weeks=DT.monthWeeks(today.getFullYear(),today.getMonth());
  var cwi=weeks.findIndex(function(m){return m.getTime()===DT.monday(today).getTime();})+1;
  var tarih=DT.ddmmyyyy(today),hafta=DT.isoWeek(today);
  var isWeekly=type==='weekly';

  /* Teknisyen bazlı özet */
  var techSections='';
  var grandTotal=0,grandDone=0;

  ts.forEach(function(t){
    var scheduled=cos.filter(function(c){return c.techId===t.id&&BL.scheduled(c,cwi);});
    var done=scheduled.filter(function(c){var v=vis[c.id+'_'+cwk];return v&&v.status==='done';});
    var miss=scheduled.filter(function(c){var v=vis[c.id+'_'+cwk];return!v||v.status!=='done';});
    if(!scheduled.length)return;
    grandTotal+=scheduled.length;grandDone+=done.length;
    var pct=scheduled.length?Math.round(done.length/scheduled.length*100):0;
    var techColor=BL.avatarColor(t.name);
    var doneRows=done.map(function(co){
      var v=vis[co.id+'_'+cwk];
      /* Önceki ziyaret */
      var prevV=null;
      weeks.slice(0,Math.max(0,cwi-1)).forEach(function(wm){var pv=vis[co.id+'_'+DT.wkey(wm)];if(pv&&pv.date)prevV=pv;});
      return '<tr>'
        +'<td style="padding:11px 18px;border-bottom:1px solid #F1F5F9;">'
        +'<div style="display:flex;align-items:center;gap:10px;">'
        +'<div style="width:8px;height:8px;border-radius:50%;background:#10B981;flex-shrink:0;"></div>'
        +'<div><div style="font-size:13px;font-weight:600;color:#1E293B;">'+co.name+'</div>'
        +(prevV?'<div style="font-size:11px;color:#94A3B8;margin-top:1px;">Önceki: '+prevV.date+'</div>':'')
        +'</div></div></td>'
        +'<td style="padding:11px 18px;border-bottom:1px solid #F1F5F9;text-align:center;">'
        +(v&&v.saat?'<span style="background:#DCFCE7;color:#166534;padding:3px 12px;border-radius:99px;font-size:12px;font-weight:700;">'+v.saat+'</span>':'<span style="color:#CBD5E1;font-size:12px;">—</span>')
        +'</td>'
        +'<td style="padding:11px 18px;border-bottom:1px solid #F1F5F9;text-align:center;">'
        +((v&&v.count>1)?'<span style="background:#EFF6FF;color:#2563EB;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700;">'+v.count+'x</span>':'')
        +'</td>'
        +'</tr>';
    }).join('');
    var missRows=miss.map(function(co){
      return '<tr>'
        +'<td colspan="3" style="padding:10px 18px;border-bottom:1px solid #F1F5F9;">'
        +'<div style="display:flex;align-items:center;gap:10px;">'
        +'<div style="width:8px;height:8px;border-radius:50%;background:#EF4444;flex-shrink:0;"></div>'
        +'<span style="font-size:13px;color:#64748B;">'+co.name+'</span>'
        +'</div></td></tr>';
    }).join('');
    techSections+='<div style="margin:0 32px 28px;">'
      /* Tech header */
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">'
      +'<div style="display:flex;align-items:center;gap:12px;">'
      +'<div style="width:44px;height:44px;border-radius:12px;background:'+techColor+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;box-shadow:0 4px 12px rgba(0,0,0,.15);">'+BL.getInitials(t.name)+'</div>'
      +'<div><div style="font-size:15px;font-weight:800;color:#1E293B;letter-spacing:-.01em;">'+t.name+'</div>'
      +'<div style="font-size:12px;color:#64748B;margin-top:1px;">Teknisyen '+t.code+'</div></div></div>'
      +'<div style="text-align:right;">'
      +'<div style="font-size:28px;font-weight:900;color:'+techColor+';letter-spacing:-.03em;">'+pct+'<span style="font-size:16px;font-weight:700;">%</span></div>'
      +'<div style="font-size:12px;color:#94A3B8;">'+done.length+'/'+scheduled.length+'</div>'
      +'</div></div>'
      /* Progress bar */
      +'<div style="height:6px;background:#F1F5F9;border-radius:99px;overflow:hidden;margin-bottom:16px;">'
      +'<div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,'+techColor+','+techColor+'aa);border-radius:99px;"></div></div>'
      /* Tablo */
      +'<div style="border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 1px 4px rgba(0,0,0,.05);">'
      +'<table style="width:100%;border-collapse:collapse;">'
      +'<thead><tr style="background:#F8FAFC;">'
      +'<th style="padding:10px 18px;text-align:left;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.08em;">Firma</th>'
      +'<th style="padding:10px 18px;text-align:center;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.08em;">Saat</th>'
      +'<th style="padding:10px 18px;text-align:center;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.08em;">Ziyaret</th>'
      +'</tr></thead><tbody>'+doneRows+(missRows&&!isWeekly?'<tr><td colspan="3" style="padding:8px 18px;font-size:12px;font-weight:700;color:#EF4444;background:#FEF2F2;">Ziyaret Edilmeyenler</td></tr>'+missRows:'')+'</tbody></table>'
      +'</div></div>';
  });

  var grandPct=grandTotal?Math.round(grandDone/grandTotal*100):0;
  var headerTitle=isWeekly?('Haftalık Özet — '+hafta+'. Hafta'):('Günlük Rapor — '+tarih);
  var headerSub=isWeekly?('Bu haftanın tüm ziyaret özeti'):('Bugünkü saha aktivitesi');

  return'<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>ServisDrama — '+headerTitle+'</title></head>'
    +'<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,\'Inter\',sans-serif;-webkit-font-smoothing:antialiased;">'
    +'<div style="max-width:700px;margin:32px auto;padding:0 16px 40px;">'
    /* TOP CARD */
    +'<div style="background:linear-gradient(135deg,#0F172A 0%,#1E3A8A 60%,#2563EB 100%);border-radius:24px;padding:36px 36px 32px;margin-bottom:0;position:relative;overflow:hidden;">'
    +'<div style="position:absolute;top:-60px;right:-60px;width:240px;height:240px;border-radius:50%;background:rgba(255,255,255,.04);"></div>'
    +'<div style="position:absolute;bottom:-40px;left:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.03);"></div>'
    +'<div style="display:flex;align-items:center;gap:16px;margin-bottom:28px;">'
    +'<img src="'+LOGO_SRC+'" style="height:42px;background:#fff;padding:7px 14px;border-radius:12px;object-fit:contain;">'
    +'<div style="width:1px;height:36px;background:rgba(255,255,255,.15);"></div>'
    +'<div><div style="color:rgba(255,255,255,.55);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;">ServisDrama</div>'
    +'<div style="color:#fff;font-size:20px;font-weight:900;letter-spacing:-.02em;margin-top:2px;">'+headerTitle+'</div>'
    +'<div style="color:rgba(255,255,255,.5);font-size:13px;margin-top:3px;">'+headerSub+'</div>'
    +'</div></div>'
    /* KPI row */
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">'
    +'<div style="background:rgba(255,255,255,.12);border-radius:16px;padding:16px 18px;backdrop-filter:blur(8px);">'
    +'<div style="font-size:30px;font-weight:900;color:#fff;letter-spacing:-.03em;">'+grandDone+'</div>'
    +'<div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:2px;">Tamamlanan</div></div>'
    +'<div style="background:rgba(255,255,255,.12);border-radius:16px;padding:16px 18px;">'
    +'<div style="font-size:30px;font-weight:900;color:#fff;letter-spacing:-.03em;">'+(grandTotal-grandDone)+'</div>'
    +'<div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:2px;">Eksik</div></div>'
    +'<div style="background:rgba(255,255,255,.12);border-radius:16px;padding:16px 18px;">'
    +'<div style="font-size:30px;font-weight:900;color:'+(grandPct>=80?'#4ADE80':'#FCD34D')+';letter-spacing:-.03em;">'+grandPct+'<span style="font-size:18px;font-weight:700;">%</span></div>'
    +'<div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:2px;">Tamamlanma</div></div>'
    +'</div></div>'
    /* CONTENT */
    +'<div style="background:#fff;border-radius:0 0 20px 20px;padding-top:28px;border:1px solid #E2E8F0;border-top:none;box-shadow:0 4px 24px rgba(0,0,0,.07);">'
    +techSections
    +'</div>'
    /* FOOTER */
    +'<div style="text-align:center;padding:20px 0 0;">'
    +'<div style="font-size:12px;color:#94A3B8;">ServisDrama · Drama Makine ve Otomotiv Sanayi Ticaret A.Ş. · '+tarih+'</div>'
    +'<div style="font-size:11px;color:#CBD5E1;margin-top:4px;">Bu e-posta otomatik oluşturulmuştur.</div>'
    +'</div>'
    +'</div></body></html>';
}

var LOGO_SRC='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgNjAiPjx0ZXh0IHk9IjQ1IiBmb250LXNpemU9IjQwIiBmb250LWZhbWlseT0iSW50ZXIsc2Fucy1zZXJpZiIgZm9udC13ZWlnaHQ9IjgwMCIgZmlsbD0iIzIxMjEyMSI+ZHJhbWE8L3RleHQ+PHRleHQgeD0iMTEyIiB5PSI0NSIgZm9udC1zaXplPSI0MCIgZm9udC1mYW1pbHk9IkludGVyLHNhbnMtc2VyaWYiIGZvbnQtd2VpZ2h0PSI4MDAiIGZpbGw9IiMyNTYzRUIiPm1ha2luZTwvdGV4dD48L3N2Zz4=';

/* ════════════════════════════════════════════════════════════
   TEKNIK SERVİS ZİYARETİ MAIL TEMPLATE
   ════════════════════════════════════════════════════════════ */
function buildTruckServiceMailHTML(customerName,technicianCode,technicianName,plannedDate,estimatedTime,estimatedMinutes,technicianPhone,technicianEmail,lastVisitDate,notes,extraNote){
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
  var phoneLink=technicianPhone?technicianPhone.replace(/\D/g,''):'905332092599';
  var displayPhone=technicianPhone||'+90 533 209 25 99';
  var statusText=estimatedTime && estimatedMinutes ? 'Tahmini varış: '+esc(estimatedTime)+' • '+Math.round(estimatedMinutes)+' dk.' : 'Tahmini varış hesaplanıyor...';

  // Firma adı + program dışı NOT
  var firmaDisplay=esc(customerName);
  if(extraNote){firmaDisplay+=' <span style="color:#E74C3C; font-weight:700; font-size:14px;">[NOT: '+esc(extraNote)+']</span>';}

  // Gün hesapla: normal gün + iş günü
  var lastVisitDisplay=lastVisitDate;
  if(lastVisitDate && plannedDate && typeof SD !== 'undefined' && typeof SD.businessDaysBetween === 'function'){
    var bDays=SD.businessDaysBetween(lastVisitDate, plannedDate);
    if(bDays>0){
      lastVisitDisplay+=' • '+bDays+' iş günü önce';
    }
  }

  var lastVisitHtml=lastVisitDate?'<tr><td class="data-label" width="200" style="padding:15px 18px; border-bottom:1px solid #C7D8F2; color:#171717; font-family:Arial, Helvetica, sans-serif; font-size:17px; line-height:23px; font-weight:400;">Son Ziyaret</td><td class="data-value" style="padding:15px 18px; border-bottom:1px solid #C7D8F2; color:#0F245E; font-family:Arial, Helvetica, sans-serif; font-size:17px; line-height:23px; font-weight:700;">'+esc(lastVisitDisplay)+'</td></tr>':'';
  var notesHtml=notes?'<tr><td class="data-label" width="200" style="padding:15px 18px 18px; color:#171717; font-family:Arial, Helvetica, sans-serif; font-size:17px; line-height:23px; font-weight:400;">Notlar</td><td class="data-value" style="padding:15px 18px 18px; color:#0F245E; font-family:Arial, Helvetica, sans-serif; font-size:17px; line-height:23px; font-weight:400;">'+esc(notes)+'</td></tr>':'';

  return '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no"><title>Teknik Servis Ziyareti</title><!--[if mso]><noscript><xml><o:OfficeDocumentSettings xmlns:o="urn:schemas-microsoft-com:office:office"><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]--><style>body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }table { border-collapse: collapse !important; }img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; }a { color: inherit; }.mobile-pad { padding-left: 40px !important; padding-right: 40px !important; }@media only screen and (max-width: 640px) {.email-shell { width: 100% !important; }.mobile-pad { padding-left: 22px !important; padding-right: 22px !important; }.top-logo { width: 148px !important; height: auto !important; }.top-label { font-size: 12px !important; letter-spacing: 1px !important; padding: 10px 12px !important; }.hero-title { font-size: 34px !important; line-height: 40px !important; }.hero-subtitle { font-size: 17px !important; line-height: 25px !important; }.body-copy { font-size: 17px !important; line-height: 29px !important; }.data-label { width: 42% !important; font-size: 15px !important; }.data-value { font-size: 15px !important; }.contact-label { width: 35% !important; font-size: 14px !important; }.contact-value { font-size: 14px !important; }}</style></head><body style="margin:0; padding:0; background-color:#F3F6FA; font-family:Arial, Helvetica, sans-serif; color:#101C3D;"><div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">Planlanan teknik servis ziyaretiniz ve tahmini varış bilgisi.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background-color:#F3F6FA;"><tr><td align="center" style="padding:18px 8px;"><table role="presentation" class="email-shell" width="680" cellspacing="0" cellpadding="0" border="0" style="width:680px; max-width:680px; background-color:#FFFFFF; border:1px solid #E3EAF3;"><tr><td class="mobile-pad" style="padding:24px 40px; background-color:#FFFFFF;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td valign="middle"><img class="top-logo" src="cid:drama-makine-logo" width="165" alt="Drama Makine" style="width:165px; height:auto;"></td><td align="right" valign="middle"><span class="top-label" style="display:inline-block; padding:11px 15px; border:1px solid #0C2D67; color:#0F43B7; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:16px; font-weight:700; letter-spacing:1.3px; white-space:nowrap;">TEKNİK SERVİS BİLDİRİMİ</span></td></tr></table></td></tr><tr><td class="mobile-pad" style="padding:38px 40px 42px; background-color:#062B5A;"><div style="font-family:Arial, Helvetica, sans-serif; color:#27A4FF; font-size:15px; line-height:20px; font-weight:700; letter-spacing:4px;">SERVİSDRAMA</div><h1 class="hero-title" style="margin:20px 0 14px; color:#FFFFFF; font-family:Arial, Helvetica, sans-serif; font-size:43px; line-height:49px; font-weight:700; letter-spacing:-0.7px;">Teknik Servis Ziyareti</h1><p class="hero-subtitle" style="margin:0; color:#FFFFFF; font-family:Arial, Helvetica, sans-serif; font-size:19px; line-height:28px; font-weight:400;">Planlanan ziyaretiniz hakkında bilgilendirme</p></td></tr><tr><td class="mobile-pad" style="padding:34px 40px 0; background-color:#FFFFFF;"><p class="body-copy" style="margin:0 0 18px; color:#161616; font-family:Arial, Helvetica, sans-serif; font-size:19px; line-height:31px; font-weight:400;">Sayın <strong style="font-weight:700;">'+firmaDisplay+',</strong></p><p class="body-copy" style="margin:0; color:#202020; font-family:Arial, Helvetica, sans-serif; font-size:18px; line-height:31px; font-weight:400;">Sizi ve ürünümüzü önemsiyoruz. Sizlere daha iyi hizmet sunabilmek için teknik servis ekibimiz bugün firmanızı ziyaret etmek üzere yola çıkmıştır.</p></td></tr><tr><td class="mobile-pad" style="padding:28px 40px 0; background-color:#FFFFFF;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #AFC8EE; border-left:5px solid #1558E8;"><tr><td class="data-label" width="200" style="padding:18px 18px 15px; border-bottom:1px solid #C7D8F2; color:#171717; font-family:Arial, Helvetica, sans-serif; font-size:17px; line-height:23px; font-weight:400;">Ziyaret Türü</td><td class="data-value" style="padding:18px 18px 15px; border-bottom:1px solid #C7D8F2; color:#0F245E; font-family:Arial, Helvetica, sans-serif; font-size:17px; line-height:23px; font-weight:700;">Teknik Servis Ziyareti</td></tr><tr><td class="data-label" width="200" style="padding:15px 18px; border-bottom:1px solid #C7D8F2; color:#171717; font-family:Arial, Helvetica, sans-serif; font-size:17px; line-height:23px; font-weight:400;">Planlanan Tarih</td><td class="data-value" style="padding:15px 18px; border-bottom:1px solid #C7D8F2; color:#0F245E; font-family:Arial, Helvetica, sans-serif; font-size:17px; line-height:23px; font-weight:700;">'+esc(plannedDate)+'</td></tr><tr><td class="data-label" width="200" style="padding:15px 18px 18px; color:#171717; font-family:Arial, Helvetica, sans-serif; font-size:17px; line-height:23px; font-weight:400;">Durum</td><td class="data-value" style="padding:15px 18px 18px; color:#0AA443; font-family:Arial, Helvetica, sans-serif; font-size:17px; line-height:23px; font-weight:700;">'+esc(statusText)+'</td></tr>'+lastVisitHtml+notesHtml+'</table></td></tr><tr><td class="mobile-pad" style="padding:28px 40px 14px; background-color:#FFFFFF;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="height:1px; background-color:#B7CBE9; font-size:1px; line-height:1px;">&nbsp;</td><td width="275" align="center" style="padding:0 16px; color:#104AC6; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:18px; font-weight:700; letter-spacing:3px; white-space:nowrap;">TEKNİSYEN BİLGİLERİ</td><td style="height:1px; background-color:#B7CBE9; font-size:1px; line-height:1px;">&nbsp;</td></tr></table></td></tr><tr><td class="mobile-pad" style="padding:0 40px 34px; background-color:#FFFFFF;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #AFC8EE;"><tr><td width="92" style="padding:18px 14px 18px 18px; border-bottom:1px solid #C7D8F2;"><table role="presentation" width="64" height="58" cellspacing="0" cellpadding="0" border="0" style="width:64px; height:58px; background-color:#0F4BD8;"><tr><td align="center" valign="middle" style="color:#FFFFFF; font-family:Arial, Helvetica, sans-serif; font-size:21px; line-height:24px; font-weight:700;">'+esc(technicianCode)+'</td></tr></table></td><td style="padding:18px 18px 18px 0; border-bottom:1px solid #C7D8F2;"><div style="color:#0F1937; font-family:Arial, Helvetica, sans-serif; font-size:20px; line-height:26px; font-weight:700;">'+esc(technicianName)+'</div><div style="margin-top:3px; color:#202020; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:22px; font-weight:400;">Teknik Servis</div></td></tr><tr><td valign="middle" width="92" style="padding:8px 14px 8px 18px; border-bottom:1px solid #C7D8F2;"><table role="presentation" width="48" height="48" cellspacing="0" cellpadding="0" border="0" style="width:48px; height:48px; background-color:#EAF1FE; border-radius:50%;"><tr><td align="center" valign="middle" style="border-radius:50%;"><img src="cid:icon-phone" width="22" height="22" alt="Telefon" style="width:22px; height:22px; margin:0 auto; display:block;"></td></tr></table></td><td style="padding:12px 18px 12px 0; border-bottom:1px solid #C7D8F2;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td class="contact-label" width="150" style="color:#1C2436; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:23px; font-weight:400;">Telefon / WhatsApp</td><td class="contact-value" style="color:#0F4BD8; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:23px; font-weight:700; white-space:nowrap;"><a href="https://wa.me/'+phoneLink+'" style="color:#0F4BD8; text-decoration:none;">'+esc(displayPhone)+'</a></td></tr></table></td></tr><tr><td valign="middle" width="92" style="padding:8px 14px 8px 18px;"><table role="presentation" width="48" height="48" cellspacing="0" cellpadding="0" border="0" style="width:48px; height:48px; background-color:#EAF1FE; border-radius:50%;"><tr><td align="center" valign="middle" style="border-radius:50%;"><img src="cid:icon-mail" width="22" height="22" alt="E-posta" style="width:22px; height:22px; margin:0 auto; display:block;"></td></tr></table></td><td style="padding:12px 18px 12px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td class="contact-label" width="150" style="color:#1C2436; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:23px; font-weight:400;">E-posta</td><td class="contact-value" style="color:#0F4BD8; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:23px; font-weight:400; white-space:nowrap;"><a href="mailto:'+esc(technicianEmail)+'" style="color:#0F4BD8; text-decoration:none;">'+esc(technicianEmail)+'</a></td></tr></table></td></tr></table></td></tr><tr><td align="center" style="padding:20px 24px 22px; background-color:#062B5A;"><p style="margin:0 0 8px; color:#FFFFFF; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:20px; font-weight:700;">Drama Makine ve Otomotiv Sanayi Ticaret A.Ş.</p><p style="margin:0 0 4px; color:#B9CBEF; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:19px; font-weight:400;">Bu e-posta otomatik olarak gönderilmiştir.<br>Bu e-posta gizlidir ve yalnızca ilgili kişilerle paylaşılmalıdır.</p><p style="margin:8px 0 0; color:#7C97C9; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:17px; font-weight:400;">© 2026 Drama Makine ve Otomotiv Sanayi Ticaret A.Ş. — Tüm hakları saklıdır.</p></td></tr></table></td></tr></table></body></html>';
}
