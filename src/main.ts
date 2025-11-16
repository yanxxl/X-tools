import {app, BrowserWindow, screen} from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import {registerIpcHandlers} from './utils/ipcHandlers';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
    app.quit();
}

// 根据屏幕分辨率计算窗口尺寸
const getWindowSize = () => {
    const primaryDisplay = screen.getPrimaryDisplay();
    const {width: screenWidth, height: screenHeight} = primaryDisplay.workAreaSize;

    // 判断是否大于1080p (1920x1080)
    const isHigherThan1080p = screenWidth > 1920 || screenHeight > 1080;

    if (isHigherThan1080p) {
        // 高分辨率显示器使用1080p窗口
        return {width: 1920, height: 1080};
    } else {
        // 1080p或更低分辨率使用720p窗口
        return {width: 1280, height: 720};
    }
};

const createWindow = () => {
    // 根据屏幕分辨率获取窗口尺寸
    const {width, height} = getWindowSize();

    console.log(`屏幕分辨率: ${screen.getPrimaryDisplay().workAreaSize.width}x${screen.getPrimaryDisplay().workAreaSize.height}`);
    console.log(`设置窗口尺寸: ${width}x${height}`);

    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width,
        height,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false, // 可以访问本地文件
        },
        titleBarStyle: 'hidden',
        trafficLightPosition: {x: 12, y: 12},
        ...(process.platform !== 'darwin' ? {titleBarOverlay: true} : {})
    });

    // 保存窗口引用以便后续控制
    (global as any).mainWindow = mainWindow;

    // 确保窗口完全显示后再设置红绿灯位置
    mainWindow.once('ready-to-show', () => {
        console.log('窗口已准备就绪，可以设置红绿灯位置');
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

// 注册IPC处理程序
registerIpcHandlers();

app.whenReady().then(() => {
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