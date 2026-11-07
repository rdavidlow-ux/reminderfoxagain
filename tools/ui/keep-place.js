// E2E (keeping your place): after a reminder is added or deleted, or a calendar subscribed to or removed, the
// Reminders list shows the same rows at its top, also when rows came or went above them, and also when the list was
// moved while a dialog was open (as Thunderbird can). Desktop app and Thunderbird add-on.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const R = window.__rf;
const lv = $('listView');
const topKey = () => {
  const lt = lv.getBoundingClientRect().top; const th = lv.querySelector('thead th'); const h = th ? th.getBoundingClientRect().height : 0;
  const tr = [...lv.querySelectorAll('tbody tr[data-key]')].find((t) => t.getBoundingClientRect().bottom - lt > h + 2);
  return tr ? tr.dataset.key : 'none';
};
const btn = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const closeAll = () => { for (const d of document.querySelectorAll('dialog[open]')) d.close(); };
try {
  const TB = document.documentElement.dataset.host === 'thunderbird';
  const base = TB ? location.origin : 'http://127.0.0.1:8765';
  await R.setTab('reminders'); await sleep(500);
  for (const f of ['all', 'upcoming']) {
    $('remFilter').value = f; $('remFilter').dispatchEvent(new Event('change')); await sleep(800);
    lv.scrollTop = Math.floor((lv.scrollHeight - lv.clientHeight) * 0.4); await sleep(500);
    const k0 = topKey();
    // add one today, from the editor: a row above the place
    $('addReminder').click(); await sleep(700);
    $('edSummary').value = 'Place test'; $('edSummary').dispatchEvent(new Event('input', { bubbles: true }));
    $('edSave').click(); await sleep(1500);
    check(`${f}: adding a reminder above keeps the same row at the top`, topKey(), k0);
    // delete it again, with the list moved to the top while the confirmation is open
    const it = (await window.rf.all()).find((x) => x.summary === 'Place test');
    const tr = lv.querySelector(`tbody tr[data-uid="${CSS.escape(it.uid)}"]`);
    tr.click(); await sleep(200);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })); await sleep(500);
    lv.scrollTop = 0; await sleep(200);
    btn(document.querySelector('dialog[open]'), 'Delete').click(); await sleep(1500);
    check(`${f}: … deleting it (the list moved while asking) comes back to the same row`, topKey(), k0);
    // subscribe: many rows above the place
    window.__rfx.openSubscriptions(); await sleep(600);
    $('subUrl').value = `${base}/_cal/holidays.ics`; $('subAdd').click(); await sleep(2500);
    closeAll(); await sleep(1000);
    check(`${f}: … subscribing to a calendar keeps the same row`, topKey(), k0);
    // remove it, with the list moved to the end as the dialog closes
    window.__rfx.openSubscriptions(); await sleep(600);
    $('subList').querySelector('[data-sa=remove]').click(); await sleep(400);
    btn($('cfFoot'), 'Remove').click(); lv.scrollTop = lv.scrollHeight; await sleep(1000);
    closeAll(); await sleep(1000);
    check(`${f}: … removing it (the list moved meanwhile) keeps the same row`, topKey(), k0);
    // and a scroll by the person afterwards is kept
    lv.scrollTop = Math.floor((lv.scrollHeight - lv.clientHeight) * 0.7); await sleep(400);
    const k1 = topKey();
    await window.rf.save({ kind: 'event', summary: 'Place test 2', date: RF.dayKey(new Date()), allDay: true }); await sleep(1500);
    check(`${f}: … a place the person scrolled to is the one kept`, topKey(), k1);
    // at the very top the list stays at the top, so a new item there shows
    lv.scrollTop = 0; await sleep(400);
    await window.rf.save({ kind: 'event', summary: 'Place test 3', date: RF.dayKey(new Date()), allDay: true }); await sleep(1500);
    check(`${f}: … at the top, it stays at the top`, lv.scrollTop, 0);
    const it3 = (await window.rf.all()).find((x) => x.summary === 'Place test 3'); await window.rf.remove(it3.uid); await sleep(1200);
    const it2 = (await window.rf.all()).find((x) => x.summary === 'Place test 2'); await window.rf.remove(it2.uid); await sleep(1200);
  }
  // picking a day in the Day view still starts at its top
  $('remFilter').value = 'day'; $('remFilter').dispatchEvent(new Event('change')); await sleep(800);
  await R.selectDay(RF.dayKey(new Date(Date.now() + 864e5))); await sleep(600);
  check('the Day view starts at the top of the day picked', lv.scrollTop, 0);
} catch (e) { console.log(`E2E ERROR ${e && e.stack || e}`); }
