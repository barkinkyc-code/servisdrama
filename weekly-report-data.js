/* ServisDrama — Haftalık rapor veri toplayıcı.
   SD.visits/SD.extras üzerinden verilen [start,end] aralığındaki tamamlanmış
   ziyaretleri toplar, plan durumunu (Plana Uygun/Program Dışı/Plan Dışı)
   belirler, firma skorunu hesaplar ve bir önceki eş uzunluktaki dönemle
   karşılaştırma (trend) üretir. */
(function(global){
  'use strict';

  function parseDate(v,weekKey){
    if(v instanceof Date)return isNaN(v.getTime())?null:v;
    var s=String(v||'');
    var m=s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if(m)return new Date(+m[3],+m[2]-1,+m[1]);
    m=s.match(/^(\d{2})\.(\d{2})$/);
    if(m){
      var year=Number((String(weekKey).match(/(20\d{2})/)||[])[1]);
      if(!year)return null;
      return new Date(year,+m[2]-1,+m[1]);
    }
    m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m)return new Date(+m[1],+m[2]-1,+m[3]);
    var d=new Date(s);
    return isNaN(d.getTime())?null:d;
  }
  function entries(rec){
    if(!rec)return{};
    if(rec.by&&typeof rec.by==='object')return rec.by;
    if(rec.tc){var o={};o[rec.tc]=rec;return o;}
    return{};
  }
  function visitCompanyId(key){return String(key).split('_')[0];}
  function visitWeekKey(key){return String(key).split('_')[1];}

  function allDoneVisits(ctx,companyId){
    var out=[];
    Object.keys(ctx.visits).forEach(function(key){
      if(visitCompanyId(key)!==String(companyId))return;
      var wk=visitWeekKey(key),es=entries(ctx.visits[key]);
      Object.keys(es).forEach(function(code){
        var e=es[code];
        if(!e||e.status!=='done')return;
        var d=parseDate(e.date,wk);
        if(d)out.push({d:d,v:e});
      });
    });
    (ctx.extras||[]).forEach(function(e){
      if(String(e.firmaId||'')!==String(companyId))return;
      var d=parseDate(e.date,e.wk);
      if(d)out.push({d:d,v:e});
    });
    out.sort(function(a,b){return b.d-a.d;});
    return out;
  }
  function lastVisitBefore(ctx,companyId,current){
    var list=allDoneVisits(ctx,companyId);
    for(var i=0;i<list.length;i++){if(list[i].d<current)return list[i].d;}
    return null;
  }
  function samplesFor(ctx,companyId){
    return (ctx.samples||[]).filter(function(s){return String(s.firmaId||s.companyId||'')===String(companyId);});
  }
  function sampleOpen(s){
    return !/(kapandı|kapandi|iptal|sonuç geldi|sonuc geldi|tamamlandı|tamamlandi)/i.test(String(s.status||s.durum||s.sonuc||''));
  }
  /* Firma skoru — "şu an ne kadar gecikmiş" anlık bakışı yerine, firmanın İLK
     ziyaretinden bu rapor dönemine kadar geçen TÜM haftaların ortalama uyum
     oranını kullanır: ilk ziyaretten itibaren firmanın kendi planına göre
     (BL.scheduled) beklenen her hafta için, o hafta gerçekten ziyaret edilmiş
     mi diye bakılır. Skor = karşılanan hafta / beklenen hafta × 100.
     Bu, tek bir gecikme anını değil, firmanın GEÇMİŞTEKİ genel düzenini yansıtır.
     - Hiç ziyaret edilmemiş firma (ilk ziyaret yok) → sabit düşük taban puan.
     - Açık numune ve teknisyen sürekliliği ek düzeltme olarak eklenir. */
  function scoreCompany(ctx,company,reportEnd){
    if(!company)return null;
    var visits=allDoneVisits(ctx,company.id).filter(function(x){return x.d<=reportEnd;});
    if(!visits.length)return 15;
    var firstVisit=visits[visits.length-1].d;

    var expectedWeeks=0,metWeeks=0;
    var cursor=ctx.DT.monday(firstVisit),endMonday=ctx.DT.monday(reportEnd);
    while(cursor<=endMonday){
      var wi=weekIndexOf(ctx,cursor);
      if(ctx.BL.scheduled(company,wi)){
        expectedWeeks++;
        var weekEnd=new Date(cursor);weekEnd.setDate(weekEnd.getDate()+6);weekEnd.setHours(23,59,59,999);
        var metThisWeek=visits.some(function(x){return x.d>=cursor&&x.d<=weekEnd;});
        if(metThisWeek)metWeeks++;
      }
      cursor=new Date(cursor);cursor.setDate(cursor.getDate()+7);
    }
    var score=expectedWeeks?Math.round(metWeeks/expectedWeeks*100):100;

    var open=samplesFor(ctx,company.id).filter(sampleOpen).length;
    if(open)score-=Math.min(20,open*7);
    var recent=visits.slice(0,4).map(function(x){return String(x.v.tc||x.v.techCode||x.v.techId||'');}).filter(Boolean);
    if(recent.length>=3&&new Set(recent).size>=3)score-=8;
    return Math.max(0,Math.min(100,Math.round(score)));
  }
  function grade(score){
    if(score==null)return{g:'-',label:'Kayıt yok',color:'#94A3B8'};
    if(score>=90)return{g:'A+',label:'Mükemmel',color:'#16A34A'};
    if(score>=80)return{g:'A',label:'Sağlıklı',color:'#46A758'};
    if(score>=70)return{g:'B+',label:'İyi',color:'#EAB308'};
    if(score>=60)return{g:'B',label:'Takip',color:'#F58220'};
    if(score>=40)return{g:'C',label:'Riskli',color:'#EA580C'};
    return{g:'D',label:'Kritik',color:'#DC2626'};
  }

  function weekIndexOf(ctx,date){
    var monday=ctx.DT.monday(date),weeks=ctx.DT.monthWeeks(date.getFullYear(),date.getMonth());
    var idx=weeks.findIndex(function(w){return w.getTime()===monday.getTime();})+1;
    return idx<1?1:idx;
  }

  function collectWeeklyData(startDate,endDate,ctxIn){
    var ctx={
      SD:(ctxIn&&ctxIn.SD)||SD,DT:(ctxIn&&ctxIn.DT)||DT,BL:(ctxIn&&ctxIn.BL)||BL
    };
    ctx.companies=ctx.SD.companies||[];
    ctx.technicians=ctx.SD.technicians||[];
    ctx.visits=ctx.SD.visits||{};
    ctx.extras=ctx.SD.extras||[];
    ctx.samples=(ctx.SD.load?ctx.SD.load('sd_samples',[]):[])||[];

    var rangeStart=new Date(startDate);rangeStart.setHours(0,0,0,0);
    var rangeEnd=new Date(endDate);rangeEnd.setHours(23,59,59,999);
    var rows=[];

    Object.keys(ctx.visits).forEach(function(key){
      var companyId=visitCompanyId(key),weekKey=visitWeekKey(key);
      /* Firma daha sonra silinmiş/yeniden adlandırılmış olabilir — kaydı yine de göster,
         sadece plan-uygunluk kontrolünü (BL.scheduled firma nesnesi ister) atla. */
      var company=ctx.companies.find(function(c){return c.id===companyId;});
      var es=entries(ctx.visits[key]);
      Object.keys(es).forEach(function(code){
        var e=es[code];
        if(!e||e.status!=='done')return;
        var date=parseDate(e.date,weekKey);
        if(!date||date<rangeStart||date>rangeEnd)return;
        var tech=ctx.technicians.find(function(t){return t.code===code;});
        var plan=company?(ctx.BL.scheduled(company,weekIndexOf(ctx,date))?'Plana Uygun':'Plan Dışı'):'Plan Dışı';
        rows.push({firmaId:companyId,firma:company?company.name:('Bilinmeyen Firma ('+companyId+')'),registered:!!company,techCode:code,teknisyen:tech?tech.name:code,dateObj:date,tarih:ctx.DT.ddmmyyyy(date),plan:plan,not:''});
      });
    });

    ctx.extras.forEach(function(e){
      var date=parseDate(e.date,e.wk);
      if(!date||date<rangeStart||date>rangeEnd)return;
      var company=ctx.companies.find(function(c){return c.id===e.firmaId;});
      var tech=ctx.technicians.find(function(t){return t.id===e.techId;});
      rows.push({firmaId:e.firmaId||'',firma:company?company.name:(e.firmAdi||'Bilinmeyen Firma'),registered:!!company,techCode:tech?tech.code:(e.techCode||''),teknisyen:tech?tech.name:(e.techCode||''),dateObj:date,tarih:ctx.DT.ddmmyyyy(date),plan:'Program Dışı',not:e.not||''});
    });

    rows.sort(function(a,b){return a.dateObj-b.dateObj;});

    var uniqueSet={},techCounts={},dayCounts={},uygun=0,planDisi=0,programDisi=0;
    rows.forEach(function(r){
      uniqueSet[r.firmaId||r.firma]=true;
      techCounts[r.teknisyen]=(techCounts[r.teknisyen]||0)+1;
      dayCounts[r.tarih]=(dayCounts[r.tarih]||0)+1;
      if(r.plan==='Plana Uygun')uygun++;
      else if(r.plan==='Plan Dışı')planDisi++;
      else programDisi++;
    });

    var scoreCache={};
    rows.forEach(function(r){
      if(!(r.firmaId in scoreCache)){
        var company=ctx.companies.find(function(c){return c.id===r.firmaId;});
        scoreCache[r.firmaId]=scoreCompany(ctx,company,rangeEnd);
      }
      r.score=scoreCache[r.firmaId];
      r.grade=grade(r.score);
      r.lastVisit=r.registered?lastVisitBefore(ctx,r.firmaId,r.dateObj):null;
    });

    var total=rows.length,unique=Object.keys(uniqueSet).length;
    var scoreVals=rows.map(function(r){return r.score;}).filter(function(s){return typeof s==='number';});
    var avgScore=scoreVals.length?Math.round(scoreVals.reduce(function(a,b){return a+b;},0)/scoreVals.length*10)/10:0;
    var planRate=total?Math.round(uygun/total*100):0;

    /* Bu dönemde gidilmesi gereken (BL.scheduled) ama hiç ziyaret edilmeyen aktif firmalar. */
    var activeCompanies=ctx.companies.filter(function(c){return c.aktif!==false;});
    var scheduledIds={};
    var mondayCursor=ctx.DT.monday(rangeStart);
    while(mondayCursor<=rangeEnd){
      var wi=weekIndexOf(ctx,mondayCursor);
      activeCompanies.forEach(function(c){if(ctx.BL.scheduled(c,wi))scheduledIds[c.id]=true;});
      mondayCursor=new Date(mondayCursor);mondayCursor.setDate(mondayCursor.getDate()+7);
    }
    var visitedIds={};
    rows.forEach(function(r){if(r.firmaId)visitedIds[r.firmaId]=true;});
    var missed=Object.keys(scheduledIds).filter(function(id){return !visitedIds[id];}).map(function(id){
      var c=activeCompanies.find(function(x){return x.id===id;});
      var tech=ctx.technicians.find(function(t){return t.id===c.techId;});
      var last=lastVisitBefore(ctx,id,rangeEnd);
      return {firmaId:id,firma:c.name,bolge:c.bolge||'-',teknisyen:tech?tech.name:'-',techCode:tech?tech.code:'-',lastVisit:last};
    }).sort(function(a,b){return a.firma.localeCompare(b.firma,'tr');});

    return {start:rangeStart,end:rangeEnd,rows:rows,total:total,unique:unique,uygun:uygun,planDisi:planDisi,programDisi:programDisi,tech:techCounts,days:dayCounts,avgScore:avgScore,planRate:planRate,missed:missed,scheduledCount:Object.keys(scheduledIds).length};
  }

  function previousPeriodRange(start,end){
    var dayCount=Math.round((end-start)/86400000)+1;
    var prevEnd=new Date(start);prevEnd.setDate(prevEnd.getDate()-1);prevEnd.setHours(23,59,59,999);
    var prevStart=new Date(prevEnd);prevStart.setDate(prevStart.getDate()-(dayCount-1));prevStart.setHours(0,0,0,0);
    return {start:prevStart,end:prevEnd};
  }

  function pctChange(cur,prev){
    if(!prev)return cur?{value:null,type:'new'}:{value:0,type:'flat'};
    var v=Math.round((cur-prev)/prev*1000)/10;
    if(v>0)return{value:v,type:'up'};
    if(v<0)return{value:v,type:'down'};
    return{value:0,type:'flat'};
  }

  function collectWeeklyDataWithTrend(startDate,endDate,ctxIn){
    var current=collectWeeklyData(startDate,endDate,ctxIn);
    var prevRange=previousPeriodRange(current.start,current.end);
    var previous=collectWeeklyData(prevRange.start,prevRange.end,ctxIn);
    current.previous=previous;
    current.trend={
      total:Object.assign({cur:current.total,prev:previous.total},pctChange(current.total,previous.total)),
      unique:Object.assign({cur:current.unique,prev:previous.unique},pctChange(current.unique,previous.unique)),
      uygun:Object.assign({cur:current.uygun,prev:previous.uygun},pctChange(current.uygun,previous.uygun)),
      planDisi:Object.assign({cur:current.planDisi,prev:previous.planDisi},pctChange(current.planDisi,previous.planDisi)),
      programDisi:Object.assign({cur:current.programDisi,prev:previous.programDisi},pctChange(current.programDisi,previous.programDisi)),
      missed:Object.assign({cur:current.missed.length,prev:previous.missed.length},pctChange(current.missed.length,previous.missed.length)),
      avgScore:Object.assign({cur:current.avgScore,prev:previous.avgScore},pctChange(current.avgScore,previous.avgScore)),
      planRate:Object.assign({cur:current.planRate,prev:previous.planRate},pctChange(current.planRate,previous.planRate))
    };
    return current;
  }

  global.collectWeeklyData=collectWeeklyData;
  global.collectWeeklyDataWithTrend=collectWeeklyDataWithTrend;
  global.previousPeriodRange=previousPeriodRange;
  global.weeklyReportGrade=grade;
  if(typeof module!=='undefined'&&module.exports)module.exports={collectWeeklyData:collectWeeklyData,collectWeeklyDataWithTrend:collectWeeklyDataWithTrend,previousPeriodRange:previousPeriodRange,grade:grade};
})(typeof window!=='undefined'?window:global);
