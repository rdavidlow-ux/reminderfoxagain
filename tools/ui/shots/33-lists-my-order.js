const sleep = (t) => new Promise((r) => setTimeout(r, t));
const $ = (id) => document.getElementById(id);
const X = window.__rfx; const R = window.__rf;
await window.rf.save({ kind: 'todo', summary: 'Pick up dry cleaning', list: 'Errands', categories: [] });
await window.rf.save({ kind: 'todo', summary: 'Hardware store: furnace filter', list: 'Errands', categories: ['Home'] });
await R.setSetting({ todoSort: 'manual' }); await R.refresh();
await R.showList('Errands'); await sleep(500);
const t = [...document.querySelectorAll('#listView tbody tr')];
t[1].click(); t[2].classList.add('drop-after');
