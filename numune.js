/* ================================================================
   ServisDrama — Numune Takip v3
   Manuel firma girişi, otomatik mail desteği
   ================================================================ */
var ST_KEY='sd_samples';
function stLoad(){try{return JSON.parse(localStorage.getItem(ST_KEY)||'[]');}catch(e){return[];}}
function stSave(v){try{localStorage.setItem(ST_KEY,JSON.stringify(v));}catch(e){}}
function stGenId(){var d=new Date();return'ST-'+d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'-'+Math.floor(1000+Math.random()*9000);}

/* Tag input */
function initTagInput(chipsId,inputId,arr){
  var chips=document.getElementById(chipsId),inp=document.getElementById(inputId);
  if(!chips||!inp)return;
  function render(){
    chips.querySelectorAll('.tag-chip').forEach(function(c){c.remove();});
    arr.forEach(function(v,i){
      var c=document.createElement('span');c.className='tag-chip';
      c.appendChild(document.createTextNode(v));
      var x=document.createElement('button');x.className='tag-chip-x';x.textContent='×';
      x.addEventListener('click',function(){arr.splice(i,1);render();});
      c.appendChild(x);chips.insertBefore(c,inp);
    });
  }
  inp.addEventListener('keydown',function(e){
    if((e.key==='Enter'||e.key===',')&&inp.value.trim()){
      e.preventDefault();var v=inp.value.trim().replace(/,$/,'');
      if(v){arr.push(v.toUpperCase());inp.value='';render();}
    }
    if(e.key==='Backspace'&&!inp.value&&arr.length){arr.pop();render();}
  });
  render();
  return render;
}

/* ── Render liste ── */
function renderSamples(){
  var list=stLoad();
  var q=((document.getElementById('stSearch')||{}).value||'').toLocaleLowerCase('tr');
  var sub=document.getElementById('stSub');
  var bek=list.filter(function(s){return!s.result;}).length;
  var don=list.filter(function(s){return!!s.result;}).length;
  if(sub)sub.textContent=bek+' beklemede · '+don+' tamamlandı · Toplam '+list.length;

  var container=document.getElementById('stList'),empty=document.getElementById('stEmpty');
  if(!container)return;
  container.innerHTML='';
  var filtered=list.filter(function(s){
    if(!q)return true;
    return(s.firmAdi||'').toLocaleLowerCase('tr').indexOf(q)>=0||(s.lab||'').toLocaleLowerCase('tr').indexOf(q)>=0||(s.id||'').toLowerCase().indexOf(q)>=0;
  }).sort(function(a,b){return(b.ts||0)-(a.ts||0);});
  if(empty)empty.classList.toggle('hidden',filtered.length>0);

  filtered.forEach(function(s){
    var card=document.createElement('div');card.className='st-card';
    var num=document.createElement('div');num.className='st-num';num.textContent='#'+s.id;
    var body=document.createElement('div');body.className='st-body';
    var firm=document.createElement('div');firm.className='st-firm';firm.textContent=s.firmAdi||'—';
    var lab=document.createElement('div');lab.className='st-lab';lab.textContent='→ '+(s.lab||'—');
    var meta=document.createElement('div');meta.className='st-meta';
    if(s.ekipmanlar&&s.ekipmanlar.length)meta.innerHTML+='<span class="st-meta-i"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'+s.ekipmanlar.join(' | ')+'</span>';
    if(s.urunler&&s.urunler.length)meta.innerHTML+='<span class="st-meta-i"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>'+s.urunler.join(' | ')+'</span>';
    if(s.tarih)meta.innerHTML+='<span class="st-meta-i"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg>'+s.tarih+'</span>';
    body.appendChild(firm);body.appendChild(lab);body.appendChild(meta);
    if(s.result){var rn=document.createElement('div');rn.style.cssText='font-size:12px;color:var(--green);margin-top:5px;font-weight:700;display:flex;align-items:center;gap:4px;';rn.innerHTML='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'+s.result;body.appendChild(rn);}
    var acts=document.createElement('div');acts.className='st-acts';
    if(!s.result){
      var rb=document.createElement('button');rb.className='st-result-btn';
      rb.innerHTML='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Sonuç Gir';
      (function(sid){rb.addEventListener('click',function(){openResultModal(sid);});})(s.id);
      acts.appendChild(rb);
    }else{
      var rd=document.createElement('span');rd.className='st-result-done';
      rd.innerHTML='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Tamamlandı';
      acts.appendChild(rd);
    }
    var db=document.createElement('button');db.className='btn-icon red';
    db.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" stroke-linecap="round"/></svg>';
    (function(sid){db.addEventListener('click',function(){if(!confirm('Numune kaydı silinecek?'))return;stSave(stLoad().filter(function(x){return x.id!==sid;}));renderSamples();if(typeof updateBadges==='function')updateBadges();UI.toast('Silindi.','success');});})(s.id);
    acts.appendChild(db);
    card.appendChild(num);card.appendChild(body);card.appendChild(acts);
    container.appendChild(card);
  });
}

