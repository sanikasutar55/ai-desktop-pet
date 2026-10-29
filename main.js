const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

const SIZES = { small: 100, medium: 150, large: 210 };
const BTN = 56;
const DEFAULTS = {
  enabled: true, visitMinutes: 5, waterMinutes: 30, checkins: true, sound: true,
  animSpeed: 1, petSize: 'medium', aiChat: false, launchAtStartup: false, alwaysOnTop: true,
  quietEnabled: false, quietStart: '22:00', quietEnd: '08:00'
};
const store = { settings: { ...DEFAULTS }, state: { nextVisit: 0, nextWater: 0, pausedUntil: 0, button: null } };
let petWin, btnWin, setWin, tray, petReady = false, petBusy = false, pendingVisit = null, drag = null;

const dataFile = () => path.join(app.getPath('userData'), 'petdata.json');
const keyFile = () => path.join(app.getPath('userData'), 'apikey.bin');
const readCfg = n => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'config', n), 'utf8')); } catch { return {}; } };
const pick = a => a[Math.floor(Math.random() * a.length)];
const webPrefs = { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false };

function loadStore() {
  try {
    const d = JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
    Object.assign(store.settings, d.settings); Object.assign(store.state, d.state);
  } catch { /* first run */ }
}
function saveStore() { try { fs.writeFileSync(dataFile(), JSON.stringify(store, null, 2)); } catch (e) { console.error(e); } }

// ---- API key (encrypted with the OS keychain via safeStorage) ----
function getKey() {
  try {
    const raw = fs.readFileSync(keyFile());
    if (raw.slice(0, 6).toString() === 'plain:') return raw.slice(6).toString();
    return safeStorage.decryptString(raw);
  } catch { return ''; }
}
function setKey(k) {
  k = (k || '').trim();
  if (!k) { try { fs.unlinkSync(keyFile()); } catch {} return; }
  const buf = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(k) : Buffer.from('plain:' + k);
  fs.writeFileSync(keyFile(), buf);
}

// ---- helpers ----
function payload() {
  const s = store.settings;
  return { settings: s, petPx: SIZES[s.petSize] || 150, workArea: screen.getPrimaryDisplay().workArea, hasKey: !!getKey() };
}
function isQuiet() {
  const s = store.settings; if (!s.quietEnabled) return false;
  const n = new Date(), m = n.getHours() * 60 + n.getMinutes();
  const t = v => { const [h, mi] = v.split(':').map(Number); return h * 60 + mi; };
  const a = t(s.quietStart), b = t(s.quietEnd);
  return a <= b ? (m >= a && m < b) : (m >= a || m < b);
}
function sendVisit(d) { if (petReady && petWin) petWin.webContents.send('pet:visit', d); else pendingVisit = d; }

// ---- windows ----
function createPet() {
  petWin = new BrowserWindow({
    width: 150, height: 174, x: -600, y: -600, transparent: true, frame: false, resizable: false,
    hasShadow: false, skipTaskbar: true, alwaysOnTop: true, show: false, webPreferences: webPrefs
  });
  petWin.setAlwaysOnTop(true, 'screen-saver');
  petWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWin.loadFile('pet.html');
}
function clampBtn(p) {
  const wa = screen.getDisplayNearestPoint({ x: p.x, y: p.y }).workArea;
  return { x: Math.round(Math.min(Math.max(p.x, wa.x), wa.x + wa.width - BTN)), y: Math.round(Math.min(Math.max(p.y, wa.y), wa.y + wa.height - BTN)) };
}
function defaultBtn() { const wa = screen.getPrimaryDisplay().workArea; return { x: wa.x + wa.width - BTN - 8, y: wa.y + Math.round(wa.height / 2) }; }
function createButton() {
  const p = clampBtn(store.state.button || defaultBtn());
  btnWin = new BrowserWindow({
    width: BTN, height: BTN, x: p.x, y: p.y, transparent: true, frame: false, resizable: false,
    hasShadow: false, skipTaskbar: true, alwaysOnTop: true, show: false, webPreferences: webPrefs
  });
  btnWin.setAlwaysOnTop(true, 'screen-saver');
  btnWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  btnWin.loadFile('button.html');
  btnWin.once('ready-to-show', () => { if (store.settings.enabled) btnWin.showInactive(); });
}
function openSettings() {
  if (setWin) { setWin.show(); setWin.focus(); return; }
  setWin = new BrowserWindow({ width: 470, height: 720, title: 'Pet Settings', webPreferences: webPrefs });
  setWin.setMenu(null);
  setWin.loadFile('settings.html');
  setWin.on('closed', () => { setWin = null; });
}

