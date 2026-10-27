const sleep = (t) => new Promise((r) => setTimeout(r, t));
const $ = (id) => document.getElementById(id);
const X = window.__rfx; const R = window.__rf;
await R.setSetting({ sliderEnabled: true, sliderKeep: 0 }); await window.rf.showSlider(); await sleep(800);
