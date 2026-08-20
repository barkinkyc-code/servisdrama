/* ═══════════════════════════════════════════════════════════════════
   ServisDrama — Satışçı Paneli v3
   -------------------------------------------------------------------
   Kurgu: satışçı panele girer ve TEK ekranda "kime gidilmedi / kime
   gidildi" sorusunun cevabını görür. Bunun için:
     · Eski Dashboard sekmesi kaldırıldı, Firmalarım'a katlandı — KPI
       kartları ile alttaki liste aynı firmaları iki kez gösteriyordu.
     · Üç ayrı filtre kutusu yerine tek satır sayı-düğmesi (chip) var:
       rakam hem bilgi hem filtre.
     · Firma detayı artık ham alan dökümü değil; admin ve teknisyenin
       gördüğü Firma 360° kartının AYNISI (company-360.js).
   Ziyaret/numune/skor hesapları burada değil, company-360.js'te.
   ═══════════════════════════════════════════════════════════════════ */
const API_HEADERS=()=>({'Content-Type':'application/json','Authorization':'Bearer '+(localStorage.getItem('token')||sessionStorage.getItem('token')||'')});
let currentPage='firmalar';
document.addEventListener('DOMContentLoaded',initializeSalesPanel);

async function initializeSalesPanel(){
  const user=SD.sessionUser();
  if(!user){location.href='index.html';return;}
  if(String(user.role||'').toLowerCase()!=='sales'){location.href='index.html';return;}
  /* remoteReady BURADA BEKLENMELİ: satışçı profili sunucudan gelen sd_st
     listesinden çözülüyor ve panelin yerel bir yedeği yok. Beklenmezse
     sessionSalesRep() liste dolmadan çalışıp null dönüyor, kullanıcı
     "Aktif satışçı profili bulunamadı" uyarısıyla dışarı atılıyordu. */
  try{await SD.remoteReady();const rep=SD.sessionSalesRep();if(!rep||rep.status==='inactive'){alert('Aktif satışçı profili bulunamadı.');doLogout();return;}initializeUI(user);showPage('firmalar');}
  catch(e){console.error(e);alert('Satışçı paneli yüklenemedi: '+e.message);}
}
function initializeUI(user){
  const initials=String(user.name||user.username||'?').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  const avatarColor=typeof BL!=='undefined'&&BL.avatarColor?BL.avatarColor(user.name||user.username||'?'):'#0B5FE8';
  ['navAvatarImg','navDdAvatar'].forEach(id=>{const e=document.getElementById(id);if(e){e.textContent=initials;e.style.background=avatarColor;}});
  ['navUserLabel','navDdName'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=user.name||user.username;});
  document.querySelectorAll('.nav-tab[data-page]').forEach(t=>t.onclick=()=>{showPage(t.dataset.page);closeMobileMenu();});
  const logo=document.getElementById('topbarLogo');if(logo)logo.addEventListener('click',()=>{showPage('firmalar');closeMobileMenu();});
  initMobileMenuControls();
  const sampleModal=document.getElementById('sampleAddModal');if(sampleModal)sampleModal.onclick=e=>{if(e.target===sampleModal)closeSampleAddModal();};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeCompanyDetail();closeSampleAddModal();document.getElementById('navNotifDropdown')?.classList.add('hidden');document.getElementById('navDropdown')?.classList.add('hidden');}});
  document.addEventListener('click',e=>{
    if(!e.target.closest('#navBellMenu'))document.getElementById('navNotifDropdown')?.classList.add('hidden');
    if(!e.target.closest('#navUserMenu'))document.getElementById('navDropdown')?.classList.add('hidden');
  });
  initCompanyControls();
  const pwForm=document.getElementById('passwordForm');if(pwForm)pwForm.addEventListener('submit',submitPasswordChange);
  const sampleBtn=document.getElementById('sampleAddBtn');if(sampleBtn)sampleBtn.addEventListener('click',openSampleAddModal);
  const sampleForm=document.getElementById('sampleAddForm');if(sampleForm)sampleForm.addEventListener('submit',submitSampleAdd);
}
/* Firmalarım ekranının tüm kontrolü iki şeyden ibaret: arama ve sıralama.
   Durum filtresi ayrı bir kutu değil, üstteki sayı düğmeleridir. */
function initCompanyControls(){
  const search=document.getElementById('companySearch');
  if(search)search.addEventListener('input',()=>{salesView.q=search.value.toLocaleLowerCase('tr');renderCompanies();});
  const sort=document.getElementById('salesSortToggle');
  if(sort)sort.addEventListener('click',()=>{salesView.sort=salesView.sort==='aciliyet'?'ad':'aciliyet';renderCompanies();});
}

/* ═══ Veri erişimi — hesaplar company-360.js'te, burada yalnız kısayol ═══ */
function myRep(){return SD.sessionSalesRep();}
function myCompanies(){
  const r=myRep();
  if(!r)return[];
  return SD.companies.filter(c=>{
    if(c.aktif===false)return false; /* pasif firma satışçının iş listesinde yer tutmasın */
    const ids=[c.salesRepId,c.salesRepUserId].filter(Boolean).map(String);
    return ids.includes(String(r.id||''))||ids.includes(String(r.userId||''))||ids.includes(String(r.legacyUserId||''));
  });
}
function companyIdOf(x){return String(x?.firmaId||x?.companyId||'');}
function lastVisit(c){return C360.lastVisit(c);}
function techLabel(v){return C360.techName(v?._tech||v?.tc||v?.techCode||v?.technicianCode||v?.techId);}
function samplesFor(c){return C360.samplesOf(c);}
function openSampleCount(c){return samplesFor(c).filter(C360.sampleOpen).length;}
function skorOf(c){const sd=C360.scoreDetail(c);return sd?sd.score:null;}
function initials(name){return String(name||'?').trim().split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();}

function showPage(name){
  currentPage=name;
  document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
  document.getElementById(name+'Content')?.classList.remove('hidden');
  document.querySelectorAll('.nav-tab[data-page]').forEach(t=>t.classList.toggle('active',t.dataset.page===name));
  ({firmalar:renderCompanies,ziyaretler:renderVisitHistory,numuneler:renderSamples,ayarlar:renderAyarlar}[name]||(()=>{}))();
}

/* ═══ Firmalarım — satışçının tek çalışma ekranı ═══ */
/* Gruplar aksiyona göre: eksikler üstte, gidilenler altta. "Riskli/Kritik/Plan
   dışı" gibi ara etiketler sahada aynı işe çıktığı için tek "Gecikmiş"te
   toplandı — liste okunur kalsın diye. */
const CHIPS=[
  {key:'all'      ,lbl:'Tüm Firmalarım'     ,icon:'🏢',cls:'gray' },
  {key:'gecikmis' ,lbl:'Gecikmiş'           ,icon:'⏰',cls:'red'  },
  {key:'gidilecek',lbl:'Bu Hafta Gidilecek' ,icon:'📅',cls:'blue' },
  {key:'gidildi'  ,lbl:'Bu Hafta Gidildi'   ,icon:'✅',cls:'green'},
  {key:'numune'   ,lbl:'Açık Numune'        ,icon:'🧪',cls:'purple'},
  {key:'talep'    ,lbl:'Ziyaret Talebim'    ,icon:'🔔',cls:'amber'}
];
const DURUM_SIRA={gecikmis:0,gidilecek:1,planinda:2,gidildi:3};
const salesView={key:'all',q:'',sort:'aciliyet'};

function chipMatches(c,key){
  if(key==='all')return true;
  if(key==='numune')return openSampleCount(c)>0;
  if(key==='talep')return !!C360.openRequestOf(c);
  return C360.durum(c).key===key;
}
function setSalesFilter(key){salesView.key=key;renderCompanies();}
/* Firma 360° kartından ziyaret talebi açılıp kapandığında liste ve sayılar
   anında tazelensin (company-360.js bu kancayı çağırır). */
window.onVisitRequestChange=function(){if(currentPage==='firmalar')renderCompanies();};

function renderCompanies(){
  const all=myCompanies(),el=document.getElementById('companiesList'),emp=document.getElementById('companiesEmpty');
  const sub=document.getElementById('companiesSub');

  if(!all.length){
    document.getElementById('salesChips').innerHTML='';
    document.getElementById('salesListTitle').textContent='';
    document.getElementById('salesSortToggle').classList.add('hidden');
    el.innerHTML='';
    emp.classList.remove('hidden');
    emp.textContent='Size atanmış firma bulunmuyor. Lütfen yöneticinizle iletişime geçin.';
    if(sub)sub.textContent='0 firma';
    return;
  }
  document.getElementById('salesSortToggle').classList.remove('hidden');

  /* Sayı düğmeleri: rakam hem özet hem filtre. Böylece ayrı bir KPI şeridi
     ile ayrı bir filtre kutusu satırına gerek kalmıyor. */
  document.getElementById('salesChips').innerHTML=CHIPS.map(ch=>{
    const n=all.filter(c=>chipMatches(c,ch.key)).length;
    return `<button type="button" class="sls-chip c-${ch.cls}${salesView.key===ch.key?' active':''}" onclick="setSalesFilter('${ch.key}')">`
      +`<b>${n}</b><span>${ch.icon} ${escapeHtml(ch.lbl)}</span></button>`;
  }).join('');

  let cs=all.filter(c=>chipMatches(c,salesView.key));
  if(salesView.q)cs=cs.filter(c=>c.name.toLocaleLowerCase('tr').includes(salesView.q));

  if(salesView.sort==='ad')cs.sort((a,b)=>a.name.localeCompare(b.name,'tr'));
  else cs.sort((a,b)=>{
    const da=DURUM_SIRA[C360.durum(a).key]??2,db=DURUM_SIRA[C360.durum(b).key]??2;
    if(da!==db)return da-db;
    return (skorOf(a)??0)-(skorOf(b)??0);           /* düşük skor = önce bakılacak */
  });

  if(sub)sub.textContent='Eksikler üstte. Rakamlara basarak listeyi daraltın, firmaya basarak 360° kartını açın.';
  document.getElementById('salesListTitle').textContent=(salesView.sort==='aciliyet'?'Önce bunlara bakın':'Alfabetik')+' · '+cs.length+' firma';
  document.getElementById('salesSortToggle').textContent=salesView.sort==='aciliyet'?'A-Z sırala':'Aciliyete göre sırala';

  emp.classList.toggle('hidden',cs.length>0);
  emp.textContent=salesView.q?'Aramaya uyan firma bulunamadı.':'Bu grupta firma yok.';

  el.innerHTML=cs.map(c=>{
    const d=C360.durum(c),skor=skorOf(c),sc=C360.scoreClass(skor),req=C360.openRequestOf(c);
    const open=`showCompanyDetail('${escapeHtml(c.id)}')`;
    /* Açık ziyaret talebi satırda görünür: satışçı hangi firmayı istediğini ve
       teknisyenin planlayıp planlamadığını kartı açmadan bilsin. */
    const talep=req
      ? `<span class="co-vr ${req.status}">${req.status==='planned'?'📅 Teknisyen planladı':'🔔 Ziyaret talebi açık'}${req.urgency==='high'?' · ACİL':''}</span>`
      : '';
    return `<div class="co-card" role="button" tabindex="0" onclick="${open}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${open};}">
      <div class="co-icon">${escapeHtml(initials(c.name))}</div>
      <div class="co-body">
        <div class="co-name">${escapeHtml(c.name)}</div>
        <div class="co-meta">${escapeHtml(C360.ozet(c))}${talep}</div>
      </div>
      <div class="co-right">
        <span class="badge badge-${d.cls}">${escapeHtml(d.label)}</span>
        <div class="ops-score ${sc}" title="Firma skoru">${skor==null?'—':skor}</div>
      </div>
    </div>`;
  }).join('');
}

/* ═══ Firma detayı = Firma 360° kartı (admin/teknisyen ile aynı) ═══ */
function showCompanyDetail(id){
  if(!myCompanies().some(c=>String(c.id)===String(id)))return; /* başka satışçının firması açılmasın */
  if(typeof window.openCompany360==='function')openCompany360(id);
}
function closeCompanyDetail(){if(document.getElementById('company360Modal'))UI.closeModal('company360Modal');}

/* ═══ Ziyaret Geçmişi — admin "Raporlar" sayfasıyla aynı dil (banner+KPI+tablo) ═══ */
let visitHistoryQuery='',visitHistoryRowsCache=[],visitHistoryWeekFilter='';
let visitHistorySort={col:'tarih',dir:'desc'};
const VISIT_SORT_COLS=[
  {key:'firma',lbl:'Firma'},
  {key:'sonZiyaret',lbl:'Son Ziyaret'},
  {key:'teknisyen',lbl:'Teknisyen'},
  {key:'tarih',lbl:'Tarih'},
  {key:'tur',lbl:'Tür'},
  {key:'skor',lbl:'Skor'}
];
function visitSortValue(row,col){
  switch(col){
    case'firma':return row._company.name.toLocaleLowerCase('tr');
    case'sonZiyaret':{const lv=lastVisit(row._company);return lv?lv._date.getTime():-1;}
    case'teknisyen':return techLabel(row).toLocaleLowerCase('tr');
    case'tarih':return row._date.getTime();
    case'tur':return row._kind==='extra'?1:0;
    case'skor':return skorOf(row._company)??-1;
    default:return 0;
  }
}
function setVisitSort(col){
  if(visitHistorySort.col===col)visitHistorySort.dir=visitHistorySort.dir==='asc'?'desc':'asc';
  else visitHistorySort={col,dir:col==='firma'||col==='teknisyen'?'asc':'desc'};
  renderVisitHistoryRows();
  updateVisitSortHeaders();
}
function updateVisitSortHeaders(){
  document.querySelectorAll('.wr-table th[data-sort]').forEach(th=>{
    const active=th.dataset.sort===visitHistorySort.col;
    th.classList.toggle('sorted',active);
    const arrow=th.querySelector('.wr-sort-arrow');
    if(arrow)arrow.textContent=active?(visitHistorySort.dir==='asc'?'▲':'▼'):'';
  });
}
function mondayOf(d){return C360.mondayOf(d);}
// "2026-W32" (native <input type="week"> değeri) -> o ISO haftanın Pazartesi'si
function isoWeekToMonday(weekStr){
  const m=/^(\d{4})-W(\d{2})$/.exec(weekStr||'');if(!m)return null;
  const year=Number(m[1]),week=Number(m[2]);
  const jan4Monday=mondayOf(new Date(year,0,4));
  const monday=new Date(jan4Monday);monday.setDate(jan4Monday.getDate()+(week-1)*7);
  return monday;
}
function renderVisitHistory(){
  const rows=[];
  myCompanies().forEach(c=>C360.visitsOf(c).forEach(v=>rows.push({...v,_company:c})));
  rows.sort((a,b)=>b._date-a._date);
  visitHistoryRowsCache=rows;
  const total=rows.length,uniqueCo=new Set(rows.map(r=>r._company.id)).size;
  const normal=rows.filter(r=>r._kind!=='extra').length,extra=rows.filter(r=>r._kind==='extra').length;
  document.getElementById('visitHistory').innerHTML=`
    <div class="wr-top">
      <div class="wr-top-left">
        <div class="wr-kicker">SERVİSDRAMA</div>
        <h2 class="wr-title">Ziyaret Geçmişi</h2>
        <div class="wr-meta">Firmalarınıza yapılan tüm teknik ziyaretler</div>
      </div>
      <div class="wr-top-right"><div class="wr-total-num">${total}</div><div class="wr-total-lbl">Teknik Ziyaret</div></div>
    </div>
    <div class="wr-kpis">
      <div class="wr-kpi blue"><div class="wr-kpi-icon">📋</div><div><small>Toplam Ziyaret</small><b>${total}</b></div></div>
      <div class="wr-kpi green"><div class="wr-kpi-icon">🏢</div><div><small>Ziyaret Edilen Firma</small><b>${uniqueCo}</b></div></div>
      <div class="wr-kpi navy"><div class="wr-kpi-icon">✅</div><div><small>Normal Ziyaret</small><b>${normal}</b></div></div>
      <div class="wr-kpi purple"><div class="wr-kpi-icon">⚡</div><div><small>Program Dışı</small><b>${extra}</b></div></div>
    </div>
    <div class="wr-week-picker">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke-linecap="round"/></svg>
      <label class="form-lbl" for="visitWeekPicker">Hafta Seç</label>
      <input type="week" id="visitWeekPicker" class="inp">
      <button class="btn btn-ghost btn-sm" id="visitWeekClear">Tüm Zamanlar</button>
    </div>
    <div class="search-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5" stroke-linecap="round"/></svg><input id="visitHistorySearch" placeholder="Firma ara..."></div>
    <div class="wr-table">
      <h3>ZİYARET LİSTESİ</h3>
      <div class="wr-table-scroll"><table><thead><tr>${VISIT_SORT_COLS.map(c=>`<th data-sort="${c.key}">${c.lbl}<span class="wr-sort-arrow"></span></th>`).join('')}</tr></thead><tbody id="visitHistoryRows"></tbody></table></div>
    </div>
    <p class="empty-state hidden" id="visitHistoryEmpty">Ziyaret kaydı bulunamadı.</p>
  `;
  const search=document.getElementById('visitHistorySearch');
  if(search)search.addEventListener('input',()=>{visitHistoryQuery=search.value.toLocaleLowerCase('tr');renderVisitHistoryRows();});
  const weekPicker=document.getElementById('visitWeekPicker');
  if(weekPicker)weekPicker.addEventListener('change',()=>{visitHistoryWeekFilter=weekPicker.value;renderVisitHistoryRows();});
  const weekClear=document.getElementById('visitWeekClear');
  if(weekClear)weekClear.addEventListener('click',()=>{visitHistoryWeekFilter='';if(weekPicker)weekPicker.value='';renderVisitHistoryRows();});
  document.querySelectorAll('.wr-table th[data-sort]').forEach(th=>th.addEventListener('click',()=>setVisitSort(th.dataset.sort)));
  updateVisitSortHeaders();
  renderVisitHistoryRows();
}
function renderVisitHistoryRows(){
  let rows=visitHistoryRowsCache.filter(r=>!visitHistoryQuery||r._company.name.toLocaleLowerCase('tr').includes(visitHistoryQuery));
  if(visitHistoryWeekFilter){
    const start=isoWeekToMonday(visitHistoryWeekFilter);
    if(start){const end=new Date(start);end.setDate(start.getDate()+7);rows=rows.filter(r=>r._date>=start&&r._date<end);}
  }
  const dir=visitHistorySort.dir==='asc'?1:-1;
  rows=rows.slice().sort((a,b)=>{
    const va=visitSortValue(a,visitHistorySort.col),vb=visitSortValue(b,visitHistorySort.col);
    if(va<vb)return-1*dir;if(va>vb)return 1*dir;return 0;
  });
  const tbody=document.getElementById('visitHistoryRows'),emp=document.getElementById('visitHistoryEmpty');
  if(!tbody)return;
  if(emp){emp.classList.toggle('hidden',rows.length>0);emp.textContent=visitHistoryWeekFilter?'Bu haftada ziyaret kaydı yok.':'Ziyaret kaydı bulunamadı.';}
  tbody.innerHTML=rows.map(v=>{
    const skor=skorOf(v._company),sc=C360.scoreClass(skor),lv=lastVisit(v._company);
    /* Satıra tıklayınca firmanın 360° kartı açılır. */
    return `<tr class="row-clickable" role="button" tabindex="0" onclick="showCompanyDetail('${escapeHtml(v._company.id)}')" onkeydown="if(event.key==='Enter'){showCompanyDetail('${escapeHtml(v._company.id)}');}"><td>${escapeHtml(v._company.name)}</td><td>${lv?formatDate(lv._date):'—'}</td><td>${escapeHtml(techLabel(v))}</td><td>${formatDate(v._date)}</td><td><span class="wr-badge ${v._kind==='extra'?'off':'ok'}">${v._kind==='extra'?'Program Dışı':'Normal'}</span></td><td><span class="${sc}-txt" style="font-weight:800;">${skor==null?'—':skor}</span></td></tr>`;
  }).join('');
}

