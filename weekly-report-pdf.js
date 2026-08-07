/* ServisDrama — Yönetici seviyesinde haftalık PDF raporu.
   weekly-report-data.js'in ürettiği veriyi (collectWeeklyDataWithTrend) kullanır.

   TASARIM NOTLARI
   - Tüm grafik/kart bloklari SVG olarak SABİT yükseklikte üretilir; böylece
     yan yana duran kutular her zaman hizalı kalır (pdfMake sütun yüksekliği
     içeriğe göre değişmez).
   - pdfMake'in gömülü Roboto altkümesinde ▲▼★ gibi dingbat karakterler YOK;
     metin olarak yazılırsa boş kutu (tofu) çıkar. Bu yüzden oklar, yıldızlar
     ve ikonlar gerçek SVG şekilleriyle çizilir.
   - Logo, koyu lacivert başlık üzerinde okunabilmesi için beyaz vektör
     olarak çizilir (PNG logo koyu gri metindir, lacivert üzerinde kaybolur). */
(function(){
'use strict';

const C={
  navy:'#0B2F67',navy2:'#102B50',blue:'#1565D8',green:'#16A34A',orange:'#F58220',
  purple:'#7C3AED',red:'#DC2626',ink:'#13233F',muted:'#6B778A',line:'#E3E9F2',
  soft:'#F7F9FC',white:'#FFFFFF',zebra:'#F8FAFD'
};
const PAGE_W=841.89, MARGIN=18, CONTENT_W=PAGE_W-MARGIN*2;   /* 805.89 */
const HEADER_H=78, FOOTER_H=22;

/* ── genel yardımcılar ─────────────────────────────────────────────── */
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function trDate(d){const m=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];return d.getDate()+' '+m[d.getMonth()]+' '+d.getFullYear();}
function fmt(d){return d?String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear():'';}
function planColor(p){return p==='Plana Uygun'?C.green:(p==='Program Dışı'?C.purple:C.orange);}
function initials(name){const p=String(name||'').trim().split(/\s+/);return((p[0]||'')[0]||'?').toUpperCase()+((p[1]||'')[0]||'').toUpperCase();}
/* Roboto ortalama karakter genişliği ~0.52em (kalın ~0.56em) — SVG'de metin
   ölçemediğimiz için sağa hizalı öğeleri konumlandırmakta kullanılır. */
function textW(s,size,bold){return String(s).length*size*(bold?0.56:0.52);}

/* ── SVG parçaları ─────────────────────────────────────────────────── */
function hexPts(cx,cy,r){
  const p=[];
  for(let i=0;i<6;i++){const a=Math.PI/180*(60*i-90);p.push((cx+r*Math.cos(a)).toFixed(1)+','+(cy+r*Math.sin(a)).toFixed(1));}
  return p.join(' ');
}
/* logoMark() sadece çizim içeriğini döner (dış <svg> yok), çünkü başlık
   bandına gömülürken viewBox ölçeklemesi kaybolur ve elle scale gerekir.
   LOGO_BOX, çizimin GERÇEK sınırlayıcı kutusudur (tarayıcıda getBBox ile
   ölçüldü) — logoTransform() bunu hedef genişliğe/banda oturtur. */
const LOGO_BOX={x:5.9,y:3.5,w:111,h:42.98};
const LOGO_UNIT_W=LOGO_BOX.x*2+LOGO_BOX.w, LOGO_UNIT_H=LOGO_BOX.y*2+LOGO_BOX.h;
function logoTransform(targetX,targetW,bandH){
  const s=targetW/LOGO_BOX.w;
  const tx=targetX-LOGO_BOX.x*s;
  const ty=(bandH-LOGO_BOX.h*s)/2-LOGO_BOX.y*s;
  return `translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${s.toFixed(4)})`;
}
function logoMark(){
  return `<polygon points="${hexPts(24,14,10.5)}" fill="none" stroke="#3E63C8" stroke-width="3.4"/>`
    +`<polygon points="${hexPts(15,31,10.5)}" fill="none" stroke="#1E9E57" stroke-width="3.4"/>`
    +`<polygon points="${hexPts(33,31,10.5)}" fill="none" stroke="#D93A3A" stroke-width="3.4"/>`
    +`<text x="54" y="23" font-family="Roboto" font-size="19" font-weight="700" fill="#FFFFFF">drama</text>`
    +`<text x="54" y="42" font-family="Roboto" font-size="19" font-weight="700" fill="#FFFFFF">makine</text>`;
}
function logoSvg(w,h){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${LOGO_UNIT_W} ${LOGO_UNIT_H}">${logoMark()}</svg>`;
}
/* 16x16 kutuya sığan beyaz ikon glifleri */
function iconPath(kind,x,y){
  const g=(c)=>`<g transform="translate(${x},${y})" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${c}</g>`;
  switch(kind){
    case 'users':   return g(`<circle cx="6" cy="5.5" r="2.6"/><path d="M1.5 13.5c0-2.5 2-4.2 4.5-4.2s4.5 1.7 4.5 4.2"/><circle cx="12" cy="6" r="2"/><path d="M12 9.6c1.8 0 3 1.2 3 2.9"/>`);
    case 'building':return g(`<rect x="2.5" y="2.5" width="7" height="11"/><path d="M9.5 6h4v7.5M4.5 5.5h1M7 5.5h.5M4.5 8h1M7 8h.5M4.5 10.5h1M7 10.5h.5M11 8.5h1M11 11h1"/>`);
    case 'check':   return g(`<path d="M3 8.5l3.2 3.2L13 5"/>`);
    case 'alert':   return g(`<path d="M8 3v6.2"/><circle cx="8" cy="12.4" r=".9" fill="#FFFFFF" stroke="none"/>`);
    case 'calendar':return g(`<rect x="2.5" y="3.5" width="11" height="10" rx="1.4"/><path d="M2.5 6.6h11M5.5 2.2v2.4M10.5 2.2v2.4"/><circle cx="6" cy="9.4" r=".8" fill="#FFFFFF" stroke="none"/><circle cx="10" cy="9.4" r=".8" fill="#FFFFFF" stroke="none"/>`);
    case 'star':    return g(`<path d="M8 2.4l1.75 3.62 3.95.55-2.86 2.8.68 3.99L8 11.48l-3.52 1.88.68-3.99-2.86-2.8 3.95-.55z"/>`);
    case 'target':  return g(`<circle cx="8" cy="8" r="5.6"/><circle cx="8" cy="8" r="2.4"/><circle cx="8" cy="8" r=".6" fill="#FFFFFF" stroke="none"/>`);
    default:        return g(`<circle cx="8" cy="8" r="5"/>`);
  }
}
function sparkline(series,x,y,w,h,color){
  const s=(series||[]).filter(v=>typeof v==='number');
  if(s.length<2)return'';
  const min=Math.min(...s),max=Math.max(...s),span=(max-min)||1;
  const pts=s.map((v,i)=>{
    const px=x+(i/(s.length-1))*w;
    const py=y+h-((v-min)/span)*h;
    return px.toFixed(1)+','+py.toFixed(1);
  }).join(' ');
  const last=s[s.length-1],lx=x+w,ly=y+h-((last-min)/span)*h;
  return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>`
    +`<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="1.7" fill="${color}"/>`;
}
/* Trend satırı: "Geçen Dönem: 32  ▲ %12.5" — ok gerçek üçgen olarak çizilir. */
function trendGroup(t,invert,x,yBase,w,fs){
  if(!t)return'';
  const left=`<text x="${x}" y="${yBase}" font-family="Roboto" font-size="${fs}" fill="${C.muted}">Geçen Dönem: ${t.prev}</text>`;
  let pct,color,dir;
  if(t.type==='new'){pct='Yeni';color=C.blue;dir=null;}
  else if(t.type==='flat'){pct='%0';color=C.muted;dir=null;}
  else{
    const good=invert?t.type==='down':t.type==='up';
    pct='%'+Math.abs(t.value);color=good?C.green:C.red;dir=t.type;
  }
  const pw=textW(pct,fs,true);
  const px=x+w-pw;
  let tri='';
  if(dir){
    const tx=px-6.2,ty=yBase-4.4;
    tri=dir==='up'
      ? `<polygon points="${tx},${ty+4.2} ${tx+4.6},${ty+4.2} ${(tx+2.3).toFixed(1)},${ty}" fill="${color}"/>`
      : `<polygon points="${tx},${ty} ${tx+4.6},${ty} ${(tx+2.3).toFixed(1)},${ty+4.2}" fill="${color}"/>`;
  }
  return left+tri+`<text x="${x+w}" y="${yBase}" text-anchor="end" font-family="Roboto" font-size="${fs}" font-weight="700" fill="${color}">${pct}</text>`;
}
/* Etiketi karta sığacak şekilde en fazla 2 satıra böler. */
function wrapLabel(label,maxW,fs){
  const words=String(label).split(' ');
  const lines=[];let cur='';
  words.forEach(wd=>{
    const cand=cur?cur+' '+wd:wd;
    if(textW(cand,fs,true)<=maxW||!cur)cur=cand; else {lines.push(cur);cur=wd;}
  });
  if(cur)lines.push(cur);
  return lines.slice(0,2);
}

function statCardSvg(o){
  const w=o.w,h=o.h,pad=8;
  const labelLines=wrapLabel(o.label,w-pad*2-22,5.2);
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`
    +`<rect x="0.5" y="0.5" width="${w-1}" height="${h-1}" rx="5" fill="#FFFFFF" stroke="${C.line}"/>`
    +`<rect x="${pad}" y="9" width="17" height="17" rx="4.5" fill="${o.color}"/>`
    +iconPath(o.icon,pad+0.5,9.5);
  labelLines.forEach((ln,i)=>{
    s+=`<text x="${pad+22}" y="${16+i*6.6}" font-family="Roboto" font-size="5.2" font-weight="700" fill="#17355F">${esc(ln)}</text>`;
  });
  s+=`<text x="${pad}" y="46" font-family="Roboto" font-size="16.5" font-weight="700" fill="${C.ink}">${esc(o.value)}</text>`;
  if(o.badge){
    const nw=textW(String(o.value),16.5,true);
    s+=`<text x="${pad+nw+5}" y="46" font-family="Roboto" font-size="9" font-weight="700" fill="${o.badgeColor||C.green}">${esc(o.badge)}</text>`;
  }
  s+=trendGroup(o.trend,o.invert,pad,58,w-pad*2,5.2);
  s+=sparkline(o.series,pad,64,w-pad*2,h-72,o.color);
  return s+'</svg>';
}

function panelSvg(title,inner,w,h){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`
    +`<rect x="0.5" y="0.5" width="${w-1}" height="${h-1}" rx="5" fill="#FFFFFF" stroke="${C.line}"/>`
    +`<text x="12" y="17" font-family="Roboto" font-size="7.6" font-weight="700" fill="${C.navy}">${esc(title)}</text>`
    +inner+'</svg>';
}

function techChartSvg(d,w,h){
  const keys=Object.keys(d.tech),total=keys.reduce((a,k)=>a+d.tech[k],0)||1;
  const colors=[C.blue,C.orange,C.green,C.purple];
  let inner='';
  const top=30,rowH=38;
  keys.slice(0,3).forEach((k,i)=>{
    const y=top+i*rowH,val=d.tech[k],pct=Math.round(val/total*1000)/10;
    const barX=52,barW=w-barX-34;
    inner+=`<circle cx="24" cy="${y+11}" r="11" fill="${colors[i%colors.length]}" opacity="0.15"/>`
      +`<text x="24" y="${y+14.5}" text-anchor="middle" font-family="Roboto" font-size="8" font-weight="700" fill="${colors[i%colors.length]}">${esc(initials(k))}</text>`
      +`<text x="${barX}" y="${y+7}" font-family="Roboto" font-size="7" font-weight="700" fill="${C.ink}">${esc(k)}</text>`
      +`<rect x="${barX}" y="${y+12}" width="${barW}" height="7" rx="3.5" fill="#EAF0F7"/>`
      +`<rect x="${barX}" y="${y+12}" width="${Math.max(3,barW*val/total).toFixed(1)}" height="7" rx="3.5" fill="${colors[i%colors.length]}"/>`
      +`<text x="${w-12}" y="${y+9}" text-anchor="end" font-family="Roboto" font-size="11" font-weight="700" fill="${C.ink}">${val}</text>`
      +`<text x="${barX}" y="${y+27}" font-family="Roboto" font-size="6" fill="${C.muted}">%${pct}</text>`;
  });
  if(!keys.length)inner+=`<text x="12" y="46" font-family="Roboto" font-size="7" fill="${C.muted}">Bu dönemde kayıt yok.</text>`;
  const fy=h-28;
  inner+=`<rect x="10" y="${fy}" width="${w-20}" height="20" rx="4" fill="${C.soft}"/>`
    +`<text x="18" y="${fy+8.5}" font-family="Roboto" font-size="6" font-weight="700" fill="${C.ink}">Toplam ${keys.length} teknisyen</text>`
    +`<text x="18" y="${fy+16}" font-family="Roboto" font-size="5.6" fill="${C.muted}">Bu dönem toplam ${d.total} ziyaret yapıldı.</text>`;
  return panelSvg('TEKNİSYENE GÖRE ZİYARET',inner,w,h);
}

function daysChartSvg(d,w,h){
  const keys=Object.keys(d.days);
  const plotX=26,plotY=40,plotW=w-plotX-14,plotH=h-plotY-40;
  let inner=`<circle cx="16" cy="26" r="2.6" fill="${C.blue}"/><text x="23" y="28.5" font-family="Roboto" font-size="5.8" fill="${C.ink}">Ziyaret</text>`
    +`<line x1="62" y1="26" x2="74" y2="26" stroke="#9DC2F0" stroke-width="1.4"/><circle cx="68" cy="26" r="2.2" fill="#9DC2F0"/><text x="79" y="28.5" font-family="Roboto" font-size="5.8" fill="${C.ink}">Kümülatif</text>`;
  if(!keys.length){
    inner+=`<text x="12" y="${plotY+26}" font-family="Roboto" font-size="7" fill="${C.muted}">Bu dönemde kayıt yok.</text>`;
    return panelSvg('GÜNLERE GÖRE ZİYARET DAĞILIMI',inner,w,h);
  }
  const vals=keys.map(k=>d.days[k]);
  let run=0;const cum=vals.map(v=>(run+=v));
  const maxY=Math.max(...cum,1);
  const step=plotW/keys.length;
  /* y ekseni */
  const ticks=4;
  for(let i=0;i<=ticks;i++){
    const v=Math.round(maxY*i/ticks),y=plotY+plotH-(plotH*i/ticks);
    inner+=`<line x1="${plotX}" y1="${y.toFixed(1)}" x2="${plotX+plotW}" y2="${y.toFixed(1)}" stroke="${C.line}" stroke-width="0.6"/>`
      +`<text x="${plotX-4}" y="${(y+2).toFixed(1)}" text-anchor="end" font-family="Roboto" font-size="5.2" fill="${C.muted}">${v}</text>`;
  }
  const bw=Math.min(16,step*0.5);
  keys.forEach((k,i)=>{
    const cx=plotX+step*i+step/2;
    const bh=(vals[i]/maxY)*plotH;
    inner+=`<rect x="${(cx-bw/2).toFixed(1)}" y="${(plotY+plotH-bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${C.blue}"/>`
      +`<text x="${cx.toFixed(1)}" y="${(plotY+plotH-bh-3).toFixed(1)}" text-anchor="middle" font-family="Roboto" font-size="6" font-weight="700" fill="${C.ink}">${vals[i]}</text>`
      +`<text x="${cx.toFixed(1)}" y="${(plotY+plotH+11).toFixed(1)}" text-anchor="middle" font-family="Roboto" font-size="5" fill="${C.muted}">${esc(k)}</text>`;
  });
  const cumPts=cum.map((v,i)=>{
    const cx=plotX+step*i+step/2,cy=plotY+plotH-(v/maxY)*plotH;
    return cx.toFixed(1)+','+cy.toFixed(1);
  }).join(' ');
  inner+=`<polyline points="${cumPts}" fill="none" stroke="#9DC2F0" stroke-width="1.4" stroke-linejoin="round"/>`;
  cum.forEach((v,i)=>{
    const cx=plotX+step*i+step/2,cy=plotY+plotH-(v/maxY)*plotH;
    inner+=`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2" fill="#FFFFFF" stroke="#9DC2F0" stroke-width="1.2"/>`;
  });
  return panelSvg('GÜNLERE GÖRE ZİYARET DAĞILIMI',inner,w,h);
}

