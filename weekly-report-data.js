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

  /* Bir kayıt AYNI hafta içinde birden fazla ziyaret tutabilir: `dates` dizisi
     tüm ziyaret günlerini, `date` yalnızca sonuncusunu içerir. Sadece `date`
     okunursa aynı haftadaki önceki ziyaretler kaybolur (ziyaret sayısı eksik
     çıkar, "son ziyaret" zinciri kopar) — bu yüzden dizi açılarak okunur. */
  function visitDatesOf(entry){
    return (entry.dates&&entry.dates.length?entry.dates:[entry.date]).filter(Boolean);
  }
  function allDoneVisits(ctx,companyId){
    var out=[];
    Object.keys(ctx.visits).forEach(function(key){
      if(visitCompanyId(key)!==String(companyId))return;
      var wk=visitWeekKey(key),es=entries(ctx.visits[key]);
      Object.keys(es).forEach(function(code){
        var e=es[code];
        if(!e||e.status!=='done')return;
        visitDatesOf(e).forEach(function(ds){
          var d=parseDate(ds,wk);
          if(d)out.push({d:d,v:e});
        });
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
  /* Firmanın kendi planına (co.weeks) göre iki ziyaret arasında beklenen hafta
     sayısı: [1,2,3,4] → her hafta, [1,3] → 2 haftada bir, [2] → 4 haftada bir.
     "Gecikmiş mi" sorusu firmanın kendi temposuna göre sorulmalı; her firmayı
     tek bir sabit gün eşiğiyle ölçmek seyrek planlı firmaları haksız yere düşürür. */
  function cadenceWeeks(company){
    var n=(company&&company.weeks&&company.weeks.length)?company.weeks.length:4;
    return Math.max(1,Math.min(4,Math.round(4/n)));
  }

  /* ═══ İZİN (leaveStart/leaveEnd, YYYY-MM-DD — sd_te kaydı) ═══
     Kaynak, günlük rapordaki gri "İzinli" kartıyla aynıdır. Teknisyen izinliyken
     ziyaret yapması beklenemeyeceği için o dönem plandan düşülür; aksi halde
     izin, firma skorunu haksız yere aşağı çekiyordu. */
  function techOfCompany(ctx,company){
    if(!company||!company.techId)return null;
    return (ctx.technicians||[]).find(function(t){return String(t.id)===String(company.techId);})||null;
  }
  function leaveRangeOf(tech){
    if(!tech||!tech.leaveStart)return null;
    var s=parseDate(tech.leaveStart),e=parseDate(tech.leaveEnd||tech.leaveStart);
    if(!s||!e)return null;
    s.setHours(0,0,0,0);e.setHours(23,59,59,999);
    return e<s?null:{start:s,end:e};
  }
  /* O hafta sorumlu teknisyen izinli miydi? Ziyaretler hafta içi yapıldığı için
     yalnızca Pzt–Cum'a bakılır ve izin bu 5 günün ÇOĞUNU (>=3) kapsamalıdır:
     tek günlük izin haftayı mazur göstermez, tam hafta izin gösterir. */
  function techOnLeaveForWeek(ctx,company,monday){
    var range=leaveRangeOf(techOfCompany(ctx,company));
    if(!range)return false;
    var covered=0;
    for(var i=0;i<5;i++){
      var day=new Date(monday);day.setDate(day.getDate()+i);day.setHours(12,0,0,0);
      if(day>=range.start&&day<=range.end)covered++;
    }
    return covered>=3;
  }
  /* [from,to] aralığında sorumlu teknisyenin izinli olduğu gün sayısı — "son
     ziyaretten bu yana geçen süre"den düşülür ki izin, güncellik puanını
     düşürmesin. */
  function leaveDaysBetween(ctx,company,from,to){
    var range=leaveRangeOf(techOfCompany(ctx,company));
    if(!range)return 0;
    var s=new Date(Math.max(range.start.getTime(),from.getTime()));
    var e=new Date(Math.min(range.end.getTime(),to.getTime()));
    if(e<s)return 0;
    s.setHours(0,0,0,0);e.setHours(0,0,0,0);
    return Math.floor((e-s)/86400000)+1;
  }

  /* [from,to] aralığında firmanın planlı (BL.scheduled) hafta sayısı ve bu
     haftaların kaçında gerçekten ziyaret olduğu. Hem "ömür boyu" hem "bu dönem"
     istatistiği AYNI kuralı kullansın diye tek yerde hesaplanır. */
  function weekCompliance(ctx,company,visits,from,to){
    var expected=0,met=0,cursor=ctx.DT.monday(from),endMonday=ctx.DT.monday(to);
    while(cursor<=endMonday){
      if(ctx.BL.scheduled(company,weekIndexOf(ctx,cursor))){
        var wkStart=cursor,wkEnd=new Date(cursor);
        wkEnd.setDate(wkEnd.getDate()+6);wkEnd.setHours(23,59,59,999);
        var visited=visits.some(function(x){return x.d>=wkStart&&x.d<=wkEnd;});
        /* Ziyaret varsa hafta her koşulda sayılır (izinde bile gidilmişse bu
           olumlu bir kayıttır). Ziyaret YOKSA ve teknisyen o hafta izinliyse
           hafta beklenenlerden tamamen çıkarılır — kaçırılmış sayılmaz. */
        if(visited){expected++;met++;}
        else if(!techOnLeaveForWeek(ctx,company,cursor))expected++;
      }
      cursor=new Date(cursor);cursor.setDate(cursor.getDate()+7);
    }
    return{expected:expected,met:met,missed:expected-met};
  }

  /* Güncellik: son ziyaretin üzerinden geçen süre, firmanın KENDİ plan aralığına
     oranlanır. Planı aşmadıysa tam puan; aştıkça doğrusal düşer (2 kat gecikme
     → 40, ~2.7 kat → 0). */
  function recencyScore(daysSince,cadence){
    if(daysSince==null)return 0;
    var ratio=daysSince/(cadence*7);
    if(ratio<=1)return 100;
    return Math.max(0,Math.round(100-(ratio-1)*60));
  }

  /* Az veriyi nötre çeken önsel (Laplace yumuşatma) ve skor ağırlıkları. */
  var SMOOTH_K=3,SMOOTH_PRIOR=0.7,W_UYUM=0.65,W_GUNCEL=0.35;

  /* Firma skoru = %65 geçmiş uyum + %35 güncellik − düzeltmeler.

     UYUM: ilk ziyaretten rapor sonuna kadar firmanın planlı olduğu her hafta
     için "o hafta gidilmiş mi" bakılır. Ham oran (met/expected) küçük paydada
     çöker: tek planlı haftası olan ve onu kaçıran firma 0 alır, 7 haftanın 5'ini
     kaçıran firma 29 alır — yani BİR kez atlayan, sürekli atlayandan kötü
     görünür. Bu yüzden ham oran ile önsele çekilmiş oranın İYİ olanı kullanılır:
     veri azken firma cezalandırılmaz, veri arttıkça iki değer birbirine yakınsar
     ve tam uyumlu firma yumuşatma yüzünden 100'ün altına düşmez.

     GÜNCELLİK: geçmişi iyi ama aylardır gidilmemiş firma ile dün gidilmiş firma
     aynı skoru almasın diye eklenir.

     Hiç ziyaret kaydı olmayan firma 0 alır — herhangi bir ziyaret edilmiş
     firmadan daha kötü olduğu garanti edilir (eski sabit 15 puan, tek haftasını
     kaçıran firmanın 0'ından yüksek kalıyordu). */
  function scoreCompany(ctx,company,reportEnd){
    return scoreDetail(ctx,company,reportEnd).score;
  }
  /* Skoru, NEDEN o skoru aldığını ve skorun bileşenlerini birlikte döner —
     rapor tablolarında rozetin altına "uyum 2/7 · 16g" gibi detay yazılabilsin
     ve not alanı boşsa gerekçe metni gösterilebilsin diye. */
  function scoreDetail(ctx,company,reportEnd){
    if(!company)return{score:null,reason:'',reasons:[],parts:null};
    var visits=allDoneVisits(ctx,company.id).filter(function(x){return x.d<=reportEnd;});
    var cadence=cadenceWeeks(company);
    if(!visits.length){
      return{score:0,reason:'Hiç ziyaret kaydı yok',reasons:['Hiç ziyaret kaydı yok'],
        parts:{expected:0,met:0,missed:0,uyum:0,guncellik:0,daysSince:null,cadence:cadence,
          planDays:cadence*7,overdue:true,neverVisited:true,lowData:true,penalties:[]}};
    }
    var firstVisit=visits[visits.length-1].d;
    var life=weekCompliance(ctx,company,visits,firstVisit,reportEnd);

    var raw=life.expected?life.met/life.expected:1;
    var smoothed=(life.met+SMOOTH_K*SMOOTH_PRIOR)/(life.expected+SMOOTH_K);
    var uyum=Math.round(Math.max(raw,smoothed)*100);

    var daysSince=Math.max(0,Math.round((reportEnd-visits[0].d)/86400000));
    /* Gerçek gecikme gösterilmeye devam eder (daysSince), ama PUAN hesabı izin
       günleri düşülmüş süreye göre yapılır: teknisyen izindeyken geçen süre
       firmanın güncellik puanını düşürmemeli. */
    var leaveDays=leaveDaysBetween(ctx,company,visits[0].d,reportEnd);
    var effectiveDays=Math.max(0,daysSince-leaveDays);
    var planDays=cadence*7,overdue=effectiveDays>planDays;
    var guncellik=recencyScore(effectiveDays,cadence);

    var score=W_UYUM*uyum+W_GUNCEL*guncellik;
    var penalties=[];
    var open=samplesFor(ctx,company.id).filter(sampleOpen).length;
    if(open){var pen=Math.min(15,open*5);score-=pen;penalties.push(open+' açık numune (-'+pen+')');}
    var recent=visits.slice(0,4).map(function(x){return String(x.v.tc||x.v.techCode||x.v.techId||'');}).filter(Boolean);
    if(recent.length>=3&&new Set(recent).size>=3){score-=8;penalties.push('Ekip sürekliliği yok (-8)');}
    score=Math.max(0,Math.min(100,Math.round(score)));

    var reasons=[];
    if(life.missed>0)reasons.push(life.met+'/'+life.expected+' planlı hafta karşılandı');
    else reasons.push('Tam uyum ('+life.met+'/'+life.expected+' hafta)');
    if(overdue)reasons.push('Son ziyaret '+daysSince+' gün önce (plan '+planDays+' gün)');
    if(leaveDays)reasons.push(leaveDays+' gün teknisyen izni skordan düşüldü');
    if(life.expected<3)reasons.push('Az veri — skor geçici');
    reasons=reasons.concat(penalties);

    return{score:score,reason:reasons.join(' · '),reasons:reasons,
      parts:{expected:life.expected,met:life.met,missed:life.missed,uyum:uyum,guncellik:guncellik,
        daysSince:daysSince,leaveDays:leaveDays,effectiveDays:effectiveDays,cadence:cadence,planDays:planDays,overdue:overdue,
        neverVisited:false,lowData:life.expected<3,penalties:penalties}};
  }
  /* Satış temsilcisi kayıtları SD.users'ta DEĞİL, ayrı `sd_st` deposunda tutulur
     (id: s1, code: S01 ...). Firma `salesRepId` (s-id) ya da `salesRepUserId`
     (sayısal userId) ile bağlanır. Raporda temsilcinin KODU gösterilir. */
  function salesRepRecord(ctx,company){
    if(!company)return null;
    var list=ctx.salesReps||[];
    var byId=company.salesRepId?list.find(function(s){return String(s.id)===String(company.salesRepId);}):null;
    if(byId)return byId;
    var byUser=company.salesRepUserId?list.find(function(s){return String(s.userId)===String(company.salesRepUserId);}):null;
    return byUser||null;
  }
  function salesRepOf(ctx,company){
    var rep=salesRepRecord(ctx,company);
    if(rep)return rep.code||rep.name||'';
    if(!company)return'';
    return company.salesRepCode||company.salesRepName||'';
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
    ctx.users=ctx.SD.users||[];
    ctx.salesReps=(ctx.SD.load?ctx.SD.load('sd_st',[]):[])||[];
    ctx.samples=(ctx.SD.load?ctx.SD.load('sd_samples',[]):[])||[];

    var rangeStart=new Date(startDate);rangeStart.setHours(0,0,0,0);
    var rangeEnd=new Date(endDate);rangeEnd.setHours(23,59,59,999);
    var rows=[];
    /* Program dışı ziyaret kaydedilirken kayıtlı bir firma seçilmişse admin.js
       ziyareti HEM SD.visits'e HEM SD.extras'a yazar (biri haftalık ızgarayı
       işaretlemek, diğeri program dışı listesini beslemek için). Rapor ikisini de
       okuduğu için tek ziyaret iki satır oluyordu. Aynı firma + aynı gün ikilisi
       burada tek satıra indirilir; extras'taki not planlı satıra taşınır. */
    var plannedByKey={},duplicates=0;

    Object.keys(ctx.visits).forEach(function(key){
      var companyId=visitCompanyId(key),weekKey=visitWeekKey(key);
      /* Firma daha sonra silinmiş/yeniden adlandırılmış olabilir — kaydı yine de göster,
         sadece plan-uygunluk kontrolünü (BL.scheduled firma nesnesi ister) atla. */
      var company=ctx.companies.find(function(c){return c.id===companyId;});
      var es=entries(ctx.visits[key]);
      Object.keys(es).forEach(function(code){
        var e=es[code];
        if(!e||e.status!=='done')return;
        var tech=ctx.technicians.find(function(t){return t.code===code;});
        visitDatesOf(e).forEach(function(ds){
          var date=parseDate(ds,weekKey);
          if(!date||date<rangeStart||date>rangeEnd)return;
          var plan=company?(ctx.BL.scheduled(company,weekIndexOf(ctx,date))?'Plana Uygun':'Plan Dışı'):'Plan Dışı';
          var row={firmaId:companyId,firma:company?company.name:('Bilinmeyen Firma ('+companyId+')'),registered:!!company,techCode:code,teknisyen:tech?tech.name:code,salesRep:salesRepOf(ctx,company),dateObj:date,tarih:ctx.DT.ddmmyyyy(date),plan:plan,not:''};
          rows.push(row);
          plannedByKey[companyId+'|'+row.tarih]=row;
        });
      });
    });

    ctx.extras.forEach(function(e){
      var date=parseDate(e.date,e.wk);
      if(!date||date<rangeStart||date>rangeEnd)return;
      var twin=e.firmaId?plannedByKey[e.firmaId+'|'+ctx.DT.ddmmyyyy(date)]:null;
      if(twin){duplicates++;if(e.not&&!twin.not){twin.not=e.not;}return;}
      var company=ctx.companies.find(function(c){return c.id===e.firmaId;});
      var tech=ctx.technicians.find(function(t){return t.id===e.techId;});
      rows.push({firmaId:e.firmaId||'',firma:company?company.name:(e.firmAdi||'Bilinmeyen Firma'),registered:!!company,techCode:tech?tech.code:(e.techCode||''),teknisyen:tech?tech.name:(e.techCode||''),salesRep:salesRepOf(ctx,company),dateObj:date,tarih:ctx.DT.ddmmyyyy(date),plan:'Program Dışı',not:e.not||''});
    });

    /* Program dışı ziyaretler tarih fark etmeksizin en alta toplanır; planlı
       satırlar kendi içinde tarihe göre sıralanır. */
    rows.sort(function(a,b){
      var ap=a.plan==='Program Dışı'?1:0,bp=b.plan==='Program Dışı'?1:0;
      if(ap!==bp)return ap-bp;
      return a.dateObj-b.dateObj;
    });

    /* "ZİYARET EDİLEN FİRMA" yalnızca firma listesinde KAYITLI firmaları sayar —
       kart "kaç müşterimize gidildi" sorusunu cevaplasın diye. Serbest metinle
       girilmiş program dışı isimler (kargo, OSGB, tedarikçi…) ve artık silinmiş
       firma id'leri ayrı sayılır; kartın altında "+N kayıt dışı" olarak görünür.
       Serbest metin isimler baştaki/sondaki boşluk ve büyük-küçük harf farkından
       ötürü aynı firmayı iki kez saymasın diye normalize edilir. */
    var uniqueSet={},unregSet={},techCounts={},dayCounts={},uygun=0,planDisi=0,programDisi=0;
    rows.forEach(function(r){
      if(r.registered&&r.firmaId)uniqueSet[r.firmaId]=true;
      else unregSet[r.firmaId||String(r.firma||'').trim().toLocaleUpperCase('tr')]=true;
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
        scoreCache[r.firmaId]=scoreDetail(ctx,company,rangeEnd);
      }
      var sd=scoreCache[r.firmaId];
      r.score=sd.score;
      r.scoreReason=sd.reason;
      r.scoreParts=sd.parts;
      r.grade=grade(r.score);
      r.lastVisit=r.registered?lastVisitBefore(ctx,r.firmaId,r.dateObj):null;
      /* Not alanı boşsa skorun gerekçesini göster — tablo satırı boş kalmasın. */
      r.notOrReason=r.not||r.scoreReason||'-';
    });

    var total=rows.length,unique=Object.keys(uniqueSet).length,unregistered=Object.keys(unregSet).length;
    var planRate=total?Math.round(uygun/total*100):0;

    /* Bu dönemde gidilmesi gereken (BL.scheduled) ama hiç ziyaret edilmeyen aktif firmalar. */
    var activeCompanies=ctx.companies.filter(function(c){return c.aktif!==false;});
    var scheduledIds={},workableIds={};
    var mondayCursor=ctx.DT.monday(rangeStart);
    while(mondayCursor<=rangeEnd){
      var wi=weekIndexOf(ctx,mondayCursor);
      (function(monday,weekIdx){
        activeCompanies.forEach(function(c){
          if(!ctx.BL.scheduled(c,weekIdx))return;
          scheduledIds[c.id]=true;
          /* Sorumlu teknisyen o hafta izinliyse o hafta "gidilebilir" sayılmaz.
             Dönemdeki TÜM planlı haftaları izne denk gelen firma gidilmeyenler
             listesine girmez — izin, kaçırılmış ziyaret gibi görünmesin. */
          if(!techOnLeaveForWeek(ctx,c,monday))workableIds[c.id]=true;
        });
      })(mondayCursor,wi);
      mondayCursor=new Date(mondayCursor);mondayCursor.setDate(mondayCursor.getDate()+7);
    }
    var visitedIds={};
    rows.forEach(function(r){if(r.firmaId)visitedIds[r.firmaId]=true;});
    /* İzin yüzünden gidilemeyen firmalar aksiyon listesinden çıkar ama skorları
       ortalamaya DAHİL kalır (aşağıda) — yoksa havuzdan düşüp ortalamayı kaydırırlar. */
    var leaveExcusedIds=Object.keys(scheduledIds).filter(function(id){return !visitedIds[id]&&!workableIds[id];});
    var missed=Object.keys(scheduledIds).filter(function(id){return !visitedIds[id]&&workableIds[id];}).map(function(id){
      var c=activeCompanies.find(function(x){return x.id===id;});
      var tech=ctx.technicians.find(function(t){return t.id===c.techId;});
      var last=lastVisitBefore(ctx,id,rangeEnd);
      var sd=scoreDetail(ctx,c,rangeEnd);
      /* Skorun gerekçesi ÖMÜR BOYU pencereye aittir ("2/7 planlı hafta"); haftalık
         raporda yanına BU DÖNEME ait sayı da yazılmazsa okuyucu 7 haftanın bu
         dönemde kaçırıldığını sanır. Bu yüzden dönem uyumu ayrıca hesaplanır. */
      var visitsAll=allDoneVisits(ctx,id).filter(function(x){return x.d<=rangeEnd;});
      var period=weekCompliance(ctx,c,visitsAll,rangeStart,rangeEnd);
      var neverVisited=!visitsAll.length;
      var overdue=!!(sd.parts&&sd.parts.overdue);
      /* Aksiyon listesi en kötüden başlamalı: hiç gidilmemiş → plan aralığını
         aşmış → sadece bu dönem atlanmış. Alfabetik sıra aciliyeti gizliyordu. */
      var severity=neverVisited?'Hiç Gidilmedi':(overdue?'Gecikmiş':'Bu Dönem Atlandı');
      var severityRank=neverVisited?0:(overdue?1:2);
      var periodNote='Bu dönem '+period.expected+' planlı hafta kaçırıldı';
      return {firmaId:id,firma:c.name,bolge:c.bolge||'-',teknisyen:tech?tech.name:'-',techCode:tech?tech.code:'-',
        salesRep:salesRepOf(ctx,c),lastVisit:last,registered:true,
        score:sd.score,scoreReason:sd.reason,scoreParts:sd.parts,grade:grade(sd.score),
        neverVisited:neverVisited,overdue:overdue,severity:severity,severityRank:severityRank,
        periodScheduledWeeks:period.expected,periodMissedWeeks:period.missed,
        notOrReason:neverVisited?(periodNote+' · Hiç ziyaret kaydı yok'):(periodNote+' · '+sd.reasons[0]),
        daysSince:last?Math.max(0,Math.round((rangeEnd-last)/86400000)):null};
    }).sort(function(a,b){
      if(a.severityRank!==b.severityRank)return a.severityRank-b.severityRank;
      if(a.score!==b.score)return a.score-b.score;
      return a.firma.localeCompare(b.firma,'tr');
    });

    /* Ortalama skor ve skor dağılımı FİRMA başına hesaplanır, ziyaret satırı
       başına değil: 3 kez gidilen firma dağılımda 3 kez sayılıyor, gidilmeyen
       firmalar ise hiç sayılmıyordu — yani ortalama, en kötü firmaları dışarıda
       bırakıp iyi firmaları çoklayarak şişiyordu. */
    var companyScores={};
    /* Kayıt dışı satırların (serbest metin isim, silinmiş firma id'si) planı
       olmadığı için skoru da yok; dağılıma girerlerse anlamsız bir "Kayıt yok"
       bandı oluşturur ve ortalamayı bozarlar — tekil firma sayımıyla aynı
       kuralla dışarıda bırakılırlar. */
    rows.forEach(function(r){if(r.firmaId&&r.registered&&!(r.firmaId in companyScores))companyScores[r.firmaId]={score:r.score,grade:r.grade};});
    missed.forEach(function(m){if(!(m.firmaId in companyScores))companyScores[m.firmaId]={score:m.score,grade:m.grade};});
    leaveExcusedIds.forEach(function(id){
      if(id in companyScores)return;
      var lc=activeCompanies.find(function(x){return x.id===id;});
      var lsd=scoreDetail(ctx,lc,rangeEnd);
      companyScores[id]={score:lsd.score,grade:grade(lsd.score)};
    });
    var scored=Object.keys(companyScores).map(function(k){return companyScores[k];});
    var scoreVals=scored.map(function(s){return s.score;}).filter(function(s){return typeof s==='number';});
    var avgScore=scoreVals.length?Math.round(scoreVals.reduce(function(a,b){return a+b;},0)/scoreVals.length*10)/10:0;

    return {start:rangeStart,end:rangeEnd,rows:rows,total:total,unique:unique,unregistered:unregistered,duplicates:duplicates,uygun:uygun,planDisi:planDisi,programDisi:programDisi,tech:techCounts,days:dayCounts,avgScore:avgScore,planRate:planRate,missed:missed,leaveExcused:leaveExcusedIds.length,companyScores:scored,scheduledCount:Object.keys(scheduledIds).length};
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

  function collectWeeklyDataWithTrend(startDate,endDate,ctxIn,historyCount){
    var current=collectWeeklyData(startDate,endDate,ctxIn);
    var prevRange=previousPeriodRange(current.start,current.end);
    var previous=collectWeeklyData(prevRange.start,prevRange.end,ctxIn);
    current.previous=previous;

    /* Sparkline'lar için GERÇEK geçmiş: son N dönem aynı uzunlukta geriye doğru
       hesaplanır (uydurma seri çizilmez). Dizi eskiden yeniye, sonuncusu bu dönem. */
    var n=typeof historyCount==='number'?historyCount:6;
    var series=[],cursorStart=current.start,cursorEnd=current.end;
    var periods=[{total:current.total,unique:current.unique,uygun:current.uygun,planDisi:current.planDisi,programDisi:current.programDisi,missed:current.missed.length,avgScore:current.avgScore,planRate:current.planRate}];
    for(var i=1;i<n;i++){
      var pr=previousPeriodRange(cursorStart,cursorEnd);
      var pd=(i===1)?previous:collectWeeklyData(pr.start,pr.end,ctxIn);
      periods.push({total:pd.total,unique:pd.unique,uygun:pd.uygun,planDisi:pd.planDisi,programDisi:pd.programDisi,missed:pd.missed.length,avgScore:pd.avgScore,planRate:pd.planRate});
      cursorStart=pr.start;cursorEnd=pr.end;
    }
    periods.reverse();
    ['total','unique','uygun','planDisi','programDisi','missed','avgScore','planRate'].forEach(function(k){
      series[k]=periods.map(function(p){return p[k];});
    });
    current.history=series;
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
