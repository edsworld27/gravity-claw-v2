const { app, Tray, Menu, nativeImage, BrowserWindow } = require('electron');
const path = require('path');

let tray = null;
let window = null;

app.whenReady().then(() => {
    // Create a tray icon (stub)
    const icon = nativeImage.createEmpty();
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Open Gravity Claw', click: () => showWindow() },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
    ]);

    tray.setToolTip('Gravity Claw');
    tray.setContextMenu(contextMenu);

    console.log('[Tray] macOS Menu Bar app initialized.');
});

function showWindow() {
    if (!window) {
        window = new BrowserWindow({
            width: 400,
            height: 600,
            show: true,
            frame: false,
            webPreferences: {
                nodeIntegration: false
            }
        });
        window.loadURL('http://localhost:3001'); // Pointing to WebChat
    } else {
        window.show();
    }
}

// Hide from dock
if (process.platform === 'darwin') {
    app.dock.hide();
}
