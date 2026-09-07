// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { FileNode, OfficeJsonData } from './types/index';
import type { MarkdownBlocksResult } from './utils/markdown';
import type { DictionaryData, DictionarySummary, DictionaryEntryData } from './utils/dictionaryParserCore';
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
    selectDirectory: (defaultPath?: string) => Promise<string | null>;
    openFileDialog: (options?: any) => Promise<string[]>;
    getFileTree: (path: string, deep?: boolean, includeHidden?: boolean, includeTextSize?: boolean) => Promise<FileNode>;
    getDirectoryChildren: (dirPath: string, includeHidden?: boolean, includeTextSize?: boolean) => Promise<FileNode[]>;
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
    parseMarkdownBlocks: (markdown: string, filePath: string, lite?: boolean, idPrefix?: string) => Promise<MarkdownBlocksResult & { parseTime?: number }>; // 在线程池中解析 Markdown，返回分块 HTML
    parseDictionary: (filePath: string) => Promise<DictionarySummary & { parseTime?: number }>; // 在线程池中解析词典文件，返回摘要（词条数据由后端持有）
    searchDictionary: (query: string, dictPaths: string[]) => Promise<DictionaryEntryData[]>; // 在后端已加载的词典中检索，仅返回命中条目
    removeDictionary: (filePath: string) => Promise<{ success: boolean }>; // 通知后端释放某个词典的内存数据
    writeFile: (filePath: string, content: string) => Promise<boolean>;
    openExternal: (url: string) => Promise<void>;
    addFile: (directoryPath: string) => Promise<{ success: boolean; filePath?: string }>;
    addFolder: (directoryPath: string) => Promise<{ success: boolean; folderPath?: string }>;
    removeFile: (filePath: string) => Promise<boolean>;
    moveFile: (fromPath: string, toPath: string) => Promise<boolean>;
    renameFile: (filePath: string, newName: string) => Promise<{ success: boolean; newPath?: string; error?: string }>;
    importFile: (sourcePath: string, targetDir: string) => Promise<{ success: boolean; targetPath?: string; error?: string }>;
    getFilePath: (file: File) => string;
    startDrag: (filePaths: string[]) => Promise<void>;
    convertToUtf8: (filePath: string) => Promise<boolean>;

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
    
    // === 系统操作 ===
    openTerminal: (directory?: string, command?: string) => Promise<{ success: boolean; error?: string }>;
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
    selectDirectory: (defaultPath?: string) => ipcRenderer.invoke('selectDirectory', defaultPath) as Promise<string | null>,
    openFileDialog: (options?: any) => ipcRenderer.invoke('openFileDialog', options) as Promise<string[]>,
    getFileTree: (path: string, deep?: boolean, includeHidden?: boolean, includeTextSize?: boolean) => ipcRenderer.invoke('getFileTree', path, deep, includeHidden, includeTextSize) as Promise<FileNode>,
    getDirectoryChildren: (dirPath: string, includeHidden?: boolean, includeTextSize?: boolean) => ipcRenderer.invoke('getDirectoryChildren', dirPath, includeHidden, includeTextSize) as Promise<FileNode[]>,
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
    parseMarkdownBlocks: (markdown: string, filePath: string, lite?: boolean, idPrefix?: string) =>
        ipcRenderer.invoke('parseMarkdownBlocks', markdown, filePath, lite, idPrefix) as Promise<MarkdownBlocksResult & { parseTime?: number }>,
    parseDictionary: (filePath: string) => ipcRenderer.invoke('parseDictionary', filePath) as Promise<DictionarySummary & { parseTime?: number }>,
    searchDictionary: (query: string, dictPaths: string[]) => ipcRenderer.invoke('searchDictionary', query, dictPaths) as Promise<DictionaryEntryData[]>,
    removeDictionary: (filePath: string) => ipcRenderer.invoke('removeDictionary', filePath) as Promise<{ success: boolean }>,
    writeFile: (filePath: string, content: string) => ipcRenderer.invoke('writeFile', filePath, content) as Promise<boolean>,
    openExternal: (url: string) => ipcRenderer.invoke('openExternal', url) as Promise<void>,
    addFile: (directoryPath: string) => ipcRenderer.invoke('addFile', directoryPath) as Promise<{ success: boolean; filePath?: string }>,
    addFolder: (directoryPath: string) => ipcRenderer.invoke('addFolder', directoryPath) as Promise<{ success: boolean; folderPath?: string }>,
    removeFile: (filePath: string) => ipcRenderer.invoke('removeFile', filePath) as Promise<boolean>,
    moveFile: (fromPath: string, toPath: string) => ipcRenderer.invoke('moveFile', fromPath, toPath) as Promise<boolean>,
    renameFile: (filePath: string, newName: string) => ipcRenderer.invoke('renameFile', filePath, newName) as Promise<{ success: boolean; newPath?: string; error?: string }>,
    importFile: (sourcePath: string, targetDir: string) => ipcRenderer.invoke('importFile', sourcePath, targetDir) as Promise<{ success: boolean; targetPath?: string; error?: string }>,
    getFilePath: (file: File) => {
        // 使用 webUtils.getPathForFile 获取 File 对象对应的文件系统路径
        return webUtils.getPathForFile(file) as string;
    },
    startDrag: (filePaths: string[]) => ipcRenderer.invoke('startDrag', filePaths) as Promise<void>,
    convertToUtf8: (filePath: string) => ipcRenderer.invoke('convertToUtf8', filePath) as Promise<boolean>,

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
    
    // 系统操作
    openTerminal: (directory?: string, command?: string) => ipcRenderer.invoke('openTerminal', directory, command) as Promise<{ success: boolean; error?: string }>,
};

// 暴露API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI);