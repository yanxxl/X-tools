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
    /** 搜索文件内容 */
    searchFilesContent: (dirPath: string, query: string, searchId: string, searchMode?: 'content' | 'filename') => Promise<any>;
    /** 取消搜索 */
    cancelSearch: (searchId: string) => Promise<boolean>;
    /** 监听搜索进度事件 */
    onSearchProgress: (callback: (progress: { totalFiles: number; currentFile: number; totalLines: number }) => void) => void;
    /** 取消监听搜索进度事件 */
    offSearchProgress: (callback: (progress: { totalFiles: number; currentFile: number; totalLines: number }) => void) => void;
    /** 监听单个文件搜索结果事件 */
    onSearchFileResult: (callback: (result: any) => void) => void;
    /** 取消监听单个文件搜索结果事件 */
    offSearchFileResult: (callback: (result: any) => void) => void;
    
    // === 窗口控制 ===
    /** 控制红绿灯（窗口控制按钮）的显示/隐藏 */
    setWindowButtonVisibility: (visible: boolean) => Promise<void>;
    /** 最小化窗口 */
    minimizeWindow: () => Promise<void>;
    /** 切换窗口最大化/还原状态 */
    toggleMaximizeWindow: () => Promise<void>;
    /** 关闭窗口 */
    closeWindow: () => Promise<void>;
    /** 创建新窗口 */
    createNewWindow: (folderPath?: string) => Promise<{success: boolean; windowId?: string; error?: string}>;
    /** 监听初始文件夹设置 */
    onSetInitialFolder: (callback: (folderPath: string) => void) => void;
    /** 取消监听初始文件夹设置 */
    offSetInitialFolder: (callback: (folderPath: string) => void) => void;
    
    // === 文件操作 ===
    /** 使用系统默认应用打开文件 */
    openFile: (filePath: string) => Promise<void>;
    /** 显示文件所在文件夹 */
    showItemInFolder: (filePath: string) => Promise<void>;
    /** 读取文件内容（用于文本文件） */
    readFile: (filePath: string) => Promise<string>;
    /** 写入文件内容 */
    writeFile: (filePath: string, content: string) => Promise<boolean>;
    /** 打开外部链接 */
    openExternal: (url: string) => Promise<void>;
    /** 获取应用版本号 */
    getAppVersion: () => Promise<string>;
    /** 获取应用名称 */
    getAppName: () => Promise<string>;
    /** 获取应用描述 */
    getAppDescription: () => Promise<string>;
    /** 获取当前平台是否为Mac */
    getIsMac: () => Promise<boolean>;
    /** 获取应用资源目录路径 */
    getAppPath: () => Promise<string>;
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
    searchFilesContent: (dirPath: string, query: string, searchId: string, searchMode?: 'content' | 'filename') => ipcRenderer.invoke('searchFilesContent', dirPath, query, searchId, searchMode) as Promise<any>,
    cancelSearch: (searchId: string) => ipcRenderer.invoke('cancelSearch', searchId) as Promise<boolean>,
    onSearchProgress: (callback) => ipcRenderer.on('searchProgress', (event, progress) => callback(progress)),
    offSearchProgress: (callback) => ipcRenderer.off('searchProgress', (event, progress) => callback(progress)),
    onSearchFileResult: (callback) => ipcRenderer.on('searchFileResult', (event, result) => callback(result)),
    offSearchFileResult: (callback) => ipcRenderer.off('searchFileResult', (event, result) => callback(result)),
    
    // 窗口控制
    setWindowButtonVisibility: (visible: boolean) => ipcRenderer.invoke('setWindowButtonVisibility', visible) as Promise<void>,
    minimizeWindow: () => ipcRenderer.invoke('minimizeWindow') as Promise<void>,
    toggleMaximizeWindow: () => ipcRenderer.invoke('toggleMaximizeWindow') as Promise<void>,
    closeWindow: () => ipcRenderer.invoke('closeWindow') as Promise<void>,
    createNewWindow: (folderPath?: string) => ipcRenderer.invoke('createNewWindow', folderPath) as Promise<{success: boolean; windowId?: string; error?: string}>,
    onSetInitialFolder: (callback) => ipcRenderer.on('setInitialFolder', (event, folderPath) => callback(folderPath)),
    offSetInitialFolder: (callback) => ipcRenderer.off('setInitialFolder', (event, folderPath) => callback(folderPath)),
    
    // 文件操作
    openFile: (filePath: string) => ipcRenderer.invoke('openFile', filePath) as Promise<void>,
    showItemInFolder: (filePath: string) => ipcRenderer.invoke('showItemInFolder', filePath) as Promise<void>,
    readFile: (filePath: string) => ipcRenderer.invoke('readFile', filePath) as Promise<string>,
    writeFile: (filePath: string, content: string) => ipcRenderer.invoke('writeFile', filePath, content) as Promise<boolean>,
    openExternal: (url: string) => ipcRenderer.invoke('openExternal', url) as Promise<void>,
    // 应用信息
    getAppVersion: () => ipcRenderer.invoke('getAppVersion') as Promise<string>,
    getAppPath: () => ipcRenderer.invoke('getAppPath') as Promise<string>,
    getAppName: () => ipcRenderer.invoke('getAppName') as Promise<string>,
    getAppDescription: () => ipcRenderer.invoke('getAppDescription') as Promise<string>,
    // 平台信息
    getIsMac: () => ipcRenderer.invoke('getIsMac') as Promise<boolean>,
};

// 暴露API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI);