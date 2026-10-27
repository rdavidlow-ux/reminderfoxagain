const sleep = (t) => new Promise((r) => setTimeout(r, t));
const $ = (id) => document.getElementById(id);
const X = window.__rfx; const R = window.__rf;
X.openSuspend(); await sleep(300); document.querySelector('input[name=spMode][value=for]').checked = true; $('spN').value = '2'; $('spN').dispatchEvent(new Event('input'));
