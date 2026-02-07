// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';
import { FileNode, OfficeJsonData } from './types/index';
import { Config } from './utils/config';
import { OfficeParserConfig } from './office/types';

/**
 * 暴露给渲染进程的Electron API接口
 */
interface ElectronAPI {
    // === 配置管理 ===
    loadConfig: () => Promise<Config>;
    saveConfig: (config: Config) => Promise<void>;
    getCurrentWindowFolder: () => Promise<string | null | undefined>;
    setCurrentWindowFolder: (folderPath: string) => Promise<boolean>;

    // === 文件系统操作 ===
    selectDirectory: () => Promise<string | null>;
    openFileDialog: (options?: any) => Promise<string[]>;
    getFileTree: (path: string) => Promise<FileNode>;
    getDirectoryChildren: (dirPath: string) => Promise<FileNode[]>;
    getFileInfo: (filePath: string) => Promise<any>;
    fileExists: (filePath: string) => Promise<boolean>;

    // === 窗口控制 ===
    setWindowButtonVisibility: (visible: boolean) => Promise<void>;
    minimizeWindow: () => Promise<void>;
    toggleMaximizeWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
    createNewWindow: (folderPath?: string) => Promise<{ success: boolean; error?: string }>;
    openDevTools: () => Promise<{ success: boolean; error?: string }>;

    // === 文件操作 ===
    openFile: (filePath: string) => Promise<void>;
    showItemInFolder: (filePath: string) => Promise<void>;
    readFile: (filePath: string) => Promise<string>;
    readFileBinary: (filePath: string) => Promise<Buffer>;
    readFileLines: (filePath: string) => Promise<string[]>; // 这个搜索预览时用
    writeFile: (filePath: string, content: string) => Promise<boolean>;
    openExternal: (url: string) => Promise<void>;
    addFile: (directoryPath: string) => Promise<{ success: boolean; filePath?: string }>;
    addFolder: (directoryPath: string) => Promise<{ success: boolean; folderPath?: string }>;
    removeFile: (filePath: string) => Promise<boolean>;
    moveFile: (fromPath: string, toPath: string) => Promise<boolean>;
    renameFile: (filePath: string, newName: string) => Promise<{ success: boolean; newPath?: string; error?: string }>;

    // === 应用信息 ===
    getAppVersion: () => Promise<string>;
    getAppName: () => Promise<string>;
    getAppDescription: () => Promise<string>;
    getAppPath: () => Promise<string>;
    getIsMac: () => Promise<boolean>;
    getPlatform: () => Promise<string>;

    // === Office文档解析 ===
    parseOffice: (filePath: string, config?: OfficeParserConfig) => Promise<OfficeJsonData>;
    parseOfficeText: (filePath: string, config?: OfficeParserConfig, delimiter?: string) => Promise<string>;
    
    // === 线程池操作 ===
    threadPoolExecute: (functionName: string, args?: any[]) => Promise<{ success: boolean; result?: any; error?: string }>;
}

// 扩展Window接口，使electronAPI全局可用
declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}

