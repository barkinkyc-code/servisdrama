/* ServisDrama — Satışçı Paneli v2 (salt-okunur teknik veriler + satış aksiyonları) */
const API_HEADERS=()=>({'Content-Type':'application/json','Authorization':'Bearer '+(localStorage.getItem('token')||sessionStorage.getItem('token')||'')});
let currentPage='dashboard';
document.addEventListener('DOMContentLoaded',initializeSalesPanel);

async function initializeSalesPanel(){
  const user=SD.sessionUser();
  if(!user){location.href='index.html';return;}
  if(String(user.role||'').toLowerCase()!=='sales'){location.href='index.html';return;}
  /* remoteReady BURADA BEKLENMELİ: satışçı profili sunucudan gelen sd_st
     listesinden çözülüyor ve panelin yerel bir yedeği yok. Beklenmezse
     sessionSalesRep() liste dolmadan çalışıp null dönüyor, kullanıcı
     "Aktif satışçı profili bulunamadı" uyarısıyla dışarı atılıyordu. */
  try{await SD.remoteReady();const rep=SD.sessionSalesRep();if(!rep||rep.status==='inactive'){alert('Aktif satışçı profili bulunamadı.');doLogout();return;}initializeUI(user);showPage('dashboard');}
  catch(e){console.error(e);alert('Satışçı paneli yüklenemedi: '+e.message);}
}
function initializeUI(user){
  const initials=String(user.name||user.username||'?').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  const avatarColor=typeof BL!=='undefined'&&BL.avatarColor?BL.avatarColor(user.name||user.username||'?'):'#0B5FE8';
  ['navAvatarImg','navDdAvatar'].forEach(id=>{const e=document.getElementById(id);if(e){e.textContent=initials;e.style.background=avatarColor;}});
  ['navUserLabel','navDdName'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=user.name||user.username;});
  document.querySelectorAll('.nav-tab[data-page]').forEach(t=>t.onclick=()=>{showPage(t.dataset.page);closeMobileMenu();});
  const logo=document.getElementById('topbarLogo');if(logo)logo.addEventListener('click',()=>{showPage('dashboard');closeMobileMenu();});
  initMobileMenuControls();
  const modal=document.getElementById('companyDetailModal');if(modal)modal.onclick=e=>{if(e.target===modal)closeCompanyDetail();};
  const sampleModal=document.getElementById('sampleAddModal');if(sampleModal)sampleModal.onclick=e=>{if(e.target===sampleModal)closeSampleAddModal();};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeCompanyDetail();closeSampleAddModal();document.getElementById('navNotifDropdown')?.classList.add('hidden');document.getElementById('navDropdown')?.classList.add('hidden');}});
  document.addEventListener('click',e=>{
    if(!e.target.closest('#navBellMenu'))document.getElementById('navNotifDropdown')?.classList.add('hidden');
    if(!e.target.closest('#navUserMenu'))document.getElementById('navDropdown')?.classList.add('hidden');
  });
  initCompanyFilterControls();
  refreshNotifBadge();
  const pwForm=document.getElementById('passwordForm');if(pwForm)pwForm.addEventListener('submit',submitPasswordChange);
  const sampleBtn=document.getElementById('sampleAddBtn');if(sampleBtn)sampleBtn.addEventListener('click',openSampleAddModal);
  const sampleForm=document.getElementById('sampleAddForm');if(sampleForm)sampleForm.addEventListener('submit',submitSampleAdd);
}
function initCompanyFilterControls(){
  const search=document.getElementById('companySearch'),status=document.getElementById('companyStatusFilter'),
    sortBy=document.getElementById('companySortBy'),openOnly=document.getElementById('companyOpenSampleFilter'),
    clear=document.getElementById('companyFilterClear');
  if(search)search.addEventListener('input',()=>{companyFilter.q=search.value.toLocaleLowerCase('tr');renderCompanies();});
  if(status)status.addEventListener('change',()=>{companyFilter.status=status.value;renderCompanies();});
  if(sortBy)sortBy.addEventListener('change',()=>{companyFilter.sortBy=sortBy.value;renderCompanies();});
  if(openOnly)openOnly.addEventListener('change',()=>{companyFilter.openSampleOnly=openOnly.checked;renderCompanies();});
  if(clear)clear.addEventListener('click',()=>{
    companyFilter.q='';companyFilter.status='';companyFilter.sortBy='name';companyFilter.openSampleOnly=false;
    if(search)search.value='';if(status)status.value='';if(sortBy)sortBy.value='name';if(openOnly)openOnly.checked=false;
    renderCompanies();
  });
}
function myRep(){return SD.sessionSalesRep();}
function myCompanies(){const r=myRep();return r?SD.companies.filter(c=>{const ids=[c.salesRepId,c.salesRepUserId].filter(Boolean).map(String);return ids.includes(String(r.id||''))||ids.includes(String(r.userId||''))||ids.includes(String(r.legacyUserId||''));}):[];}
function companyIdOf(x){return String(x?.firmaId||x?.companyId||'');}
function visitCompanyId(key){return String(key).split(/[|_]/)[0];}
function visitDate(x){const ts=Number(x?.ts);if(ts>0)return new Date(ts);const s=String(x?.date||x?.dayKey||'');if(/^\d{2}\.\d{2}\.\d{4}$/.test(s)){const [d,m,y]=s.split('.');return new Date(+y,+m-1,+d);}if(/^\d{2}\.\d{2}$/.test(s)){const [d,m]=s.split('.');let z=new Date(new Date().getFullYear(),+m-1,+d);if(z>Date.now()+864e5)z.setFullYear(z.getFullYear()-1);return z;}const z=new Date(s);return isNaN(z)?null:z;}
function entries(rec){return rec?.by&&typeof rec.by==='object'?Object.values(rec.by):(rec?[rec]:[]);}
function allVisitsForCompany(id){const out=[];Object.entries(SD.visits||{}).forEach(([k,r])=>{if(visitCompanyId(k)!==String(id))return;entries(r).forEach(v=>out.push({...v,_type:'normal',_date:visitDate(v)}));});(SD.extras||[]).forEach(x=>{if(companyIdOf(x)===String(id))out.push({...x,_type:'extra',_date:visitDate(x)});});return out.filter(x=>x._date).sort((a,b)=>b._date-a._date);}
function lastVisit(c){return allVisitsForCompany(c.id)[0]||null;}
function techLabel(v){const code=String(v?.techCode||v?.technicianCode||v?.tc||'');const t=(SD.technicians||[]).find(x=>String(x.code)===code||String(x.id)===String(v?.techId||''));return t?(t.name+' — '+(t.code||code)):(code||'Bilinmiyor');}
function weekIndex(d=new Date()){return Math.max(1,Math.min(4,Math.ceil(d.getDate()/7)));}
function scheduled(c,d=new Date()){const w=Array.isArray(c.weeks)&&c.weeks.length?c.weeks:[1,2,3,4];return w.includes(weekIndex(d));}
function visitedThisWeek(c){const now=new Date(),start=new Date(now);start.setDate(now.getDate()-((now.getDay()+6)%7));start.setHours(0,0,0,0);return allVisitsForCompany(c.id).some(v=>v._date>=start);}
function daysSince(v){return v?Math.floor((Date.now()-v._date.getTime())/864e5):null;}
function delayStatus(c){const l=lastVisit(c),days=daysSince(l),isPlan=scheduled(c),done=visitedThisWeek(c);if(isPlan&&done)return 'visited';if(isPlan&&!done&&new Date().getDay()>=5)return 'delayed';if(isPlan&&!done)return 'scheduled';if(days===null)return 'critical';if(days>90)return 'critical';if(days>60)return 'risk';return 'ok';}
function samplesFor(c){return (SD.load('sd_samples',[])||[]).filter(s=>companyIdOf(s)===String(c.id));}
function sampleOpen(s){const st=String(s.status||s.durum||s.sonuc||'').toLowerCase();return !/(kapandı|kapandi|iptal|sonuç geldi|sonuc geldi|tamamlandı|tamamlandi)/.test(st);}
function health(c){let score=100,reasons=[];const st=delayStatus(c),l=lastVisit(c),d=daysSince(l);if(st==='delayed'){score-=20;reasons.push('Planlı ziyaret gecikmiş');}if(st==='critical'){score-=35;reasons.push('Uzun süredir ziyaret yok');}else if(st==='risk'){score-=20;reasons.push('Son ziyaret 60 günü geçmiş');}if(d===null){score-=25;reasons.push('Ziyaret kaydı yok');}const open=samplesFor(c).filter(sampleOpen);if(open.length){score-=Math.min(25,open.length*8);reasons.push(open.length+' açık numune');}const recent=allVisitsForCompany(c.id).slice(0,3).map(techLabel);if(new Set(recent).size>=3){score-=10;reasons.push('Son ziyaretlerde teknisyen sürekliliği düşük');}score=Math.max(0,score);return{score,reasons,label:score>=80?'Sağlıklı':score>=60?'Takip':score>=40?'Riskli':'Kritik'};}
function showPage(name){currentPage=name;document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));document.getElementById(name+'Content')?.classList.remove('hidden');document.querySelectorAll('.nav-tab[data-page]').forEach(t=>t.classList.toggle('active',t.dataset.page===name));({dashboard:renderDashboard,firmalar:renderCompanies,ziyaretler:renderVisitHistory,numuneler:renderSamples,ayarlar:renderAyarlar}[name]||(()=>{}))();}
const DELAY_META={visited:{lbl:'Ziyaret Edildi',c:'green'},delayed:{lbl:'Gecikti',c:'red'},scheduled:{lbl:'Bu Hafta Planlı',c:'blue'},critical:{lbl:'Kritik',c:'red'},risk:{lbl:'Riskli',c:'amber'},ok:{lbl:'Normal',c:'green'}};
function initials(name){return String(name||'?').trim().split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();}
function miniCompanyRow(c){const l=lastVisit(c),st=delayStatus(c),meta=DELAY_META[st]||DELAY_META.ok;return `<div class="mini-row" onclick="showCompanyDetail('${escapeHtml(c.id)}')"><div class="mini-avatar">${escapeHtml(initials(c.name))}</div><div class="mini-info"><div class="mini-name">${escapeHtml(c.name)}</div><div class="mini-sub">${l?('Son ziyaret: '+formatDate(l._date)+' · '+escapeHtml(techLabel(l))):'Ziyaret kaydı yok'}</div></div><span class="badge badge-${meta.c}">${meta.lbl}</span></div>`;}
function renderDashboard(){
  const cs=myCompanies();
  const ss=(SD.load('sd_samples',[])||[]).filter(s=>cs.some(c=>String(c.id)===companyIdOf(s)));
  const planned=cs.filter(c=>scheduled(c)),visitedNow=cs.filter(c=>visitedThisWeek(c)),delayed=cs.filter(c=>delayStatus(c)==='delayed'),critical=cs.filter(c=>delayStatus(c)==='critical'),stale=cs.filter(c=>(daysSince(lastVisit(c))||0)>30),openSamples=ss.filter(sampleOpen),risky=cs.filter(c=>health(c).score<60);
  /* Sadeleştirildi: 8 kart göz yoruyor ve hangisinin aksiyon gerektirdiği
     kayboluyordu. Dört karta indirildi — biri bağlam (toplam), biri plan,
     biri AKSİYON (geciken+kritik tek sayıda, kırılımı alt satırda), biri
     takip. Kaldırılan kartların bilgisi kayıp değil: "Bu Hafta Ziyaret"
     zaten plan kartının altında, "30+ gün" ve "riskli firma" ise Dikkat
     kartıyla örtüşüyordu. Kartlar artık ilgili sayfaya götürüyor. */
  const dikkat=[...delayed,...critical].filter((c,i,a)=>a.findIndex(x=>x.id===c.id)===i);
  const kpis=[
    {icon:'🏢',lbl:'Firmalarım',val:cs.length,sub:'size atanmış',bg:'#EFF6FF',c:'#2563EB',go:"showPage('firmalar')"},
    {icon:'📅',lbl:'Bu Hafta Planlı',val:planned.length,sub:visitedNow.length+' tamamlandı',bg:'#EEF2FF',c:'#4F46E5',go:"showPage('firmalar')"},
    {icon:'⏰',lbl:'Dikkat Gerekiyor',val:dikkat.length,sub:delayed.length+' geciken · '+critical.length+' kritik',bg:'#FEF3C7',c:'#D97706',go:"showPage('firmalar')"},
    {icon:'🧪',lbl:'Açık Numune',val:openSamples.length,sub:'analiz bekliyor',bg:'#F5F3FF',c:'#7C3AED',go:"showPage('numuneler')"}
  ];
  document.getElementById('dashboardStats').innerHTML=`<div class="kpi-row">${kpis.map(k=>`<div class="kpi-card kpi-clickable" role="button" tabindex="0" onclick="${k.go}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${k.go};}"><div class="kpi-icon" style="background:${k.bg};color:${k.c};">${k.icon}</div><div class="kpi-val" style="color:${k.c};">${k.val}</div><div class="kpi-lbl">${k.lbl}</div><div class="kpi-sub">${k.sub}</div></div>`).join('')}</div>`;

  const soon=cs.filter(c=>scheduled(c)&&!visitedThisWeek(c)).sort((a,b)=>(daysSince(lastVisit(a))||999)-(daysSince(lastVisit(b))||999));
  document.getElementById('dashboardUpcoming').innerHTML=`<h3 class="dash-sec-title">Bu Hafta Gidilecek Firmalar</h3>`+(soon.length?`<div class="mini-list">${soon.map(miniCompanyRow).join('')}</div>`:'<div class="empty-msg">Bu hafta beklenen ziyaret yok.</div>');

  const overdue=[...delayed,...critical].filter((c,i,arr)=>arr.findIndex(x=>x.id===c.id)===i).sort((a,b)=>(daysSince(lastVisit(b))||999)-(daysSince(lastVisit(a))||999));
  document.getElementById('dashboardOverdue').innerHTML=`<h3 class="dash-sec-title">Geciken Firmalar</h3>`+(overdue.length?`<div class="mini-list">${overdue.map(miniCompanyRow).join('')}</div>`:'<div class="empty-msg">Geciken firmanız yok.</div>');
}
const HEALTH_COLOR={'Sağlıklı':'green','Takip':'blue','Riskli':'amber','Kritik':'red'};
const companyFilter={q:'',status:'',sortBy:'name',openSampleOnly:false};
function applyCompanyFilters(cs){
  let out=cs.filter(c=>{
    if(companyFilter.q&&!c.name.toLocaleLowerCase('tr').includes(companyFilter.q))return false;
    if(companyFilter.status&&delayStatus(c)!==companyFilter.status)return false;
    if(companyFilter.openSampleOnly&&!samplesFor(c).some(sampleOpen))return false;
    return true;
  });
  if(companyFilter.sortBy==='lastVisit')out.sort((a,b)=>(daysSince(lastVisit(b))??999)-(daysSince(lastVisit(a))??999));
  else if(companyFilter.sortBy==='health')out.sort((a,b)=>health(a).score-health(b).score);
  else out.sort((a,b)=>a.name.localeCompare(b.name,'tr'));
  return out;
}
function renderCompanies(){
  const el=document.getElementById('companiesList'),all=myCompanies();
  const sub=document.getElementById('companiesSub');
  if(!all.length){el.innerHTML='';document.getElementById('companiesEmpty').classList.remove('hidden');document.getElementById('companiesEmpty').textContent='Size atanmış firma bulunmuyor. Lütfen yöneticinizle iletişime geçin.';if(sub)sub.textContent='0 firma';return;}
  const cs=applyCompanyFilters(all);
  if(sub)sub.textContent=`${cs.length} / ${all.length} firma`;
  const emp=document.getElementById('companiesEmpty');
  emp.classList.toggle('hidden',cs.length>0);
  emp.textContent='Filtreye uyan firma bulunamadı.';
  el.innerHTML=cs.map(c=>{
    const l=lastVisit(c),h=health(c),st=delayStatus(c),dm=DELAY_META[st]||DELAY_META.ok,openS=samplesFor(c).filter(sampleOpen).length,hc=HEALTH_COLOR[h.label]||'blue';
    return `<div class="co-card" onclick="showCompanyDetail('${escapeHtml(c.id)}')">
      <div class="co-icon">${escapeHtml(initials(c.name))}</div>
      <div class="co-body">
        <div class="co-name">${escapeHtml(c.name)}</div>
        <div class="co-meta">
          <span>📍 ${escapeHtml(c.bolge||'Bölge yok')}</span>
          <span>${l?('Son ziyaret: '+formatDate(l._date)+' · '+escapeHtml(techLabel(l))):'Ziyaret kaydı yok'}</span>
          <span>🧪 ${openS} açık numune</span>
        </div>
      </div>
      <div class="co-right">
        <span class="badge badge-${dm.c}">${dm.lbl}</span>
        <div class="health-row-inline">
          <div class="health-bar"><div class="health-bar-fill health-${hc}" style="width:${h.score}%"></div></div>
          <span class="health-label health-text-${hc}">${h.score}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}
/* Ziyaret Geçmişi: admin "Raporlar" sayfasındaki .wr-* rapor görünümüyle aynı dil (banner+KPI+tablo). */
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
    case'tur':return row._type==='extra'?1:0;
    case'skor':return health(row._company).score;
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
function mondayOf(d){const x=new Date(d);x.setDate(x.getDate()-((x.getDay()+6)%7));x.setHours(0,0,0,0);return x;}
function weekRange(offset){const start=mondayOf(new Date());start.setDate(start.getDate()+offset*7);const end=new Date(start);end.setDate(start.getDate()+7);return{start,end};}
function shortDate(d){return new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'2-digit'}).format(d);}
// "2026-W32" (native <input type="week"> değeri) -> o ISO haftanın Pazartesi'si
function isoWeekToMonday(weekStr){
  const m=/^(\d{4})-W(\d{2})$/.exec(weekStr||'');if(!m)return null;
  const year=Number(m[1]),week=Number(m[2]);
  const jan4Monday=mondayOf(new Date(year,0,4));
  const monday=new Date(jan4Monday);monday.setDate(jan4Monday.getDate()+(week-1)*7);
  return monday;
}
function isoWeekOf(d){
  const x=mondayOf(d);const jan4Monday=mondayOf(new Date(x.getFullYear(),0,4));
  let week=Math.round((x-jan4Monday)/6048e5)+1,year=x.getFullYear();
  if(week<1){year--;week=Math.round((x-mondayOf(new Date(year,0,4)))/6048e5)+1;}
  return year+'-W'+String(week).padStart(2,'0');
}
function renderVisitHistory(){
  const rows=[];
  myCompanies().forEach(c=>allVisitsForCompany(c.id).forEach(v=>rows.push({...v,_company:c})));
  rows.sort((a,b)=>b._date-a._date);
  visitHistoryRowsCache=rows;
  const total=rows.length,uniqueCo=new Set(rows.map(r=>r._company.id)).size;
  const normal=rows.filter(r=>r._type!=='extra').length,extra=rows.filter(r=>r._type==='extra').length;
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
    const h=health(v._company),hc=HEALTH_COLOR[h.label]||'blue',lv=lastVisit(v._company);
    /* Satıra tıklayınca firma detayı açılır. */
    return `<tr class="row-clickable" role="button" tabindex="0" onclick="showCompanyDetail('${escapeHtml(v._company.id)}')" onkeydown="if(event.key==='Enter'){showCompanyDetail('${escapeHtml(v._company.id)}');}"><td>${escapeHtml(v._company.name)}</td><td>${lv?formatDate(lv._date):'—'}</td><td>${escapeHtml(techLabel(v))}</td><td>${formatDate(v._date)}</td><td><span class="wr-badge ${v._type==='extra'?'off':'ok'}">${v._type==='extra'?'Program Dışı':'Normal'}</span></td><td><span class="health-text-${hc}" style="font-weight:800;">${h.score}</span></td></tr>`;
  }).join('');
}
function visitDetails(v){const skip=new Set(['by','ts','date','dayKey','saat','time','tc','techCode','technicianCode','techId','firmaId','companyId','_type','_date','id']);const parts=Object.entries(v).filter(([k,val])=>!skip.has(k)&&val!==''&&val!=null&&typeof val!=='object').slice(0,20).map(([k,val])=>`<div><b>${escapeHtml(k)}:</b> ${escapeHtml(String(val))}</div>`);return parts.length?`<div class="visit-notes">${parts.join('')}</div>`:'';}
/* Eskiden kaydın TÜM alanları ham anahtar adlarıyla basılıyordu (firmaId, ts,
   reminderSent...) — okunmayan gürültüydü. Artık yalnızca anlamlı alanlar
   gösteriliyor ve kart firma detayına götürüyor. */
function sampleOpenLabel(s){return sampleOpen(s)?'<span class="wr-badge off">Bekliyor</span>':'<span class="wr-badge ok">Sonuçlandı</span>';}
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

/* Ayarlar: profil bilgisi (salt okunur) + kendi şifresini değiştirme. */
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

/* Bildirimler: sağ üstte zil ikonu + açılır liste (ayrı sayfa yok). */
async function refreshNotifBadge(){
  try{
    const r=await fetch('/api/notifications/unread/count',{headers:API_HEADERS()});
    if(!r.ok)return;
    const j=await r.json(),badge=document.getElementById('navBellBadge');
    if(!badge)return;
    const n=j.unread_count||0;
    badge.textContent=n>9?'9+':String(n);
    badge.classList.toggle('hidden',n===0);
  }catch(e){}
}
async function loadNotifDropdown(){
  const list=document.getElementById('navNotifList');
  if(!list)return;
  list.innerHTML='<div class="nav-notif-empty">Yükleniyor...</div>';
  try{
    const r=await fetch('/api/notifications',{headers:API_HEADERS()});
    const j=await r.json();
    const items=(j.notifications||[]).slice(0,15);
    list.innerHTML=items.length?items.map(n=>`<div class="nav-notif-item ${n.read||n.readAt?'':'unread'}" onclick="readNotification('${n.id}')"><b>${escapeHtml(n.title||'Bildirim')}</b><div>${escapeHtml(n.message||'')}</div><small>${escapeHtml(formatDate(new Date(n.createdAt)))}</small></div>`).join(''):'<div class="nav-notif-empty">Bildiriminiz yok.</div>';
  }catch(e){list.innerHTML='<div class="nav-notif-empty">Bildirimler yüklenemedi.</div>';}
}
function toggleNotifBell(event){
  if(event)event.stopPropagation();
  const dd=document.getElementById('navNotifDropdown');
  if(!dd)return;
  const opening=dd.classList.contains('hidden');
  document.getElementById('navDropdown')?.classList.add('hidden');
  dd.classList.toggle('hidden');
  if(opening)loadNotifDropdown();
}
async function readNotification(id){await fetch('/api/notifications/'+encodeURIComponent(id)+'/read',{method:'PUT',headers:API_HEADERS()});await loadNotifDropdown();await refreshNotifBadge();}
function showCompanyDetail(id){const c=myCompanies().find(x=>String(x.id)===String(id));if(!c)return;const visits=allVisitsForCompany(c.id),h=health(c),samples=samplesFor(c);document.getElementById('companyDetailTitle').textContent=c.name;document.getElementById('companyDetailBody').innerHTML=`<div class="detail-grid"><div><b>Bölge</b><span>${escapeHtml(c.bolge||'-')}</span></div><div><b>Ziyaret Periyodu</b><span>${escapeHtml((c.weeks||[]).join(', ')||'-')}</span></div><div><b>Atanmış Teknik Servis</b><span>${escapeHtml((SD.technicians||[]).find(t=>String(t.id)===String(c.techId))?.name||c.techId||'-')}</span></div><div><b>Son Giden</b><span>${escapeHtml(visits[0]?techLabel(visits[0]):'-')}</span></div><div><b>Sağlık Skoru</b><span>${h.score} · ${h.label}</span></div><div><b>Açık Numune</b><span>${samples.filter(sampleOpen).length}</span></div></div><h3>Skor Nedenleri</h3><p>${h.reasons.length?h.reasons.map(escapeHtml).join(' · '):'Olumsuz kayıt yok'}</p><h3>Ziyaretler</h3>${visits.length?visits.map(v=>`<div class="visit-entry"><b>${formatDate(v._date)} · ${v._type==='extra'?'Program Dışı':'Normal'}</b><div>${escapeHtml(techLabel(v))}</div>${visitDetails(v)}</div>`).join(''):'<p>Kayıt yok</p>'}<h3>Numuneler</h3>${samples.length?samples.map(s=>`<div class="sample-card">${Object.entries(s).filter(([k,v])=>v!==''&&v!=null&&typeof v!=='object').map(([k,v])=>`<div><b>${escapeHtml(k)}:</b> ${escapeHtml(String(v))}</div>`).join('')}</div>`).join(''):'<p>Kayıt yok</p>'}`;document.getElementById('companyDetailModal').classList.remove('hidden');}
function closeCompanyDetail(){document.getElementById('companyDetailModal')?.classList.add('hidden');}
function formatDate(d){if(!d||isNaN(d))return'-';return new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d);}
function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
/* Menü üst panelde; mobilde hamburger üst paneli açıp linkleri alta indirir (admin.js ile aynı desen). */
function setMobileMenu(open){const topbar=document.getElementById('topbar'),nav=document.getElementById('navTabs'),overlay=document.getElementById('mobileOverlay'),button=document.getElementById('mobileMenuBtn');open=!!open;if(topbar)topbar.classList.toggle('nav-open',open);if(nav){nav.classList.toggle('mobile-open',open);nav.setAttribute('aria-hidden',open?'false':'true');}if(overlay)overlay.classList.toggle('show',open);if(button)button.setAttribute('aria-expanded',open?'true':'false');document.body.classList.toggle('menu-open',open);}
function toggleMobileMenu(event){if(event){event.preventDefault();event.stopPropagation();}const topbar=document.getElementById('topbar');setMobileMenu(!(topbar&&topbar.classList.contains('nav-open')));return false;}
function closeMobileMenu(){setMobileMenu(false);}
function initMobileMenuControls(){const button=document.getElementById('mobileMenuBtn'),overlay=document.getElementById('mobileOverlay');if(button){button.setAttribute('aria-expanded','false');button.addEventListener('click',toggleMobileMenu,{passive:false});}if(overlay)overlay.addEventListener('click',e=>{e.preventDefault();closeMobileMenu();});}
function toggleUserMenu(event){if(event)event.stopPropagation();const dd=document.getElementById('navDropdown');if(!dd)return;document.getElementById('navNotifDropdown')?.classList.add('hidden');dd.classList.toggle('hidden');}
function doLogout(){localStorage.removeItem('token');sessionStorage.removeItem('token');localStorage.removeItem('sd_user');sessionStorage.removeItem('sd_user');location.href='index.html';}
window.showPage=showPage;window.showCompanyDetail=showCompanyDetail;window.closeCompanyDetail=closeCompanyDetail;window.readNotification=readNotification;window.toggleNotifBell=toggleNotifBell;window.toggleUserMenu=toggleUserMenu;window.doLogout=doLogout;
