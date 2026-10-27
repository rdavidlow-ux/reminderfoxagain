const sleep = (t) => new Promise((r) => setTimeout(r, t));
const $ = (id) => document.getElementById(id);
const X = window.__rfx; const R = window.__rf;
const all = await window.rf.all(); const uid = (s) => all.find((d) => d.summary === s).uid;
await R.setSetting({ remColumnsHidden: ['day', 'repeat'] }); await R.refresh();
$('settingsBtn').click(); await sleep(300); X.showPanel('display'); await sleep(200);
document.querySelector('#stColsRem').scrollIntoView({ block: 'center' }); await sleep(200);