// ---- pet actions ----
function broadcastSettings() {
  const p = payload();
  if (petWin) petWin.webContents.send('settings:changed', p);
  if (setWin) setWin.webContents.send('settings:changed', p);
}
function applySystem() {
  const s = store.settings;
  app.setLoginItemSettings({ openAtLogin: !!s.launchAtStartup, path: process.execPath, args: app.isPackaged ? [] : [app.getAppPath()] });
  for (const w of [petWin, btnWin]) if (w) { w.setAlwaysOnTop(!!s.alwaysOnTop, 'screen-saver'); }
  if (btnWin) { if (s.enabled) btnWin.showInactive(); else btnWin.hide(); }
  if (!s.enabled && petWin) petWin.webContents.send('pet:forceHide');
}
function summon(openChat = false) {
  const s = store.settings;
  if (!s.enabled) { s.enabled = true; saveStore(); applySystem(); broadcastSettings(); }
  sendVisit({ message: pick(readCfg('messages.json').summon || ['Hi!']), manual: true, openChat });
}
function resetPositions() {
  store.state.button = null; saveStore();
  if (btnWin) { const p = clampBtn(defaultBtn()); btnWin.setPosition(p.x, p.y); btnWin.showInactive(); }
}
function setPause(ms) {
  const st = store.state;
  if (ms === 'tomorrow') { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); st.pausedUntil = d.getTime(); }
  else st.pausedUntil = ms ? Date.now() + ms : 0;
  saveStore(); buildTray();
}
function buildTray() {
  if (!tray) {
    const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'pet.png')).resize({ width: 20, height: 20 });
    tray = new Tray(icon); tray.setToolTip('Desktop Pet'); tray.on('click', () => summon());
  }
  const until = store.state.pausedUntil, paused = Date.now() < until;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Summon Pet', click: () => summon() },
    { label: 'Chat', click: () => summon(true) },
    { label: 'Settings', click: openSettings },
    { label: paused ? 'Pause Pet (paused until ' + new Date(until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ')' : 'Pause Pet', submenu: [
      { label: 'Pause for 30 minutes', click: () => setPause(30 * 60000) },
      { label: 'Pause for 1 hour', click: () => setPause(60 * 60000) },
      { label: 'Pause until tomorrow', click: () => setPause('tomorrow') },
      { label: 'Resume', enabled: paused, click: () => setPause(0) }
    ] },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]));
}

// ---- scheduler (one cheap check every 15 s) ----
function tick() {
  const s = store.settings, st = store.state, now = Date.now();
  if (st.pausedUntil && now >= st.pausedUntil) { st.pausedUntil = 0; saveStore(); buildTray(); }
  if (!s.enabled) return;
  const visitMs = s.visitMinutes * 60000, waterMs = s.waterMinutes * 60000;
  const visitDue = now >= st.nextVisit, waterDue = now >= st.nextWater;
  if (!visitDue && !waterDue) return;
  if (now < st.pausedUntil || isQuiet()) {            // random visits stop while paused / quiet
    if (visitDue) st.nextVisit = now + visitMs;
    if (waterDue) st.nextWater = now + waterMs;
    saveStore(); return;
  }
  if (petBusy) return;
  const msgs = readCfg('messages.json');
  let cat;
  if (waterDue) { cat = 'water'; st.nextWater = now + waterMs; }
  else if (s.checkins) cat = pick(['greeting', 'mood', 'stretch', 'break']);
  st.nextVisit = now + visitMs; saveStore();
  if (cat) sendVisit({ message: pick(msgs[cat]), category: cat });
}

// ---- chat ----
function basicReply(text) {
  const c = readCfg('messages.json').chat || { rules: [], fallback: ['...'] };
  const t = ' ' + text.toLowerCase() + ' ';
  for (const r of c.rules) if (r.keywords.some(k => new RegExp('\\b' + k + '\\b').test(t))) return pick(r.replies);
  return pick(c.fallback);
}
async function aiReply(history) {
  const p = readCfg('personality.json');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getKey() },
    body: JSON.stringify({ model: p.model || 'gpt-4o-mini', temperature: p.temperature ?? 0.8, max_tokens: p.maxTokens || 120,
      messages: [{ role: 'system', content: p.systemPrompt }, ...history.slice(-12)] })
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return (await res.json()).choices[0].message.content.trim();
}

// ---- IPC ----
ipcMain.handle('settings:get', () => payload());
ipcMain.handle('settings:set', (e, patch) => {
  const s = store.settings, st = store.state, old = { ...s };
  for (const k of Object.keys(patch)) if (k in DEFAULTS) s[k] = patch[k];
  s.visitMinutes = Math.max(1, Number(s.visitMinutes) || 5);
  s.waterMinutes = Math.max(1, Number(s.waterMinutes) || 30);
  if (s.visitMinutes !== old.visitMinutes) st.nextVisit = Date.now() + s.visitMinutes * 60000;
  if (s.waterMinutes !== old.waterMinutes) st.nextWater = Date.now() + s.waterMinutes * 60000;
  saveStore(); applySystem(); broadcastSettings();
  return payload();
});
ipcMain.handle('key:set', (e, k) => { setKey(k); return !!getKey(); });
ipcMain.handle('chat:send', async (e, { text, history }) => {
  if (store.settings.aiChat && getKey()) {
    try { return { reply: await aiReply(history), mode: 'ai' }; }
    catch { return { reply: basicReply(text), mode: 'basic', note: ' (AI unavailable, basic mode)' }; }
  }
  return { reply: basicReply(text), mode: 'basic' };
});
ipcMain.on('pet:ready', () => { petReady = true; if (pendingVisit) { sendVisit(pendingVisit); pendingVisit = null; } });
ipcMain.on('pet:bounds', (e, b) => { if (petWin) petWin.setBounds(b); });
ipcMain.on('pet:show', () => { if (petWin) petWin.showInactive(); });
ipcMain.on('pet:hide', () => { if (petWin) petWin.hide(); });
ipcMain.on('pet:busy', (e, v) => { petBusy = v; });
ipcMain.on('pet:focus', () => { if (petWin) petWin.focus(); });
ipcMain.on('btn:click', () => summon());
ipcMain.on('btn:start', () => { const c = screen.getCursorScreenPoint(), [x, y] = btnWin.getPosition(); drag = { cx: c.x, cy: c.y, x, y }; });
ipcMain.on('btn:drag', () => {
  if (!drag) return; const c = screen.getCursorScreenPoint();
  const p = clampBtn({ x: drag.x + c.x - drag.cx, y: drag.y + c.y - drag.cy });
  btnWin.setPosition(p.x, p.y);
});
ipcMain.on('btn:drop', () => { drag = null; const [x, y] = btnWin.getPosition(); store.state.button = clampBtn({ x, y }); saveStore(); });

// ---- startup ----
function init() {
  loadStore();
  if (app.dock) app.dock.hide();
  const st = store.state, s = store.settings, now = Date.now();
  if (process.argv.includes('--reset')) st.button = null;
  if (!(st.nextVisit > now)) st.nextVisit = now + 10000;       // greet shortly after launch
  if (!(st.nextWater > now)) st.nextWater = now + s.waterMinutes * 60000;
  createPet(); createButton(); buildTray(); applySystem();
  setInterval(tick, 15000);
  saveStore();
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (e, argv) => { if (argv.includes('--reset')) resetPositions(); summon(); });
  app.on('window-all-closed', () => {});
  app.whenReady().then(init);
}
