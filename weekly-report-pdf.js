/* ServisDrama — Yönetici seviyesinde haftalık PDF raporu.
   weekly-report-data.js'in ürettiği veriyi (collectWeeklyDataWithTrend) kullanır;
   mail/Raporlar sayfasındaki dashboard ile aynı sayıları, aynı trend
   karşılaştırmalarını ve aynı "gidilmeyen firma" listesini gösterir. */
(function(){
'use strict';
const C={navy:'#0B2F67',navy2:'#102B50',blue:'#1565D8',green:'#16A34A',orange:'#F58220',purple:'#7C3AED',red:'#DC2626',ink:'#13233F',muted:'#6B778A',line:'#DCE4EE',soft:'#F4F7FB',white:'#FFFFFF'};

function trDate(d){const months=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];return d.getDate()+' '+months[d.getMonth()]+' '+d.getFullYear();}
function fmt(d){return d?String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear():'';}
async function imageData(url){try{const r=await fetch(url);if(!r.ok)return null;const b=await r.blob();return await new Promise((ok,err)=>{const fr=new FileReader();fr.onload=()=>ok(fr.result);fr.onerror=err;fr.readAsDataURL(b);});}catch(e){return null;}}

/* NOT: pdfMake'in gömülü Roboto altkümesinde ▲▼★☆ gibi dingbat karakterler
   yok — metin olarak yazılırsa boş kutucuk (tofu) çıkıyor. Yön için ok yerine
   +/- işaretli renkli yüzde, yıldız için de metin yerine gerçek SVG daire
   kullanıyoruz; ikisi de font glifine bağımlı değil. */
function trendRun(t,invert){
  if(!t)return{text:'',fontSize:6,color:C.muted};
  if(t.type==='new')return{text:[{text:'Geçen Dönem: 0  '},{text:'Yeni',color:C.blue,bold:true}],fontSize:6,color:C.muted};
  if(t.type==='flat')return{text:'Geçen Dönem: '+t.prev+'  %0',fontSize:6,color:C.muted};
  const good=invert?t.type==='down':t.type==='up';
  const sign=t.type==='up'?'+':'-';
  return{text:[{text:'Geçen Dönem: '+t.prev+'  '},{text:sign+'%'+Math.abs(t.value),color:good?C.green:C.red,bold:true}],fontSize:6,color:C.muted};
}
function card(label,value,color,trendObj,invert){
  return{table:{widths:['*'],body:[[{margin:[9,7,9,6],stack:[
    {text:label,fontSize:6.5,bold:true,color:C.muted},
    {text:String(value),fontSize:18,bold:true,color:color,margin:[0,3,0,2]},
    trendRun(trendObj,invert)
  ]}]]},layout:{fillColor:()=>C.white,hLineColor:()=>C.line,vLineColor:()=>C.line,hLineWidth:()=>0.7,vLineWidth:()=>0.7},margin:[1.5,0]};
}
function starSvg(score){
  if(score==null)return{text:'—',fontSize:7,color:C.muted,alignment:'center'};
  const filled=Math.max(0,Math.min(5,Math.round(score/20)));
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="50" height="9">`;
  for(let i=0;i<5;i++)s+=`<circle cx="${5+i*10}" cy="4.5" r="3.6" fill="${i<filled?'#F5A623':'none'}" stroke="#F5A623" stroke-width="1"/>`;
  return{svg:s+'</svg>',width:50,height:9};
}
function badgeCell(r){return{stack:[{text:r.score==null?r.grade.g:(r.grade.g+'  '+r.score),bold:true,color:C.white,fontSize:7,alignment:'center',margin:[2,2,2,2]}],fillColor:r.grade.color};}
function daysAgoText(r){
  if(!r.registered)return'—';
  if(!r.lastVisit)return'İlk ziyaret';
  const days=Math.max(0,Math.round((r.dateObj-r.lastVisit)/864e5));
  return days+' gün';
}
function planColor(p){return p==='Plana Uygun'?C.green:(p==='Program Dışı'?C.purple:C.orange);}

/* NOT: svg genişlikleri, içine konduğu pdfMake sütununun GERÇEK genişliğinden
   büyük olursa komşu sütuna taşıp üst üste biniyor — bu yüzden burada ve
   çağrı noktalarında sütun genişliğine göre HESAPLANMIŞ, güvenli değerler
   kullanılıyor (sabit/tahmini değerler değil). */
function barSvg(obj,w,h){
  const keys=Object.keys(obj),max=Math.max(1,...keys.map(k=>obj[k]));
  const maxChars=keys.reduce((m,k)=>Math.max(m,String(k).length),4);
  const left=Math.max(46,Math.min(w*0.46,maxChars*4.3));
  const bw=Math.max(24,w-left-26);
  const row=Math.max(20,(h-10)/Math.max(1,keys.length));
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`;
  keys.forEach((k,i)=>{const y=6+i*row,ww=Math.round(obj[k]/max*bw);s+=`<text x="0" y="${y+11}" font-size="8" fill="${C.ink}" font-family="Roboto">${String(k).replace(/&/g,'&amp;')}</text><rect x="${left}" y="${y}" width="${bw}" height="13" rx="3" fill="#EAF0F7"/><rect x="${left}" y="${y}" width="${ww}" height="13" rx="3" fill="${C.blue}"/><text x="${left+bw+5}" y="${y+11}" font-size="9" font-weight="700" fill="${C.ink}" font-family="Roboto">${obj[k]}</text>`;});
  return s+(keys.length?'':`<text x="0" y="16" font-size="8" fill="${C.muted}">Kayıt yok</text>`)+'</svg>';
}
function donutSvg(d,w){
  const p=d.planRate,r=Math.min(30,w*0.22),cx=r+10,cy=r+10,circ=2*Math.PI*r,dash=circ*p/100,h=(r+10)*2+8;
  const lx=cx+r+14,lh=15;
  const legend=[['Plana Uygun',d.uygun,C.green],['Program Dışı',d.programDisi,C.purple],['Plan Dışı',d.planDisi,C.orange]]
    .map((row,i)=>`<rect x="${lx}" y="${cy-lh+i*lh}" width="7" height="7" fill="${row[2]}"/><text x="${lx+10}" y="${cy-lh+7+i*lh}" font-size="6.6" fill="${C.ink}" font-family="Roboto">${row[0]} ${row[1]}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#EEE8FF" stroke-width="${Math.max(9,r*0.42)}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.green}" stroke-width="${Math.max(9,r*0.42)}" stroke-dasharray="${dash} ${circ-dash}" transform="rotate(-90 ${cx} ${cy})"/><text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="${Math.max(10,r*0.36)}" font-weight="700" fill="${C.ink}" font-family="Roboto">%${p}</text>${legend}</svg>`;
}
function scoreSvg(d,w){
  const bands=[['A+',90,100,C.green],['A',80,89,'#46A758'],['B+',70,79,'#EAB308'],['B',60,69,C.orange],['C',40,59,'#EA580C'],['D',0,39,C.red]],counts={};
  bands.forEach(x=>counts[x[0]]=0);let unknown=0;
  d.rows.forEach(r=>{if(r.grade&&r.grade.g!=='-')counts[r.grade.g]=(counts[r.grade.g]||0)+1;else unknown++;});
  const rows=unknown>0?bands.concat([['-',0,0,'#94A3B8']]):bands;
  const rowH=15,countX=w-6,rangeX=36;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${rows.length*rowH+8}">`;
  rows.forEach((x,i)=>{
    const y=4+i*rowH,label=x[0]==='-'?'-':x[0],rangeText=x[0]==='-'?'Kayıt yok':(x[1]+'-'+x[2]),count=x[0]==='-'?unknown:(counts[x[0]]||0);
    s+=`<rect x="2" y="${y}" width="26" height="12" rx="3" fill="${x[3]}"/><text x="15" y="${y+8.7}" text-anchor="middle" font-size="7" font-weight="700" fill="white" font-family="Roboto">${label}</text><text x="${rangeX}" y="${y+8.7}" font-size="6.8" fill="${C.muted}" font-family="Roboto">${rangeText}</text><text x="${countX}" y="${y+8.7}" text-anchor="end" font-size="8" font-weight="700" fill="${C.ink}" font-family="Roboto">${count}</text>`;
  });
  return s+'</svg>';
}
function tableLayout(){return{fillColor:(i)=>i===0?C.navy:(i%2===0?'#F8FAFD':C.white),hLineColor:()=>C.line,vLineColor:()=>C.line,hLineWidth:()=>0.45,vLineWidth:()=>0.45,paddingLeft:()=>4,paddingRight:()=>4,paddingTop:()=>3.5,paddingBottom:()=>3.5};}

async function buildPdf(d){
  if(typeof pdfMake==='undefined')throw new Error('PDF motoru yüklenemedi. İnternet bağlantısını kontrol edin.');
  const logo=await imageData('assets/email/technical-service/drama-makine-logo.png');
  const topRows=d.rows.slice().sort((a,b)=>b.dateObj-a.dateObj).slice(0,7);
  const g=window.weeklyReportGrade;

  const headerSummary=['Firma','Teknisyen (Kod)','Ziyaret Tarihi','Durum','Son Ziyaret','Kaç Gün Önce','Firma Skoru','Plan Durumu','Not'].map(h=>({text:h,style:'th'}));
  const summaryRows=topRows.map(r=>[r.firma,r.teknisyen+' ('+r.techCode+')',r.tarih,{text:'Tamamlandı',color:C.green,bold:true},r.lastVisit?fmt(r.lastVisit):(r.registered?'İlk ziyaret':'—'),daysAgoText(r),badgeCell(r),{text:r.plan,bold:true,color:planColor(r.plan)},r.not||'-']);

  const headerDetail=['Firma','Teknisyen (Kod)','Ziyaret Tarihi','Durum','Son Ziyaret','Kaç Gün Önce','Firma Skoru','Skor Seviyesi','Plan Durumu','Not'].map(h=>({text:h,style:'th'}));
  const detailRows=d.rows.map(r=>[r.firma,r.teknisyen+' ('+r.techCode+')',r.tarih,{text:'Tamamlandı',color:C.green,bold:true},r.lastVisit?fmt(r.lastVisit):(r.registered?'İlk ziyaret':'—'),daysAgoText(r),badgeCell(r),starSvg(r.score),{text:r.plan,bold:true,color:planColor(r.plan)},r.not||'-']);

  const missedRows=d.missed.map(m=>[m.firma,m.bolge,m.teknisyen+' ('+m.techCode+')',m.lastVisit?fmt(m.lastVisit):'Hiç ziyaret edilmedi']);

  const doc={pageSize:'A4',pageOrientation:'landscape',pageMargins:[24,25,24,30],defaultStyle:{font:'Roboto',color:C.ink,fontSize:8},
    styles:{th:{bold:true,color:C.white,fontSize:6.5,alignment:'center'},sec:{fontSize:9,bold:true,color:C.navy,margin:[0,0,0,5]}},
    footer:(p,n)=>({margin:[24,4,24,0],columns:[{text:'ServisDrama • Haftalık Rapor',color:C.white,bold:true,fontSize:7},{text:'Powered by BKAYACI',color:C.white,fontSize:7,alignment:'center'},{text:'www.dramamakine.com     Sayfa '+p+' / '+n,color:C.white,fontSize:7,alignment:'right'}],canvas:[{type:'rect',x:-24,y:-8,w:842,h:28,color:C.navy}]}),
    content:[
      {columns:[
        logo?{image:logo,width:105}:{text:'drama\nmakine',fontSize:17,bold:true,color:C.navy},
        {width:'*',margin:[14,2,0,0],stack:[{text:'TEKNİK SERVİS HAFTALIK RAPORU',fontSize:21,bold:true,color:C.navy},{text:'SERVİSDRAMA',fontSize:8,bold:true,color:C.blue,margin:[0,3,0,0]}]},
        {width:195,columns:[{stack:[{text:'DÖNEM',fontSize:7,bold:true},{text:fmt(d.start)+' - '+fmt(d.end),fontSize:9,bold:true,color:C.navy}]},{stack:[{text:'RAPOR TARİHİ',fontSize:7,bold:true},{text:trDate(new Date()),fontSize:9,bold:true,color:C.navy}],margin:[18,0,0,0]}]}
      ]},
      {canvas:[{type:'line',x1:0,y1:7,x2:792,y2:7,lineWidth:2,lineColor:C.navy}],margin:[0,0,0,13]},

      {columns:[
        card('TOPLAM ZİYARET',d.total,C.blue,d.trend.total,false),
        card('ZİYARET EDİLEN FİRMA',d.unique,C.green,d.trend.unique,false),
        card('PLANA UYGUN',d.uygun,C.green,d.trend.uygun,false),
        card('PLAN DIŞI',d.planDisi,C.orange,d.trend.planDisi,true),
        card('PROGRAM DIŞI',d.programDisi,C.purple,d.trend.programDisi,true),
        card('GİDİLMEYEN FİRMA',d.missed.length,C.red,d.trend.missed,true),
        card('ORT. FİRMA SKORU',d.avgScore,C.navy,d.trend.avgScore,false),
        card('PLAN UYUM ORANI','%'+d.planRate,C.blue,d.trend.planRate,false)
      ],columnGap:3,margin:[0,0,0,13]},

      {columns:[
        {width:'25%',table:{widths:['*'],body:[[{stack:[{text:'TEKNİSYENE GÖRE ZİYARET',style:'sec'},{svg:barSvg(d.tech,168,110)}],margin:8}]]},layout:{hLineColor:()=>C.line,vLineColor:()=>C.line,hLineWidth:()=>0.6,vLineWidth:()=>0.6}},
        {width:'25%',table:{widths:['*'],body:[[{stack:[{text:'GÜNLERE GÖRE ZİYARET DAĞILIMI',style:'sec'},{svg:barSvg(d.days,168,110)}],margin:8}]]},layout:{hLineColor:()=>C.line,vLineColor:()=>C.line,hLineWidth:()=>0.6,vLineWidth:()=>0.6}},
        {width:'23%',table:{widths:['*'],body:[[{stack:[{text:'PLAN DURUMU DAĞILIMI',style:'sec'},{svg:donutSvg(d,153)}],margin:8}]]},layout:{hLineColor:()=>C.line,vLineColor:()=>C.line,hLineWidth:()=>0.6,vLineWidth:()=>0.6}},
        {width:'27%',table:{widths:['*'],body:[[{stack:[{text:'FİRMA SKOR DAĞILIMI',style:'sec'},{svg:scoreSvg(d,183)}],margin:8}]]},layout:{hLineColor:()=>C.line,vLineColor:()=>C.line,hLineWidth:()=>0.6,vLineWidth:()=>0.6}}
      ],columnGap:8,margin:[0,0,0,12]},

      {text:'SON ZİYARETLER - ÖZET',style:'sec'},
      {table:{headerRows:1,widths:[130,90,48,52,55,42,52,62,'*'],body:[headerSummary].concat(summaryRows)},layout:tableLayout()},
      {text:'Not: Kaç Gün Önce, bu ziyaretten önceki en güncel tamamlanmış ziyaretten bu yana geçen gün sayısıdır. Firma skoru; ziyaret düzenliliği, açık numune ve ekip sürekliliğine göre hesaplanır.',fontSize:6.5,italics:true,color:C.muted,margin:[0,6,0,0]},

      {text:'',pageBreak:'before'},
      {columns:[{text:'GİDİLMESİ GEREKİP GİDİLMEYEN FİRMALAR',fontSize:13,bold:true,color:C.red},{text:d.missed.length+' / '+d.scheduledCount+' firma',alignment:'right',fontSize:9,bold:true,color:C.muted}],margin:[0,0,0,8]},
      d.missed.length
        ?{table:{headerRows:1,widths:[220,90,120,'*'],body:[['Firma','Bölge','Teknisyen (Kod)','Son Ziyaret'].map(h=>({text:h,style:'th'}))].concat(missedRows)},layout:{fillColor:(i)=>i===0?C.red:(i%2===0?'#FEF2F2':C.white),hLineColor:()=>C.line,vLineColor:()=>C.line,hLineWidth:()=>0.45,vLineWidth:()=>0.45,paddingLeft:()=>4,paddingRight:()=>4,paddingTop:()=>3.5,paddingBottom:()=>3.5},margin:[0,0,0,14]}
        :{text:'✓ Bu dönem planlanan tüm firmalar ziyaret edildi.',color:C.green,bold:true,fontSize:9,margin:[0,0,0,14]},

      {columns:[{text:'ZİYARET DETAYI',fontSize:13,bold:true,color:C.navy},{text:'Dönem: '+fmt(d.start)+' - '+fmt(d.end),alignment:'right',fontSize:8,bold:true,color:C.muted}],margin:[0,0,0,8]},
      {table:{headerRows:1,widths:[112,78,40,50,50,38,44,54,58,'*'],body:[headerDetail].concat(detailRows),dontBreakRows:true},layout:tableLayout()},

      {columns:[
        {width:'55%',margin:[0,12,10,0],table:{widths:['*'],body:[[{stack:[{text:'YÖNETİCİ DEĞERLENDİRMESİ',fontSize:9,bold:true,color:C.navy},{text:'• Plan uyum oranı: %'+d.planRate+'\n• Ortalama firma skoru: '+d.avgScore+' ('+g(d.avgScore).g+')\n• Program dışı ziyaret: '+d.programDisi+'\n• Plan dışı ziyaret: '+d.planDisi+'\n• Gidilmesi gerekip gidilmeyen firma: '+d.missed.length+' / '+d.scheduledCount,fontSize:8,lineHeight:1.5,margin:[0,6,0,0]}],margin:10}]]},layout:{fillColor:()=>C.soft,hLineColor:()=>C.line,vLineColor:()=>C.line,hLineWidth:()=>0.6,vLineWidth:()=>0.6}},
        {width:'45%',margin:[0,12,0,0],table:{widths:['*'],body:[[{stack:[
          {text:'RAPOR AÇIKLAMALARI',fontSize:9,bold:true,color:C.navy},
          {text:'Toplam Ziyaret\nDönemde tamamlanmış tüm ziyaretlerin (planlı + program dışı) toplam sayısıdır.\n\nZiyaret Edilen Firma\nBu dönemde en az bir kez ziyaret edilen tekil firma sayısıdır.\n\nPlana Uygun\nFirmanın kendi haftalık planına denk gelen haftada yapılan ziyarettir.\n\nPlan Dışı\nFirmanın o hafta planlı olmadığı halde yapılan ziyarettir; düzensizliğe işaret eder.\n\nProgram Dışı\nSisteme önceden kayıtlı olmayan, sahada anlık eklenen ek ziyaretlerdir.\n\nGidilmeyen Firma\nO hafta planlandığı halde hiç ziyaret edilmeyen aktif firma sayısıdır.\n\nPlan Uyum Oranı\nPlana uygun ziyaretlerin toplam ziyaretlere oranıdır.\n\nFirma Skoru\n0-100 arası puan; ilk ziyaretten bu döneme kadar geçen tüm haftaların ortalama uyum oranıdır (beklenen hafta sayısına göre kaç haftada gerçekten ziyaret edilmiş), buna açık numune sayısı ve teknisyen sürekliliği düzeltme olarak eklenir. Hiç ziyaret edilmemiş firmalar sabit düşük puanla işaretlenir. A+ (90-100) mükemmel, D (0-39) kritik seviyeyi gösterir.\n\nSkor Seviyesi\nFirma skorunun 5 üzerinden yıldız gösterimidir.\n\nSon Ziyaret / Kaç Gün Önce\nBu ziyaretten önceki en güncel tamamlanmış ziyaret tarihi ve o tarihten bu yana geçen gün sayısıdır.',fontSize:6.3,lineHeight:1.3,margin:[0,6,0,0]}
        ],margin:9}]]},layout:{fillColor:()=>C.white,hLineColor:()=>C.line,vLineColor:()=>C.line,hLineWidth:()=>0.6,vLineWidth:()=>0.6}}
      ]}
    ]
  };
  return pdfMake.createPdf(doc);
}
function getBuffer(pdf){return new Promise((ok,err)=>{try{pdf.getBuffer(b=>ok(b));}catch(e){err(e);}});}
function b64(buffer){var bytes=new Uint8Array(buffer),binary='',chunk=0x8000;for(var i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode.apply(null,bytes.subarray(i,Math.min(i+chunk,bytes.length)));return btoa(binary);}

window.buildWeeklyReportPdf=buildPdf;
window.weeklyReportPdfBuffer=async function(d){const pdf=await buildPdf(d);return getBuffer(pdf);};
window.weeklyReportPdfBase64=async function(d){const buf=await window.weeklyReportPdfBuffer(d);return b64(buf);};
window.downloadWeeklyReportPdf=async function(d,filename){const pdf=await buildPdf(d);pdf.download(filename);};
})();
