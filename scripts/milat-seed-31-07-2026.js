/* Milat kaydı: hiç ziyaret edilmemiş firmalara 31.07.2026 (2026-W31) tarihli
   "tamamlandı" ziyaret kaydı ekler. Gerçek ziyaret geçmişi olan firmalara dokunmaz.
   Canlı uygulamada admin olarak giriş yapmış tarayıcı konsoluna yapıştırıp çalıştırın. */
(function(){
  var cos = SD.companies||[];
  var visits = SD.visits||{};
  var techs = SD.technicians||[];
  var milatDate = new Date(2026,6,31); // 31 Temmuz 2026
  var wk = DT.wkey(milatDate);
  var dateShort = DT.ddmm(milatDate);
  var dateFull = DT.ddmmyyyy(milatDate);

  function hasHistory(coId){
    return Object.keys(visits).some(function(key){
      if(key.indexOf(coId+'_')!==0)return false;
      var rec=visits[key];
      return rec && rec.status==='done';
    });
  }

  var updated=[], skipped=[];
  cos.forEach(function(co){
    if(hasHistory(co.id))return;
    var tech = techs.find(function(t){return t.id===co.techId;});
    if(!tech){skipped.push(co.name);return;}
    var key = co.id+'_'+wk;
    visits[key] = SD.putVisitEntry(visits[key], tech.code, {
      date: dateShort, count:1, status:'done', saat:'09:00',
      startDate: dateFull, startTime:'09:00', endDate: dateFull, endTime:'09:00'
    });
    updated.push(co.name+' -> '+tech.code);
  });
  SD.visits = visits;
  console.log('Milat kaydı oluşturuldu:', updated.length, 'firma.');
  console.log('Teknisyeni tanımsız, atlanan:', skipped.length, skipped);
  console.table(updated);
})();
