const sleep = (t) => new Promise((r) => setTimeout(r, t));
const today = RF.startOfDay(new Date());
await window.rf.save({ kind: "event", summary: "Call the bank", date: RF.dayKey(RF.addDays(today, -3)), time: "10:00", untilDone: true, alarm: { minutes: 0 }, categories: ["Bills"] });
await window.rf.save({ kind: "event", summary: "Mom's <1960> birthday", date: RF.dayKey(RF.addDays(today, 5)).replace(/^\d{4}/, "1960"), allDay: true, important: true, untilDone: true, repeat: { freq: "YEARLY", end: "never" }, categories: ["Birthday"] });
await window.rf.save({ kind: "todo", summary: "Buy stamps", showInTooltip: true });
await sleep(900);
