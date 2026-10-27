const sleep = (t) => new Promise((r) => setTimeout(r, t));
const $ = (id) => document.getElementById(id);
const X = window.__rfx; const R = window.__rf;
await window.rf.backupNow(false); await sleep(1100); await window.rf.save({ kind: 'event', summary: 'x', date: '2026-11-02', allDay: true, categories: [] }); await window.rf.backupNow(false); X.openRestore(); await sleep(500); document.querySelector('#rsList tr[data-i]').click();
