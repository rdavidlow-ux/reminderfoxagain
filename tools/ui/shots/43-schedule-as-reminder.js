const sleep = (t) => new Promise((r) => setTimeout(r, t));
const $ = (id) => document.getElementById(id);
const due = RF.dayKey(RF.addDays(RF.startOfDay(new Date()), 10));
await window.rf.save({ kind: 'todo', summary: 'Get the car winter tires put on', date: due, allDay: true, time: null, categories: ['Car'], notes: 'Tires are in the garage',
  remind: { start: 'before', days: 7, at: '09:00', every: 'day', afterDue: true } });
await sleep(500);
await window.__rf.setTab('todos'); await sleep(500);
const tr = [...document.querySelectorAll('#listView tbody tr')].find((x) => x.querySelector('.t') && x.querySelector('.t').textContent.startsWith('Get the car'));
const r = tr.getBoundingClientRect(); tr.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: r.left + 300, clientY: r.top + 10 })); await sleep(300);
document.querySelector('#ctx button[data-ctx=schedule]').click(); await sleep(300);
$('scDate').value = RF.dayKey(RF.addDays(RF.startOfDay(new Date()), 6)); $('scDate').dispatchEvent(new Event('change'));
$('scTime').value = '08:30'; $('scTime').dispatchEvent(new Event('change'));
$('scAlarm').value = '60'; $('scAlarm').dispatchEvent(new Event('change'));
