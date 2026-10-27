const sleep = (t) => new Promise((r) => setTimeout(r, t));
const $ = (id) => document.getElementById(id);
const X = window.__rfx; const R = window.__rf;
const all = await window.rf.all(); const uid = (s) => all.find((d) => d.summary === s).uid;
await window.rf.complete(uid('Car service'), true);
await R.setSetting({ remColumnsHidden: ['day', 'repeat'], hideCompleted: true }); await R.refresh(); await R.setTab('reminders'); await sleep(500);
