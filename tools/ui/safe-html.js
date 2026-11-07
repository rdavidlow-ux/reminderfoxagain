// E2E (safe HTML): RF.setHTML and RF.addHTML put HTML into the page without innerHTML, and remove anything that could
// run code; table rows and options land where they belong. In the desktop app and the Thunderbird add-on.
const check = (name, got, want) => console.log(`E2E ${name}: ${got} (expected ${want})${String(got) === String(want) ? '' : '  WRONG'}`);
try {
  const box = document.createElement('div'); document.body.append(box);
  window.__xss = 0;
  RF.setHTML(box, '<b>Bold</b><script>window.__xss = 1<\/script><img src="x.png" onerror="window.__xss = 2"><a href="javascript:window.__xss=3">a</a><a href="https://example.com/">b</a><iframe src="https://example.com"></iframe><button onclick="window.__xss=4" data-x="1">c</button>');
  check('safe HTML keeps ordinary markup', `${box.querySelector('b').textContent} ${box.querySelector('button').dataset.x}`, 'Bold 1');
  check('safe HTML drops scripts and frames', `${box.querySelectorAll('script').length} ${box.querySelectorAll('iframe').length}`, '0 0');
  check('safe HTML drops event attributes', `${box.querySelector('img').hasAttribute('onerror')} ${box.querySelector('button').hasAttribute('onclick')}`, 'false false');
  check('safe HTML drops javascript: links, keeps https', `${box.querySelectorAll('a')[0].hasAttribute('href')} ${box.querySelectorAll('a')[1].getAttribute('href')}`, 'false https://example.com/');
  box.querySelector('button').click();
  await new Promise((r) => setTimeout(r, 300));
  check('nothing in it ran', window.__xss, 0);
  // SVG animation could set a link's address after the clean-up; it is removed, the drawing kept
  RF.setHTML(box, '<svg><a><animate attributeName="href" values="javascript:window.__xss=5"/><set attributeName="href" to="javascript:window.__xss=6"/><text y="20">a</text></a></svg>');
  check('safe HTML drops SVG animation, keeps the drawing', `${box.querySelectorAll('animate,set').length} ${!!box.querySelector('svg text')}`, '0 true');
  const tb = document.createElement('tbody'); const t = document.createElement('table'); t.append(tb); box.append(t);
  RF.setHTML(tb, '<tr data-i="1"><td>one</td></tr><tr><td>two</td></tr>');
  check('table rows go into a table body', `${tb.rows.length} ${tb.rows[0].dataset.i} ${tb.rows[1].cells[0].textContent}`, '2 1 two');
  const sel = document.createElement('select'); box.append(sel);
  RF.setHTML(sel, '<option value="a">A</option><optgroup label="G"><option value="b" selected>B</option></optgroup>');
  check('options and groups go into a select', `${sel.options.length} ${sel.value} ${sel.querySelector('optgroup').label}`, '2 b G');
  RF.addHTML(sel, 'beforeend', '<option value="c">C</option>');
  RF.addHTML(sel, 'afterbegin', '<option value="z">Z</option>');
  check('addHTML adds at the end and the start', [...sel.options].map((o) => o.value).join(''), 'zabc');
  RF.setHTML(box, '');
  check('empty HTML empties it', box.childNodes.length, 0);
  box.remove();
  // the page's own content still comes through it: the list has rows and the dialogs open
  check('the Reminders list is built with it', document.querySelectorAll('#listView tbody tr').length > 0, true);
} catch (e) { console.log(`E2E ERROR ${e.message}`); }
