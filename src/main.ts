import {app, BrowserWindow, protocol} from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers } from './utils/ipcHandlers';

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'local-file',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            stream: true
        }
    }
]);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
    app.quit();
}

const createWindow = () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
        titleBarStyle: 'hidden',
        trafficLightPosition: {x: 12, y: 12},
        ...(process.platform !== 'darwin' ? {titleBarOverlay: true} : {})
    });

    // and load the index.html of the app.
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
        mainWindow.loadFile(
            path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
        );
    }

    // Open the DevTools.
    // mainWindow.webContents.openDevTools();
};

const registerLocalFileProtocol = () => {
    protocol.registerFileProtocol('local-file', (request, callback) => {
        try {
            const url = request.url.replace('local-file://', '');
            const decodedPath = decodeURIComponent(url);
            callback({ path: decodedPath });
        } catch (error) {
            console.error('解析本地文件协议失败:', error);
            callback({ error: -6 }); // FILE_NOT_FOUND
        }
    });
};

// 注册IPC处理程序
registerIpcHandlers();

app.whenReady().then(() => {
    registerLocalFileProtocol();
    createWindow();
});

// Quit when all windows are closed, except on macOS. There,
// it's common for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
