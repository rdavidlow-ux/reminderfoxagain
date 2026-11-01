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

  // ---------------------------------------------------------------- Settings → General: what only Thunderbird can do
  const tray = $('stTrayNote') || $('stTray');
  if (tray && !$('stTbTags')) {
    const box = document.createElement('div');
    box.innerHTML = '<label class="inline-chk"><input type="checkbox" class="chk" id="stTbTags"> Tag emails that have a reminder or list item</label>' +
      '<label class="inline-chk"><input type="checkbox" class="chk" id="stTbBdays"> Birthday reminders from your address books</label>';
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
  dlg.innerHTML = '<form class="dlg small" method="dialog">' +
    '<div class="dlg-head"><h2>Invite people</h2></div>' +
    '<div class="dlg-body">' +
    '<div class="field"><label for="tbInvTo">Email addresses, separated by commas</label><input class="inp" id="tbInvTo" autocomplete="off" list="tbInvList"><datalist id="tbInvList"></datalist></div>' +
    '<div class="note">The invitation opens in a new message for you to check and send.</div>' +
    '</div>' +
    '<div class="dlg-foot"><span class="spacer"></span><button type="button" class="btn" id="tbInvCancel">Cancel</button><button type="submit" class="btn primary" id="tbInvGo">Create invitation</button></div>' +
    '</form>';
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
      $('tbInvList').innerHTML = found.map((c) => `<option value="${esc(pre + c.email)}" translate="no">${esc(c.name || c.email)}</option>`).join('');
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
      $('tbInvList').innerHTML = '';
      dlg.showModal();
      to.focus();
      return true;
    },
  };
}());
