import { ipcMain, dialog } from 'electron';
import { getFileTree, getFileInfo } from './fileUtils';
import { addRecentFolder, getRecentFolders, getLastOpenedFolder, updateFolderTimestamp, removeRecentFolder } from './configManager';

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
      // 保存到配置文件
      addRecentFolder(folderPath);
      return folderPath;
    }
    return null;
  });

  // 获取最近使用的文件夹列表
  ipcMain.handle('getRecentFolders', async () => {
    return getRecentFolders();
  });

  // 获取上次打开的文件夹
  ipcMain.handle('getLastOpenedFolder', async () => {
    return getLastOpenedFolder();
  });
  
  // 更新文件夹的最后打开时间戳
  ipcMain.handle('updateFolderTimestamp', async (event, folderPath: string) => {
    try {
      updateFolderTimestamp(folderPath);
    } catch (error) {
      console.error('更新文件夹时间戳失败:', error);
      throw error;
    }
  });
  
  // 从最近文件夹列表中删除指定文件夹
  ipcMain.handle('removeRecentFolder', async (event, folderPath: string) => {
    try {
      removeRecentFolder(folderPath);
    } catch (error) {
      console.error('删除最近文件夹失败:', error);
      throw error;
    }
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