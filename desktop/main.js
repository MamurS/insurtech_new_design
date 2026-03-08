const { app, BrowserWindow, session } = require('electron');
const path = require('path');

let mainWindow;

async function createWindow() {
  // Clear ALL session data BEFORE creating the window
  const ses = session.defaultSession;
  await ses.clearStorageData();
  await ses.clearCache();
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "InsurTech Policy Manager",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadURL('https://insurtech-r36f.onrender.com');

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    mainWindow.loadURL(`data:text/html,
      <html>
        <body style="font-family: Arial; padding: 50px; text-align: center; background: #1e293b; color: white;">
          <h1>Connection Error</h1>
          <p>Unable to connect to InsurTech server.</p>
          <p style="color: #888; font-size: 14px;">${errorDescription}</p>
          <button onclick="location.reload()" style="padding: 10px 20px; cursor: pointer; margin-top: 20px; background: #3b82f6; color: white; border: none; border-radius: 8px;">
            Retry
          </button>
        </body>
      </html>
    `);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});