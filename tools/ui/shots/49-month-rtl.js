// The Month tab, laid out right to left (run with RF_LANG=ar or he-IL).
const sleep = (t) => new Promise((r) => setTimeout(r, t));
await window.__rf.setTab('month'); await sleep(500);
