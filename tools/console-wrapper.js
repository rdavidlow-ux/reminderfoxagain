'use strict';
// Starts the app and prints renderer console lines that start with "E2E" (for tools/e2e.sh).
//   electron tools/console-wrapper.js [--no-sandbox ...]
const { app } = require('electron');
app.on('web-contents-created', (e, wc) => {
  wc.on('console-message', (ev, level, message) => {
    const msg = ev && typeof ev.message === 'string' ? ev.message : message;
    if (typeof msg === 'string' && msg.startsWith('E2E')) process.stdout.write(msg + '\n');
  });
});
require('../src/main.js');
