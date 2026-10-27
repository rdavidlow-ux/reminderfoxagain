const sleep = (t) => new Promise((r) => setTimeout(r, t));
const R = window.__rf;
await R.setSetting({ customThemes: [{ id: 'forest', name: 'Forest', bg: '#0f1f14', surface: '#16301f', ink: '#e8f5e9', accent: '#43a047', star: '#ffca28' }], theme: 'custom:forest' });
R.applyTheme(); await R.refresh(); await sleep(500);
