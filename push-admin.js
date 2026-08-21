/* ═══════════════════════════════════════════════════════════════════
   Push Bildirimleri — admin Ayarlar sekmesi.
   -------------------------------------------------------------------
   admin.js'in renderSettingsTab(tab) fonksiyonu tab başına sabit bir
   if/else zinciridir; içine yeni bir "push" dalı eklemek admin.js'i
   düzenlemek demek. Bunun yerine enhancements.js'in zaten kullandığı
   desenle (window.goto/window.saveFirma SARMALAMA) aynı yol izlenir:
   admin.js'e HİÇ dokunulmadan renderSettingsTab sarmalanır — "push" tab'ı
   burada, başka her şey eskisi gibi orijinal fonksiyona gider.
   ═══════════════════════════════════════════════════════════════════ */
(function(global){
'use strict';

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function token(){return localStorage.getItem('token')||sessionStorage.getItem('token')||'';}
function headers(){return{'Content-Type':'application/json','Authorization':'Bearer '+token()};}
function ico(n,c){return (typeof global.SDIcon==='function')?SDIcon(n,c):'';}

/* utils/webPush.js'teki PUSH_CATEGORY eşlemesiyle AYNI anahtarlar. Yeni bir
   sd_notifications türü eklenip orada kategorilendirilirse buraya da
   eklenmezse kullanıcı o türü aç/kapa edemez (sunucu varsayılana döner). */
var CATS=[
  {key:'visit_request',lbl:'Yeni ziyaret talebi',desc:'Satışçı teknik servis istediğinde ilgili teknisyene gider.'},
  {key:'visit_request_status',lbl:'Talep durumu değişti',desc:'Teknisyen "planladım/tamamladım" dediğinde satışçıya gider.'},
  {key:'sample_taken',lbl:'Numune alındı',desc:'Satışçı numune kaydettiğinde ilgili teknisyene gider.'},
  {key:'visit_overdue',lbl:'Gecikme uyarıları',desc:'Planlı ziyaret gecikti / uzun süredir gidilmedi (günlük otomatik kontrol).'},
  {key:'action',lbl:'Aksiyon hatırlatmaları',desc:'Süresi yaklaşan veya geçen aksiyonlar.'}
];

function renderPushSettings(){
  var content=document.getElementById('settingsContent');
  if(!content)return;
  content.innerHTML='<div class="settings-card"><div class="settings-ttl">'+ico('bell')+'Push Bildirimleri</div>'
    +'<p style="font-size:13px;color:var(--text3);margin-bottom:6px;">Hangi bildirim türlerinin telefona push bildirimi olarak da gönderileceğini seçin. Uygulama-içi bildirim zili bundan etkilenmez, her zaman hepsini gösterir.</p>'
    +'<div class="feat-row"><div><div class="feat-nm">Push Bildirimleri</div><div class="feat-desc">Kapalıyken aşağıdaki hiçbir tür push olarak gönderilmez.</div></div>'
    +'<label class="toggle"><input type="checkbox" id="pushMasterToggle"><span class="toggle-tr"></span></label></div>'
    +CATS.map(function(c){
      return '<div class="feat-row"><div><div class="feat-nm">'+esc(c.lbl)+'</div><div class="feat-desc">'+esc(c.desc)+'</div></div>'
        +'<label class="toggle"><input type="checkbox" class="pushCatToggle" data-cat="'+esc(c.key)+'"><span class="toggle-tr"></span></label></div>';
    }).join('')
    +'<div id="pushSettingsMsg" style="margin-top:10px;font-size:12.5px;color:var(--text3);min-height:16px;"></div></div>';
  loadPrefs();
}

function loadPrefs(){
  fetch('/api/push/prefs',{headers:headers()}).then(function(r){return r.json();}).then(function(j){
    var prefs=j.prefs||{};
    var defOn={};
    (j.categories||[]).forEach(function(c){defOn[c.key]=c.defaultOn;});
    var master=document.getElementById('pushMasterToggle');
    if(master){master.checked=prefs.enabled!==false;master.addEventListener('change',save);}
    document.querySelectorAll('.pushCatToggle').forEach(function(el){
      var k=el.dataset.cat;
      el.checked=Object.prototype.hasOwnProperty.call(prefs,k)?!!prefs[k]:!!defOn[k];
      el.addEventListener('change',save);
    });
  }).catch(function(){
    var msg=document.getElementById('pushSettingsMsg');
    if(msg)msg.textContent='Tercihler yüklenemedi.';
  });
}
function save(){
  var master=document.getElementById('pushMasterToggle');
  var prefs={enabled:!!(master&&master.checked)};
  document.querySelectorAll('.pushCatToggle').forEach(function(el){prefs[el.dataset.cat]=el.checked;});
  var msg=document.getElementById('pushSettingsMsg');
  if(msg)msg.textContent='Kaydediliyor…';
  fetch('/api/push/prefs',{method:'PUT',headers:headers(),body:JSON.stringify({prefs:prefs})})
    .then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j};});})
    .then(function(x){
      if(!msg)return;
      msg.textContent=x.ok?'Kaydedildi.':(x.j.error||'Kaydedilemedi.');
      if(x.ok)setTimeout(function(){msg.textContent='';},1500);
    })
    .catch(function(){if(msg)msg.textContent='Kaydedilemedi.';});
}

function ensureTab(){
  var tabs=document.getElementById('settingsTabs');
  if(!tabs||document.querySelector('#settingsTabs [data-stab="push"]'))return;
  var btn=document.createElement('button');
  btn.className='stab';
  btn.dataset.stab='push';
  btn.innerHTML=ico('bell')+'Push';
  btn.addEventListener('click',function(){
    document.querySelectorAll('#settingsTabs .stab').forEach(function(x){x.classList.remove('active');});
    btn.classList.add('active');
    renderSettingsTab('push');
  });
  tabs.appendChild(btn);
}

function wrapRenderSettingsTab(){
  var old=global.renderSettingsTab;
  if(typeof old!=='function'||old.__pushWrapped)return;
  var wrapped=function(tab){
    if(tab==='push'){renderPushSettings();if(global.A)A.settingsTab='push';return;}
    return old.apply(this,arguments);
  };
  wrapped.__pushWrapped=true;
  global.renderSettingsTab=wrapped;
}

function boot(){
  if(!document.getElementById('settingsTabs'))return; // yalnızca admin.html
  wrapRenderSettingsTab();
  ensureTab();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,400);});
else setTimeout(boot,400);
})(window);
