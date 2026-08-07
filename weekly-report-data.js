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
  function scoreCompany(ctx,company,reportEnd){
    if(!company)return null;
    var last=lastVisitBefore(ctx,company.id,new Date(reportEnd.getTime()+86400000));
    var days=last?Math.max(0,Math.floor((reportEnd-last)/86400000)):null;
    var score=100;
    if(days===null)score-=25;else if(days>90)score-=35;else if(days>60)score-=20;
    var open=samplesFor(ctx,company.id).filter(sampleOpen).length;
    if(open)score-=Math.min(25,open*8);
    var recent=allDoneVisits(ctx,company.id).slice(0,3).map(function(x){return String(x.v.tc||x.v.techCode||x.v.techId||'');});
    if(new Set(recent).size>=3)score-=10;
    return Math.max(0,Math.min(100,score));
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
      var company=ctx.companies.find(function(c){return c.id===companyId;});
      if(!company)return;
      var es=entries(ctx.visits[key]);
      Object.keys(es).forEach(function(code){
        var e=es[code];
        if(!e||e.status!=='done')return;
        var date=parseDate(e.date,weekKey);
        if(!date||date<rangeStart||date>rangeEnd)return;
        var tech=ctx.technicians.find(function(t){return t.code===code;});
        var plan=ctx.BL.scheduled(company,weekIndexOf(ctx,date))?'Plana Uygun':'Plan Dışı';
        rows.push({firmaId:company.id,firma:company.name,techCode:code,teknisyen:tech?tech.name:code,dateObj:date,tarih:ctx.DT.ddmmyyyy(date),plan:plan,not:''});
      });
    });

    ctx.extras.forEach(function(e){
      var date=parseDate(e.date,e.wk);
      if(!date||date<rangeStart||date>rangeEnd)return;
      var company=ctx.companies.find(function(c){return c.id===e.firmaId;});
      var tech=ctx.technicians.find(function(t){return t.id===e.techId;});
      rows.push({firmaId:e.firmaId||'',firma:company?company.name:(e.firmAdi||'Bilinmeyen Firma'),techCode:tech?tech.code:(e.techCode||''),teknisyen:tech?tech.name:(e.techCode||''),dateObj:date,tarih:ctx.DT.ddmmyyyy(date),plan:'Program Dışı',not:e.not||''});
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
      r.lastVisit=lastVisitBefore(ctx,r.firmaId,r.dateObj);
    });

    var total=rows.length,unique=Object.keys(uniqueSet).length;
    var scoreVals=rows.map(function(r){return r.score;}).filter(function(s){return typeof s==='number';});
    var avgScore=scoreVals.length?Math.round(scoreVals.reduce(function(a,b){return a+b;},0)/scoreVals.length*10)/10:0;
    var planRate=total?Math.round(uygun/total*100):0;

    return {start:rangeStart,end:rangeEnd,rows:rows,total:total,unique:unique,uygun:uygun,planDisi:planDisi,programDisi:programDisi,tech:techCounts,days:dayCounts,avgScore:avgScore,planRate:planRate};
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
