/* ServisDrama — Outlook-safe daily report renderer.
   Table layout + inline CSS; no flex/grid/SVG/base64/emoji. */
(function(global){
  'use strict';

  function esc(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  function trDate(date){
    var months=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    return date.getDate()+' '+months[date.getMonth()]+' '+date.getFullYear();
  }
  function formatSetupDate(value){
    if(!value)return'';
    var parts=String(value).split('-');
    if(parts.length!==3)return esc(value);
    var d=new Date(Number(parts[0]),Number(parts[1])-1,Number(parts[2]));
    return isNaN(d.getTime())?esc(value):String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear();
  }
  function safeColor(value,fallback){
    return /^#[0-9a-f]{6}$/i.test(String(value||''))?value:fallback;
  }
  function parseVisitDate(value,weekKey){
    if(!value)return null;
    var parts=String(value).split('.'),year=parts[2]?Number(parts[2]):Number((String(weekKey).match(/(20\d{2})/)||[])[1]);
    if(parts.length<2||!year)return null;
    var date=new Date(year,Number(parts[1])-1,Number(parts[0]));
    return isNaN(date.getTime())?null:date;
  }
  function previousVisit(companyId,visits,currentWeekKey,today){
    var latest=null,milat=null;
    Object.keys(visits).forEach(function(key){
      if(key===companyId+'_'+currentWeekKey||key.indexOf(companyId+'_')!==0)return;
      var record=visits[key];
      if(!record||record.status!=='done')return;
      var date=parseVisitDate(record.date,key);
      if(!date||date>=today)return;
      var isMilat=date.getDate()===31&&date.getMonth()===6&&date.getFullYear()===2026;
      if(isMilat){milat=date;return;}
      if(!latest||date>latest)latest=date;
    });
    var result=latest||milat;
    if(!result){
      return {date:'Kayıt yok',days:''};
    }
    var days=Math.max(0,Math.floor((new Date(today.getFullYear(),today.getMonth(),today.getDate())-result)/86400000));
    return {date:String(result.getDate()).padStart(2,'0')+'.'+String(result.getMonth()+1).padStart(2,'0')+'.'+result.getFullYear(),days:days+' gün geçti'};
  }
  /* Talep satırındaki "son gidilen tarih + kaç gün geçti".
     previousVisit() ile aynı veriye bakar, iki farkı var: (1) içinde
     bulunulan haftanın kaydını DIŞLAMAZ — burada sorulan "bir önceki
     ziyaret" değil, firmaya EN SON ne zaman gidildiği; (2) çok teknisyenli
     ({by:{kod:...}}) kayıtları da okur, yalnız üst seviyeyi değil. */
  function lastVisitInfo(companyId,visits,today){
    var limit=new Date(today.getFullYear(),today.getMonth(),today.getDate()),latest=null;
    function consider(entry,weekKey){
      if(!entry||entry.status!=='done')return;
      var values=(Array.isArray(entry.dates)&&entry.dates.length)?entry.dates:[entry.date];
      values.forEach(function(value){
        var date=parseVisitDate(value,weekKey);
        if(!date||date>limit)return;
        if(date.getDate()===31&&date.getMonth()===6&&date.getFullYear()===2026)return; /* milat */
        if(!latest||date>latest)latest=date;
      });
    }
    Object.keys(visits||{}).forEach(function(key){
      if(String(key).indexOf(companyId+'_')!==0)return;
      var record=visits[key]||{};
      consider(record,key);
      var by=(record.by&&typeof record.by==='object')?record.by:null;
      if(by)Object.keys(by).forEach(function(code){consider(by[code],key);});
    });
    if(!latest)return{date:'Kayıt yok',days:''};
    var days=Math.max(0,Math.floor((limit-latest)/86400000));
    return{
      date:String(latest.getDate()).padStart(2,'0')+'.'+String(latest.getMonth()+1).padStart(2,'0')+'.'+latest.getFullYear(),
      days:days+' gün geçti'
    };
  }
  function visitRow(visit){
    var marker=visit.isExtra
      ?'<img src="cid:icon-star" width="14" height="14" alt="Önemli" style="display:block;border:0;outline:none;text-decoration:none;width:14px;height:14px;">'
      :'<table role="presentation" width="8" bgcolor="#1565d8" style="width:8px;background-color:#1565d8;"><tr><td height="8" style="height:8px;font-size:1px;line-height:8px;">&nbsp;</td></tr></table>';
    var noteHtml=visit.isExtra&&visit.note
      ?'<div style="font-size:12px;line-height:18px;font-weight:normal;color:#d97706;margin-top:6px;padding:8px 10px;background-color:#fef3c7;border-left:3px solid #f59a00;word-break:break-word;">📌 '+esc(visit.note)+'</div>'
      :'';
    return '<tr><td style="border-top:1px solid #dbe3ec;padding:16px;">'
      +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
      +'<td width="20" valign="top" style="width:20px;padding-top:6px;">'+marker+'</td>'
      +'<td class="company" valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:21px;font-weight:bold;color:#13233f;word-break:break-word;">'+esc(visit.name)
      +'<div style="font-size:13px;line-height:19px;font-weight:normal;color:#6b778a;">Son ziyaret: '+esc(visit.previousDate||'Kayıt yok')+(visit.daysElapsed?' <span style="color:#1565d8;font-weight:bold;">• '+esc(visit.daysElapsed)+'</span>':'')+'</div>'
      +noteHtml+'</td>'
      +'<td width="70" valign="middle" align="right" style="width:70px;padding-left:8px;font-family:Arial,Helvetica,sans-serif;">'
      +'<span style="display:inline-block;padding:6px 9px;border:1px solid #b9ead6;background-color:#e0f7ed;color:#008b61;font-size:14px;line-height:18px;font-weight:bold;">'+esc(visit.time||'—')+'</span>'
      +'</td></tr></table></td></tr>';
  }
  function staffCard(person,index){
    if(person.onLeave)return leaveCard(person);
    var color=safeColor(person.color,index%2?'#f59a00':'#1565d8');
    var rows=person.visits.map(visitRow).join('');
    /* 0 ziyaret: sayı kırmızı, altına kısa bilgi satırı — kart listede kalır. */
    var countColor=person.visits.length?'#009a69':'#c2410c';
    if(!person.visits.length)rows='<tr><td style="border-top:1px solid #dbe3ec;padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;line-height:18px;color:#8a6a49;">Bugün ziyaret girilmedi.</td></tr>';
    return '<tr><td class="pad" style="padding:0 30px 18px;">'
      +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dbe3ec;">'
      +'<tr><td bgcolor="#ffffff" style="padding:18px 16px;background-color:#ffffff;">'
      +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
      +'<td width="68" valign="middle"><table role="presentation" width="54" height="54" cellpadding="0" cellspacing="0" border="0" bgcolor="'+color+'" style="width:54px;height:54px;background-color:'+color+';"><tr><td align="center" valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:18px;font-weight:bold;color:#ffffff;">'+esc(person.code)+'</td></tr></table></td>'
      +'<td valign="middle" style="font-family:Arial,Helvetica,sans-serif;"><div style="font-size:19px;line-height:24px;font-weight:bold;color:#13233f;">'+esc(person.name)+'</div><div style="font-size:14px;line-height:20px;font-weight:bold;color:'+countColor+';">'+person.visits.length+' ziyaret</div></td>'
      +'</tr></table></td></tr>'+rows+'</table></td></tr>';
  }
  /* İzinli teknisyen kartı — nötr gri zemin, ziyaret sayısı yerine İzinli
     rozeti + tarih aralığı (GG.AA.YYYY). Outlook uyumlu: tablo + inline CSS. */
  function leaveCard(person){
    var range=formatSetupDate(person.leaveStart)+(person.leaveEnd&&person.leaveEnd!==person.leaveStart?' – '+formatSetupDate(person.leaveEnd):'');
    return '<tr><td class="pad" style="padding:0 30px 18px;">'
      +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f5f7" style="border:1px solid #d7dbe2;background-color:#f4f5f7;">'
      +'<tr><td style="padding:18px 16px;">'
      +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
      +'<td width="68" valign="middle"><table role="presentation" width="54" height="54" cellpadding="0" cellspacing="0" border="0" bgcolor="#aeb6c2" style="width:54px;height:54px;background-color:#aeb6c2;"><tr><td align="center" valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:18px;font-weight:bold;color:#ffffff;">'+esc(person.code)+'</td></tr></table></td>'
      +'<td valign="middle" style="font-family:Arial,Helvetica,sans-serif;"><div style="font-size:19px;line-height:24px;font-weight:bold;color:#4b5568;">'+esc(person.name)+'</div>'
      +'<div style="padding-top:6px;"><span style="display:inline-block;padding:5px 10px;border:1px solid #d2d7de;background-color:#eceef2;color:#5b6472;font-size:12.5px;line-height:16px;font-weight:bold;">İzinli'+(range?' &#8226; '+range:'')+'</span></div>'
      +'</td></tr></table>'
      +'<div style="padding:12px 2px 0;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;line-height:18px;color:#6b7688;">Ziyaret planlanmadı.</div>'
      +'</td></tr></table></td></tr>';
  }
  /* Teknisyen verilen gün izinli mi? (leaveStart/leaveEnd, YYYY-MM-DD) */
  function isOnLeave(tech,day){
    if(!tech||!tech.leaveStart)return false;
    var ymd=day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0');
    var end=tech.leaveEnd||tech.leaveStart;
    return ymd>=tech.leaveStart&&ymd<=end;
  }

  function collectData(ctx){
    var _SD=(ctx&&ctx.SD)||SD,_DT=(ctx&&ctx.DT)||DT,_BL=(ctx&&ctx.BL)||BL;
    var today=(ctx&&ctx.today)||new Date(),companies=_SD.companies||[],visits=_SD.visits||{},techs=_SD.technicians||[],extras=_SD.extras||[],visitRequests=_SD.visitRequests||[];
    var todayDDmm=_DT.ddmm(today),weekKey=_DT.wkey(today),weeks=_DT.monthWeeks(today.getFullYear(),today.getMonth());
    var weekIndex=weeks.findIndex(function(m){return m.getTime()===_DT.monday(today).getTime();})+1;
    if(weekIndex<1)weekIndex=1;
    var people=[];
    /* Ziyaret, firmanın sahibine göre değil FİİLEN GİDEN teknisyene göre listelenir.
       Kayıt teknisyen bazlı tutulduğu için aynı firmaya hem 1015 hem 1016 girdiyse
       ikisi de kendi bloğunda görünür — biri diğerini ezmez. Eski tek teknisyenli
       kayıtlarda giriş, kayıttaki tc kodundan türetilir. */
    var onLeavePeople=[];
    techs.forEach(function(tech){
      /* İzinli teknisyen: ziyareti olsun olmasın raporda gri "İzinli" kartıyla
         gösterilir — "izinli miydi, yoksa hiç mi gitmedi" ayrımı yapılabilsin.
         Ayrı listede toplanır ve çalışan personelin ALTINA eklenir. */
      if(isOnLeave(tech,today)){
        onLeavePeople.push({code:tech.code,name:tech.name,color:_BL.avatarColor(tech.name),visits:[],onLeave:true,leaveStart:tech.leaveStart,leaveEnd:tech.leaveEnd});
        return;
      }
      var list=[];
      companies.forEach(function(company){
        if(!_BL.scheduled(company,weekIndex))return;
        var v=_SD.visitEntryFor(visits[company.id+'_'+weekKey],tech.code);
        if(!v||v.status!=='done')return;
        if(v.marked===false)return;
        if(v.date!==todayDDmm)return;
        var previous=previousVisit(company.id,visits,weekKey,today);
        list.push({name:company.name,previousDate:previous.date,daysElapsed:previous.days,time:v.saat||'',isExtra:false});
      });
      extras.filter(function(e){return e.techId===tech.id&&e.date===todayDDmm;}).forEach(function(e){
        var extraCompany=companies.find(function(c){return c.id===e.firmaId;});
        var extraName=extraCompany?extraCompany.name:e.firmAdi;
        var extraPrevious=extraCompany?previousVisit(extraCompany.id,visits,weekKey,today):{date:'Kayıt yok',days:''};
        list.push({name:extraName,previousDate:extraPrevious.date,daysElapsed:extraPrevious.days,time:e.saat||'',isExtra:true,note:e.not||''});
      });
      if(list.length){people.push({code:tech.code,name:tech.name,color:_BL.avatarColor(tech.name),visits:list});}
      else{
        /* Bugün hiç ziyaret girmemiş teknisyen de raporda görünür (0 ziyaret) —
           "izinli mi, yoksa hiç mi girmedi" ayrımı yapılabilsin. Hiç aktif
           firması olmayan kodlar (kullanılmayan teknisyen kayıtları) atlanır. */
        var hasCompanies=companies.some(function(c){return c.techId===tech.id&&c.aktif!==false;});
        if(hasCompanies)people.push({code:tech.code,name:tech.name,color:_BL.avatarColor(tech.name),visits:[]});
      }
    });
    var todayYmd=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
    var installations=companies.filter(function(c){return (c.kurulumStart||c.kurulumEnd)&&(!c.kurulumEnd||c.kurulumEnd>=todayYmd);}).map(function(c){
      return {name:c.name,start:c.kurulumStart,end:c.kurulumEnd,startTime:c.kurulumStartTime||'',endTime:c.kurulumEndTime||''};
    });
    /* İzinliler her zaman listenin sonunda; "Personel" metriği yalnızca fiilen
       çalışan (izinli olmayan) personeli sayar. */
    var activeCount=people.length;
    people=people.concat(onLeavePeople);

    /* Ziyaret talepleri: BUGÜN açılmış olanlar (satıştan gelen "öncelikli
       git" istekleri) — kurulum/personel kartlarıyla aynı "bugün ne oldu"
       mantığı. Kapanmışlar da (durum=kapandı) dahil edilir ki rapor okuyan
       kişi hem yeni talebi hem aynı gün kapandığını görsün. */
    var visitRequestsToday=visitRequests.filter(function(r){
      var d=new Date(r.createdAt);
      return !isNaN(d)&&_DT.ddmmyyyy(d)===_DT.ddmmyyyy(today);
    }).sort(function(a,b){return String(a.createdAt||'').localeCompare(String(b.createdAt||''));})
      .map(function(r){
        var last=lastVisitInfo(String(r.companyId||''),visits,today);
        return Object.assign({},r,{lastVisitDate:last.date,lastVisitDays:last.days});
      });

    return {today:today,people:people,activeCount:activeCount,installations:installations,total:people.reduce(function(n,p){return n+p.visits.length;},0),visitRequests:visitRequestsToday};
  }

  /* Ziyaret talebi durumu → rapordaki rozet rengi. installationRows'daki
     "Tamamlandı/Devam ediyor" rozetiyle aynı kalıp (renkli çerçeve+zemin),
     yalnızca dört duruma göre genişletildi. */
  var VR_STATUS_STYLE={
    open:{t:'Bekliyor',bd:'#f3d9a8',bg:'#fff7e6',c:'#875000'},
    planned:{t:'Planlandı',bd:'#bfdbfe',bg:'#eff6ff',c:'#1565d8'},
    done:{t:'Tamamlandı',bd:'#b7e4d5',bg:'#ecfdf5',c:'#047857'},
    cancelled:{t:'İptal Edildi',bd:'#d1d5db',bg:'#f3f4f6',c:'#6b7280'}
  };
  /* Talep satırı bilinçli olarak SIKI: raporda günde birkaç talep birikebiliyor
     ve kurulum kartı ölçüsünde bir blok kullanıldığında liste sayfayı yutuyordu.
     Künyede teknisyenin yalnız KODU var (ad değil) — kod zaten tekil ve satırı
     kısa tutuyor. */
  function visitRequestRowHTML(r){
    var st=VR_STATUS_STYLE[r.status]||VR_STATUS_STYLE.open;
    var detay=esc(r.salesRepName||'Satışçı')+' &#8594; '+esc(r.techCode||r.techName||'—')
      +(r.reason?' &#8226; '+esc(r.reason):'');
    /* Başlığın yanında firmaya en son ne zaman gidildiği: raporu okuyan kişi
       talebin ne kadar geciktiğini kartı açmadan görsün. */
    var sonZiyaret=' &#8226; Son ziyaret: '+esc(r.lastVisitDate||'Kayıt yok')
      +(r.lastVisitDays?' <span style="color:#13233f;font-weight:bold;">&#8226; '+esc(r.lastVisitDays)+'</span>':'');
    return '<tr><td class="pad" style="padding:0 30px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eff6ff" style="background-color:#eff6ff;border-left:4px solid #1565d8;border-top:1px solid #bfdbfe;border-right:1px solid #bfdbfe;border-bottom:1px solid #bfdbfe;"><tr>'
      +'<td style="padding:9px 8px 10px 12px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:11px;line-height:16px;font-weight:bold;color:#1565d8;letter-spacing:.4px;">ZİYARET TALEBİ<span style="font-weight:normal;letter-spacing:0;color:#65748a;">'+sonZiyaret+'</span></div><div class="install-company" style="padding-top:2px;font-size:14px;line-height:19px;font-weight:bold;color:#13233f;">'+esc(r.companyName||'')+'</div><div class="install-date" style="padding-top:2px;font-size:12px;line-height:17px;color:#65748a;">'+detay+'</div></td>'
      +'<td class="install-status" width="92" align="center" valign="middle" style="width:92px;padding:9px 10px 10px 6px;font-family:Arial,Helvetica,sans-serif;"><span style="display:inline-block;padding:4px 8px;border:1px solid '+st.bd+';background-color:'+st.bg+';color:'+st.c+';font-size:11px;line-height:16px;white-space:nowrap;">'+st.t+'</span></td>'
      +'</tr></table></td></tr>';
  }

  function buildOutlookRaporHTML(ctx){
    var _DT=(ctx&&ctx.DT)||DT;
    var data=collectData(ctx),today=data.today,reportDate=trDate(today),week=_DT.isoWeek(today)+'. Hafta';
    /* Ziyaret talepleri bölümü YALNIZCA bugün talep varsa eklenir — sessiz bir
       günde raporun geri kalanına (kurulum/personel bölümleri, HİÇBİRİ
       değişmedi) her zaman boş bir bölüm eklemek gürültü olurdu. */
    var visitRequestSection=data.visitRequests.length
      ?('<tr><td class="pad" style="padding:12px 30px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="160" valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:23px;font-weight:bold;color:#13233f;white-space:nowrap;">Ziyaret Talepleri</td><td valign="middle" style="padding-left:12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" bgcolor="#cbd5e1" style="height:1px;background-color:#cbd5e1;font-size:1px;line-height:1px;">&nbsp;</td></tr></table></td></tr></table></td></tr>'
        +data.visitRequests.map(visitRequestRowHTML).join(''))
      :'';
    var installationRows='';
    data.installations.forEach(function(inst){
      var startText=formatSetupDate(inst.start)+(inst.startTime?' · '+esc(inst.startTime):'');
      var isCompleted=!!String(inst.endTime||'').trim();
      var endText=isCompleted?(formatSetupDate(inst.end||inst.start)+' · '+esc(inst.endTime)):'';
      var dates=isCompleted?(startText+' – '+endText):(startText+' – Devam ediyor');
      var statusText=isCompleted?'Tamamlandı':'Devam ediyor';
      var statusStyle=isCompleted
        ?'border:1px solid #b7e4d5;background-color:#ecfdf5;color:#047857;'
        :'border:1px solid #f3d9a8;background-color:#fff7e6;color:#875000;';
      installationRows+='<tr><td class="pad" style="padding:14px 30px 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fffaf0" style="background-color:#fffaf0;border-left:5px solid #f59a00;border-top:1px solid #f3d9a8;border-right:1px solid #f3d9a8;border-bottom:1px solid #f3d9a8;"><tr><td style="padding:18px 12px 18px 18px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:12px;line-height:18px;font-weight:bold;color:#dc7900;letter-spacing:.5px;">KURULUM &amp; DEVREYE ALMA</div><div class="install-company" style="padding-top:5px;font-size:15px;line-height:21px;font-weight:bold;color:#13233f;">'+esc(inst.name)+'</div><div class="install-date" style="padding-top:5px;font-size:13px;line-height:20px;color:#65748a;white-space:nowrap;">'+dates+'</div></td><td class="install-status" width="116" align="center" valign="middle" style="width:116px;padding:18px 12px 18px 8px;font-family:Arial,Helvetica,sans-serif;"><span style="display:inline-block;padding:8px 9px;'+statusStyle+'font-size:12px;line-height:18px;white-space:nowrap;">'+statusText+'</span></td></tr></table></td></tr>';
    });
    var staffRows=data.people.map(staffCard).join('');
    var emptyRows=data.people.length?'':'<tr><td class="pad" style="padding:0 30px 22px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#6b778a;">Bugün tamamlanan teknik ziyaret bulunmuyor.</td></tr>';
    return '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>ServisDrama Günlük Ziyaret Özeti</title>'
      +'<!--[if mso]><style>table,td,p,a,h1{font-family:Arial,Helvetica,sans-serif!important}</style><![endif]--><style>table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse}img{border:0;outline:none;text-decoration:none;display:block}@media only screen and (max-width:600px){.shell{width:100%!important}.pad{padding-left:18px!important;padding-right:18px!important}.brand-logo{width:148px!important;height:54px!important}.brand-cell{width:166px!important}.report-label{font-size:10px!important;line-height:14px!important;letter-spacing:1px!important;padding:9px 10px!important}.hero-title{font-size:28px!important;line-height:34px!important}.mobile-block{display:block!important;width:100%!important}.mobile-left{text-align:left!important;padding-top:14px!important}.metric{font-size:12px!important}.company{font-size:14px!important;line-height:20px!important}.install-company{font-size:14px!important;line-height:20px!important}.install-date{font-size:12px!important;white-space:nowrap!important}.install-status{width:106px!important;padding-left:8px!important;padding-right:10px!important}.install-status span{font-size:12px!important;padding:7px 8px!important}}</style></head>'
      +'<body style="margin:0;padding:0;background-color:#f3f6fa;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">'+esc(reportDate)+' günlük teknik servis ve kurulum özeti.</div>'
      +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f6fa"><tr><td align="center" style="padding:24px 10px;">'
      +'<!--[if mso]><table role="presentation" width="680"><tr><td><![endif]--><table role="presentation" class="shell" width="680" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:680px;max-width:680px;background-color:#ffffff;border:1px solid #dbe3ec;">'
      +'<tr><td class="pad" style="padding:18px 30px;"><table role="presentation" width="100%"><tr><td class="brand-cell" width="185" valign="middle"><img class="brand-logo" src="cid:drama-makine-logo" width="158" height="58" alt="Drama Makine" style="display:block;width:158px;height:58px;object-fit:contain;"></td><td valign="middle" align="right"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr><td class="report-label" align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:15px;letter-spacing:1.3px;font-weight:bold;color:#13233f;border:1px solid #13233f;padding:10px 13px;white-space:nowrap;">GÜNLÜK SERVİS RAPORU</td></tr></table></td></tr></table></td></tr>'
      +'<tr><td class="pad" bgcolor="#102b50" style="padding:34px 30px;background-color:#102b50;"><table role="presentation" width="100%"><tr><td class="mobile-block" width="55%" valign="middle"><div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;letter-spacing:2px;font-weight:bold;color:#42a1ff;">SERVİSDRAMA</div><h1 class="hero-title" style="margin:8px 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:34px;line-height:40px;color:#ffffff;">Günlük Ziyaret Özeti</h1><div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#d8e5f3;">Sahadaki teknik ekip faaliyetlerinin özeti.</div></td><td class="mobile-block mobile-left" width="45%" valign="middle" align="right"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr><td width="25" valign="middle"><img src="cid:servisdrama-calendar-white" width="18" height="18" alt="" style="display:block;width:18px;height:18px;"></td><td valign="middle" style="padding-right:14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;font-weight:bold;color:#ffffff;white-space:nowrap;">'+esc(reportDate)+'</td><td width="1" bgcolor="#70839a" style="width:1px;background-color:#70839a;font-size:1px;line-height:32px;">&nbsp;</td><td width="25" valign="middle" style="padding-left:14px;"><img src="cid:servisdrama-calendar-white" width="18" height="18" alt="" style="display:block;width:18px;height:18px;"></td><td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#ffffff;white-space:nowrap;">'+esc(week)+'</td></tr></table></td></tr></table></td></tr>'
      +'<tr><td class="pad" style="padding:26px 30px 12px;"><table role="presentation" width="100%" style="border:1px solid #dbe3ec;"><tr><td width="33.33%" align="center" style="padding:20px 8px;border-right:1px solid #dbe3ec;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:24px;line-height:28px;font-weight:bold;color:#1565d8;">'+data.total+'</div><div class="metric" style="font-size:14px;line-height:20px;font-weight:bold;color:#13233f;">Teknik Ziyaret</div></td><td width="33.33%" align="center" style="padding:20px 8px;border-right:1px solid #dbe3ec;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:24px;line-height:28px;font-weight:bold;color:#f59a00;">'+data.installations.length+'</div><div class="metric" style="font-size:14px;line-height:20px;font-weight:bold;color:#13233f;">Kurulum</div></td><td width="33.33%" align="center" style="padding:20px 8px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:24px;line-height:28px;font-weight:bold;color:#078578;">'+(data.activeCount!=null?data.activeCount:data.people.length)+'</div><div class="metric" style="font-size:14px;line-height:20px;font-weight:bold;color:#13233f;">Personel</div></td></tr></table></td></tr>'
      +installationRows+'<tr><td class="pad" style="padding:14px 30px 12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="116" valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:24px;font-weight:bold;color:#13233f;white-space:nowrap;">Teknik Ekip</td><td valign="middle" style="padding-left:12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" bgcolor="#cbd5e1" style="height:1px;background-color:#cbd5e1;font-size:1px;line-height:1px;">&nbsp;</td></tr></table></td></tr></table></td></tr>'
      +staffRows+emptyRows+visitRequestSection+'<tr><td class="pad" align="center" style="padding:22px 30px;border-top:1px solid #dbe3ec;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#7a8799;"><strong style="color:#1565d8;">ServisDrama</strong> • Automated Report • Powered by BKAYACI<br><span style="color:#98a4b4;">Bu e-posta gizlidir ve yalnızca ilgili kişilerle paylaşılmalıdır.</span></td></tr>'
      +'</table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>';
  }

  /* Numune bildirimi — günlük rapor ile AYNI kabuk (logo, koyu mavi başlık,
     Outlook-safe tablo düzeni), sadece içerik numune alanlarına göre değişir. */
  function buildNumuneMailHTML(rec){
    var d=new Date(),reportDate=trDate(d);
    var rows=[['FİRMA',rec.firmAdi],['LABORATUVAR',rec.lab],['EKİPMAN',(rec.ekipmanlar||[]).join(', ')],['ÜRÜN/NUMUNE',(rec.urunler||[]).join(', ')],['GÖNDERİM TARİHİ',rec.tarih||reportDate]];
    if(rec.not)rows.push(['NOT',rec.not]);
    var infoRows=rows.map(function(r){
      return '<tr><td style="padding:12px 16px;border-top:1px solid #dbe3ec;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:#8592a6;width:170px;white-space:nowrap;">'+esc(r[0])+'</td>'
        +'<td style="padding:12px 16px;border-top:1px solid #dbe3ec;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#13233f;">'+esc(r[1]||'—')+'</td></tr>';
    }).join('');
    return '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>ServisDrama Numune Bildirimi</title>'
      +'<!--[if mso]><style>table,td,p,a,h1{font-family:Arial,Helvetica,sans-serif!important}</style><![endif]--><style>table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse}img{border:0;outline:none;text-decoration:none;display:block}@media only screen and (max-width:600px){.shell{width:100%!important}.pad{padding-left:18px!important;padding-right:18px!important}.hero-title{font-size:26px!important;line-height:32px!important}}</style></head>'
      +'<body style="margin:0;padding:0;background-color:#f3f6fa;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">'+esc(rec.firmAdi)+' için yeni numune kaydı — '+esc(reportDate)+'.</div>'
      +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f6fa"><tr><td align="center" style="padding:24px 10px;">'
      +'<!--[if mso]><table role="presentation" width="680"><tr><td><![endif]--><table role="presentation" class="shell" width="680" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:680px;max-width:680px;background-color:#ffffff;border:1px solid #dbe3ec;">'
      +'<tr><td class="pad" style="padding:18px 30px;"><table role="presentation" width="100%"><tr><td width="185" valign="middle"><img src="cid:drama-makine-logo" width="158" height="58" alt="Drama Makine" style="display:block;width:158px;height:58px;object-fit:contain;"></td><td valign="middle" align="right"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr><td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:15px;letter-spacing:1.3px;font-weight:bold;color:#13233f;border:1px solid #13233f;padding:10px 13px;white-space:nowrap;">NUMUNE BİLDİRİMİ</td></tr></table></td></tr></table></td></tr>'
      +'<tr><td class="pad" bgcolor="#102b50" style="padding:34px 30px;background-color:#102b50;"><table role="presentation" width="100%"><tr><td valign="middle"><div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;letter-spacing:2px;font-weight:bold;color:#42a1ff;">SERVİSDRAMA</div><h1 class="hero-title" style="margin:8px 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:34px;line-height:40px;color:#ffffff;">Yeni Numune Bildirimi</h1><div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#d8e5f3;">Takip No: '+esc(rec.id)+'</div></td></tr></table></td></tr>'
      +'<tr><td class="pad" style="padding:26px 30px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dbe3ec;">'+infoRows+'</table></td></tr>'
      +'<tr><td class="pad" style="padding:14px 30px 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eff6ff" style="background-color:#eff6ff;border:1px solid #bfdbfe;"><tr><td style="padding:16px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:13px;line-height:19px;font-weight:bold;color:#1565d8;">Analiz Sonucu Bekleniyor</div><div style="font-size:13px;line-height:19px;color:#3b6fa8;margin-top:3px;">Sonuç geldiğinde ServisDrama sisteminden işaretleyin.</div></td></tr></table></td></tr>'
      +'<tr><td class="pad" align="center" style="padding:22px 30px;border-top:1px solid #dbe3ec;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#7a8799;"><strong style="color:#1565d8;">ServisDrama</strong> • Numune Takip • Powered by BKAYACI<br><span style="color:#98a4b4;">Bu e-posta gizlidir ve yalnızca ilgili kişilerle paylaşılmalıdır.</span></td></tr>'
      +'</table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>';
  }

  /* Numune hatırlatma — aynı kabuk, turuncu/kırmızı vurgu ile "sonuç hâlâ gelmedi" uyarısı. */
  function buildNumuneReminderMailHTML(rec,days){
    var d=new Date(),reportDate=trDate(d);
    var rows=[['FİRMA',rec.firmAdi],['LABORATUVAR',rec.lab],['EKİPMAN',(rec.ekipmanlar||[]).join(', ')],['ÜRÜN/NUMUNE',(rec.urunler||[]).join(', ')],['GÖNDERİM TARİHİ',rec.tarih||reportDate]];
    if(rec.not)rows.push(['NOT',rec.not]);
    var infoRows=rows.map(function(r){
      return '<tr><td style="padding:12px 16px;border-top:1px solid #dbe3ec;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:#8592a6;width:170px;white-space:nowrap;">'+esc(r[0])+'</td>'
        +'<td style="padding:12px 16px;border-top:1px solid #dbe3ec;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#13233f;">'+esc(r[1]||'—')+'</td></tr>';
    }).join('');
    return '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>ServisDrama Numune Hatırlatma</title>'
      +'<!--[if mso]><style>table,td,p,a,h1{font-family:Arial,Helvetica,sans-serif!important}</style><![endif]--><style>table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse}img{border:0;outline:none;text-decoration:none;display:block}@media only screen and (max-width:600px){.shell{width:100%!important}.pad{padding-left:18px!important;padding-right:18px!important}.hero-title{font-size:26px!important;line-height:32px!important}}</style></head>'
      +'<body style="margin:0;padding:0;background-color:#f3f6fa;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">'+esc(rec.firmAdi)+' numunesi '+days+' iş günüdür sonuçlanmadı.</div>'
      +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f6fa"><tr><td align="center" style="padding:24px 10px;">'
      +'<!--[if mso]><table role="presentation" width="680"><tr><td><![endif]--><table role="presentation" class="shell" width="680" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:680px;max-width:680px;background-color:#ffffff;border:1px solid #dbe3ec;">'
      +'<tr><td class="pad" style="padding:18px 30px;"><table role="presentation" width="100%"><tr><td width="185" valign="middle"><img src="cid:drama-makine-logo" width="158" height="58" alt="Drama Makine" style="display:block;width:158px;height:58px;object-fit:contain;"></td><td valign="middle" align="right"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr><td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:15px;letter-spacing:1.3px;font-weight:bold;color:#8a3b00;border:1px solid #8a3b00;padding:10px 13px;white-space:nowrap;">NUMUNE HATIRLATMA</td></tr></table></td></tr></table></td></tr>'
      +'<tr><td class="pad" bgcolor="#7a2e00" style="padding:34px 30px;background-color:#7a2e00;"><table role="presentation" width="100%"><tr><td valign="middle"><div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;letter-spacing:2px;font-weight:bold;color:#ffb27a;">SERVİSDRAMA</div><h1 class="hero-title" style="margin:8px 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:34px;line-height:40px;color:#ffffff;">Numune Sonucu Bekleniyor</h1><div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#ffe3cc;">Takip No: '+esc(rec.id)+' • '+days+' iş günüdür sonuç girilmedi</div></td></tr></table></td></tr>'
      +'<tr><td class="pad" style="padding:26px 30px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dbe3ec;">'+infoRows+'</table></td></tr>'
      +'<tr><td class="pad" style="padding:14px 30px 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fff7ed" style="background-color:#fff7ed;border:1px solid #fdba74;"><tr><td style="padding:16px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:13px;line-height:19px;font-weight:bold;color:#9a3412;">Bu numune henüz sonuçlanmadı</div><div style="font-size:13px;line-height:19px;color:#b45309;margin-top:3px;">Analiz merkeziyle takip edip sonucu ServisDrama sisteminden işaretleyin.</div></td></tr></table></td></tr>'
      +'<tr><td class="pad" align="center" style="padding:22px 30px;border-top:1px solid #dbe3ec;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#7a8799;"><strong style="color:#1565d8;">ServisDrama</strong> • Numune Takip • Powered by BKAYACI<br><span style="color:#98a4b4;">Bu e-posta gizlidir ve yalnızca ilgili kişilerle paylaşılmalıdır.</span></td></tr>'
      +'</table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>';
  }

  function buildOutlookRaporHTMLPreview(){
    var html=buildOutlookRaporHTML();
    return html.replace(/cid:drama-makine-logo/g,'assets/email/servisdrama/drama-makine-logo.png')
      .replace(/cid:servisdrama-calendar-white/g,'assets/email/servisdrama/icon-calendar-white.png')
      .replace(/cid:icon-star/g,'assets/email/servisdrama/icon-star.png')
      .replace(/cid:icon-phone/g,'assets/email/servisdrama/icon-phone.png')
      .replace(/cid:icon-mail/g,'assets/email/servisdrama/icon-mail.png');
  }

  global.buildOutlookRaporHTML=buildOutlookRaporHTML;
  global.buildOutlookRaporHTMLPreview=buildOutlookRaporHTMLPreview;
  global.buildNumuneMailHTML=buildNumuneMailHTML;
  global.buildNumuneReminderMailHTML=buildNumuneReminderMailHTML;
  if(typeof module!=='undefined'&&module.exports)module.exports={buildOutlookRaporHTML:buildOutlookRaporHTML,buildNumuneMailHTML:buildNumuneMailHTML,buildNumuneReminderMailHTML:buildNumuneReminderMailHTML};
})(typeof window!=='undefined'?window:global);
