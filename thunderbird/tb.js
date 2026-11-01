'use strict';
// ReminderFoxAgain for Thunderbird: what the main page shows differently in an add-on (loaded after features.js).
(function () {
  const path = document.getElementById('stPath');
  if (path && !document.getElementById('tbPath')) {
    const note = document.createElement('div');
    note.className = 'note';
    note.id = 'tbPath';
    note.textContent = 'Your reminders are kept in your Thunderbird profile, with a backup every day.'; // translated by i18n-dom.js
    path.after(note);
  }

  const $ = (id) => document.getElementById(id);
  const RF = () => window.__rf || {};
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------------------------------------------------------------- Settings → Data → Import from ReminderFox…
  // The desktop app finds reminderfox.ics in the Firefox and Thunderbird profiles; an add-on can't look there, so it
  // first says where the file is, then app.js's own handler opens the file picker (with prefs.js allowed, as there).
  // where the file is, before the file picker opens (Settings → Data, and the welcome page below)
  const whereIsIt = () => RF().confirmDlg('Import from ReminderFox',
    '<div>An add-on can\'t look in other programs\' folders, so pick the file yourself: the ReminderFox add-on kept it as reminderfox.ics, in the reminderfox folder of your Thunderbird or Firefox profile.</div>' +
    '<div class="note">To open the profile folder: Help → Troubleshooting Information (in Firefox: More Troubleshooting Information) → Profile Folder → Open Folder.</div>' +
    '<div class="note">Pick the profile folder\'s prefs.js with it to bring your list names too.</div>',
    [{ label: 'Cancel', value: null }, { label: 'Choose the file…', cls: 'primary', value: 'pick' }]);
  const oldRf = $('stOldRf');
  if (oldRf) {
    let go = false;
    oldRf.addEventListener('click', async (e) => {
      if (go) { go = false; return; }
      e.stopImmediatePropagation();
      if ((await whereIsIt()) !== 'pick') return;
      go = true;
      oldRf.click(); // the click on "Choose the file…" still counts as the person's, so the file picker may open
    }, true);
  }

  // ---------------------------------------------------------------- the welcome page of a new installation
  // Its own option for the ReminderFox add-on's file (the desktop app lists the files it finds there): it says where
  // the file is, then app.js's "Import a calendar file" choice opens the picker (which takes prefs.js too).
  const list = $('listView');
  if (list) {
    const addOld = () => {
      const pick = list.querySelector('.welcome .opt[data-w="pick"]:not(.tb-old)');
      if (!pick || list.querySelector('.welcome .tb-old')) return;
      const opt = pick.cloneNode(false);
      opt.classList.add('tb-old');
      window.RF.setHTML(opt, '<span style="font-size:22px">🦊</span><div><b>Import from your ReminderFox add-on</b><small>Pick the reminderfox.ics the ReminderFox add-on kept in your Firefox or Thunderbird profile</small></div>');
      pick.before(opt);
    };
    new MutationObserver(addOld).observe(list, { childList: true, subtree: true });
    addOld();
    let go = false;
    list.addEventListener('click', async (e) => {
      const opt = e.target.closest('.welcome .tb-old');
      if (!opt) return;
      if (go) { go = false; return; }
      e.stopImmediatePropagation();
      if ((await whereIsIt()) !== 'pick') return;
      go = true;
      opt.click();
    }, true);
  }

  // ---------------------------------------------------------------- Settings → General: what only Thunderbird can do
  const tray = $('stTrayNote') || $('stTray');
  if (tray && !$('stTbTags')) {
    const box = document.createElement('div');
    window.RF.setHTML(box, '<label class="inline-chk"><input type="checkbox" class="chk" id="stTbTags"> Tag emails that have a reminder or list item</label>' +
      '<label class="inline-chk"><input type="checkbox" class="chk" id="stTbBdays"> Birthday reminders from your address books</label>');
    (tray.closest('label') || tray).after(...box.children);
    const show = (s) => { if (!s) return; $('stTbTags').checked = s.tbTagEmails !== false; $('stTbBdays').checked = !!s.tbBirthdays; };
    window.rf.on('settings:changed', show);
    window.rf.meta().then((m) => show(m && m.settings)).catch(() => {});
    $('stTbTags').addEventListener('change', () => window.rf.setSettings({ tbTagEmails: $('stTbTags').checked }));
    $('stTbBdays').addEventListener('change', () => window.rf.setSettings({ tbBirthdays: $('stTbBdays').checked }));
  }

  // ---------------------------------------------------------------- Invite people…: addresses (with suggestions from
  // the address books), then a new message with the invitation for the person to check and send
  const dlg = document.createElement('dialog');
  dlg.id = 'tbInvite';
  window.RF.setHTML(dlg, '<form class="dlg small" method="dialog">' +
    '<div class="dlg-head"><h2>Invite people</h2></div>' +
    '<div class="dlg-body">' +
    '<div class="field"><label for="tbInvTo">Email addresses, separated by commas</label><input class="inp" id="tbInvTo" autocomplete="off" list="tbInvList"><datalist id="tbInvList"></datalist></div>' +
    '<div class="note">The invitation opens in a new message for you to check and send.</div>' +
    '</div>' +
    '<div class="dlg-foot"><span class="spacer"></span><button type="button" class="btn" id="tbInvCancel">Cancel</button><button type="submit" class="btn primary" id="tbInvGo">Create invitation</button></div>' +
    '</form>');
  document.body.appendChild(dlg);
  let invUid = null; let sugTimer = null;
  const to = $('tbInvTo');
  // the suggestions complete the address being typed (after the last comma)
  to.addEventListener('input', () => {
    clearTimeout(sugTimer);
    sugTimer = setTimeout(async () => {
      const parts = to.value.split(','); const last = parts.pop().trim(); const head = parts.map((x) => x.trim()).filter(Boolean);
      const found = last.length >= 2 ? await window.rf.contacts(last).catch(() => []) : [];
      const pre = head.length ? `${head.join(', ')}, ` : '';
      window.RF.setHTML($('tbInvList'), found.map((c) => `<option value="${esc(pre + c.email)}" translate="no">${esc(c.name || c.email)}</option>`).join(''));
    }, 200);
  });
  $('tbInvCancel').addEventListener('click', () => dlg.close());
  dlg.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const emails = to.value.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
    const r = await RF().guard(window.rf.inviteSend(invUid, emails));
    if (r) dlg.close();
  });
  window.RFTB = {
    openInvite: async (uid) => {
      invUid = uid;
      const d = await window.rf.get(uid).catch(() => null);
      to.value = d && d.attendees && d.attendees.length ? `${d.attendees.map((a) => a.email).join(', ')}, ` : '';
      window.RF.setHTML($('tbInvList'), '');
      dlg.showModal();
      to.focus();
      return true;
    },
  };
}());
