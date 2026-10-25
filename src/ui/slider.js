'use strict';
/* global RF */
// The pop-up with today's and upcoming reminders (the add-on's "alert slider").
(function () {
  const { fmt, esc } = RF;
  const $ = (id) => document.getElementById(id);
  let closeTimer = null;
  let hovering = false;
  let keepSeconds = 15;
  let lastRing = 0;
  async function playSound(s) {
    let url = null;
    try { url = await window.rf.soundData(); } catch (e) { /* a built-in sound */ }
    RF.playSound(url, s.alarmTone);
  }

  function item(r, upcoming) {
    const when = r.kind === 'todo' && r.allDay ? 'To-do' : r.allDay ? (upcoming ? fmt.relDay(r.start) : 'All day')
      : upcoming ? `${fmt.relDay(r.start)}` : fmt.time(r.start);
    const small = [upcoming && !r.allDay ? fmt.time(r.start) : '', r.carried ? `overdue since ${fmt.date(r.overdueSince)}` : '', r.location].filter(Boolean).join(' · ');
    return `<div class="it${r.important ? ' important' : ''}" data-uid="${esc(r.uid)}" data-start="${r.occStart != null ? r.occStart : r.start}">` +
      `<div class="tm">${esc(when)}</div><div class="tx"><b>${r.important ? '★ ' : ''}${esc(r.summary)}</b>${small ? `<small>${esc(small)}</small>` : ''}</div></div>`;
  }
  function render(p) {
    const s = p.settings || {};
    RF.applyTheme(s.theme || '', s.customThemes);
    RF.setFormats(s);
    keepSeconds = Number(s.sliderKeep);
    const t = p.today || []; const u = p.upcoming || [];
    $('title').textContent = t.length ? `Today · ${t.length} reminder${t.length === 1 ? '' : 's'}` : 'Coming up';
    let html = '';
    if (s.sliderShow !== 'upcoming') html += `<div class="grp">Today · ${esc(fmt.date(Date.now()))}</div>${t.length ? t.map((r) => item(r, false)).join('') : '<div class="none">Nothing today.</div>'}`;
    if (s.sliderShow !== 'today') html += `<div class="grp">Next ${Number(s.upcomingDays) || 15} days</div>${u.length ? u.map((r) => item(r, true)).join('') : '<div class="none">Nothing coming up.</div>'}`;
    $('list').innerHTML = html;
    armClose();
    // the first render and the window's first update arrive together: ring once
    if (p.ring && s.sliderSound && s.alarmSound !== false && Date.now() - lastRing > 3000) { lastRing = Date.now(); playSound(s); }
  }
  function armClose() {
    clearTimeout(closeTimer);
    if (keepSeconds > 0 && !hovering) closeTimer = setTimeout(() => window.rf.closeSlider(), keepSeconds * 1000);
  }
  document.body.addEventListener('mouseenter', () => { hovering = true; clearTimeout(closeTimer); });
  document.body.addEventListener('mouseleave', () => { hovering = false; armClose(); });
  $('close').addEventListener('click', () => window.rf.closeSlider());
  $('list').addEventListener('click', (e) => {
    const it = e.target.closest('.it');
    if (it) window.rf.openFromSlider(it.dataset.uid, Number(it.dataset.start));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.rf.closeSlider(); });
  window.rf.on('slider:update', (p) => render({ ...p, ring: true }));
  window.rf.sliderState().then((p) => render({ ...p, ring: true })).catch(() => {});
})();
