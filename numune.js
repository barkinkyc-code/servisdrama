/* ================================================================
   ServisDrama — Numune Takip v3
   Manuel firma girişi, otomatik mail desteği
   ================================================================ */
var ST_KEY='sd_samples';
/* SD.save/SD.load üzerinden gider — böylece diğer tüm ortak veriler (firma,
   ziyaret vb.) gibi sunucuya senkronize edilir. Önceden doğrudan localStorage'a
   yazılıyordu; bu da sayfa yenilenip uzak veri çekilince yeni eklenen
   numunelerin üzerine eski sunucu kaydının yazılıp kaybolmasına yol açıyordu. */
function stLoad(){return SD.load(ST_KEY,[]);}
function stSave(v){SD.save(ST_KEY,v);}
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
  if(empty){
    empty.classList.toggle('hidden',filtered.length>0);
    empty.textContent=(list.length>0&&filtered.length===0)?'Aramanızla eşleşen numune bulunamadı. Aramayı temizleyin.':'Numune kaydı bulunamadı.';
  }

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
    var vb=document.createElement('button');vb.className='btn-icon';vb.title='Detay';
    vb.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    (function(sid){vb.addEventListener('click',function(){openSampleDetail(sid);});})(s.id);
    acts.appendChild(vb);
    var eb=document.createElement('button');eb.className='btn-icon';eb.title='Düzenle';
    eb.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    (function(sid){eb.addEventListener('click',function(){openStModal(sid);});})(s.id);
    acts.appendChild(eb);
    var db=document.createElement('button');db.className='btn-icon red';db.title='Sil';
    db.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" stroke-linecap="round"/></svg>';
    (function(sid){db.addEventListener('click',function(){if(!confirm('Numune kaydı silinecek?'))return;stSave(stLoad().filter(function(x){return x.id!==sid;}));renderSamples();if(typeof updateBadges==='function')updateBadges();UI.toast('Silindi.','success');});})(s.id);
    acts.appendChild(db);
    card.appendChild(num);card.appendChild(body);card.appendChild(acts);
    container.appendChild(card);
  });
}

/* ── Numune detay görünümü ── */
function openSampleDetail(id){
  var s=stLoad().find(function(x){return x.id===id;});
  var body=document.getElementById('stDetailBody');if(!s||!body)return;
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function row(label,value){return '<div style="display:flex;gap:14px;padding:10px 0;border-bottom:1px solid var(--border);"><div style="width:150px;flex-shrink:0;font-size:12px;font-weight:700;color:var(--text3);">'+esc(label)+'</div><div style="font-size:13.5px;font-weight:600;color:var(--text);">'+(value||'—')+'</div></div>';}
  var mails=[].concat((SD.companies.find(function(c){return c.id===s.firmaId;})||{}).aMails||[],labMailsFor(s.lab));
  if(s.extraMail)mails.push(s.extraMail);
  mails=mails.filter(function(v,i,a){return v&&a.indexOf(v)===i;});
  body.innerHTML=''
    +row('Takip No',esc(s.id))
    +row('Firma',esc(s.firmAdi))
    +row('Analiz Merkezi',esc(s.lab))
    +row('Ekipmanlar',(s.ekipmanlar||[]).map(esc).join(', '))
    +row('Ürün/Numuneler',(s.urunler||[]).map(esc).join(', '))
    +row('Gönderim Tarihi',esc(s.tarih))
    +row('Not',esc(s.not))
    +row('Sonuç',s.result?('<span style="color:var(--green);font-weight:800;">'+esc(s.result)+'</span>'):'<span style="color:var(--muted);">Bekliyor</span>')
    +row('Bildirim Alıcıları',mails.length?mails.map(esc).join(', '):'barkin.kayaci@dramamakine.com');
  UI.openModal('stDetailModal');
}

/* Analiz merkezi başına kayıtlı mail adresleri — SD.config içinde saklanır (cfg.labMails) */
function labMailsFor(lab){var cfg=SD.config;return(cfg.labMails&&cfg.labMails[lab])?cfg.labMails[lab].slice():[];}
function saveLabMails(lab,arr){if(!lab)return;var cfg=SD.config;cfg.labMails=cfg.labMails||{};cfg.labMails[lab]=arr.slice();SD.config=cfg;}

/* Analiz merkezi mail chip'leri: ekipman/ürün etiketleriyle aynı görünüm, ama
   e-posta büyük harfe çevrilmez ve her ekleme/silmede o merkez için kaydedilir. */
