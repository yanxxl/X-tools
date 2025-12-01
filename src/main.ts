import {app, BrowserWindow, dialog, ipcMain, screen, shell} from 'electron';
import {promises as fs} from 'fs';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import {getDirectoryChildren, getFileInfo, getFileTree} from './utils/fileUtils';
import {loadConfig, saveConfig} from './utils/configManager';
import {Config} from "./utils/config";
import chardet from 'chardet';
import iconv from 'iconv-lite';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
    app.quit();
}

// 用于存储当前活动的搜索Worker线程
const activeSearchWorkers = new Map<string, any>();

// 注册所有IPC处理程序
function registerIpcHandlers() {
    // 处理文件夹选择对话框请求
    ipcMain.handle('selectDirectory', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: '选择文件夹',
        });

        if (!result.canceled && result.filePaths.length > 0) {
            const folderPath = result.filePaths[0];
            return folderPath;
        }
        return null;
    });

    ipcMain.handle('loadConfig', async () => {
        return loadConfig();
    });

    ipcMain.handle('saveConfig', async (event, config: Config) => {
        saveConfig(config);
    });

    // 处理获取文件树请求（懒加载模式）
    ipcMain.handle('getFileTree', async (event, dirPath: string) => {
        try {
            return getFileTree(dirPath, false); // 使用懒加载模式
        } catch (error) {
            console.error('获取文件树失败:', error);
            throw error;
        }
    });

    // 处理懒加载获取目录子节点请求
    ipcMain.handle('getDirectoryChildren', async (event, dirPath: string) => {
        try {
            return getDirectoryChildren(dirPath);
        } catch (error) {
            console.error('获取目录子节点失败:', error);
            throw error;
        }
    });

    // 获取文件/目录基本信息
    ipcMain.handle('getFileInfo', async (event, filePath: string) => {
        try {
            return getFileInfo(filePath);
        } catch (error) {
            console.error('获取文件信息失败:', error);
            throw error;
        }
    });

    // 控制红绿灯的显示/隐藏
    ipcMain.handle('setWindowButtonVisibility', (_, visible: boolean) => {
        const mainWindow = (global as any).mainWindow as BrowserWindow;
        if (mainWindow) {
            try {
                mainWindow.setWindowButtonVisibility(visible);
            } catch (error) {
                console.error('设置红绿灯位置失败:', error);
                throw error;
            }
        } else {
            console.error('主窗口引用不存在');
            throw new Error('主窗口引用不存在');
        }
    });

    // 打开文件（使用系统默认应用）
    ipcMain.handle('openFile', async (event, filePath: string) => {
        try {
            await shell.openPath(filePath);
        } catch (error) {
            console.error('打开文件失败:', error);
            throw error;
        }
    });

    // 显示文件所在文件夹
    ipcMain.handle('showItemInFolder', async (event, filePath: string) => {
        try {
            shell.showItemInFolder(filePath);
        } catch (error) {
            console.error('显示文件夹失败:', error);
            throw error;
        }
    });

    // 读取文件内容
    ipcMain.handle('readFile', async (event, filePath: string) => {
        try {
            // 先以buffer形式读取文件
            const buffer = await fs.readFile(filePath);
            // 检测文件编码
            const detectedEncoding = chardet.detect(buffer);
            console.log(`检测到文件编码: ${detectedEncoding || 'unknown'}，路径: ${filePath}`);

            // 如果检测到编码，则使用iconv-lite转换为utf-8
            // 如果无法检测到编码或编码不支持，尝试使用utf-8（可能会出现乱码）
            let content: string;
            if (detectedEncoding && iconv.encodingExists(detectedEncoding)) {
                content = iconv.decode(buffer, detectedEncoding);
            } else {
                // 尝试直接使用utf-8（可能会抛出错误）
                try {
                    content = buffer.toString('utf-8');
                } catch (e) {
                    // 如果utf-8解码失败，尝试使用gbk作为备选
                    content = iconv.decode(buffer, 'gbk');
                }
            }
            
            return content;
        } catch (error) {
            console.error('读取文件失败:', error);
            throw error;
        }
    });

    // 写入文件内容
    ipcMain.handle('writeFile', async (event, filePath: string, content: string) => {
        try {
            // 首先检测文件是否存在并获取其编码
            let fileEncoding = 'utf-8'; // 默认使用utf-8

            try {
                // 检查文件是否存在
                await fs.access(filePath);

                // 文件存在，读取文件以检测编码
                const buffer = await fs.readFile(filePath, {encoding: null});
                const detectedEncoding = chardet.detect(buffer);

                if (detectedEncoding && iconv.encodingExists(detectedEncoding)) {
                    fileEncoding = detectedEncoding;
                    console.log(`检测到文件编码: ${fileEncoding}，路径: ${filePath}`);
                }
            } catch (error) {
                // 文件不存在或读取失败，使用默认编码
                console.log(`文件不存在或无法读取，将使用默认编码: ${fileEncoding}，路径: ${filePath}`);
            }

            // 根据文件编码写入内容
            if (fileEncoding === 'utf-8') {
                // UTF-8编码直接写入
                await fs.writeFile(filePath, content, 'utf-8');
            } else {
                // 其他编码需要使用iconv-lite进行转换后写入
                const encodedContent = iconv.encode(content, fileEncoding);
                await fs.writeFile(filePath, encodedContent);
            }
            
            return true;
        } catch (error) {
            console.error('写入文件失败:', error);
            throw error;
        }
    });

    // 打开外部链接
    ipcMain.handle('openExternal', async (event, url: string) => {
        try {
            await shell.openExternal(url);
        } catch (error) {
            console.error('打开外部链接失败:', error);
            throw error;
        }
    });

    // 搜索文件内容 - 使用Worker线程
    ipcMain.handle('searchFilesContent', async (event, dirPath: string, query: string, searchId: string, searchMode: 'content' | 'filename' = 'content') => {
        const {Worker} = require('worker_threads');
        const path = require('path');
        const {app} = require('electron');

        return new Promise((resolve, reject) => {
            // 创建Worker线程 - 根据是否打包使用不同的路径
            let workerPath;
            if (__dirname.includes('.vite/build')) {
                // 开发模式下，Worker文件直接在.vite/build目录下
                workerPath = path.join(__dirname, 'searchWorker.js');
            } else if (app.isPackaged) {
                // 打包后，Worker文件会在resources目录下
                workerPath = path.join(process.resourcesPath, 'searchWorker.js');
            } else {
                // 其他情况，使用源码路径
                workerPath = path.join(app.getAppPath(), 'src', 'utils', 'searchWorker.ts');
            }

            const worker = new Worker(workerPath, {
                workerData: {dirPath, query, searchId, searchMode}
            });

            // 存储Worker引用以便后续取消
            activeSearchWorkers.set(searchId, worker);

            const results: any[] = [];

            // 监听Worker线程消息
            worker.on('message', (message: any) => {
                if (message.type === 'progress') {
                    // 转发进度更新到渲染进程
                    event.sender.send('searchProgress', message.data);
                } else if (message.type === 'fileResult') {
                    // 接收到单个文件的搜索结果
                    if (message.data === null) {
                        // 搜索完成
                        event.sender.send('searchFileResult', {searchId, data: null}); // 发送结束信号到前端
                        activeSearchWorkers.delete(searchId); // 清除活动Worker引用
                        resolve(results);
                    } else {
                        // 添加到结果列表并发送到前端
                        results.push(message.data);
                        event.sender.send('searchFileResult', {searchId, data: message.data});
                    }
                } else if (message.type === 'error') {
                    // 搜索出错
                    activeSearchWorkers.delete(searchId); // 清除活动Worker引用
                    reject(new Error(message.data));
                }
            });

            // 监听Worker线程错误
            worker.on('error', (error: Error) => {
                console.error('Worker线程错误:', error);
                activeSearchWorkers.delete(searchId); // 清除活动Worker引用
                reject(error);
            });

            // 监听Worker线程退出
            worker.on('exit', (code: number) => {
                if (code !== 0) {
                    console.error(`Worker线程退出，退出码: ${code}`);
                }
                activeSearchWorkers.delete(searchId); // 确保清除活动Worker引用
            });
        });
    });

    // 取消搜索
    ipcMain.handle('cancelSearch', async (event, searchId: string) => {
        const worker = activeSearchWorkers.get(searchId);
        if (worker) {
            worker.terminate(); // 终止Worker线程
            activeSearchWorkers.delete(searchId); // 清除引用
            return true;
        }
        return false;
    });
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