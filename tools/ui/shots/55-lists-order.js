const sleep = (t) => new Promise((r) => setTimeout(r, t));
const $ = (id) => document.getElementById(id);
const X = window.__rfx; const R = window.__rf;
const all = await window.rf.all(); const uid = (s) => all.find((d) => d.summary === s).uid;
await R.setSetting({ todoSort: 'category' }); await R.refresh(); await R.setTab('todos'); await sleep(400);
$('showDone').checked = true; $('showDone').dispatchEvent(new Event('change')); await sleep(500);
