'use strict';
// A made-up calendar to subscribe to in the UI checks (tools/ui/subscriptions.js): four events around today.
//   node tools/sample-calendar.js serve <port>   serves it at /_cal/holidays.ics (and a 404 for anything else)
const pad = (n) => String(n).padStart(2, '0');
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; };
function text() {
  const ev = (uid, start, summary, extra = []) => ['BEGIN:VEVENT', `UID:${uid}@sample.example`, 'DTSTAMP:20260101T000000Z', start, `SUMMARY:${summary}`, ...extra, 'END:VEVENT'];
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ReminderFoxAgain//Sample holidays//EN', 'X-WR-CALNAME:Sample holidays',
    ...ev('founders', `DTSTART;VALUE=DATE:${day(3)}`, "Founders' Day (sample)"),
    ...ev('lantern', `DTSTART;VALUE=DATE:${day(10)}`, 'Lantern Night (sample)', ['LOCATION:Harbour Park']),
    ...ev('marathon', `DTSTART:${day(1)}T180000`, 'City marathon (sample)'),
    ...ev('fair', `DTSTART;VALUE=DATE:${day(-5)}`, 'Spring Fair (sample)'),
    'END:VCALENDAR', ''].join('\r\n');
}
// a calendar of 11 MB with no stated length, sent in parts: it is refused once it is over 10 MB (security audit)
function sendHuge(res) {
  res.writeHead(200, { 'content-type': 'text/calendar' });
  const part = `BEGIN:VCALENDAR\r\n${'X-PAD:'.padEnd(1022, 'x')}\r\n`.repeat(64);
  let n = 0;
  const more = () => { while (n < 170) { n++; if (!res.write(part)) { res.once('drain', more); return; } } res.end(); };
  res.on('error', () => {}); more();
}
module.exports = { text, sendHuge };
if (require.main === module && process.argv[2] === 'serve') {
  require('http').createServer((req, res) => {
    if (req.url.split('?')[0] === '/_cal/huge.ics') { sendHuge(res); return; }
    if (req.url.split('?')[0] === '/_cal/holidays.ics') { res.writeHead(200, { 'content-type': 'text/calendar' }); res.end(text()); return; }
    res.writeHead(404); res.end('not found');
  }).listen(Number(process.argv[3]) || 8765, '127.0.0.1');
}
