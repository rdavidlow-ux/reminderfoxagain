const sleep = (t) => new Promise((r) => setTimeout(r, t));
const $ = (id) => document.getElementById(id);
const X = window.__rfx; const R = window.__rf;
const all = await window.rf.all(); const uid = (s) => all.find((d) => d.summary === s).uid;
await R.setSetting({ views: [{ name: 'Family & birthdays', criteria: [{ field: 'categories', value: 'Family, Birthday' }], date: null, includeTodos: false },
  { name: 'Appointments this month', criteria: [{ field: 'any', value: 'dentist, doctor, appointment' }], date: { from: { n: 0, unit: 'D' }, to: { n: 1, unit: 'M' } }, includeTodos: false }] });
await R.refresh(); $('settingsBtn').click(); await sleep(300); X.showPanel('lists'); await sleep(200); X.openViews(); await sleep(400);
