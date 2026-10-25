'use strict';
// Node 22 runs `node --test test/` by loading this folder as a module, so pull in every test file.
const fs = require('fs');
for (const f of fs.readdirSync(__dirname).sort()) if (f.endsWith('.test.js')) require(`./${f}`);
