// A'wn Khafi desktop wrapper. Loads the published web app (AI runs server-side)
// and hides every window from screen sharing / recording.
const { app, BrowserWindow, Menu, session } = require("electron");
const APP_URL = "https://question-whisper-copilot.lovable.app";

function protect(win) {
  win.setContentProtection(true); // excluded from Zoom/Meet/Teams/OBS capture
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200, height: 820, title: "A'wn Khafi", backgroundColor: "#121212",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  protect(win);
  win.webContents.setWindowOpenHandler(() => ({
    action: "allow",
    overrideBrowserWindowOptions: { alwaysOnTop: true, width: 420, height: 600 },
  }));
  win.webContents.on("did-create-window", (child) => { protect(child); child.setAlwaysOnTop(true, "screen-saver"); });
  win.loadURL(APP_URL);
  return win;
}

app.whenReady().then(() => {
  // Auto-grant mic + screen/tab audio for our own origin.
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(wc.getURL().startsWith(APP_URL)));
  session.defaultSession.setDisplayMediaRequestHandler((req, cb) => {
    require("electron").desktopCapturer.getSources({ types: ["screen"] }).then((s) => cb({ video: s[0], audio: "loopback" }));
  });
  const win = createWindow();
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: "View", submenu: [
      { label: "Always on top", type: "checkbox", click: (i) => win.setAlwaysOnTop(i.checked, "screen-saver") },
      { label: "Compact mode", type: "checkbox", click: (i) => i.checked ? win.setSize(420, 640) : win.setSize(1200, 820) },
      { role: "reload" }, { role: "toggleDevTools" }, { role: "quit" },
    ]},
  ]));
});
app.on("window-all-closed", () => app.quit());
