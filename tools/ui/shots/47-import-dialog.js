// The import dialog for the add-on's sample file: preview, add or replace, duplicates, a category.
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const X = window.__rfx;
const dir = (await window.rf.meta()).dataFile.replace(/[\\/][^\\/]+$/, '');
X.askImport(`${dir}/addon-sample.ics`); await sleep(700);
document.getElementById('imCat').value = 'From ReminderFox';
