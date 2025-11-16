// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import {contextBridge, ipcRenderer} from 'electron';
import {FileNode} from './types/index';

// 暴露文件系统相关功能给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
     // 加载配置
    loadConfig: () => ipcRenderer.invoke('loadConfig'),
    // 保存配置
    saveConfig: (config: any) => ipcRenderer.invoke('saveConfig', config),
    // 打开文件夹选择对话框
    selectDirectory: () => ipcRenderer.invoke('selectDirectory'),
    // 获取文件树结构（懒加载模式）
    getFileTree: (path: string) => ipcRenderer.invoke('getFileTree', path) as Promise<FileNode>,
    // 懒加载获取目录子节点
    getDirectoryChildren: (dirPath: string) => ipcRenderer.invoke('getDirectoryChildren', dirPath) as Promise<FileNode[]>,
     // 获取文件/目录基本信息
    getFileInfo: (filePath: string) => ipcRenderer.invoke('getFileInfo', filePath),
    // 控制红绿灯的显示/隐藏
    setWindowButtonVisibility: (visible: boolean) => ipcRenderer.invoke('setWindowButtonVisibility', visible),
});

// 导入API类型定义
import './types/api';