function polar(cx,cy,r,ang){const a=(ang-90)*Math.PI/180;return{x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)};}
function arcPath(cx,cy,r,a0,a1){
  const s=polar(cx,cy,r,a0),e=polar(cx,cy,r,a1),large=(a1-a0)>180?1:0;
  return `M${s.x.toFixed(2)} ${s.y.toFixed(2)} A${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}
function donutChartSvg(d,w,h){
  const segs=[
    {v:d.uygun,c:C.green,l:'Plana Uygun'},
    {v:d.programDisi,c:C.purple,l:'Program Dışı'},
    {v:d.planDisi,c:C.orange,l:'Plan Dışı'}
  ];
  const total=segs.reduce((a,s)=>a+s.v,0);
  const cx=58,cy=Math.round(h/2)+6,r=32,sw=15;
  let inner='';
  if(!total){
    inner+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.line}" stroke-width="${sw}"/>`
      +`<text x="${cx}" y="${cy+3}" text-anchor="middle" font-family="Roboto" font-size="8" fill="${C.muted}">Veri yok</text>`;
  }else{
    let ang=0;
    segs.forEach(s=>{
      if(!s.v)return;
      const sweep=s.v/total*360, a1=ang+Math.min(sweep,359.9);
      inner+=`<path d="${arcPath(cx,cy,r,ang,a1)}" fill="none" stroke="${s.c}" stroke-width="${sw}"/>`;
      const mid=polar(cx,cy,r,(ang+a1)/2);
      const pct=Math.round(s.v/total*100);
      if(pct>=8)inner+=`<text x="${mid.x.toFixed(1)}" y="${(mid.y+2.4).toFixed(1)}" text-anchor="middle" font-family="Roboto" font-size="6.4" font-weight="700" fill="#FFFFFF">%${pct}</text>`;
      ang=a1;
    });
    inner+=`<text x="${cx}" y="${cy+1}" text-anchor="middle" font-family="Roboto" font-size="15" font-weight="700" fill="${C.ink}">${total}</text>`
      +`<text x="${cx}" y="${cy+11}" text-anchor="middle" font-family="Roboto" font-size="5.4" fill="${C.muted}">Toplam</text>`;
  }
  const lx=cx+r+22;
  segs.forEach((s,i)=>{
    const y=cy-24+i*20;
    inner+=`<rect x="${lx}" y="${y}" width="7" height="7" rx="1.5" fill="${s.c}"/>`
      +`<text x="${lx+11}" y="${y+6.4}" font-family="Roboto" font-size="6.2" fill="${C.ink}">${esc(s.l)}</text>`
      +`<text x="${lx+11}" y="${y+14}" font-family="Roboto" font-size="6" font-weight="700" fill="${C.muted}">${s.v} Adet</text>`;
  });
  return panelSvg('PLAN DURUMU DAĞILIMI',inner,w,h);
}

