'use strict';
// Writes the built-in alarm sounds (RF.TONES in src/ui/common.js) as 16-bit mono .wav files, rendered with the same
// Web Audio code in Chromium's OfflineAudioContext, for platforms that need sound files (notification sounds).
//   node tools/sounds.js <outDir>
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const OUT = path.resolve(process.argv[2] || 'sounds');
const RATE = 44100;

function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), 44 + i * 2));
  return buf;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'common.js'), 'utf8') });
  const tones = await page.evaluate(async (rate) => {
    const out = [];
    for (const t of window.RF.TONES) {
      const c = new OfflineAudioContext(1, Math.ceil((t.dur + 0.2) * rate), rate);
      t.draw(c, c.destination, 0.02);
      const b = await c.startRendering();
      out.push({ id: t.id, label: t.label, data: Array.from(b.getChannelData(0)) });
    }
    return out;
  }, RATE);
  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  for (const t of tones) {
    const f = path.join(OUT, `${t.id}.wav`);
    fs.writeFileSync(f, wav(t.data));
    const peak = t.data.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    console.log(`${t.id}.wav  ${t.label}  ${(t.data.length / RATE).toFixed(2)} s  peak ${peak.toFixed(2)}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
