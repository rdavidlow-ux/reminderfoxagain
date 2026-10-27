// An item selected in a list: the Duplicate / Move to / Copy to / Delete row, with the Copy to list dialog open.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const $ = (id) => document.getElementById(id);
const R = window.__rf; const X = window.__rfx;
await R.setSetting({ lists: ['Errands', 'Groceries'] }); await R.refresh();
await R.showList('Errands'); await sleep(600);
const tr = [...document.querySelectorAll('#listView tbody tr')].find((x) => x.querySelector('.t').textContent === 'Buy milk and eggs');
tr.click(); await sleep(200);
await X.askMoveToList(await window.rf.get(tr.dataset.uid), { copy: true }); await sleep(200);
$('mlSel').value = 'Groceries'; await sleep(200);
