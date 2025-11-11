// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import {contextBridge, ipcRenderer} from 'electron';
import { FileNode } from './types/index';

// 暴露文件系统相关功能给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 打开文件夹选择对话框
  selectDirectory: () => ipcRenderer.invoke('selectDirectory'),
  // 获取文件树结构
  getFileTree: (path: string) => ipcRenderer.invoke('getFileTree', path) as Promise<FileNode>,
  // 获取最近使用的文件夹列表
  getRecentFolders: () => ipcRenderer.invoke('getRecentFolders'),
  // 获取上次打开的文件夹
  getLastOpenedFolder: () => ipcRenderer.invoke('getLastOpenedFolder'),
  // 更新文件夹的最后打开时间戳
  updateFolderTimestamp: (folderPath: string) => ipcRenderer.invoke('updateFolderTimestamp', folderPath),
  // 从最近文件夹列表中删除指定文件夹
  removeRecentFolder: (folderPath: string) => ipcRenderer.invoke('removeRecentFolder', folderPath),
  // 获取文件/目录基本信息
  getFileInfo: (filePath: string) => ipcRenderer.invoke('getFileInfo', filePath),
});

// 导入API类型定义
import './types/api';
