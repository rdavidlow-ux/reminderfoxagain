const sleep = (t) => new Promise((r) => setTimeout(r, t));
const $ = (id) => document.getElementById(id);
const X = window.__rfx; const R = window.__rf;
X.openQuick(); await sleep(300); $('qaText').value = 'Take the bread out'; await window.rf.quickAdd({ text: 'Call back Sam', at: Date.now() + 47 * 60000 }); X.openQuick(); await sleep(300); $('qaText').value = 'Take the bread out'; $('qaN').value = '20'; $('qaN').dispatchEvent(new Event('input'));
