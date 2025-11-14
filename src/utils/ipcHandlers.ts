import {ipcMain, dialog} from 'electron';
import {getFileTree, getFileInfo} from './fileUtils';
import {loadConfig, saveConfig} from './configManager';
import config from "../../forge.config";
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

    // 处理获取文件树请求
    ipcMain.handle('getFileTree', async (event, dirPath: string) => {
        try {
            return getFileTree(dirPath);
        } catch (error) {
            console.error('获取文件树失败:', error);
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
}