const sleep = (t) => new Promise((r) => setTimeout(r, t));
const $ = (id) => document.getElementById(id);
await window.rf.save({ kind: 'event', summary: 'Pay the hydro bill', date: RF.dayKey(new Date(new Date().getFullYear(), new Date().getMonth(), 5)), allDay: true, time: null,
  repeat: { freq: 'MONTHLY', interval: 1, mode: 'date', end: 'never' }, alarm: { minutes: 900 }, categories: ['Bills'] });
await sleep(400); await window.__rf.refresh(); await sleep(300);
$('remFilter').value = 'upcoming'; $('remFilter').dispatchEvent(new Event('change')); await sleep(500);
$('remCat').value = 'Bills'; $('remCat').dispatchEvent(new Event('change')); await sleep(600);
