const { app, BrowserWindow, ipcMain, net, session } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 480,
    minHeight: 640,
    backgroundColor: '#0a0e14',
    title: 'MCDU App Fenix A320',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // webview tag needed to embed the Fenix server pages
      webviewTag: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  // mainWindow.webContents.openDevTools();
}

// Allow webviews to load the Fenix server even with its own headers.
app.whenReady().then(() => {
  // Strip X-Frame-Options / frame-ancestors so the Fenix EFB pages can be
  // displayed inside our webview regardless of server header config.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders || {};
    for (const key of Object.keys(headers)) {
      const lk = key.toLowerCase();
      if (lk === 'x-frame-options' || lk === 'content-security-policy') {
        delete headers[key];
      }
    }
    callback({ responseHeaders: headers });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/**
 * Ping the Fenix server. We do a lightweight HTTP request to http://<host>:8083/
 * with a short timeout. A response (any status) means the server is up.
 */
ipcMain.handle('check-fenix', async (_event, host) => {
  const url = `http://${host}:8083/`;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    const request = net.request({ method: 'GET', url });
    const timer = setTimeout(() => {
      try { request.abort(); } catch (_) {}
      finish({ ok: false, reason: 'timeout' });
    }, 2500);

    request.on('response', (response) => {
      clearTimeout(timer);
      finish({ ok: true, status: response.statusCode });
      response.on('data', () => {});
      response.on('end', () => {});
    });

    request.on('error', (err) => {
      clearTimeout(timer);
      finish({ ok: false, reason: err.message });
    });

    request.end();
  });
});

ipcMain.handle('get-local-ip', async () => {
  const os = require('os');
  const ifaces = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        candidates.push(iface.address);
      }
    }
  }
  return candidates;
});