function renderLabMailChips(){
  var chips=document.getElementById('stLabMailChips'),inp=document.getElementById('stLabMailInp');
  if(!chips||!inp)return;
  chips.querySelectorAll('.tag-chip').forEach(function(c){c.remove();});
  _stLabMail.forEach(function(v,i){
    var c=document.createElement('span');c.className='tag-chip';
    c.appendChild(document.createTextNode(v));
    var x=document.createElement('button');x.className='tag-chip-x';x.textContent='×';
    x.addEventListener('click',function(){_stLabMail.splice(i,1);saveLabMails(_stLabCurrent,_stLabMail);renderLabMailChips();});
    c.appendChild(x);chips.insertBefore(c,inp);
  });
}
function initLabMailInput(){
  var inp=document.getElementById('stLabMailInp');if(!inp)return;
  if(inp._stLabH)inp.removeEventListener('keydown',inp._stLabH);
  inp._stLabH=function(e){
    if((e.key==='Enter'||e.key===',')&&inp.value.trim()){
      e.preventDefault();var v=inp.value.trim().replace(/,$/,'');
      if(v&&/^\S+@\S+\.\S+$/.test(v)&&_stLabMail.indexOf(v)<0){_stLabMail.push(v);saveLabMails(_stLabCurrent,_stLabMail);renderLabMailChips();inp.value='';}
      else if(v)UI.toast('Geçerli bir e-posta adresi girin.','error');
    }
    if(e.key==='Backspace'&&!inp.value&&_stLabMail.length){_stLabMail.pop();saveLabMails(_stLabCurrent,_stLabMail);renderLabMailChips();}
  };
  inp.addEventListener('keydown',inp._stLabH);
  renderLabMailChips();
}
function onLabChange(){
  var sel=document.getElementById('stLab'),grp=document.getElementById('stLabMailGrp');
  var lab=sel?sel.value.trim().toUpperCase():'';
  _stLabCurrent=lab;
  if(!grp)return;
  if(!lab){grp.style.display='none';_stLabMail.length=0;return;}
  grp.style.display='';
  _stLabMail=labMailsFor(lab);
  initLabMailInput();
}

/* ── Modal değişkenleri ── */
var _stEk=[],_stUr=[],_stFId='',_stFAdi='';
var _stLabMail=[],_stLabCurrent='';
var _stEkRender,_stUrRender,_stAutoCompleteListener,_stModalOpen=false;
var _stEditId=null;

