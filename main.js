const { app, BrowserWindow, Menu, shell, ipcMain, dialog, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

/* some laptop GPUs / drivers leave the window invisible or blank: software rendering is the safe choice */
app.disableHardwareAcceleration();

/* write start-up problems to a log so a window that fails to open can be diagnosed */
function log(msg) {
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'ascent-log.txt'), new Date().toISOString() + ' ' + msg + '\n'); } catch (e) {}
}
process.on('uncaughtException', e => log('uncaught: ' + (e && e.stack || e)));

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }

let win;
const BAR_H = 44; // height of the window-button area (matches the app header)

/* colours the window starts with (the page then sends its exact ones), so there is never a black or white strip */
function hex(c) {
  if (!c) return null;
  c = String(c).trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  const m = c.match(/[\d.]+/g);
  if (!m || m.length < 3 || (m.length > 3 && +m[3] < 0.99)) return null;
  return '#' + m.slice(0, 3).map(n => Math.round(+n).toString(16).padStart(2, '0')).join('');
}
const START = () => false
  ? { page: '#181a1f', bar: '#202328', fg: '#eceef2' }
  : { page: '#eceef2', bar: '#f9fafc', fg: '#14161c' };

function createWindow() {
  const c0 = START();
  win = new BrowserWindow({
    width: 1280, height: 840, minWidth: 420, minHeight: 600,
    title: 'JEE OS',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    backgroundColor: c0.page,
    show: false,
    autoHideMenuBar: true,
    // no black title bar: the page extends to the top edge and the
    // minimise / maximise / close buttons float over the app header
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: c0.bar, symbolColor: c0.fg, height: BAR_H },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, sandbox: true, backgroundThrottling: false
    }
  });
  Menu.setApplicationMenu(null);
  let shown = false;
  const showOnce = () => { if (!shown && win && !win.isDestroyed()) { shown = true; win.show(); } };
  win.once('ready-to-show', showOnce);
  win.webContents.on('did-finish-load', showOnce);
  win.webContents.on('did-fail-load', (_e, code, desc, url) => { log('did-fail-load ' + code + ' ' + desc + ' ' + url); showOnce(); });
  win.webContents.on('render-process-gone', (_e, d) => log('render-process-gone ' + JSON.stringify(d)));
  setTimeout(showOnce, 4000); // never leave the app running with no visible window
  win.loadFile(path.join(__dirname, 'app', 'index.html')).catch(e => { log('loadFile: ' + e); showOnce(); });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); }
  });
}

/* ---------- window buttons follow the app theme ---------- */
ipcMain.on('titlebar', (_e, bg, fg, page) => {
  try {
    if (!win || win.isDestroyed()) return;
    const b = hex(bg), f = hex(fg), p = hex(page);
    if (b && f && win.setTitleBarOverlay) win.setTitleBarOverlay({ color: b, symbolColor: f, height: BAR_H });
    if (p) win.setBackgroundColor(p); // also what shows while the window is being resized
  } catch (e) {}
});

/* ---------- backups ---------- */
const cfgFile = () => path.join(app.getPath('userData'), 'backup-config.json');
function backupDir() {
  let dir = path.join(app.getPath('documents'), 'Ascent Backups');
  try { const c = JSON.parse(fs.readFileSync(cfgFile(), 'utf8')); if (c.dir) dir = c.dir; } catch (e) {}
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  return dir;
}
function stamp() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}
function listBackups() {
  const dir = backupDir();
  let files = [];
  try {
    files = fs.readdirSync(dir).filter(n => /^Ascent-backup-.*\.json$/.test(n)).map(n => {
      const s = fs.statSync(path.join(dir, n));
      return { name: n, mtime: s.mtimeMs, size: s.size };
    }).sort((a, b) => b.mtime - a.mtime);
  } catch (e) {}
  return { dir, files };
}
function prune(dir) { // keep the newest 30
  try { listBackups().files.slice(30).forEach(f => fs.unlinkSync(path.join(dir, f.name))); } catch (e) {}
}
function writeBackup(text, label) {
  const dir = backupDir();
  const name = `Ascent-backup-${label ? label + '-' : ''}${stamp()}.json`;
  fs.writeFileSync(path.join(dir, name), text, 'utf8');
  prune(dir);
  return { ok: true, time: Date.now(), name, dir };
}

