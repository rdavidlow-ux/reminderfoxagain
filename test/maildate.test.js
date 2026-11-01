'use strict';
// Unit tests for finding the date an email is about (src/host/maildate.js), used by "Add reminder…" on an email in
// the Thunderbird add-on. The email was sent on Thu Oct 29, 2026 at 10:00; "today" is Sat Oct 31, 2026.
const test = require('node:test');
const assert = require('node:assert/strict');
const { findDate, reminderFromEmail } = require('../src/host/maildate');

const REF = new Date(2026, 9, 29, 10, 0).getTime();
const NOW = new Date(2026, 9, 31, 9, 0).getTime();
const find = (text, locale = 'en-US', now = NOW, ref = REF) => { const r = findDate(text, { ref, now, locale }); return r && [r.date, r.time]; };

test('maildate 1. written dates, with and without a year or weekday', () => {
  assert.deepEqual(find('Dentist appointment on November 3, 2026'), ['2026-11-03', null]);
  assert.deepEqual(find('Your car service is booked for Tuesday, Nov 3rd'), ['2026-11-03', null]);
  assert.deepEqual(find('Renewal due 15 December 2026'), ['2026-12-15', null]);
  assert.deepEqual(find('the 3rd of November'), ['2026-11-03', null]);
  assert.deepEqual(find('Party on Sept 12'), ['2027-09-12', null]); // no year: the next Sep 12 after the email
  assert.deepEqual(find('ISO style 2026-11-20 please'), ['2026-11-20', null]);
});

test('maildate 2. times next to the date', () => {
  assert.deepEqual(find('Meeting on Nov 4 at 2:30 pm in room 4'), ['2026-11-04', '14:30']);
  assert.deepEqual(find('Call: November 5, 2026, 9 a.m.'), ['2026-11-05', '09:00']);
  assert.deepEqual(find('Flight leaves 2026-11-12 14:05'), ['2026-11-12', '14:05']);
  assert.deepEqual(find('Lunch at noon on Friday', 'en-US', NOW, NOW), ['2026-11-06', '12:00']); // read on Saturday: next Friday
  assert.deepEqual(find('at 3pm on November 9'), ['2026-11-09', '15:00']);
  assert.deepEqual(find('Nov 10, 2026, 12 people are coming'), ['2026-11-10', null]); // a bare number is not a time
});

test('maildate 3. numbers in the order of the locale', () => {
  assert.deepEqual(find('Due 11/03/2026', 'en-US'), ['2026-11-03', null]);
  assert.deepEqual(find('Due 03/11/2026', 'en-GB'), ['2026-11-03', null]);
  assert.deepEqual(find('Fällig am 3.11.2026 um 14:00 Uhr', 'de'), ['2026-11-03', '14:00']);
  assert.equal(find('Due 13/13/2026', 'en-US'), null);
  // year first is always year, month, day, whatever the locale (found in a real email: "Due date\n\n2026/11/02")
  assert.deepEqual(find('Due date\n\n2026/11/02', 'en-US'), ['2026-11-02', null]);
  assert.deepEqual(find('Due date: 2026/11/02', 'en-GB'), ['2026-11-02', null]);
  assert.deepEqual(find('Frist 2026.11.02 14:00', 'de'), ['2026-11-02', '14:00']);
  assert.deepEqual(find('締め切り：2026年11月2日', 'ja-JP'), ['2026-11-02', null]);
  assert.equal(find('2026/13/02 or 2026/11-02', 'en-US'), null); // no month 13; mixed separators are not a date
});

test('maildate 4. words: today, tomorrow and weekdays are read from the day the email was sent', () => {
  // sent Thu Oct 29: "tomorrow" was Fri Oct 30, which is already past today (Oct 31), so nothing is found
  assert.equal(find('Can we talk tomorrow?'), null);
  // read the same day it was sent
  assert.deepEqual(find('Can we talk tomorrow at 10:30?', 'en-US', REF, REF), ['2026-10-30', '10:30']);
  assert.deepEqual(find('See you next Monday'), ['2026-11-02', null]);
  assert.deepEqual(find('Book club this Thursday 7pm'), ['2026-11-05', '19:00']);
  assert.equal(find('the sun was out and we wed in May'), null);
});

test('maildate 5. other languages: month and weekday names of the locale', () => {
  assert.deepEqual(find('Rendez-vous le 12 novembre 2026 à 15h30', 'fr'), ['2026-11-12', '15:30']);
  assert.deepEqual(find('Termin am 3. Dezember', 'de'), ['2026-12-03', null]);
  assert.deepEqual(find('Cita el 5 de noviembre de 2026', 'es-ES'), ['2026-11-05', null]);
  assert.deepEqual(find('Встреча 20 ноября 2026', 'ru-RU'), ['2026-11-20', null]);
});

test('maildate 6. past dates and quoted replies are passed over; the first date ahead wins', () => {
  assert.deepEqual(find('We met on October 1, 2026. Next meeting: November 18, 2026.'), ['2026-11-18', null]);
  const reply = 'Sounds good.\n\nOn Thu, Oct 29, 2026 at 10:00 AM, Olivia <o@example.com> wrote:\n> Let us meet on December 1, 2026.';
  assert.equal(find(reply), null);
  assert.equal(find('> quoted: January 5, 2027'), null);
  assert.equal(find('Save the date: 2031-05-01'), null); // years away
});

test('maildate 7. the reminder for an email: subject without Re:, date from the subject first, then the text', () => {
  const r = reminderFromEmail({ subject: 'Re: Fwd: Car service at the dealer', date: REF, body: 'Hi Leo,\nyour car service is on Tuesday, Nov 3rd at 8:00 am.\nThanks' }, { now: NOW, locale: 'en-CA' });
  assert.deepEqual(r, { summary: 'Car service at the dealer', date: '2026-11-03', time: '08:00', found: 'Tuesday, Nov 3rd' });
  const s = reminderFromEmail({ subject: 'Parent-teacher interview Nov 12 at 6:30 pm', date: REF, body: 'Another date: Nov 20' }, { now: NOW, locale: 'en-US' });
  assert.equal(s.date, '2026-11-12');
  assert.equal(s.time, '18:30');
  const none = reminderFromEmail({ subject: 'Newsletter', date: REF, body: 'No dates here.' }, { now: NOW, locale: 'en-US' });
  assert.deepEqual(none, { summary: 'Newsletter', date: null, time: null, found: null });
});