// === API实现 ===
const electronAPI: ElectronAPI = {
    // 配置管理
    loadConfig: () => ipcRenderer.invoke('loadConfig') as Promise<Config>,
    saveConfig: (config: Config) => ipcRenderer.invoke('saveConfig', config) as Promise<void>,
    getCurrentWindowFolder: () => ipcRenderer.invoke('getCurrentWindowFolder') as Promise<string | null | undefined>,
    setCurrentWindowFolder: (folderPath: string) => ipcRenderer.invoke('setCurrentWindowFolder', folderPath) as Promise<boolean>,

    // 文件系统操作
    selectDirectory: () => ipcRenderer.invoke('selectDirectory') as Promise<string | null>,
    openFileDialog: (options?: any) => ipcRenderer.invoke('openFileDialog', options) as Promise<string[]>,
    getFileTree: (path: string) => ipcRenderer.invoke('getFileTree', path) as Promise<FileNode>,
    getDirectoryChildren: (dirPath: string) => ipcRenderer.invoke('getDirectoryChildren', dirPath) as Promise<FileNode[]>,
    getFileInfo: (filePath: string) => ipcRenderer.invoke('getFileInfo', filePath),
    fileExists: (filePath: string) => ipcRenderer.invoke('fileExists', filePath) as Promise<boolean>,

    // 窗口控制
    setWindowButtonVisibility: (visible: boolean) => ipcRenderer.invoke('setWindowButtonVisibility', visible) as Promise<void>,
    minimizeWindow: () => ipcRenderer.invoke('minimizeWindow') as Promise<void>,
    toggleMaximizeWindow: () => ipcRenderer.invoke('toggleMaximizeWindow') as Promise<void>,
    closeWindow: () => ipcRenderer.invoke('closeWindow') as Promise<void>,
    createNewWindow: (folderPath?: string) => ipcRenderer.invoke('createNewWindow', folderPath) as Promise<{ success: boolean; error?: string }>,
    openDevTools: () => ipcRenderer.invoke('openDevTools') as Promise<{ success: boolean; error?: string }>,

    // 文件操作
    openFile: (filePath: string) => ipcRenderer.invoke('openFile', filePath) as Promise<void>,
    showItemInFolder: (filePath: string) => ipcRenderer.invoke('showItemInFolder', filePath) as Promise<void>,
    readFile: (filePath: string) => ipcRenderer.invoke('readFile', filePath) as Promise<string>,
    readFileBinary: (filePath: string) => ipcRenderer.invoke('readFileBinary', filePath) as Promise<Buffer>,
    readFileLines: (filePath: string) => ipcRenderer.invoke('readFileLines', filePath) as Promise<string[]>,
    writeFile: (filePath: string, content: string) => ipcRenderer.invoke('writeFile', filePath, content) as Promise<boolean>,
    openExternal: (url: string) => ipcRenderer.invoke('openExternal', url) as Promise<void>,
    addFile: (directoryPath: string) => ipcRenderer.invoke('addFile', directoryPath) as Promise<{ success: boolean; filePath?: string }>,
    addFolder: (directoryPath: string) => ipcRenderer.invoke('addFolder', directoryPath) as Promise<{ success: boolean; folderPath?: string }>,
    removeFile: (filePath: string) => ipcRenderer.invoke('removeFile', filePath) as Promise<boolean>,
    moveFile: (fromPath: string, toPath: string) => ipcRenderer.invoke('moveFile', fromPath, toPath) as Promise<boolean>,
    renameFile: (filePath: string, newName: string) => ipcRenderer.invoke('renameFile', filePath, newName) as Promise<{ success: boolean; newPath?: string; error?: string }>,

    // 应用信息
    getAppVersion: () => ipcRenderer.invoke('getAppVersion') as Promise<string>,
    getAppName: () => ipcRenderer.invoke('getAppName') as Promise<string>,
    getAppDescription: () => ipcRenderer.invoke('getAppDescription') as Promise<string>,
    getAppPath: () => ipcRenderer.invoke('getAppPath') as Promise<string>,
    getIsMac: () => ipcRenderer.invoke('getIsMac') as Promise<boolean>,
    getPlatform: () => ipcRenderer.invoke('getPlatform') as Promise<string>,

    // Office文档解析
    parseOffice: (filePath: string, config?: OfficeParserConfig) => ipcRenderer.invoke('parseOffice', filePath, config) as Promise<OfficeJsonData>,
    parseOfficeText: (filePath: string, config?: OfficeParserConfig, delimiter?: string) => ipcRenderer.invoke('parseOfficeText', filePath, config, delimiter) as Promise<string>,
    
    // 线程池操作
    threadPoolExecute: (functionName: string, args?: any[]) => ipcRenderer.invoke('threadPoolExecute', functionName, args || []) as Promise<{ success: boolean; result?: any; error?: string }>,
};

// 暴露API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI);