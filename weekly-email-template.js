/* ServisDrama — Haftalık rapor e-postası (Outlook-safe).
   Yönetici PDF raporuyla aynı görsel dili kullanır (tablo düzeni, aynı renk
   paleti), ama SVG/donut yerine tablo tabanlı çubuklar kullanır çünkü Outlook
   masaüstü SVG/canvas/border-radius desteklemez. weekly-report-data.js'in
   ürettiği veriyi (collectWeeklyDataWithTrend) girdi alır. */
(function(global){
  'use strict';

  var C={navy:'#0B2F67',navy2:'#102B50',blue:'#1565D8',green:'#16A34A',orange:'#F58220',purple:'#7C3AED',red:'#DC2626',ink:'#13233F',muted:'#6B778A',line:'#DCE4EE',soft:'#F4F7FB'};

  function esc(v){
    return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  function trDate(date){
    var months=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    return date.getDate()+' '+months[date.getMonth()]+' '+date.getFullYear();
  }
  function fmtShort(d){
    return d?(String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear()):'';
  }
  function planColor(plan){
    return plan==='Plana Uygun'?C.green:(plan==='Program Dışı'?C.purple:C.orange);
  }

  /* Trend oku: iyi yön (up=yeşil) varsayılan; invert=true olan kartlarda
     (Plan Dışı, Program Dışı gibi "azsa iyi" metriklerde) yön renkleri ters çevrilir. */
  function trendLine(t,invert){
    if(!t)return'';
    var arrow='',color=C.muted,text='';
    if(t.type==='new'){arrow='';color=C.blue;text='Yeni';}
    else if(t.type==='flat'){arrow='';color=C.muted;text='%0';}
    else{
      var good=invert?t.type==='down':t.type==='up';
      arrow=t.type==='up'?'&#9650;':'&#9660;';
      color=good?C.green:C.red;
      text='%'+Math.abs(t.value);
    }
    return '<div style="font-size:10px;line-height:14px;color:'+C.muted+';margin-top:5px;">Geçen Dönem: '+t.prev+' <span style="color:'+color+';font-weight:bold;">'+arrow+' '+text+'</span></div>';
  }

  function statCard(icon,color,value,label,trend,invert){
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid '+C.line+';"><tr><td style="padding:12px 10px;font-family:Arial,Helvetica,sans-serif;">'
      +'<table role="presentation" width="28" height="28" cellpadding="0" cellspacing="0" border="0" bgcolor="'+color+'" style="width:28px;height:28px;background-color:'+color+';"><tr><td align="center" valign="middle"><img src="cid:'+icon+'" width="15" height="15" alt="" style="display:block;width:15px;height:15px;"></td></tr></table>'
      +'<div style="font-size:21px;line-height:25px;font-weight:bold;color:'+C.ink+';margin-top:8px;">'+esc(value)+'</div>'
      +'<div style="font-size:10.5px;line-height:14px;font-weight:bold;color:'+C.muted+';margin-top:2px;">'+esc(label)+'</div>'
      +trendLine(trend,invert)
      +'</td></tr></table>';
  }

  function statCardsGrid(d){
    var t=d.trend;
    var cards=[
      statCard('stat-visits',C.blue,d.total,'TOPLAM ZİYARET',t.total,false),
      statCard('stat-companies',C.green,d.unique,'ZİYARET EDİLEN FİRMA',t.unique,false),
      statCard('stat-check',C.green,d.uygun,'PLANA UYGUN',t.uygun,false),
      statCard('stat-alert',C.orange,d.planDisi,'PLAN DIŞI',t.planDisi,true),
      statCard('stat-calendar',C.purple,d.programDisi,'PROGRAM DIŞI',t.programDisi,true),
      statCard('stat-score',C.navy,d.avgScore,'ORT. FİRMA SKORU',t.avgScore,false),
      statCard('stat-target',C.blue,'%'+d.planRate,'PLAN UYUM ORANI',t.planRate,false)
    ];
    function row(items){
      var cells=items.map(function(c){return '<td width="25%" valign="top" style="padding:0 4px 8px 0;">'+(c||'')+'</td>';}).join('');
      return '<tr>'+cells+'</tr>';
    }
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;"><colgroup><col width="25%"><col width="25%"><col width="25%"><col width="25%"></colgroup>'
      +row(cards.slice(0,4))+row(cards.slice(4,7).concat(['']))
      +'</table>';
  }

  function barChartBlock(title,obj){
    var keys=Object.keys(obj),max=Math.max(1,keys.map(function(k){return obj[k];}).reduce(function(a,b){return Math.max(a,b);},0));
    var rows=keys.map(function(k){
      var pct=Math.max(4,Math.round(obj[k]/max*100));
      return '<tr><td style="padding:5px 0;font-family:Arial,Helvetica,sans-serif;">'
        +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
        +'<td width="86" valign="middle" style="font-size:10.5px;color:'+C.ink+';padding-right:6px;">'+esc(k)+'</td>'
        +'<td valign="middle"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
        +'<td width="'+pct+'%" bgcolor="'+C.blue+'" style="background-color:'+C.blue+';height:12px;font-size:1px;line-height:12px;">&nbsp;</td>'
        +'<td width="'+(100-pct)+'%" bgcolor="#EAF0F7" style="background-color:#EAF0F7;height:12px;font-size:1px;line-height:12px;">&nbsp;</td>'
        +'</tr></table></td>'
        +'<td width="24" align="right" valign="middle" style="font-size:11px;font-weight:bold;color:'+C.ink+';padding-left:6px;">'+obj[k]+'</td>'
        +'</tr></table></td></tr>';
    }).join('');
    if(!keys.length)rows='<tr><td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:'+C.muted+';">Bu dönemde veri yok.</td></tr>';
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid '+C.line+';"><tr><td style="padding:14px 14px 8px;">'
      +'<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:'+C.navy+';letter-spacing:.3px;margin-bottom:8px;">'+esc(title)+'</div>'
      +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'+rows+'</table>'
      +'</td></tr></table>';
  }

  function planStackedBlock(d){
    var total=Math.max(1,d.uygun+d.programDisi+d.planDisi);
    var segs=[
      {v:d.uygun,color:C.green,label:'Plana Uygun'},
      {v:d.programDisi,color:C.purple,label:'Program Dışı'},
      {v:d.planDisi,color:C.orange,label:'Plan Dışı'}
    ].filter(function(s){return s.v>0;});
    var bar=segs.length
      ?'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
        +segs.map(function(s){var pct=Math.max(2,Math.round(s.v/total*100));return '<td width="'+pct+'%" bgcolor="'+s.color+'" style="background-color:'+s.color+';height:16px;font-size:1px;line-height:16px;">&nbsp;</td>';}).join('')
        +'</tr></table>'
      :'<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:'+C.muted+';">Bu dönemde veri yok.</div>';
    var legend=[
      {color:C.green,label:'Plana Uygun',v:d.uygun},
      {color:C.purple,label:'Program Dışı',v:d.programDisi},
      {color:C.orange,label:'Plan Dışı',v:d.planDisi}
    ].map(function(s){
      return '<tr><td width="10" style="padding:5px 0;"><table role="presentation" width="9" height="9" cellpadding="0" cellspacing="0" border="0" bgcolor="'+s.color+'" style="width:9px;height:9px;background-color:'+s.color+';"><tr><td style="font-size:1px;line-height:9px;">&nbsp;</td></tr></table></td>'
        +'<td style="padding:5px 0 5px 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:'+C.ink+';">'+s.label+'</td>'
        +'<td align="right" style="padding:5px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:'+C.ink+';">'+s.v+'</td></tr>';
    }).join('');
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid '+C.line+';"><tr><td style="padding:14px;">'
      +'<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:'+C.navy+';letter-spacing:.3px;margin-bottom:10px;">PLAN DURUMU DAĞILIMI · %'+d.planRate+' UYUM</div>'
      +bar
      +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">'+legend+'</table>'
      +'</td></tr></table>';
  }

  function scoreDistributionBlock(d,gradeFn){
    var bands=[['A+',90,100],['A',80,89],['B+',70,79],['B',60,69],['C',40,59],['D',0,39]];
    var counts={},unknown=0;bands.forEach(function(b){counts[b[0]]=0;});
    d.rows.forEach(function(r){if(r.grade&&r.grade.g!=='-')counts[r.grade.g]=(counts[r.grade.g]||0)+1;else unknown++;});
    var rows=bands.map(function(b){
      var g=gradeFn(b[1]);
      return '<tr><td width="34" style="padding:4px 0;"><table role="presentation" width="30" height="16" cellpadding="0" cellspacing="0" border="0" bgcolor="'+g.color+'" style="width:30px;height:16px;background-color:'+g.color+';"><tr><td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:bold;color:#ffffff;">'+b[0]+'</td></tr></table></td>'
        +'<td style="padding:4px 0 4px 8px;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:'+C.muted+';">'+b[1]+'-'+b[2]+'</td>'
        +'<td align="right" style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:'+C.ink+';">'+(counts[b[0]]||0)+'</td></tr>';
    }).join('');
    if(unknown>0){
      rows+='<tr><td width="34" style="padding:4px 0;"><table role="presentation" width="30" height="16" cellpadding="0" cellspacing="0" border="0" bgcolor="#94A3B8" style="width:30px;height:16px;background-color:#94A3B8;"><tr><td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:bold;color:#ffffff;">-</td></tr></table></td>'
        +'<td style="padding:4px 0 4px 8px;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:'+C.muted+';">Kayıt yok</td>'
        +'<td align="right" style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:'+C.ink+';">'+unknown+'</td></tr>';
    }
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid '+C.line+';"><tr><td style="padding:14px;">'
      +'<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:'+C.navy+';letter-spacing:.3px;margin-bottom:8px;">FİRMA SKOR DAĞILIMI · ORT. '+d.avgScore+'</div>'
      +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'+rows+'</table>'
      +'</td></tr></table>';
  }

  function summaryTable(rows){
    var head='<tr>'+['Firma','Teknisyen (Kod)','Tarih','Durum','Son Ziyaret','Skor','Plan Durumu','Not'].map(function(h){
      return '<td bgcolor="'+C.navy+'" style="background-color:'+C.navy+';padding:9px 8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#ffffff;white-space:nowrap;">'+h+'</td>';
    }).join('')+'</tr>';
    var body=rows.map(function(r,i){
      var bg=i%2===0?'#ffffff':'#F8FAFD';
      return '<tr>'
        +'<td bgcolor="'+bg+'" style="background-color:'+bg+';padding:8px;border-top:1px solid '+C.line+';font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:'+C.ink+';">'+esc(r.firma)+'</td>'
        +'<td bgcolor="'+bg+'" style="background-color:'+bg+';padding:8px;border-top:1px solid '+C.line+';font-family:Arial,Helvetica,sans-serif;font-size:11px;color:'+C.ink+';white-space:nowrap;">'+esc(r.teknisyen)+' ('+esc(r.techCode)+')</td>'
        +'<td bgcolor="'+bg+'" style="background-color:'+bg+';padding:8px;border-top:1px solid '+C.line+';font-family:Arial,Helvetica,sans-serif;font-size:11px;color:'+C.ink+';white-space:nowrap;">'+esc(r.tarih)+'</td>'
        +'<td bgcolor="'+bg+'" style="background-color:'+bg+';padding:8px;border-top:1px solid '+C.line+';font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:'+C.green+';white-space:nowrap;">&#9679; Tamamlandı</td>'
        +'<td bgcolor="'+bg+'" style="background-color:'+bg+';padding:8px;border-top:1px solid '+C.line+';font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:'+C.muted+';white-space:nowrap;">'+(r.lastVisit?fmtShort(r.lastVisit):'İlk ziyaret')+'</td>'
        +'<td bgcolor="'+bg+'" style="background-color:'+bg+';padding:8px;border-top:1px solid '+C.line+';">'+(r.grade?'<span style="display:inline-block;padding:3px 7px;background-color:'+r.grade.color+';color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;">'+r.grade.g+' '+(r.score==null?'-':r.score)+'</span>':'-')+'</td>'
        +'<td bgcolor="'+bg+'" style="background-color:'+bg+';padding:8px;border-top:1px solid '+C.line+';font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:'+planColor(r.plan)+';white-space:nowrap;">'+esc(r.plan)+'</td>'
        +'<td bgcolor="'+bg+'" style="background-color:'+bg+';padding:8px;border-top:1px solid '+C.line+';font-family:Arial,Helvetica,sans-serif;font-size:11px;color:'+C.ink+';">'+esc(r.not||'-')+'</td>'
        +'</tr>';
    }).join('');
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid '+C.line+';">'+head+body+'</table>';
  }

  function buildWeeklyReportMailHTML(d,gradeFn){
    var reportDate=trDate(new Date());
    var period=fmtShort(d.start)+' – '+fmtShort(d.end);
    var topRows=d.rows.slice().sort(function(a,b){return b.dateObj-a.dateObj;});
    var emptyNote=d.rows.length?'':'<tr><td class="pad" style="padding:0 30px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:'+C.muted+';">Seçilen dönemde tamamlanmış ziyaret bulunmuyor.</td></tr>';

    return '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>ServisDrama Haftalık Rapor</title>'
      +'<!--[if mso]><style>table,td,p,a,h1{font-family:Arial,Helvetica,sans-serif!important}</style><![endif]--><style>table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse}img{border:0;outline:none;text-decoration:none;display:block}@media only screen and (max-width:600px){.shell{width:100%!important}.pad{padding-left:16px!important;padding-right:16px!important}.stack{display:block!important;width:100%!important}}</style></head>'
      +'<body style="margin:0;padding:0;background-color:#f3f6fa;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">'+esc(period)+' teknik servis haftalık yönetici raporu.</div>'
      +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f6fa"><tr><td align="center" style="padding:24px 10px;">'
      +'<!--[if mso]><table role="presentation" width="680"><tr><td><![endif]--><table role="presentation" class="shell" width="680" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:680px;max-width:680px;background-color:#ffffff;border:1px solid '+C.line+';">'

      +'<tr><td class="pad" style="padding:18px 30px;"><table role="presentation" width="100%"><tr>'
      +'<td width="185" valign="middle"><img src="cid:drama-makine-logo" width="158" height="58" alt="Drama Makine" style="display:block;width:158px;height:58px;object-fit:contain;"></td>'
      +'<td valign="middle" align="right"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr><td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:15px;letter-spacing:1.3px;font-weight:bold;color:'+C.ink+';border:1px solid '+C.ink+';padding:10px 13px;white-space:nowrap;">HAFTALIK SERVİS RAPORU</td></tr></table></td>'
      +'</tr></table></td></tr>'

      +'<tr><td class="pad" bgcolor="'+C.navy2+'" style="padding:30px 30px;background-color:'+C.navy2+';"><table role="presentation" width="100%"><tr><td valign="middle">'
      +'<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;letter-spacing:2px;font-weight:bold;color:#42a1ff;">SERVİSDRAMA</div>'
      +'<h1 style="margin:8px 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:28px;line-height:34px;color:#ffffff;">Teknik Servis Haftalık Raporu</h1>'
      +'<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>'
      +'<td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:#9db4d6;">DÖNEM&nbsp;&nbsp;</td><td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#ffffff;padding-right:16px;">'+esc(period)+'</td>'
      +'<td width="1" bgcolor="#39547d" style="width:1px;background-color:#39547d;font-size:1px;">&nbsp;</td>'
      +'<td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:#9db4d6;padding-left:16px;">RAPOR TARİHİ&nbsp;&nbsp;</td><td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#ffffff;">'+esc(reportDate)+'</td>'
      +'</tr></table>'
      +'</td></tr></table></td></tr>'

      +'<tr><td class="pad" style="padding:22px 30px 6px;">'+statCardsGrid(d)+'</td></tr>'

      +'<tr><td class="pad" style="padding:6px 30px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
      +'<td class="stack" width="50%" valign="top" style="padding-right:6px;">'+barChartBlock('TEKNİSYENE GÖRE ZİYARET',d.tech)+'</td>'
      +'<td class="stack" width="50%" valign="top" style="padding-left:6px;">'+barChartBlock('GÜNLERE GÖRE ZİYARET DAĞILIMI',d.days)+'</td>'
      +'</tr></table></td></tr>'

      +'<tr><td class="pad" style="padding:10px 30px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
      +'<td class="stack" width="50%" valign="top" style="padding-right:6px;">'+planStackedBlock(d)+'</td>'
      +'<td class="stack" width="50%" valign="top" style="padding-left:6px;">'+scoreDistributionBlock(d,gradeFn)+'</td>'
      +'</tr></table></td></tr>'

      +'<tr><td class="pad" style="padding:20px 30px 10px;"><div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:22px;font-weight:bold;color:'+C.ink+';">Dönem İçindeki Tüm Ziyaretler ('+topRows.length+')</div></td></tr>'
      +'<tr><td class="pad" style="padding:0 30px 8px;overflow-x:auto;">'+summaryTable(topRows)+'</td></tr>'
      +emptyNote
      +'<tr><td class="pad" style="padding:0 30px 20px;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;font-style:italic;color:'+C.muted+';">Not: Firma skoru; ziyaret düzenliliği, açık numune ve ekip sürekliliğine göre hesaplanır.</td></tr>'

      +'<tr><td class="pad" align="center" style="padding:22px 30px;border-top:1px solid '+C.line+';font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#7a8799;"><strong style="color:'+C.blue+';">ServisDrama</strong> • Haftalık Rapor • Powered by BKAYACI<br><span style="color:#98a4b4;">Bu e-posta gizlidir ve yalnızca ilgili kişilerle paylaşılmalıdır.</span></td></tr>'

      +'</table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>';
  }

  global.buildWeeklyReportMailHTML=buildWeeklyReportMailHTML;
  if(typeof module!=='undefined'&&module.exports)module.exports={buildWeeklyReportMailHTML:buildWeeklyReportMailHTML};
})(typeof window!=='undefined'?window:global);