function scoreDistSvg(d,w,h){
  const bands=[['A+',90,100,C.green],['A',80,89,'#46A758'],['B',70,79,'#EAB308'],['C',60,69,C.orange],['D',0,59,C.red]];
  const counts={};bands.forEach(b=>counts[b[0]]=0);let unknown=0;
  d.rows.forEach(r=>{
    if(r.score==null){unknown++;return;}
    const s=r.score;
    if(s>=90)counts['A+']++;else if(s>=80)counts['A']++;else if(s>=70)counts['B']++;else if(s>=60)counts['C']++;else counts['D']++;
  });
  const scored=d.rows.length-unknown;
  const rows=unknown>0?bands.concat([['-',0,0,'#94A3B8']]):bands;
  const top=28,rowH=17,barX=88,barW=w-barX-56;
  let inner='';
  rows.forEach((b,i)=>{
    const y=top+i*rowH;
    const isUnknown=b[0]==='-';
    const cnt=isUnknown?unknown:counts[b[0]];
    const denom=isUnknown?d.rows.length:(scored||1);
    const pct=denom?Math.round(cnt/denom*100):0;
    const rangeText=isUnknown?'Kayıt yok':('('+b[1]+'-'+b[2]+')');
    inner+=`<rect x="12" y="${y}" width="20" height="11" rx="2.6" fill="${b[3]}"/>`
      +`<text x="22" y="${y+8}" text-anchor="middle" font-family="Roboto" font-size="6.2" font-weight="700" fill="#FFFFFF">${b[0]}</text>`
      +`<text x="38" y="${y+8}" font-family="Roboto" font-size="6" fill="${C.muted}">${rangeText}</text>`
      +`<rect x="${barX}" y="${y+2.5}" width="${barW}" height="6" rx="3" fill="#EDF2F8"/>`
      +`<rect x="${barX}" y="${y+2.5}" width="${Math.max(0,barW*pct/100).toFixed(1)}" height="6" rx="3" fill="${b[3]}"/>`
      +`<text x="${w-30}" y="${y+8}" text-anchor="end" font-family="Roboto" font-size="7" font-weight="700" fill="${C.ink}">${cnt}</text>`
      +`<text x="${w-12}" y="${y+8}" text-anchor="end" font-family="Roboto" font-size="6" fill="${C.muted}">%${pct}</text>`;
  });
  const g=window.weeklyReportGrade(d.avgScore);
  const fy=h-26;
  inner+=`<rect x="10" y="${fy}" width="${w-20}" height="19" rx="4" fill="${C.soft}"/>`
    +`<text x="18" y="${fy+12.5}" font-family="Roboto" font-size="6.4" font-weight="700" fill="${C.ink}">Ortalama Skor</text>`
    +`<text x="${w-40}" y="${fy+12.5}" text-anchor="end" font-family="Roboto" font-size="8.4" font-weight="700" fill="${C.ink}">${d.avgScore} / 100</text>`
    +`<text x="${w-16}" y="${fy+12.5}" text-anchor="end" font-family="Roboto" font-size="8.4" font-weight="700" fill="${g.color}">${g.g}</text>`;
  return panelSvg('FİRMA SKOR DAĞILIMI',inner,w,h);
}

