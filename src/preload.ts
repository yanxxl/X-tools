// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import {contextBridge, ipcRenderer} from 'electron';
import {FileNode} from './types/index';
import {Config} from './utils/config';

/**
 * 暴露给渲染进程的Electron API接口
 * 集中管理所有前后端通信API
 */
interface ElectronAPI {
    // === 配置管理 ===
    /** 加载应用配置 */
    loadConfig: () => Promise<Config>;
    /** 保存应用配置 */
    saveConfig: (config: Config) => Promise<void>;
    
    // === 文件系统操作 ===
    /** 打开文件夹选择对话框 */
    selectDirectory: () => Promise<string | null>;
    /** 获取文件树结构（懒加载模式） */
    getFileTree: (path: string) => Promise<FileNode>;
    /** 懒加载获取目录子节点 */
    getDirectoryChildren: (dirPath: string) => Promise<FileNode[]>;
    /** 获取文件/目录基本信息 */
    getFileInfo: (filePath: string) => Promise<any>;
    
    // === 窗口控制 ===
    /** 控制红绿灯（窗口控制按钮）的显示/隐藏 */
    setWindowButtonVisibility: (visible: boolean) => Promise<void>;
    
    // === 文件操作 ===
    /** 使用系统默认应用打开文件 */
    openFile: (filePath: string) => Promise<void>;
    /** 显示文件所在文件夹 */
    showItemInFolder: (filePath: string) => Promise<void>;
}

// 扩展Window接口，使electronAPI全局可用
declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}

// === API实现 ===

// 定义所有暴露给渲染进程的API
const electronAPI: ElectronAPI = {
    // 配置管理
    loadConfig: () => ipcRenderer.invoke('loadConfig') as Promise<Config>,
    saveConfig: (config: Config) => ipcRenderer.invoke('saveConfig', config) as Promise<void>,
    
    // 文件系统操作
    selectDirectory: () => ipcRenderer.invoke('selectDirectory') as Promise<string | null>,
    getFileTree: (path: string) => ipcRenderer.invoke('getFileTree', path) as Promise<FileNode>,
    getDirectoryChildren: (dirPath: string) => ipcRenderer.invoke('getDirectoryChildren', dirPath) as Promise<FileNode[]>,
    getFileInfo: (filePath: string) => ipcRenderer.invoke('getFileInfo', filePath),
    
    // 窗口控制
    setWindowButtonVisibility: (visible: boolean) => ipcRenderer.invoke('setWindowButtonVisibility', visible) as Promise<void>,
    
    // 文件操作
    openFile: (filePath: string) => ipcRenderer.invoke('openFile', filePath) as Promise<void>,
    showItemInFolder: (filePath: string) => ipcRenderer.invoke('showItemInFolder', filePath) as Promise<void>,
};

// 暴露API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI);