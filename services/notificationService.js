/* Satışçı bildirim üretimi — Vercel Cron tarafından çağrılır, e-posta varsayılan kapalıdır. */
const { mutateState } = require('../utils/stateStore');
const { getCompanySalesRep } = require('../utils/salesIdentity');
const { sendPushForNotification } = require('../utils/webPush');
function parseDate(v){if(!v)return null;const s=String(v);if(/^\d{2}\.\d{2}\.\d{4}$/.test(s)){const [d,m,y]=s.split('.');return new Date(+y,+m-1,+d);}if(/^\d{2}\.\d{2}$/.test(s)){const [d,m]=s.split('.');let z=new Date(new Date().getFullYear(),+m-1,+d);if(z>Date.now()+864e5)z.setFullYear(z.getFullYear()-1);return z;}const z=new Date(s);return isNaN(z)?null:z;}
function recordDate(r){const ts=Number(r?.ts);return ts>0?new Date(ts):parseDate(r?.date||r?.dayKey);}
function companyIdFromKey(k){return String(k).split(/[|_]/)[0];}
function entries(r){return r?.by&&typeof r.by==='object'?Object.values(r.by):(r?[r]:[]);}
function visitsFor(state,id){const rows=[];Object.entries(state.sd_vi||{}).forEach(([k,r])=>{if(companyIdFromKey(k)===String(id))entries(r).forEach(x=>rows.push(recordDate(x)));});(state.sd_ex||[]).forEach(x=>{if(String(x?.firmaId||x?.companyId||'')===String(id))rows.push(recordDate(x));});return rows.filter(Boolean).sort((a,b)=>b-a);}
function monday(d){const x=new Date(d),n=(x.getDay()+6)%7;x.setDate(x.getDate()-n);x.setHours(0,0,0,0);return x;}
function weekIndex(d){return Math.max(1,Math.min(4,Math.ceil(d.getDate()/7)));}
function scheduled(c,d){const w=Array.isArray(c?.weeks)&&c.weeks.length?c.weeks:[1,2,3,4];return w.includes(weekIndex(d));}
async function checkAndNotify(db,options={}){
  let result={checked:0,created:0,emailed:0};
  const toPush=[]; // push gönderimi transaction KAPANDIKTAN sonra yapılır — ağ çağrısı DB kilidini uzatmasın
  await mutateState(state=>{
    const today=new Date(),start=monday(today),stamp=today.toISOString().slice(0,10);
    state.sd_notifications=Array.isArray(state.sd_notifications)?state.sd_notifications:[];
    const keys=new Set(state.sd_notifications.map(n=>String(n.deduplicationKey||n.id||'')));
    for(const c of (state.sd_co||[])){
      if(c?.aktif===false)continue;
      const rep=getCompanySalesRep(state,c);if(!rep)continue;
      result.checked++;
      const dates=visitsFor(state,c.id),latest=dates[0]||null,visitedWeek=dates.some(d=>d>=start),isScheduled=scheduled(c,today);
      let type='',title='',message='';
      if(isScheduled&&!visitedWeek&&today.getDay()>=5){type='visit_overdue';title='Planlı ziyaret gecikti';message=`${c.name} bu hafta planlıydı ancak ziyaret kaydı bulunmuyor.`;}
      else if(!latest){type='visit_missing';title='Ziyaret kaydı yok';message=`${c.name} için henüz ziyaret kaydı bulunmuyor.`;}
      else{const days=Math.floor((today-latest)/864e5);if(days>90){type='visit_critical';title='Kritik ziyaret gecikmesi';message=`${c.name} firmasına ${days} gündür ziyaret yok.`;}else continue;}
      const key=`${type}:${c.id}:${stamp}`;if(keys.has(key))continue;
      const notif={id:'not_'+Date.now()+'_'+result.created,recipientUserId:String(rep.id),recipientRole:'sales',companyId:String(c.id),type,title,message,createdAt:today.toISOString(),read:false,status:'unread',deduplicationKey:key};
      state.sd_notifications.push(notif);
      toPush.push(notif);
      keys.add(key);result.created++;
    }
  },null);
  if(toPush.length){
    const sent=await Promise.all(toPush.map(n=>sendPushForNotification(n).catch(()=>({sent:0}))));
    result.pushed=sent.reduce((n,x)=>n+(x?.sent||0),0);
  }
  return result;
}
function initNotificationService(){console.log('[NotificationService] Vercel Cron modu aktif; setInterval kullanılmıyor.');}
function stopNotificationService(){}
module.exports={checkAndNotify,initNotificationService,stopNotificationService,_internals:{parseDate,recordDate,visitsFor,scheduled}};
