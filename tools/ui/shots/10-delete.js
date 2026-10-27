const sleep = (t) => new Promise((r) => setTimeout(r, t));
const $ = (id) => document.getElementById(id);
const set = (id, v, ev = "input") => { const el = $(id); if (el.type === "checkbox") el.checked = v; else el.value = v; el.dispatchEvent(new Event(ev, { bubbles: true })); };
const filter = async (f) => { set("remFilter", f, "change"); await sleep(500); };
const row = (title) => [...document.querySelectorAll("#listView tbody tr")].find((tr) => tr.querySelector(".t") && tr.querySelector(".t").textContent === title);
const tr = row('Team stand-up');
await window.__rf.openEditor({ uid: tr.dataset.uid, start: Number(tr.dataset.start) }); await sleep(200);
$('edDelete').click();