/* Sayfa başlığı bandı — tam genişlik lacivert şerit. */
function headerBandSvg(period,reportDateShort){
  const w=PAGE_W,h=HEADER_H;
  const boxW=152,boxH=40,gap=10,by=(h-boxH)/2;
  const b2x=w-MARGIN-boxW, b1x=b2x-gap-boxW;
  const logoW=126;
  const dateBox=(x,label,value)=>
    `<rect x="${x}" y="${by}" width="${boxW}" height="${boxH}" rx="5" fill="#FFFFFF"/>`
    +`<g transform="translate(${x+11},${by+11})" fill="none" stroke="${C.navy}" stroke-width="1.4" stroke-linecap="round"><rect x="0.5" y="1.5" width="14" height="13" rx="2"/><path d="M0.5 5.5h14M4 0.5v2.6M11 0.5v2.6"/></g>`
    +`<text x="${x+34}" y="${by+16}" font-family="Roboto" font-size="6.2" font-weight="700" fill="${C.muted}">${esc(label)}</text>`
    +`<text x="${x+34}" y="${by+29}" font-family="Roboto" font-size="8" font-weight="700" fill="${C.navy}">${esc(value)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`
    +`<rect x="0" y="0" width="${w}" height="${h}" fill="${C.navy}"/>`
    +`<g transform="${logoTransform(MARGIN,logoW,h)}">${logoMark()}</g>`
    +`<line x1="${MARGIN+logoW+14}" y1="16" x2="${MARGIN+logoW+14}" y2="${h-16}" stroke="#FFFFFF" stroke-width="0.8" opacity="0.28"/>`
    +`<text x="${MARGIN+logoW+30}" y="34" font-family="Roboto" font-size="18" font-weight="700" fill="#FFFFFF">TEKNİK SERVİS HAFTALIK RAPORU</text>`
    +`<text x="${MARGIN+logoW+31}" y="49" font-family="Roboto" font-size="7.2" font-weight="700" fill="#7FB2F5">SERVİSDRAMA</text>`
    +`<text x="${MARGIN+logoW+104}" y="49" font-family="Roboto" font-size="7.2" fill="#A9C2E0">Güvenilir Hizmet, Kalıcı Çözüm</text>`
    +dateBox(b1x,'DÖNEM',period)+dateBox(b2x,'RAPOR TARİHİ',reportDateShort)
    +'</svg>';
}

