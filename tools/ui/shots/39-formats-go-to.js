const sleep = (t) => new Promise((r) => setTimeout(r, t));
const $ = (id) => document.getElementById(id);
const X = window.__rfx; const R = window.__rf;
await R.setSetting({ dateFormat: 'dmy-text', timeFormat: '24' }); await R.refresh(); await sleep(300); X.openGoTo(); await sleep(200); $('gtDate').value = '2026-12-24';
