import {ipcMain, dialog, BrowserWindow} from 'electron';
import {getFileTree, getFileInfo, getDirectoryChildren} from './fileUtils';
import {loadConfig, saveConfig} from './configManager';
import {Config} from "./config";

/**
 * 注册所有IPC处理程序
 */
export function registerIpcHandlers() {
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
                if (visible) {
                    mainWindow.setWindowButtonVisibility(true)
                } else {
                    mainWindow.setWindowButtonVisibility(false)
                }
                console.log(`红绿灯位置已设置：${visible ? '显示' : '隐藏'}`);
            } catch (error) {
                console.error('设置红绿灯位置失败:', error);
                throw error;
            }
        } else {
            console.error('主窗口引用不存在');
            throw new Error('主窗口引用不存在');
        }
    });
}