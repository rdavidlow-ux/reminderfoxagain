'use strict';
// store.js asks Node's crypto for random ids; the WebView has them too (bundled in place of 'crypto')
module.exports = { randomUUID: () => self.crypto.randomUUID() };