/* Tablo hücresi: 5 üzerinden yıldız (gerçek SVG yıldız — font glifi değil) */
function starCell(score){
  if(score==null)return{text:'—',fontSize:6.5,color:C.muted,alignment:'center'};
  const filled=Math.max(0,Math.min(5,Math.round(score/20)));
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="52" height="10">`;
  for(let i=0;i<5;i++){
    const cx=5.5+i*10.2,cy=5,r=4.2,ri=1.75;
    let pts='';
    for(let k=0;k<10;k++){
      const rad=(k%2===0)?r:ri,a=(Math.PI/180)*(36*k-90);
      pts+=(cx+rad*Math.cos(a)).toFixed(2)+','+(cy+rad*Math.sin(a)).toFixed(2)+' ';
    }
    s+=`<polygon points="${pts.trim()}" fill="${i<filled?'#F5A623':'none'}" stroke="#F5A623" stroke-width="0.7"/>`;
  }
  return{svg:s+'</svg>',width:52,height:10,alignment:'center'};
}
/* Yeşil nokta + "Tamamlandı" — nokta SVG, çünkü ● Roboto altkümesinde yok. */
function durumCell(){
  return{columns:[
    {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="6" height="6"><circle cx="3" cy="3" r="2.6" fill="${C.green}"/></svg>`,width:6,margin:[0,1.6,0,0]},
    {text:'Tamamlandı',fontSize:6.4,color:C.green,bold:true,margin:[2.5,0,0,0]}
  ],columnGap:0};
}
function scoreBadge(r){
  return{text:r.score==null?'—':(r.grade.g+'  '+r.score),bold:true,color:C.white,fontSize:6.4,alignment:'center',fillColor:r.grade.color,margin:[1,2.5,1,2.5]};
}
function dateCell(r){
  return{stack:[
    {text:r.tarih,fontSize:6.6,color:C.ink},
    {text:r.lastVisit?('Son: '+fmt(r.lastVisit)):(r.registered?'Son: İlk ziyaret':'Son: —'),fontSize:5.4,color:C.muted,margin:[0,1,0,0]}
  ]};
}
function daysAgoCell(r){
  if(!r.registered)return{text:'—',fontSize:6.4,color:C.muted,alignment:'center'};
  if(!r.lastVisit)return{text:'İlk ziyaret',fontSize:6,color:C.muted,alignment:'center'};
  const days=Math.max(0,Math.round((r.dateObj-r.lastVisit)/864e5));
  return{text:days+' gün',fontSize:6.4,color:days>14?C.orange:C.muted,alignment:'center'};
}
function tableLayout(){
  return{
    fillColor:(i)=>i===0?C.navy:(i%2===0?C.zebra:C.white),
    hLineColor:()=>C.line,vLineColor:()=>C.line,
    hLineWidth:()=>0.4,vLineWidth:()=>0.4,
    paddingLeft:()=>4,paddingRight:()=>4,paddingTop:()=>3.2,paddingBottom:()=>3.2
  };
}
function redLayout(){
  return{
    fillColor:(i)=>i===0?C.red:(i%2===0?'#FEF3F3':C.white),
    hLineColor:()=>C.line,vLineColor:()=>C.line,
    hLineWidth:()=>0.4,vLineWidth:()=>0.4,
    paddingLeft:()=>4,paddingRight:()=>4,paddingTop:()=>3.2,paddingBottom:()=>3.2
  };
}
/* Bölüm başlığı — "Başlık (adet)" biçimi tüm bölümlerde AYNI. */
function sectionTitle(title,count,color){
  return{columns:[
    {text:[{text:title,fontSize:11,bold:true,color:color||C.navy},{text:'  ('+count+')',fontSize:11,bold:true,color:C.muted}],width:'*'}
  ],margin:[0,0,0,6]};
}

