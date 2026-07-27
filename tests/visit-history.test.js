'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const memory = new Map([
  ['sd_ver', 'v12'],
  ['sd_last_visits_v1', '1'],
  ['sd_vi', JSON.stringify({
    'c48_2026-W29': {
      date: '17.07.2026',
      saat: '14:00',
      tc: '1015',
      status: 'done',
      count: 1
    }
  })]
]);

const localStorage = {
  getItem(key) {
    return memory.has(key) ? memory.get(key) : null;
  },
  setItem(key, value) {
    memory.set(key, String(value));
  },
  removeItem(key) {
    memory.delete(key);
  }
};

const context = {
  localStorage,
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Date,
  Math,
  JSON,
  String,
  Array,
  Object,
  parseInt,
  isNaN
};

vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(projectRoot, 'companies.js'), 'utf8'),
  context
);
vm.runInContext(
  fs.readFileSync(path.join(projectRoot, 'data.js'), 'utf8'),
  context
);

context.SD.seed();

const expected = [
  ['DURMAZLAR', '17.07.2026', '1015', 'Cuma'],
  ['BURÇAK', '17.06.2026', '1015', 'Çarşamba'],
  ['FENESE', '13.07.2026', '1015', 'Pazartesi'],
  ['F.S.S.', '17.07.2026', '1015', 'Cuma'],
  ['AKYAPAK', '30.06.2026', '1016', 'Salı'],
  ['CANEL', '03.07.2026', '1016', 'Cuma'],
  ['DİŞLİ MAKİNA', '30.06.2026', '1016', 'Salı'],
  ['ODOKSAN', '01.07.2026', '1016', 'Çarşamba']
];

for (const [term, date, technicianCode, weekday] of expected) {
  const company = context.SD.companies.find((item) =>
    item.name.toLocaleUpperCase('tr-TR').includes(term)
  );
  assert.ok(company, `Firma bulunamadı: ${term}`);

  const record = Object.entries(context.SD.visits)
    .find(([key, visit]) =>
      key.startsWith(`${company.id}_`) && visit.date === date
    )?.[1];

  assert.ok(record, `Ziyaret bulunamadı: ${term}`);
  assert.equal(record.tc, technicianCode, `${term} teknisyen kodu`);
  assert.equal(record.weekday, weekday, `${term} hafta günü`);
}

assert.equal(
  Object.keys(context.SD.visits).some((key) =>
    key.startsWith('c48_') &&
    context.SD.visits[key].date === '17.07.2026'
  ),
  false,
  'Eski hatalı c48 kaydı temizlenmelidir'
);

const durmazlar = context.SD.companies.find((item) =>
  item.name.includes('DURMAZLAR')
);
const departureAt = new Date(2026, 6, 23, 10, 0, 0);
const beforeDeparture = context.SD.getPreviousCompletedVisit(
  durmazlar.id,
  departureAt
);

assert.equal(beforeDeparture.date, '17.07.2026');
assert.equal(
  context.SD.businessDaysBetween(
    new Date(2026, 6, 17),
    new Date(2026, 6, 23)
  ),
  4
);
assert.equal(
  context.SD.businessDaysBetween(
    new Date(2026, 6, 13),
    new Date(2026, 6, 23)
  ),
  7,
  '15 Temmuz resmî tatili iş günü sayılmamalıdır'
);

const technician = context.SD.technicians.find((item) =>
  item.code === '1015'
);
context.SD.recordDeparture(durmazlar, technician, departureAt);

const afterDeparture = context.SD.getPreviousCompletedVisit(
  durmazlar.id,
  departureAt
);
assert.equal(
  afterDeparture.date,
  '17.07.2026',
  'Pending yola çıkış tamamlanmış son ziyaret olmamalıdır'
);

const departure = context.SD.departures.at(-1);
assert.equal(departure.date, '23.07.2026');
assert.equal(departure.weekday, 'Perşembe');
assert.equal(departure.time, '10:00');

const html = context.buildTruckServiceMailHTML(
  durmazlar.name,
  '1015',
  'Semih Ağlan',
  '23.07.2026',
  '',
  0,
  technician.phone,
  technician.email,
  beforeDeparture.date,
  ''
);

assert.ok(
  html.includes('17.07.2026 • 4 iş günü önce'),
  'Mailde son ziyaret ve iş günü bilgisi bulunmalıdır'
);

console.log('Ziyaret geçmişi, yola çıkış ve iş günü testleri başarılı.');
