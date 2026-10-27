const sleep = (t) => new Promise((r) => setTimeout(r, t));
const $ = (id) => document.getElementById(id);
await window.rf.save({ kind: 'event', summary: 'Netflix (auth payment)', date: '2024-09-17', allDay: true, time: null,
  repeat: { freq: 'MONTHLY', interval: 1, mode: 'date', end: 'never' }, alarm: null, categories: ['Subscriptions'] });
await sleep(500);
$('remFilter').value = 'past'; $('remFilter').dispatchEvent(new Event('change')); await sleep(700);
await window.__rf.selectDay(RF.dayKey(RF.addDays(RF.startOfDay(new Date()), -1)));