async function buildPdf(d){
  if(typeof pdfMake==='undefined')throw new Error('PDF motoru yüklenemedi. İnternet bağlantısını kontrol edin.');
  const H=d.history||{};
  const period=fmt(d.start)+' - '+fmt(d.end);
  const reportDate=trDate(new Date());

  /* ── başlık bandı ── */
  const headerSvg=headerBandSvg(period,fmt(new Date()));

  /* ── istatistik kartları (8 adet, tamamı eşit boy) ── */
  const CARD_GAP=4, CARD_W=(CONTENT_W-CARD_GAP*7)/8, CARD_H=82;
  const gAvg=window.weeklyReportGrade(d.avgScore);
  const cards=[
    {label:'TOPLAM ZİYARET',value:d.total,color:C.blue,icon:'users',trend:d.trend.total,series:H.total},
    {label:'ZİYARET EDİLEN FİRMA',value:d.unique,color:C.green,icon:'building',trend:d.trend.unique,series:H.unique},
    {label:'PLANA UYGUN',value:d.uygun,color:C.green,icon:'check',trend:d.trend.uygun,series:H.uygun},
    {label:'PLAN DIŞI',value:d.planDisi,color:C.orange,icon:'alert',trend:d.trend.planDisi,series:H.planDisi,invert:true},
    {label:'PROGRAM DIŞI',value:d.programDisi,color:C.purple,icon:'calendar',trend:d.trend.programDisi,series:H.programDisi,invert:true},
    {label:'GİDİLMEYEN FİRMA',value:d.missed.length,color:C.red,icon:'alert',trend:d.trend.missed,series:H.missed,invert:true},
    {label:'ORT. FİRMA SKORU',value:d.avgScore,color:C.navy,icon:'star',trend:d.trend.avgScore,series:H.avgScore,badge:gAvg.g,badgeColor:gAvg.color},
    {label:'PLAN UYUM ORANI',value:'%'+d.planRate,color:C.blue,icon:'target',trend:d.trend.planRate,series:H.planRate}
  ].map(c=>({svg:statCardSvg(Object.assign({w:CARD_W,h:CARD_H},c)),width:CARD_W}));

  /* ── grafik kutuları (4 adet, tamamı eşit boy) ── */
  const CH_GAP=6, CH_H=152;
  const chW=[200,215,175,CONTENT_W-CH_GAP*3-200-215-175];
  const charts=[
    {svg:techChartSvg(d,chW[0],CH_H),width:chW[0]},
    {svg:daysChartSvg(d,chW[1],CH_H),width:chW[1]},
    {svg:donutChartSvg(d,chW[2],CH_H),width:chW[2]},
    {svg:scoreDistSvg(d,chW[3],CH_H),width:chW[3]}
  ];

  /* ── tablolar ── */
  const th=(t)=>({text:t,style:'th'});
  const summaryHead=['Firma','Tekn.','Ziyaret Tarihi','Satış Temsilcisi','Kaç Gün Önce','Firma Skoru','Plan Durumu','Not'].map(th);
  const summaryRows=d.rows.slice(0,8).map(r=>[
    {text:r.firma,fontSize:6.6,bold:true},
    {text:r.techCode||'—',fontSize:6.6,alignment:'center'},
    dateCell(r),
    {text:r.salesRep||'—',fontSize:6.4,color:r.salesRep?C.ink:C.muted},
    daysAgoCell(r),
    scoreBadge(r),
    {text:r.plan,fontSize:6.4,bold:true,color:planColor(r.plan),alignment:'center'},
    {text:r.notOrReason||'-',fontSize:6,color:r.not?C.ink:C.muted}
  ]);

  const detailHead=['Firma','Tekn.','Ziyaret Tarihi','Durum','Satış Temsilcisi','Kaç Gün Önce','Firma Skoru','Skor Seviyesi','Plan Durumu','Not'].map(th);
  const detailRows=d.rows.map(r=>[
    {text:r.firma,fontSize:6.4,bold:true},
    {text:r.techCode||'—',fontSize:6.4,alignment:'center'},
    dateCell(r),
    durumCell(),
    {text:r.salesRep||'—',fontSize:6.2,color:r.salesRep?C.ink:C.muted},
    daysAgoCell(r),
    scoreBadge(r),
    starCell(r.score),
    {text:r.plan,fontSize:6.2,bold:true,color:planColor(r.plan),alignment:'center'},
    {text:r.notOrReason||'-',fontSize:5.9,color:r.not?C.ink:C.muted}
  ]);

  const missedHead=['Firma','Bölge','Tekn.','Satış Temsilcisi','Son Ziyaret'].map(th);
  const missedRows=d.missed.map(m=>[
    {text:m.firma,fontSize:6.6,bold:true},
    {text:m.bolge,fontSize:6.4,color:C.muted},
    {text:m.techCode||'—',fontSize:6.4,alignment:'center'},
    {text:m.salesRep||'—',fontSize:6.4,color:m.salesRep?C.ink:C.muted},
    {text:m.lastVisit?fmt(m.lastVisit):'Hiç ziyaret edilmedi',fontSize:6.4,color:m.lastVisit?C.ink:C.red}
  ]);

  const explain=[
    ['Toplam Ziyaret','Dönemde tamamlanan tüm ziyaretlerin sayısıdır (planlı + program dışı). Aynı firmaya iki kez gidildiyse iki ziyaret sayılır.'],
    ['Ziyaret Edilen Firma','Bu dönemde en az bir kez ziyaret edilen TEKİL firma sayısıdır. Toplam ziyaretten küçükse, bazı firmalara birden fazla gidilmiştir.'],
    ['Plana Uygun','Firmanın kendi periyoduna denk gelen haftada yapılan ziyarettir.'],
    ['Plan Dışı','Firma o hafta planlı olmadığı halde yapılan ziyarettir.'],
    ['Program Dışı','Sisteme kayıtlı planı olmayan, sahada anlık eklenen ziyaretlerdir; tabloların en altında toplanır.'],
    ['Gidilmeyen Firma','O hafta planlandığı halde hiç ziyaret edilmeyen aktif firma sayısıdır.'],
    ['Plan Uyum Oranı','Plana uygun ziyaretlerin toplam ziyaretlere oranıdır.'],
    ['Firma Skoru','İlk ziyaretten bu döneme kadar geçen tüm planlı haftaların ortalama uyum oranıdır (kaç haftada gerçekten gidilmiş). Açık numune ve ekip sürekliliği puanı düşürür. A+ (90-100) mükemmel, D (0-59) kritik.'],
    ['Skor Seviyesi','Firma skorunun 5 üzerinden yıldız karşılığıdır.'],
    ['Kaç Gün Önce','Bu ziyaretten bir önceki tamamlanmış ziyaretten bu yana geçen gün sayısıdır.'],
    ['Not','Saha notu girilmişse o gösterilir; girilmemişse skorun neden düştüğü özetlenir.']
  ];
  const explainStack=[{text:'RAPOR AÇIKLAMALARI',fontSize:8,bold:true,color:C.navy,margin:[0,0,0,5]}];
  explain.forEach(e=>{
    explainStack.push({text:e[0],fontSize:6.2,bold:true,color:C.ink,margin:[0,3,0,0]});
    explainStack.push({text:e[1],fontSize:5.5,color:C.muted,lineHeight:1.25});
  });

  const doc={
    pageSize:'A4',pageOrientation:'landscape',
    pageMargins:[MARGIN,HEADER_H+8,MARGIN,FOOTER_H+10],
    defaultStyle:{font:'Roboto',color:C.ink,fontSize:7},
    styles:{th:{bold:true,color:C.white,fontSize:6,alignment:'center'}},
    header:()=>({svg:headerSvg,width:PAGE_W,margin:[0,0,0,0]}),
    footer:(p,n)=>({
      svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${FOOTER_H}">`
        +`<rect x="0" y="0" width="${PAGE_W}" height="${FOOTER_H}" fill="${C.navy}"/>`
        +`<text x="${MARGIN}" y="14" font-family="Roboto" font-size="6.6" font-weight="700" fill="#FFFFFF">ServisDrama · Haftalık Rapor</text>`
        +`<text x="${PAGE_W/2}" y="14" text-anchor="middle" font-family="Roboto" font-size="6.6" fill="#B9CCE6">Powered by BKAYACI</text>`
        +`<text x="${PAGE_W-MARGIN-58}" y="14" text-anchor="end" font-family="Roboto" font-size="6.6" fill="#B9CCE6">www.dramamakine.com</text>`
        +`<text x="${PAGE_W-MARGIN}" y="14" text-anchor="end" font-family="Roboto" font-size="6.6" font-weight="700" fill="#FFFFFF">Sayfa ${p} / ${n}</text>`
        +`</svg>`,
      width:PAGE_W,margin:[0,0,0,0]
    }),
    content:[
      {columns:cards,columnGap:CARD_GAP,margin:[0,0,0,10]},
      {columns:charts,columnGap:CH_GAP,margin:[0,0,0,12]},
      {columns:[
        {width:'*',stack:[
          sectionTitle('SON ZİYARETLER — ÖZET',d.rows.length),
          {table:{headerRows:1,widths:[142,26,58,72,44,50,56,'*'],body:[summaryHead].concat(summaryRows)},layout:tableLayout()},
          {text:'Tüm ziyaretlerin tam listesi 2. sayfadaki "Ziyaret Detayı" tablosundadır.',fontSize:5.8,italics:true,color:C.muted,margin:[0,5,0,0]}
        ]},
        {width:186,stack:[{
          table:{widths:['*'],body:[[{stack:explainStack,margin:[8,7,8,7]}]]},
          layout:{fillColor:()=>C.white,hLineColor:()=>C.line,vLineColor:()=>C.line,hLineWidth:()=>0.6,vLineWidth:()=>0.6}
        }],margin:[0,20,0,0]}
      ],columnGap:10},

      {text:'',pageBreak:'before'},
      sectionTitle('GİDİLMESİ GEREKİP GİDİLMEYEN FİRMALAR',d.missed.length,C.red),
      d.missed.length
        ? {table:{headerRows:1,widths:[250,90,34,120,'*'],body:[missedHead].concat(missedRows)},layout:redLayout(),margin:[0,0,0,16]}
        : {text:'Bu dönem planlanan tüm firmalar ziyaret edildi.',color:C.green,bold:true,fontSize:8,margin:[0,0,0,16]},

      sectionTitle('ZİYARET DETAYI',d.rows.length),
      {table:{headerRows:1,widths:[140,26,56,52,66,42,48,54,54,'*'],body:[detailHead].concat(detailRows),dontBreakRows:true},layout:tableLayout()},
      {text:'Not: Program dışı ziyaretler tarih fark etmeksizin tablonun en altında toplanmıştır.',fontSize:5.8,italics:true,color:C.muted,margin:[0,5,0,0]}
    ]
  };
  return pdfMake.createPdf(doc);
}

function getBuffer(pdf){return new Promise((ok,err)=>{try{pdf.getBuffer(b=>ok(b));}catch(e){err(e);}});}
function b64(buffer){const bytes=new Uint8Array(buffer);let bin='',chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)bin+=String.fromCharCode.apply(null,bytes.subarray(i,Math.min(i+chunk,bytes.length)));return btoa(bin);}

/* SVG blokları tarayıcıda birebir render edilebildiği için, düzen/taşma
   kontrolü PDF üretmeden yapılabilsin diye üreticiler dışa açılır. */
window.__weeklyPdfSvg={statCard:statCardSvg,tech:techChartSvg,days:daysChartSvg,donut:donutChartSvg,score:scoreDistSvg,logo:logoSvg,star:starCell,header:headerBandSvg};
window.buildWeeklyReportPdf=buildPdf;
window.weeklyReportPdfBuffer=async function(d){const pdf=await buildPdf(d);return getBuffer(pdf);};
window.weeklyReportPdfBase64=async function(d){const buf=await window.weeklyReportPdfBuffer(d);return b64(buf);};
window.downloadWeeklyReportPdf=async function(d,filename){const pdf=await buildPdf(d);pdf.download(filename);};
})();
