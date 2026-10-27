// The Lists tab with its dropdown opened (drawn expanded, since a native dropdown can't be captured open).
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const $ = (id) => document.getElementById(id);
const R = window.__rf;
await window.rf.save({ kind: 'todo', summary: 'Dune Part Two', list: 'Movies to see', categories: [] });
await window.rf.save({ kind: 'todo', summary: 'Past Lives', list: 'Movies to see', categories: [] });
await R.setSetting({ lists: ['Errands', 'Movies to see', 'Gift ideas'] }); await R.refresh();
await R.showList('Errands'); await sleep(600);
const sel = $('todoList');
const r = sel.getBoundingClientRect();
sel.setAttribute('size', String(sel.options.length + 1));
Object.assign(sel.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, zIndex: 50, height: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.18)', paddingBottom: '4px' });
await sleep(200);
