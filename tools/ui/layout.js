// E2E: the lists never scroll sideways and month cells are never clipped (run at several window widths).
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
const $ = (id) => document.getElementById(id);
const W = window.innerWidth;
try {
  // the page itself never scrolls sideways, and the header (search box, Settings) is never cut off, with or without the calendar panel
  for (const side of [true, false]) {
    await window.__rf.setSetting({ sidePanel: side }); document.body.classList.toggle('no-side', !side); await sleep(300);
    const de = document.documentElement, p = side ? '' : ' (calendar panel hidden)';
    check(`${W}px page sideways${p}`, de.scrollWidth > de.clientWidth + 1 ? `scrolls (${de.scrollWidth} > ${de.clientWidth})` : 'fits', 'fits');
    const cut = [...document.querySelectorAll('header.top > *, .tabs > *')].filter((e) => e.offsetParent && e.getBoundingClientRect().right > de.clientWidth + 1).map((e) => e.id || e.className);
    check(`${W}px header and tabs cut off${p}`, cut.join(',') || 'none', 'none');
  }
  await window.__rf.setSetting({ sidePanel: true }); document.body.classList.remove('no-side'); await sleep(300);
  const sideways = () => { const lv = $('listView'); return lv.scrollWidth > lv.clientWidth + 1 ? `scrolls (${lv.scrollWidth} > ${lv.clientWidth})` : 'fits'; };
  for (const f of ['upcoming', 'all', 'past']) {
    $('remFilter').value = f; $('remFilter').dispatchEvent(new Event('change')); await sleep(500);
    check(`${W}px reminders/${f} sideways`, sideways(), 'fits');
  }
  await window.__rf.setTab('todos'); await sleep(400);
  check(`${W}px to-dos sideways`, sideways(), 'fits');
  await window.__rf.setTab('month'); await sleep(600);
  const clipped = [...document.querySelectorAll('#monthGrid .cell')].filter((c) => c.scrollHeight > c.clientHeight + 1).length;
  check(`${W}px month cells clipped`, clipped, 0);
  check(`${W}px month grid inside the view`, $('monthGrid').getBoundingClientRect().bottom <= $('monthView').getBoundingClientRect().bottom + 1, true);
  // the tab bar, with the List dropdown in it, fits; and a long list name doesn't push it wider
  await window.__rf.setSetting({ lists: ['Terminated or Suspended', 'A very long list name for testing the width'] }); await window.__rf.refresh(); await sleep(400);
  const tabs = document.querySelector('.tabs');
  check(`${W}px tab bar fits`, tabs.scrollWidth <= tabs.clientWidth + 1, true);
  await window.__rf.setTab('todos'); await sleep(400);
  check(`${W}px list toolbar inside the view`, $('tbTodos').scrollWidth <= $('tbTodos').clientWidth + 1, true);
} catch (e) { console.log(`E2E ERROR ${e && e.stack || e}`); }