/* ═══ Numuneler ═══ */
function sampleOpenLabel(s){return C360.sampleOpen(s)?'<span class="wr-badge off">Bekliyor</span>':'<span class="wr-badge ok">Sonuçlandı</span>';}
function renderSamples(){
  const cs=new Map(myCompanies().map(c=>[String(c.id),c]));
  const rows=(SD.load('sd_samples',[])||[]).filter(s=>cs.has(companyIdOf(s)))
    .sort((a,b)=>(Number(b.ts)||0)-(Number(a.ts)||0));
  const satir=(lbl,val)=>val?`<div class="sample-line"><span>${escapeHtml(lbl)}</span><b>${escapeHtml(val)}</b></div>`:'';
  document.getElementById('samplesList').innerHTML=rows.length?rows.map(s=>{
    const co=cs.get(companyIdOf(s));
    const urun=[].concat(s.urunler||[]).filter(Boolean).join(', ');
    const ekip=[].concat(s.ekipmanlar||[]).filter(Boolean).join(', ');
    return `<div class="sample-card row-clickable" role="button" tabindex="0" onclick="showCompanyDetail('${escapeHtml(String(co?.id||''))}')" onkeydown="if(event.key==='Enter'){showCompanyDetail('${escapeHtml(String(co?.id||''))}');}">`
      +`<div class="sample-head"><h3>${escapeHtml(co?.name||s.firmAdi||'Firma')}</h3>${sampleOpenLabel(s)}</div>`
      +satir('Gönderim',s.tarih)+satir('Analiz Merkezi',s.lab)+satir('Ürün',urun)+satir('Ekipman',ekip)
      +satir('Not',s.not)+satir('Sonuç',s.result)
      +'</div>';
  }).join(''):'<p>Numune kaydı yok.</p>';
}

