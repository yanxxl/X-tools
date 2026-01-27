import { app, BrowserWindow, dialog, ipcMain, Menu, screen, shell } from 'electron';
import { promises as fs } from 'fs';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { getDirectoryChildren, getFileInfo, getFileTree, readFileText, writeFileText } from './utils/fileLocalUtil';
import { loadConfig, saveConfig } from './utils/configManager';
import { Config } from "./utils/config";
import chardet from 'chardet';
import iconv from 'iconv-lite';
import { spawnSync } from 'child_process';
import { Worker } from 'worker_threads';
import { OfficeParser } from './office/OfficeParser';
import { OfficeParserConfig } from './office/types';
import workerpool from 'workerpool';
import { astToJson, astToText, parseOfficeDocument } from './utils/office';

// 添加环境变量声明
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// 修复Windows控制台中文乱码问题
if (process.platform === 'win32') {
    // 设置Windows控制台为UTF-8编码
    try {
        spawnSync('chcp', ['65001'], { stdio: 'inherit' });
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

// 存储窗口与文件夹的映射关系
const windowFolderMap = new Map<Electron.BrowserWindow, string | undefined>();

// 平台检测
const isMac = process.platform === 'darwin';

// 线程池实例
let pool: workerpool.Pool | null = null;

// 初始化线程池
function initializeThreadPool() {
    try {
        // 根据是否打包使用不同的路径
        let workerPath: string;

        if (__dirname.includes('.vite/build')) {
            // 开发模式下，Worker文件直接在.vite/build目录下
            workerPath = path.join(__dirname, 'poolWorker.js');
        } else if (app.isPackaged) {
            // 打包后，Worker文件在ASAR归档中，使用app.getAppPath()获取路径
            workerPath = path.join(app.getAppPath(), '.vite/build', 'poolWorker.js');
        } else {
            // 其他情况，使用源码路径
            workerPath = path.join(app.getAppPath(), 'src', 'utils', 'poolWorker.ts');
        }

        pool = workerpool.pool(workerPath);

        console.log('线程池初始化成功，工作器路径:', workerPath);
    } catch (error) {
        console.error('线程池初始化失败:', error);
    }
}

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

    // 处理文件选择对话框请求（支持多选）
    ipcMain.handle('openFileDialog', async (event, options) => {
        const result = await dialog.showOpenDialog(options || {
            properties: ['openFile', 'multiSelections'],
            title: '选择文件',
        });

        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths;
        }
        return [];
    });

    ipcMain.handle('loadConfig', async () => {
        return loadConfig();
    });

    ipcMain.handle('saveConfig', async (event, config: Config) => {
        saveConfig(config);
    });

    // 处理获取文件树请求
    ipcMain.handle('getFileTree', async (event, dirPath: string) => {
        try {
            return getFileTree(dirPath, true); // 全部加载
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
            const content = await readFileText(filePath);
            if (content === null) {
                throw new Error('读取文件失败');
            }
            return content;
        } catch (error) {
            console.error('读取文件失败:', error);
            throw error;
        }
    });

    // 读取二进制文件内容
    ipcMain.handle('readFileBinary', async (event, filePath: string) => {
        try {
            const buffer = await fs.readFile(filePath);
            return buffer;
        } catch (error) {
            console.error('读取二进制文件失败:', error);
            throw error;
        }
    });



    // 解析Office文档（通用方法）
    ipcMain.handle('parseOffice', async (event, filePath: string, config?: OfficeParserConfig) => {
        try {
            const result = astToJson(await parseOfficeDocument(filePath, config));
            return result;
        } catch (error) {
            console.error('解析Office文件失败:', error);
            throw error;
        }
    });

    // 解析Office文档文本内容
    ipcMain.handle('parseOfficeText', async (event, filePath: string, config?: OfficeParserConfig, delimiter?: string) => {
        try {
            const ast = await parseOfficeDocument(filePath, config);
            const text = astToText(ast, delimiter);
            return text;
        } catch (error) {
            console.error('解析Office文件文本失败:', error);
            throw error;
        }
    });

    // 写入文件内容
    ipcMain.handle('writeFile', async (event, filePath: string, content: string) => {
        try {
            return await writeFileText(filePath, content);
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
        // 使用跨平台的正则表达式处理路径分隔符
        const resourcesPath = appPath.replace(/[/\\]app\.asar$/, '');
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

    // 获取当前操作系统平台
    ipcMain.handle('getPlatform', async () => {
        return process.platform;
    });

    // 获取当前窗口的文件夹
    ipcMain.handle('getCurrentWindowFolder', (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) {
            return windowFolderMap.get(window);
        }
        return null;
    });

    // 设置当前窗口的文件夹
    ipcMain.handle('setCurrentWindowFolder', (event, folderPath: string) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) {
            windowFolderMap.set(window, folderPath);
            return true;
        }
        return false;
    });



    // 创建新窗口
    ipcMain.handle('createNewWindow', async (event, folderPath?: string) => {
        try {
            createWindow(folderPath);
            return { success: true };
        } catch (error) {
            console.error('创建新窗口失败:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // 打开开发者工具
    ipcMain.handle('openDevTools', async (event) => {
        try {
            const window = BrowserWindow.fromWebContents(event.sender);
            if (window) {
                window.webContents.openDevTools();
                return { success: true };
            }
            return { success: false, error: '无法找到对应的窗口' };
        } catch (error) {
            console.error('打开开发者工具失败:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    // 线程池执行函数
    ipcMain.handle('threadPoolExecute', async (event, functionName: string, args: any[] = []) => {
        if (!pool) {
            initializeThreadPool();
        }

        if (!pool) {
            return { success: false, error: '线程池未初始化' };
        }

        try {
            const result = await pool.exec(functionName, args);
            return { success: true, result };
        } catch (error) {
            console.error('线程池任务执行失败:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
}

// 根据屏幕分辨率计算窗口尺寸
const getWindowSize = () => {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // 判断是否大于1080p (1920x1080)
    const isHigherThan1080p = screenWidth > 1920 || screenHeight > 1080;

    if (isHigherThan1080p) {
        // 高分辨率显示器使用1080p窗口
        return { width: 1920, height: 1080 };
    } else {
        // 1080p或更低分辨率使用720p窗口
        return { width: 1280, height: 720 };
    }
};



// 创建新窗口，可选择指定初始文件夹
const createWindow = (folderPath?: string) => {
    // 根据屏幕分辨率获取窗口尺寸
    const { width, height } = getWindowSize();

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

    // Create the browser window with platform-specific settings
    const newWindow = new BrowserWindow({
        width,
        height,
        x,  // 添加x坐标
        y,  // 添加y坐标
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false, // 可以访问本地文件
            nodeIntegrationInWorker: true, // 允许Web Worker使用Node.js API
        },
        ...(process.platform === 'darwin' ? {
            // macOS specific settings
            titleBarStyle: 'hidden',
            trafficLightPosition: { x: 12, y: 12 }
        } : {
            // Windows/Linux specific settings
            frame: false, // 隐藏系统标题栏和边框
            titleBarStyle: 'hidden', // 隐藏标题栏
            titleBarOverlay: false, // 禁用标题栏覆盖
        })
    });

    // 记录窗口与文件夹的映射关系
    if (!folderPath) folderPath = loadConfig().recentFolders?.[0]?.path || null;
    windowFolderMap.set(newWindow, folderPath);

    // 如果这是第一个窗口，设置为global.mainWindow以兼容现有代码
    if (BrowserWindow.getAllWindows().length === 1) {
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

    // 窗口关闭时清理引用
    newWindow.on('closed', () => {
        // 清理窗口与文件夹的映射关系
        windowFolderMap.delete(newWindow);

        // 如果关闭的是主窗口，重新指定一个主窗口
        if ((global as any).mainWindow === newWindow) {
            const remainingWindows = BrowserWindow.getAllWindows();
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
                { label: '撤销', role: 'undo' },
                { label: '重做', role: 'redo' },
                { type: 'separator' },
                { label: '剪切', role: 'cut' },
                { label: '复制', role: 'copy' },
                { label: '粘贴', role: 'paste' },
                { label: '全选', role: 'selectAll' }
            ]
        },
        // 窗口菜单（所有平台）
        {
            label: '窗口',
            submenu: [
                { label: '最小化', role: 'minimize' },
                { label: '关闭', role: 'close' },
                { type: 'separator' },
                { label: '重新加载', role: 'reload' },
                { label: '强制重新加载', role: 'forceReload' },
                { label: '切换开发者工具', role: 'toggleDevTools' },
                { type: 'separator' },
                { label: '全部显示', role: 'front' }
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
                    { type: 'separator' },
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

    // 初始化线程池
    initializeThreadPool();

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