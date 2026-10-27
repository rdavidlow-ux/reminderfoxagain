const sleep = (t) => new Promise((r) => setTimeout(r, t));
const $ = (id) => document.getElementById(id);
const X = window.__rfx; const R = window.__rf;
await R.setSetting({ miniMonths: 3 }); await R.refresh(); await sleep(300); await R.setTab('todos'); await sleep(300);
