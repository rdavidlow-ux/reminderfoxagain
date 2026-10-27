const sleep = (t) => new Promise((r) => setTimeout(r, t));
const $ = (id) => document.getElementById(id);
const X = window.__rfx; const R = window.__rf;
await window.rf.save({ kind: 'todo', summary: 'Seed order', list: 'Garden', categories: [] }); await R.refresh(); X.openLists(); await sleep(300);