/* Numune Ekle: satışçı bizzat numune aldığında kayıt oluşturur; backend atanmış teknisyene bildirim düşürür. */
function openSampleAddModal(){
  const sel=document.getElementById('sampleCompany');
  sel.innerHTML=myCompanies().map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
  document.getElementById('sampleTarih').value=new Date().toISOString().slice(0,10);
  document.getElementById('sampleAddMsg').className='pw-msg hidden';
  document.getElementById('sampleAddModal').classList.remove('hidden');
}
function closeSampleAddModal(){document.getElementById('sampleAddModal')?.classList.add('hidden');}
async function submitSampleAdd(e){
  e.preventDefault();
  const msg=document.getElementById('sampleAddMsg');
  const body={
    companyId:document.getElementById('sampleCompany').value,
    lab:document.getElementById('sampleLab').value,
    urunler:document.getElementById('sampleUrunler').value,
    tarih:document.getElementById('sampleTarih').value,
    not:document.getElementById('sampleNot').value
  };
  try{
    const r=await fetch('/api/samples',{method:'POST',headers:API_HEADERS(),body:JSON.stringify(body)});
    const j=await r.json();
    if(!r.ok){msg.textContent=j.error||'Numune eklenemedi';msg.className='pw-msg err';return;}
    msg.textContent='Numune kaydedildi, teknisyene bildirim gönderildi.';msg.className='pw-msg ok';
    await SD.remoteReady({force:true});
    renderSamples();
    setTimeout(()=>{closeSampleAddModal();document.getElementById('sampleAddForm').reset();},1200);
  }catch(err){msg.textContent='Numune eklenemedi: '+err.message;msg.className='pw-msg err';}
}

