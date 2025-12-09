import {app, BrowserWindow, dialog, ipcMain, Menu, screen, shell} from 'electron';
import {promises as fs} from 'fs';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import {getDirectoryChildren, getFileInfo, getFileTree} from './utils/fileLocalUtil';
import {loadConfig, saveConfig} from './utils/configManager';
import {Config} from "./utils/config";
import chardet from 'chardet';
import iconv from 'iconv-lite';
import {spawnSync} from 'child_process';
import {Worker} from 'worker_threads';

// 添加环境变量声明
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// 修复Windows控制台中文乱码问题
if (process.platform === 'win32') {
    // 设置Windows控制台为UTF-8编码
    try {
        spawnSync('chcp', ['65001'], {stdio: 'inherit'});
    } catch (error) {
        console.error('设置控制台编码失败:', error);
    }

    // 重写console.log和console.error方法，确保输出正确编码
    const originalLog = console.log;
    const originalError = console.error;

    console.log = function (...args: any[]) {
        if (process.platform === 'win32') {
            // 转换为字符串
            const message = args.map(arg => {
                if (typeof arg === 'object') {
                    return JSON.stringify(arg, null, 2);
                }
                return String(arg);
            }).join(' ');

            // 使用iconv-lite转换为GBK编码输出到stdout
            process.stdout.write(iconv.encode(message + '\n', 'gbk'));
        } else {
            originalLog.apply(console, args);
        }
    };

    console.error = function (...args: any[]) {
        if (process.platform === 'win32') {
            // 转换为字符串
            const message = args.map(arg => {
                if (typeof arg === 'object') {
                    return JSON.stringify(arg, null, 2);
                }
                return String(arg);
            }).join(' ');

            // 使用iconv-lite转换为GBK编码输出到stderr
            process.stderr.write(iconv.encode(message + '\n', 'gbk'));
        } else {
            originalError.apply(console, args);
        }
    };
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
    app.quit();
}

// 用于存储当前活动的搜索Worker线程
const activeSearchWorkers = new Map<string, any>();

// 用于存储所有窗口的Map
const windows = new Map<string, BrowserWindow>();

