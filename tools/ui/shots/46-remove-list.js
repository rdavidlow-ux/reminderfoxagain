// Removing a list that has to-dos: move them to To-Do's, or delete them with the list.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const $ = (id) => document.getElementById(id);
const R = window.__rf; const X = window.__rfx;
await R.showList('Errands'); await sleep(400);
X.openLists(); await sleep(300);
$('lsList').querySelector('[data-l="Errands"] [data-a=del]').click(); await sleep(400);