/* ═══ Ayarlar: profil bilgisi (salt okunur) + kendi şifresini değiştirme ═══ */
function renderAyarlar(){
  const rep=myRep(),user=SD.sessionUser();
  const name=rep?.name||user?.name||'-',inactive=rep?.status==='inactive';
  const avatarColor=typeof BL!=='undefined'&&BL.avatarColor?BL.avatarColor(name):'#0B5FE8';
  const avatar=document.getElementById('ayAvatar');
  if(avatar){avatar.textContent=initials(name);avatar.style.background=avatarColor;}
  const nameEl=document.getElementById('ayName');if(nameEl)nameEl.textContent=name;
  const codeBadge=document.getElementById('ayCodeBadge');if(codeBadge)codeBadge.textContent=rep?.code||'—';
  const statusBadge=document.getElementById('ayStatusBadge');
  if(statusBadge){statusBadge.textContent=inactive?'Pasif':'Aktif';statusBadge.className='badge '+(inactive?'badge-red':'badge-green');}

  const fields=[
    ['Ad Soyad',name],
    ['Satışçı Kodu',rep?.code||'-'],
    ['Kullanıcı Adı',rep?.username||user?.username||'-'],
    ['E-posta',rep?.email||user?.email||'-'],
    ['Telefon',rep?.phone||'-'],
    ['Durum',inactive?'Pasif':'Aktif']
  ];
  document.getElementById('profileGrid').innerHTML=fields.map(([l,v])=>`<div><b>${escapeHtml(l)}</b><span>${escapeHtml(v)}</span></div>`).join('');
}
async function submitPasswordChange(e){
  e.preventDefault();
  const msg=document.getElementById('pwMsg');
  const current=document.getElementById('pwCurrent').value,next=document.getElementById('pwNew').value,confirm=document.getElementById('pwConfirm').value;
  if(next!==confirm){msg.textContent='Yeni şifreler eşleşmiyor';msg.className='pw-msg err';return;}
  try{
    const r=await fetch('/api/auth/change-password',{method:'PUT',headers:API_HEADERS(),body:JSON.stringify({currentPassword:current,newPassword:next})});
    const j=await r.json();
    if(!r.ok){msg.textContent=j.error||'Şifre güncellenemedi';msg.className='pw-msg err';return;}
    msg.textContent='Şifreniz güncellendi.';msg.className='pw-msg ok';
    document.getElementById('passwordForm').reset();
  }catch(err){msg.textContent='Şifre güncellenemedi: '+err.message;msg.className='pw-msg err';}
}

/* Bildirim zili artık notify-bell.js'te: admin ve teknisyen panelleri de
   aynı zili kullanıyor, kod tek yerde duruyor. */


function formatDate(d){if(!d||isNaN(d))return'-';return new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d);}
function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
/* Menü üst panelde; mobilde hamburger üst paneli açıp linkleri alta indirir (admin.js ile aynı desen). */
function setMobileMenu(open){const topbar=document.getElementById('topbar'),nav=document.getElementById('navTabs'),overlay=document.getElementById('mobileOverlay'),button=document.getElementById('mobileMenuBtn');open=!!open;if(topbar)topbar.classList.toggle('nav-open',open);if(nav){nav.classList.toggle('mobile-open',open);nav.setAttribute('aria-hidden',open?'false':'true');}if(overlay)overlay.classList.toggle('show',open);if(button)button.setAttribute('aria-expanded',open?'true':'false');document.body.classList.toggle('menu-open',open);}
function toggleMobileMenu(event){if(event){event.preventDefault();event.stopPropagation();}const topbar=document.getElementById('topbar');setMobileMenu(!(topbar&&topbar.classList.contains('nav-open')));return false;}
function closeMobileMenu(){setMobileMenu(false);}
function initMobileMenuControls(){const button=document.getElementById('mobileMenuBtn'),overlay=document.getElementById('mobileOverlay');if(button){button.setAttribute('aria-expanded','false');button.addEventListener('click',toggleMobileMenu,{passive:false});}if(overlay)overlay.addEventListener('click',e=>{e.preventDefault();closeMobileMenu();});}
function toggleUserMenu(event){if(event)event.stopPropagation();const dd=document.getElementById('navDropdown');if(!dd)return;document.getElementById('navNotifDropdown')?.classList.add('hidden');dd.classList.toggle('hidden');}
function doLogout(){localStorage.removeItem('token');sessionStorage.removeItem('token');localStorage.removeItem('sd_user');sessionStorage.removeItem('sd_user');location.href='index.html';}
window.showPage=showPage;window.setSalesFilter=setSalesFilter;window.showCompanyDetail=showCompanyDetail;window.closeCompanyDetail=closeCompanyDetail;window.toggleUserMenu=toggleUserMenu;window.doLogout=doLogout;
