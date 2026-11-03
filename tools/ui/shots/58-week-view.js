const sleep = (t) => new Promise((r) => setTimeout(r, t));
await window.__rf.setTab('month'); await sleep(400);
document.querySelector('#calMode [data-cmode="week"]').click(); await sleep(700);