ipcMain.handle('bk:now', (_e, text, label) => {
  try { return writeBackup(String(text), label); } catch (e) { return { ok: false, error: 'Backup failed' }; }
});
ipcMain.on('bk:quiet', (e, text) => {
  try { writeBackup(String(text), 'auto'); } catch (err) {}
  e.returnValue = true;
});
ipcMain.handle('bk:info', () => listBackups());
ipcMain.handle('bk:open', () => { shell.openPath(backupDir()); });
ipcMain.handle('bk:choose', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], defaultPath: backupDir() });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  fs.writeFileSync(cfgFile(), JSON.stringify({ dir: r.filePaths[0] }));
  return { ok: true, dir: r.filePaths[0] };
});
ipcMain.handle('bk:read', (_e, name) => {
  try {
    const safe = path.basename(String(name));
    return { ok: true, text: fs.readFileSync(path.join(backupDir(), safe), 'utf8') };
  } catch (e) { return { ok: false }; }
});
ipcMain.handle('bk:pick', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Backup', extensions: ['json'] }] });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  try { return { ok: true, text: fs.readFileSync(r.filePaths[0], 'utf8') }; } catch (e) { return { ok: false }; }
});


/* ---------- automatic updates (installed version only, from GitHub Releases) ---------- */
let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch (e) { log('electron-updater not available: ' + e); }
const isPortable = !!process.env.PORTABLE_EXECUTABLE_DIR;
const canUpdate = () => !!autoUpdater && app.isPackaged && !isPortable;
let upd = { state: 'idle', version: null, percent: 0, error: null };
let askedFor = null;
function pushUpd(patch) {
  Object.assign(upd, patch);
  if (win && !win.isDestroyed()) win.webContents.send('update:status', { ...upd, current: app.getVersion(), supported: canUpdate(), portable: isPortable });
}
function checkUpdates() {
  if (!canUpdate()) return Promise.resolve();
  return autoUpdater.checkForUpdates().catch(e => { log('update check failed: ' + (e && e.message || e)); pushUpd({ state: 'error', error: String(e && e.message || e) }); });
}
function setupUpdater() {
  if (!canUpdate()) { log('auto-update off (packaged=' + app.isPackaged + ', portable=' + isPortable + ')'); return; }
  /* private repository: the build adds update-token.json (read-only token for this one repo) */
  try {
    const f = JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'update-token.json'), 'utf8'));
    if (f && f.token && f.owner && f.repo) autoUpdater.setFeedURL({ provider: 'github', owner: f.owner, repo: f.repo, private: true, token: f.token });
  } catch (e) { /* no token file: public repository, uses the built-in update settings */ }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true; // even if you pick "Later", it installs when you close the app
  autoUpdater.logger = { info: m => log('updater: ' + m), warn: m => log('updater warn: ' + m), error: m => log('updater error: ' + m), debug() {} };
  autoUpdater.on('checking-for-update', () => pushUpd({ state: 'checking', error: null }));
  autoUpdater.on('update-not-available', () => pushUpd({ state: 'idle', version: null }));
  autoUpdater.on('update-available', i => pushUpd({ state: 'downloading', version: i.version, percent: 0 }));
  autoUpdater.on('download-progress', p => pushUpd({ state: 'downloading', percent: p.percent }));
  autoUpdater.on('error', e => { log('updater error event: ' + (e && e.message || e)); pushUpd({ state: 'error', error: String(e && e.message || e) }); });
  autoUpdater.on('update-downloaded', i => {
    pushUpd({ state: 'ready', version: i.version, percent: 100 });
    if (askedFor === i.version) return;
    askedFor = i.version;
    dialog.showMessageBox(win, {
      type: 'info', buttons: ['Restart now', 'Later'], defaultId: 0, cancelId: 1,
      title: 'JEE OS update', message: 'Version ' + i.version + ' is ready',
      detail: 'Restart to finish updating. Your data is kept. If you pick Later, it installs the next time you close the app.'
    }).then(r => { if (r.response === 0) autoUpdater.quitAndInstall(false, true); }).catch(() => {});
  });
  setTimeout(checkUpdates, 8000);
  setInterval(checkUpdates, 4 * 60 * 60 * 1000);
}
ipcMain.handle('update:state', () => ({ ...upd, current: app.getVersion(), supported: canUpdate(), portable: isPortable }));
ipcMain.handle('update:check', async () => { await checkUpdates(); return { ...upd, current: app.getVersion(), supported: canUpdate(), portable: isPortable }; });
ipcMain.handle('update:install', () => { if (canUpdate() && upd.state === 'ready') autoUpdater.quitAndInstall(false, true); });

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => { try { createWindow(); setupUpdater(); } catch (e) { log('createWindow: ' + (e && e.stack || e)); dialog.showErrorBox('JEE OS', String(e)); app.quit(); } });
app.on('window-all-closed', () => app.quit());