/* ── Modal değişkenleri ── */
var _stEk=[],_stUr=[],_stFId='',_stFAdi='';
var _stEkRender,_stUrRender,_stAutoCompleteListener,_stModalOpen=false;

function openStModal(){
  if(_stModalOpen)return;
  _stModalOpen=true;
  UI.openModal('stModal');

  /* Form reset'i hemen yap */
  (function(){
    _stEk.length=0;_stUr.length=0;_stFId='';_stFAdi='';
    ['stFirmaInp','stLab','stNot','stExtraMail'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
    var td=document.getElementById('stTarih');
    if(td){var d=new Date();td.value=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
    var fs=document.getElementById('stFirmaSelected');if(fs)fs.textContent='—';
    var fsi=document.getElementById('stFirmaId');if(fsi)fsi.value='';
    /* Chips temizle */
    var ekc=document.getElementById('stEkipmanChips');if(ekc)ekc.querySelectorAll('.tag-chip').forEach(function(c){c.remove();});
    var urc=document.getElementById('stUrunChips');if(urc)urc.querySelectorAll('.tag-chip').forEach(function(c){c.remove();});
    /* Tag inputs */
    _stEkRender=initTagInput('stEkipmanChips','stEkipmanInp',_stEk);
    _stUrRender=initTagInput('stUrunChips','stUrunInp',_stUr);
    /* Firma autocomplete — KAYITLI DEĞİLSE MANUEL GİRİŞE İZİN VER */
    var inp=document.getElementById('stFirmaInp'),ac=document.getElementById('stFirmaAC');
    if(inp&&ac){
      var _h=function(){
        var q=inp.value.toLocaleLowerCase('tr');ac.innerHTML='';
        if(!q){ac.style.display='none';return;}
        var m=SD.companies.filter(function(c){return c.name.toLocaleLowerCase('tr').indexOf(q)>=0;}).slice(0,8);
        if(!m.length){
          ac.style.display='block';
          var item=document.createElement('div');item.className='ac-item';
          item.style.cssText='font-style:italic;color:var(--text3);';
          item.textContent='↵ "'+inp.value+'" olarak kaydet (listede yok)';
          item.addEventListener('click',function(e){
            e.stopPropagation();
            _stFId='';_stFAdi=inp.value;
            var fs2=document.getElementById('stFirmaSelected');if(fs2)fs2.textContent=inp.value+' (manuel)';
            ac.style.display='none';
            inp.blur();
          });
          ac.appendChild(item);
          return;
        }
        ac.style.display='block';
        m.forEach(function(c){
          var item=document.createElement('div');item.className='ac-item';item.textContent=c.name;
          item.addEventListener('click',function(e){
            e.stopPropagation();
            _stFId=c.id;_stFAdi=c.name;inp.value=c.name;ac.style.display='none';
            var fs2=document.getElementById('stFirmaSelected');if(fs2)fs2.textContent=c.name;
            inp.blur();
          });
          ac.appendChild(item);
        });
      };
      inp.removeEventListener('input',inp._stH);
      inp.removeEventListener('blur',inp._stBlur);
      inp.removeEventListener('keydown',inp._stKD);
      inp._stH=_h;
      inp.addEventListener('input',_h);
      inp._stBlur=function(){setTimeout(function(){ac.style.display='none';},150);};
      inp.addEventListener('blur',inp._stBlur);

      /* Enter desteği */
      inp._stKD=function(e){
        if(e.key!=='Enter')return;
        e.preventDefault();
        var items=ac.querySelectorAll('.ac-item');
        if(!items.length)return;
        /* İlk item'ı seç */
        items[0].click();
      };
      inp.addEventListener('keydown',inp._stKD);
    }
  })();
}

function saveNumune(){
  _stModalOpen=false;
  /* Pending tag inputs flush */
  var ei=document.getElementById('stEkipmanInp'),ui=document.getElementById('stUrunInp');
  if(ei&&ei.value.trim()){_stEk.push(ei.value.trim().toUpperCase());ei.value='';}
  if(ui&&ui.value.trim()){_stUr.push(ui.value.trim().toUpperCase());ui.value='';}
  /* Chips güncelle */
  var ekc=document.getElementById('stEkipmanChips');
  if(ekc){
    ekc.querySelectorAll('.tag-chip').forEach(function(c){c.remove();});
    _stEk.forEach(function(v){
      var c=document.createElement('span');c.className='tag-chip';
      c.appendChild(document.createTextNode(v));
      var x=document.createElement('button');x.className='tag-chip-x';x.textContent='×';
      x.addEventListener('click',function(){_stEk.splice(_stEk.indexOf(v),1);});
      c.appendChild(x);
      ekc.insertBefore(c,ei);
    });
  }
  var urc=document.getElementById('stUrunChips');
  if(urc){
    urc.querySelectorAll('.tag-chip').forEach(function(c){c.remove();});
    _stUr.forEach(function(v){
      var c=document.createElement('span');c.className='tag-chip';
      c.appendChild(document.createTextNode(v));
      var x=document.createElement('button');x.className='tag-chip-x';x.textContent='×';
      x.addEventListener('click',function(){_stUr.splice(_stUr.indexOf(v),1);});
      c.appendChild(x);
      urc.insertBefore(c,ui);
    });
  }

  /* Firma kontrolü */
  var fInp=document.getElementById('stFirmaInp');
  if(!_stFAdi&&fInp&&fInp.value.trim()){_stFAdi=fInp.value.trim();}
  if(!_stFAdi){UI.toast('Firma seçin veya yazın.','error');return;}

  var lab=(document.getElementById('stLab')||{}).value||'';
  if(!lab){UI.toast('Analiz merkezi seçin.','error');return;}
  if(_stEk.length===0){UI.toast('En az bir ekipman girin.','error');return;}
  if(_stUr.length===0){UI.toast('En az bir ürün/numune girin.','error');return;}

  var co=_stFId?SD.companies.find(function(c){return c.id===_stFId;}):null;
  var rec={
    id:stGenId(),firmaId:_stFId,firmAdi:_stFAdi,lab:lab.toUpperCase(),
    ekipmanlar:_stEk.slice(),urunler:_stUr.slice(),
    tarih:(document.getElementById('stTarih')||{}).value||'',
    not:(document.getElementById('stNot')||{}).value||'',
    extraMail:(document.getElementById('stExtraMail')||{}).value||'',
    result:'',ts:Date.now()
  };
  var all=stLoad();all.unshift(rec);stSave(all);

  /* Mail gönder */
  var cfg=SD.config,to=(cfg.mailAlicilar||[]).join(',');
  var coMails=co&&co.aMails?co.aMails.join(','):'';
  if(coMails)to=to?to+','+coMails:coMails;
  if(rec.extraMail)to=to?to+','+rec.extraMail:rec.extraMail;
  if(!to&&cfg.reportTo)to=cfg.reportTo;

  /* HTML mail oluştur ve aç */
  var html=buildNumuneMailHTML(rec);
  var blob=new Blob([html],{type:'text/html;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.click();
  setTimeout(function(){URL.revokeObjectURL(url);},15000);

  if(to){
    var NL='\n';
    var body=['SERVİSDRAMA — YENİ NUMUNE BİLDİRİMİ','='.repeat(36),'Takip No  : '+rec.id,'Firma     : '+rec.firmAdi,'Lab       : '+rec.lab,'Ekipman   : '+rec.ekipmanlar.join(', '),'Ürün      : '+rec.urunler.join(', '),'Tarih     : '+rec.tarih].join(NL);
    setTimeout(function(){
      window.location.href='mailto:'+encodeURIComponent(to)+'?subject='+encodeURIComponent('ServisDrama Numune | '+rec.id+' | '+rec.firmAdi)+'&body='+encodeURIComponent(body);
    },800);
  }

  UI.closeModal('stModal');renderSamples();
  if(typeof updateBadges==='function')updateBadges();
  UI.toast('Numune kaydedildi: '+rec.id,'success');
}

function buildNumuneMailHTML(rec){
  var d=new Date();
  return'<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Numune Bildirimi</title></head>'
    +'<body style="margin:0;padding:0;background:#f3f6fa;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;">'
    +'<div style="max-width:700px;margin:24px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.12);">'
    +'<div style="background:linear-gradient(135deg,#102B50,#1565D8);padding:32px 28px;display:flex;align-items:center;gap:16px;">'
    +'<div style="width:50px;height:50px;background:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><img src="assets/email/servisdrama/drama-makine-logo.png" style="width:40px;height:40px;object-fit:contain;"></div>'
    +'<div style="flex:1;color:#fff;"><div style="font-size:11px;font-weight:700;letter-spacing:1.3px;opacity:.9;margin-bottom:2px;">SERVISDRAMA</div>'
    +'<h1 style="margin:0;font-size:22px;font-weight:800;line-height:1.2;">✏️ Yeni Numune Bildirimi</h1></div>'
    +'<div style="background:rgba(0,0,0,.15);color:#fff;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;white-space:nowrap;">'+rec.id+'</div>'
    +'</div>'
    +'<div style="padding:32px 28px;">'
    +'<table style="width:100%;border-collapse:collapse;">'
    +[['FİRMA',rec.firmAdi],['LABORATUVAR',rec.lab],['EKİPMAN',rec.ekipmanlar.join(', ')],['ÜRÜN/NUMUNE',rec.urunler.join(', ')],['GÖNDERİM TARİHİ',rec.tarih||DT.ddmmyyyy(d)],rec.not?['NOT',rec.not]:null]
    .filter(Boolean).map(function(r){return'<tr><td style="padding:14px 0;font-size:13px;font-weight:700;color:#9ca3af;letter-spacing:.05em;border-bottom:1px solid #f0f0f0;width:160px;">'+r[0]+'</td>'
    +'<td style="padding:14px 0 14px 20px;font-size:14px;font-weight:600;color:#1e293b;border-bottom:1px solid #f0f0f0;">'+r[1]+'</td></tr>';}).join('')
    +'</table>'
    +'<div style="background:#dbeafe;border:1.5px solid #93c5fd;border-radius:12px;padding:16px;margin-top:24px;">'
    +'<div style="font-size:13px;font-weight:700;color:#0754b8;margin-bottom:4px;">📌 Analiz Sonucu Beklenilmektedir</div>'
    +'<div style="font-size:13px;color:#1565d8;">Sonuç geldiğinde ServisDrama sisteminden işaretleyiniz.</div></div>'
    +'</div>'
    +'<div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 28px;text-align:center;font-size:12px;color:#6b7280;">'
    +'ServisDrama · Drama Makine ve Otomotiv · '+DT.ddmmyyyy(d)
    +'</div></div></body></html>';
}

var _stRId='';
function openResultModal(sid){
  _stRId=sid;var s=stLoad().find(function(x){return x.id===sid;});if(!s)return;
  var info=document.getElementById('stResultInfo');
  if(info)info.innerHTML='<b>'+s.id+'</b> &nbsp;·&nbsp; '+s.firmAdi+'<br><span style="color:var(--blue);font-weight:700;">'+s.lab+'</span>';
  var nota=document.getElementById('stResultNot');if(nota)nota.value=s.result||'';
  UI.openModal('stResultModal');
}
function saveResult(){
  var nota=document.getElementById('stResultNot');if(!nota)return;
  var val=nota.value.trim()||'Tamamlandı — '+DT.ddmmyyyy(new Date());
  stSave(stLoad().map(function(s){if(s.id===_stRId)s.result=val;return s;}));
  UI.closeModal('stResultModal');renderSamples();
  if(typeof updateBadges==='function')updateBadges();
  UI.toast('Sonuç kaydedildi ✓','success');
}

document.addEventListener('DOMContentLoaded',function(){
  var se=document.getElementById('stEkleBtn');
  if(se){
    se.addEventListener('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      openStModal();
    });
  }
  var ss=document.getElementById('stSaveBtn');if(ss)ss.addEventListener('click',saveNumune);
  var sr=document.getElementById('stResultSaveBtn');if(sr)sr.addEventListener('click',saveResult);
  var sch=document.getElementById('stSearch');if(sch)sch.addEventListener('input',renderSamples);

  /* Result modal close handlers */
  var srm=document.getElementById('stResultModal');
  if(srm){
    var resultCloseX=document.getElementById('stResultClose');
    if(resultCloseX){
      resultCloseX.addEventListener('click',function(e){
        e.preventDefault();
        e.stopPropagation();
        UI.closeModal('stResultModal');
      });
    }
    var resultCancel=document.getElementById('stResultCancel');
    if(resultCancel){
      resultCancel.addEventListener('click',function(e){
        e.preventDefault();
        e.stopPropagation();
        UI.closeModal('stResultModal');
      });
    }
  }

  /* Modal close handler'ları */
  var sm=document.getElementById('stModal');
  if(sm){
    /* Modal overlay'e tıklandığında (modal dışında) kapat */
    sm.addEventListener('click',function(e){
      if(e.target===sm){
        _stModalOpen=false;
        UI.closeModal('stModal');
      }
    });
    /* Modal içine tıklandığında propagation durdur */
    var modal=sm.querySelector('.modal');
    if(modal){
      modal.addEventListener('click',function(e){
        e.stopPropagation();
      });
    }
    /* Close X button */
    var closeX=document.getElementById('stModalClose');
    if(closeX){
      closeX.addEventListener('click',function(e){
        e.preventDefault();
        e.stopPropagation();
        _stModalOpen=false;
        UI.closeModal('stModal');
      });
    }
    /* Cancel button */
    var cancelBtn=document.getElementById('stModalCancel');
    if(cancelBtn){
      cancelBtn.addEventListener('click',function(e){
        e.preventDefault();
        e.stopPropagation();
        _stModalOpen=false;
        UI.closeModal('stModal');
      });
    }
  }
});