function openStModal(editId){
  if(_stModalOpen)return;
  _stModalOpen=true;
  _stEditId=editId||null;
  var rec=_stEditId?stLoad().find(function(x){return x.id===_stEditId;}):null;
  UI.openModal('stModal');

  var title=document.getElementById('stModalTitle');if(title)title.textContent=rec?'Numuneyi Düzenle':'Yeni Numune Ekle';
  var lbl=document.getElementById('stSaveBtnLabel');if(lbl)lbl.textContent=rec?'Güncelle':'Kaydet & Bildir';

  /* Form reset'i hemen yap */
  (function(){
    _stEk.length=0;_stUr.length=0;_stFId='';_stFAdi='';_stLabMail.length=0;_stLabCurrent='';
    ['stFirmaInp','stLab','stNot','stExtraMail'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
    var labMailGrp=document.getElementById('stLabMailGrp');if(labMailGrp)labMailGrp.style.display='none';
    var lsel=document.getElementById('stLab');
    if(lsel){if(lsel._stLabChangeH)lsel.removeEventListener('change',lsel._stLabChangeH);lsel._stLabChangeH=onLabChange;lsel.addEventListener('change',onLabChange);}
    var td=document.getElementById('stTarih');
    if(td){var d=new Date();td.value=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
    var fs=document.getElementById('stFirmaSelected');if(fs)fs.textContent='—';
    var fsi=document.getElementById('stFirmaId');if(fsi)fsi.value='';
    /* Chips temizle */
    var ekc=document.getElementById('stEkipmanChips');if(ekc)ekc.querySelectorAll('.tag-chip').forEach(function(c){c.remove();});
    var urc=document.getElementById('stUrunChips');if(urc)urc.querySelectorAll('.tag-chip').forEach(function(c){c.remove();});

    /* Düzenleme modu: mevcut kaydı forma yükle */
    if(rec){
      _stFId=rec.firmaId||'';_stFAdi=rec.firmAdi||'';
      _stEk.push.apply(_stEk,rec.ekipmanlar||[]);
      _stUr.push.apply(_stUr,rec.urunler||[]);
      var fInp2=document.getElementById('stFirmaInp');if(fInp2)fInp2.value=rec.firmAdi||'';
      if(fs)fs.textContent=rec.firmAdi||'—';
      if(fsi)fsi.value=rec.firmaId||'';
      if(lsel)lsel.value=rec.lab||'';
      if(td&&rec.tarih)td.value=rec.tarih;
      var ntEl=document.getElementById('stNot');if(ntEl)ntEl.value=rec.not||'';
      var emEl=document.getElementById('stExtraMail');if(emEl)emEl.value=rec.extraMail||'';
      onLabChange();
    }

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
  var ei=document.getElementById('stEkipmanInp'),ui=document.getElementById('stUrunInp'),lmi=document.getElementById('stLabMailInp');
  if(ei&&ei.value.trim()){_stEk.push(ei.value.trim().toUpperCase());ei.value='';}
  if(ui&&ui.value.trim()){_stUr.push(ui.value.trim().toUpperCase());ui.value='';}
  if(lmi&&lmi.value.trim()){
    var lv=lmi.value.trim().replace(/,$/,'');
    if(/^\S+@\S+\.\S+$/.test(lv)&&_stLabMail.indexOf(lv)<0){_stLabMail.push(lv);saveLabMails(_stLabCurrent,_stLabMail);}
    lmi.value='';
  }
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

  var editingId=_stEditId,existing=editingId?stLoad().find(function(x){return x.id===editingId;}):null;
  var rec={
    id:existing?existing.id:stGenId(),firmaId:_stFId,firmAdi:_stFAdi,lab:lab.toUpperCase(),
    ekipmanlar:_stEk.slice(),urunler:_stUr.slice(),
    tarih:(document.getElementById('stTarih')||{}).value||'',
    not:(document.getElementById('stNot')||{}).value||'',
    extraMail:(document.getElementById('stExtraMail')||{}).value||'',
    result:existing?(existing.result||''):'',
    reminderSent:existing?!!existing.reminderSent:false,
    ts:existing?existing.ts:Date.now()
  };
  var all=stLoad();
  if(existing)all=all.map(function(x){return x.id===rec.id?rec:x;});
  else all.unshift(rec);
  stSave(all);
  _stEditId=null;

  /* Kayıt onayı (modal kapama, liste yenileme, toast) her zaman burada
     tamamlanır — aşağıdaki mail gönderimi başarısız olsa/hata fırlatsa bile
     kullanıcı kaydın yapıldığını görür. */
  UI.closeModal('stModal');renderSamples();
  if(typeof updateBadges==='function')updateBadges();
  UI.toast(existing?('Numune güncellendi: '+rec.id):('Numune kaydedildi: '+rec.id),'success');
  if(existing)return;

  /* Mail gönder — otomatik (günlük rapor ile aynı sunucu/SMTP akışı ve tasarımı).
     Alıcılar: sabit barkin.kayaci + firmanın kayıtlı analiz e-postaları (co.aMails)
     + seçilen analiz merkezi için kayıtlı e-postalar (cfg.labMails) + varsa ilave adres. */
  try{
    var cfg=SD.config;
    var co=_stFId?SD.companies.find(function(c){return c.id===_stFId;}):null;
    var ccList=[].concat(co&&co.aMails?co.aMails:[],labMailsFor(rec.lab));
    if(rec.extraMail)ccList.push(rec.extraMail);
    ccList=ccList.filter(function(v,i,a){return v&&a.indexOf(v)===i;});
    var html=buildNumuneMailHTML(rec);
    fetch('/api/send-test-mail',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        to:'barkin.kayaci@dramamakine.com',
        cc:ccList.join(','),
        subject:'ServisDrama - Yeni Numune Bildirimi ('+rec.id+' | '+rec.firmAdi+')',
        html:html,
        smtpHost:cfg.smtpHost||'',
        smtpPort:cfg.smtpPort||'',
        smtpUser:cfg.smtpUser||'',
        smtpPass:cfg.smtpPass||'',
        smtpTls:cfg.smtpTls||'tls',
        from:(cfg.smtpSenderName||'Drama Makine')+' <'+(cfg.smtpSenderEmail||'servis@dramamakine.com')+'>',
        attachmentNames:['drama-makine-logo']
      })
    })
    .then(function(r){return r.json();})
    .then(function(d){if(!d.success)console.warn('Numune maili gönderilemedi:',d.error);})
    .catch(function(e){console.error('Numune mail hatası:',e);});
  }catch(e){
    console.error('Numune maili hazırlanamadı:',e);
  }
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
  /* stEkleBtn/stSaveBtn/stResultSaveBtn/stSearch admin.js'te (on(...) çağrıları
     ile) zaten bağlanıyor — burada tekrar bağlamak aynı tıklamada saveNumune()'un
     birden fazla kez çalışıp mükerrer numune kaydı + mükerrer mail göndermesine
     yol açıyordu. */

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
