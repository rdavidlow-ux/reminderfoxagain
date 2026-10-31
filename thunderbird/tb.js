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
}());