// 平台检测
const isMac = process.platform === 'darwin';

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
    ipcMain.handle('setWindowButtonVisibility', (event, visible: boolean) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) {
            try {
                // setWindowButtonVisibility is macOS-specific
                if (process.platform === 'darwin' && typeof window.setWindowButtonVisibility === 'function') {
                    window.setWindowButtonVisibility(visible);
                }
            } catch (error) {
                console.error('设置红绿灯位置失败:', error);
                throw error;
            }
        } else {
            console.error('窗口引用不存在');
            throw new Error('窗口引用不存在');
        }
    });

    // 窗口最小化
    ipcMain.handle('minimizeWindow', (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) {
            window.minimize();
        }
    });

    // 窗口最大化/还原切换
    ipcMain.handle('toggleMaximizeWindow', (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) {
            if (window.isMaximized()) {
                window.unmaximize();
            } else {
                window.maximize();
            }
        }
    });

    // 关闭窗口
    ipcMain.handle('closeWindow', (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) {
            window.close();
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

    // 获取应用版本号
    ipcMain.handle('getAppVersion', async () => {
        return app.getVersion();
    });

    // 获取应用名称
    ipcMain.handle('getAppName', async () => {
        return app.getName();
    });

    // 获取应用资源目录路径
    ipcMain.handle('getAppPath', async () => {
        // 在Electron中，app.getAppPath()返回应用程序目录路径
        // 我们需要构造正确的资源目录路径
        const appPath = app.getAppPath();
        // 应用程序目录通常是 Resources/app.asar，所以我们需要返回到Resources目录
        const resourcesPath = appPath.replace(/\/app\.asar$/, '');
        console.log('getAppPath: appPath =', appPath);
        console.log('getAppPath: resourcesPath =', resourcesPath);
        return resourcesPath;
    });

    // 获取应用描述
    ipcMain.handle('getAppDescription', async () => {
        const packageJsonPath = path.join(app.getAppPath(), 'package.json');
        const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonContent);
        return packageJson.description;
    });

    // 获取当前平台是否为Mac
    ipcMain.handle('getIsMac', async () => {
        return isMac;
    });

    // 搜索文件内容 - 使用Worker线程
    ipcMain.handle('searchFilesContent', async (event, dirPath: string, query: string, searchId: string, searchMode: 'content' | 'filename' = 'content') => {
        // Worker和path、app已经在文件顶部导入

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

    // 创建新窗口
    ipcMain.handle('createNewWindow', async (event, folderPath?: string) => {
        try {
            const newWindow = createWindow(folderPath);
            return {success: true, windowId: (newWindow as any).windowId};
        } catch (error) {
            console.error('创建新窗口失败:', error);
            return {success: false, error: (error as Error).message};
        }
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

// 生成唯一窗口ID
function generateWindowId(): string {
    return `window_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 创建新窗口，可选择指定初始文件夹
const createWindow = (folderPath?: string) => {
    // 根据屏幕分辨率获取窗口尺寸
    const {width, height} = getWindowSize();
    
    // 获取当前活跃窗口的位置信息，用于新窗口偏移
    let x: number | undefined;
    let y: number | undefined;
    
    // 获取当前焦点窗口
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
        const currentPosition = focusedWindow.getPosition();
        // 新窗口相对于当前窗口偏移30像素
        x = currentPosition[0] + 40;
        y = currentPosition[1] + 40;
    }

    // 生成唯一窗口ID
    const windowId = generateWindowId();

    // Create the browser window with platform-specific settings
    const newWindow = new BrowserWindow({
        width,
        height,
        x,  // 添加x坐标
        y,  // 添加y坐标
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false, // 可以访问本地文件
        },
        ...(process.platform === 'darwin' ? {
            // macOS specific settings
            titleBarStyle: 'hidden',
            trafficLightPosition: {x: 12, y: 12}
        } : {
            // Windows/Linux specific settings
            frame: false, // 隐藏系统标题栏和边框
            titleBarStyle: 'hidden', // 隐藏标题栏
            titleBarOverlay: false, // 禁用标题栏覆盖
        })
    });

    // 存储窗口引用
    windows.set(windowId, newWindow);
    (newWindow as any).windowId = windowId;

    // 如果这是第一个窗口，设置为global.mainWindow以兼容现有代码
    if (windows.size === 1) {
        (global as any).mainWindow = newWindow;
    }

    // and load the index.html of the app.
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        newWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
        newWindow.loadFile(
            path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
        );
    }

    // 窗口准备好后，如果指定了文件夹路径，则设置初始文件夹
    newWindow.webContents.once('did-finish-load', () => {
        if (folderPath) {
            newWindow.webContents.send('setInitialFolder', folderPath);
        }
    });

    // 窗口关闭时清理引用
    newWindow.on('closed', () => {
        windows.delete(windowId);
        // 如果关闭的是主窗口，重新指定一个主窗口
        if ((global as any).mainWindow === newWindow) {
            const remainingWindows = Array.from(windows.values());
            if (remainingWindows.length > 0) {
                (global as any).mainWindow = remainingWindows[0];
            } else {
                (global as any).mainWindow = null;
            }
        }
    });

    // Open the DevTools.
    // newWindow.webContents.openDevTools();

    return newWindow;
};

// 创建应用菜单
function createMenu() {
    const appName = app.getName();

    // 基础菜单项
    const baseMenu: any[] = [
        // 编辑菜单（所有平台）
        {
            label: '编辑',
            submenu: [
                {label: '撤销', role: 'undo'},
                {label: '重做', role: 'redo'},
                {type: 'separator'},
                {label: '剪切', role: 'cut'},
                {label: '复制', role: 'copy'},
                {label: '粘贴', role: 'paste'},
                {label: '全选', role: 'selectAll'}
            ]
        },
        // 窗口菜单（所有平台）
        {
            label: '窗口',
            submenu: [
                {label: '最小化', role: 'minimize'},
                {label: '关闭', role: 'close'},
                {type: 'separator'},
                {label: '重新加载', role: 'reload'},
                {label: '强制重新加载', role: 'forceReload'},
                {label: '切换开发者工具', role: 'toggleDevTools'},
                {type: 'separator'},
                {label: '全部显示', role: 'front'}
            ]
        },
        // 帮助菜单（所有平台）
        {
            label: '帮助',
            submenu: [
                {
                    label: '关于 ' + appName,
                    click: async () => {
                        const mainWindow = (global as any).mainWindow as BrowserWindow;
                        if (mainWindow) {
                            const appVersion = app.getVersion();

                            dialog.showMessageBox(mainWindow, {
                                type: 'info',
                                title: '关于',
                                message: `${appName}\n版本: ${appVersion}\n\n一个本地资料库浏览工具。`,
                                buttons: ['确定']
                            });
                        }
                    }
                }
            ]
        }
    ];

    let menuTemplate: any[] = [];

    if (isMac) {
        // macOS 菜单结构
        menuTemplate = [
            {
                label: appName,
                submenu: [
                    {
                        label: '关于 ' + appName,
                        click: async () => {
                            const mainWindow = (global as any).mainWindow as BrowserWindow;
                            if (mainWindow) {
                                const appVersion = app.getVersion();

                                dialog.showMessageBox(mainWindow, {
                                    type: 'info',
                                    title: '关于',
                                    message: `${appName}\n版本: ${appVersion}\n\n一个本地资料库浏览工具。`,
                                    buttons: ['确定']
                                });
                            }
                        }
                    },
                    {type: 'separator'},
                    {
                        label: '退出',
                        accelerator: 'Cmd+Q',
                        click() {
                            app.quit();
                        }
                    }
                ]
            },
            ...baseMenu
        ];
    } else {
        // Windows/Linux 菜单结构
        menuTemplate = [
            {
                label: '文件',
                submenu: [
                    {
                        label: '退出',
                        accelerator: 'Ctrl+Q',
                        click() {
                            app.quit();
                        }
                    }
                ]
            },
            ...baseMenu
        ];
    }

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}

// 注册IPC处理程序
registerIpcHandlers();

app.whenReady().then(() => {
    // 显示软件版本号，Electron 版本号
    console.log(`${app.getName()} ${app.getVersion()} - Electron ${process.versions.electron}`);

    createWindow();
    if (isMac) createMenu();
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