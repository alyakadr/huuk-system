const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Check if in development
  const isDev = process.env.NODE_ENV === "development"; // Check if in development mode

  if (isDev) {
    // During development, load React app from localhost:3000
    win.loadURL("http://localhost:3000");
    win.webContents.openDevTools(); // Optional: Open DevTools for debugging
  } else {
    // In production, load from the built index.html
    const indexPath = path.join(__dirname, "build", "index.html");
    win.loadFile(indexPath);
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
