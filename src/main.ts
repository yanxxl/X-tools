import { app, BrowserWindow, dialog, ipcMain, Menu, screen, shell } from 'electron';
import fs from 'fs';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { getDirectoryChildren, getFileInfo, getFileTree, readFileText, writeFileText } from './utils/fileLocalUtil';
import { readFileLines } from './utils/fileCacheUtil';
import { loadConfig, saveConfig } from './utils/configManager';
import { Config } from "./utils/config";
import { OfficeParserConfig } from './office/types';
import workerpool from 'workerpool';
import { astToJson, astToText, parseOfficeDocument } from './utils/office';
import log, { configureLogger } from './utils/logger';

// 添加环境变量声明
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// 配置日志系统
configureLogger();
// 用log替换默认的console
console.log = log.info;
console.error = log.error;

// 修复Windows控制台中文乱码问题
// fixWindowsConsoleEncoding();

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
        let workerPath: string;

        if (app.isPackaged) {
            workerPath = path.join(app.getAppPath(), '.vite/build', 'poolWorker.js');
        } else {
            const buildPath = path.join(__dirname, '..', '.vite', 'build', 'poolWorker.js');
            if (fs.existsSync(buildPath)) {
                workerPath = buildPath;
            } else {
                workerPath = path.join(__dirname, 'poolWorker.js');
            }
        }

        workerPath = path.resolve(workerPath);
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
            const fileInfo = getFileInfo(filePath);
            if (fileInfo === null) {
                throw new Error(`文件不存在: ${filePath}`);
            }
            return fileInfo;
        } catch (error) {
            console.error('获取文件信息失败:', error);
            throw error;
        }
    });

    // 检查文件是否存在
    ipcMain.handle('fileExists', async (event, filePath: string) => {
        try {
            return fs.existsSync(filePath);
        } catch (error) {
            console.error('检查文件存在失败:', error);
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
            const buffer = fs.readFileSync(filePath);
            return buffer;
        } catch (error) {
            console.error('读取二进制文件失败:', error);
            throw error;
        }
    });

    // 读取文件内容行列表
    ipcMain.handle('readFileLines', async (event, filePath: string) => {
        try {
            const lines = await readFileLines(filePath);
            return lines;
        } catch (error) {
            console.error('读取文件行列表失败:', error);
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

    // 打开外部链接
    ipcMain.handle('openExternal', async (event, url: string) => {
        try {
            await shell.openExternal(url);
        } catch (error) {
            console.error('打开外部链接失败:', error);
            throw error;
        }
    });

    // 添加文件
    ipcMain.handle('addFile', async (event, directoryPath: string) => {
        try {
            // 确保目录存在
            if (!fs.existsSync(directoryPath)) {
                fs.mkdirSync(directoryPath, { recursive: true });
            }

            // 生成新文件路径，处理重名情况
            let fileName = '新文件.md';
            let filePath = path.join(directoryPath, fileName);
            let counter = 1;

            // 检查文件是否存在，如果存在则添加序号
            while (fs.existsSync(filePath)) {
                fileName = `新文件(${counter}).md`;
                filePath = path.join(directoryPath, fileName);
                counter++;
            }

            // 创建空文件
            fs.writeFileSync(filePath, '', 'utf-8');
            return { success: true, filePath };
        } catch (error) {
            console.error('添加文件失败:', error);
            throw error;
        }
    });

    // 添加文件夹
    ipcMain.handle('addFolder', async (event, directoryPath: string) => {
        try {
            // 确保目录存在
            if (!fs.existsSync(directoryPath)) {
                fs.mkdirSync(directoryPath, { recursive: true });
            }

            // 生成新文件夹路径，处理重名情况
            let folderName = '新文件夹';
            let folderPath = path.join(directoryPath, folderName);
            let counter = 1;

            // 检查文件夹是否存在，如果存在则添加序号
            while (fs.existsSync(folderPath)) {
                folderName = `新文件夹(${counter})`;
                folderPath = path.join(directoryPath, folderName);
                counter++;
            }

            // 创建文件夹
            fs.mkdirSync(folderPath, { recursive: true });
            return { success: true, folderPath };
        } catch (error) {
            console.error('添加文件夹失败:', error);
            throw error;
        }
    });

    // 删除文件或文件夹（移动到回收站）
    ipcMain.handle('removeFile', async (event, filePath: string) => {
        try {
            if (fs.existsSync(filePath)) {
                // 无论文件还是文件夹，都使用shell.trashItem移动到回收站
                await shell.trashItem(filePath);
                return true;
            }
            return false;
        } catch (error) {
            console.error('删除失败:', error);
            throw error;
        }
    });

    // 移动文件
    ipcMain.handle('moveFile', async (event, fromPath: string, toPath: string) => {
        try {
            // 确保目标目录存在
            const toDirPath = path.dirname(toPath);
            if (!fs.existsSync(toDirPath)) {
                fs.mkdirSync(toDirPath, { recursive: true });
            }
            fs.renameSync(fromPath, toPath);
            return true;
        } catch (error) {
            console.error('移动文件失败:', error);
            throw error;
        }
    });

    // 重命名文件
    ipcMain.handle('renameFile', async (event, filePath: string, newName: string) => {
        try {
            // 提取目录路径
            const dirPath = path.dirname(filePath);
            // 构建新的文件路径
            const newPath = path.join(dirPath, newName);
            
            // 检查新路径是否与原路径相同
            if (newPath === filePath) {
                return { success: true, newPath: filePath };
            }
            
            // 检查新文件名是否为空
            if (!newName.trim()) {
                return { success: false, error: '文件名不能为空' };
            }
            
            // 检查新文件是否已存在
            if (fs.existsSync(newPath)) {
                return { success: false, error: '文件名已存在' };
            }
            
            // 重命名文件
            fs.renameSync(filePath, newPath);
            return { success: true, newPath };
        } catch (error) {
            console.error('重命名文件失败:', error);
            return { success: false, error: error instanceof Error ? error.message : '重命名文件失败' };
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
        const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
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
            // 安全设置：阻止外部链接加载
            contextIsolation: true,
            allowRunningInsecureContent: false,
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

    // 安全设置：阻止外部链接加载
    newWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        
        // 只允许加载本地文件或开发服务器
        if (parsedUrl.protocol !== 'file:' && 
            parsedUrl.host !== 'localhost' && 
            parsedUrl.host !== '127.0.0.1' &&
            !navigationUrl.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL || '')) {
            event.preventDefault();
            console.warn('阻止外部链接导航:', navigationUrl);
        }
    });

    // 阻止新窗口创建（外部链接）
    newWindow.webContents.setWindowOpenHandler(({ url }) => {
        // 只允许打开本地文件或开发服务器
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'file:' && 
            parsedUrl.host !== 'localhost' && 
            parsedUrl.host !== '127.0.0.1' &&
            !url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL || '')) {
            console.warn('阻止新窗口打开外部链接:', url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

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

    // 应用初始化完成后，调用线程池执行过期缓存清理
    setTimeout(async () => {
        try {
            console.log('应用初始化完成，开始检查并清理过期缓存...');
            if (pool) {
                const result = await pool.exec('checkAndCleanExpiredCache', []);
                console.log('自动清理缓存结果:');
                console.log(result);
            } else {
                console.log('线程池未初始化，跳过自动清理缓存');
            }
        } catch (error) {
            console.error('自动清理缓存失败:', error);
        }
    }, 2000); // 延迟2秒执行，确保线程池完全初始化

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