import {FileNode} from './index';

import {Config} from "../utils/config";

// 最近文件夹类型
export interface RecentFolder {
    path: string;
    name: string;
    timestamp: number;
}

// 基本文件信息
export interface FileInfo {
    path: string;
    name: string;
    isDirectory: boolean;
    size: number;
    mtimeMs: number;
    ctimeMs: number;
    atimeMs: number;
    ext: string;
    childrenCount?: number;
}

/**
 * 暴露给渲染进程的Electron API接口
 */
export interface ElectronAPI {
    // 打开文件夹选择对话框
    selectDirectory: () => Promise<string | null>;
    // 获取文件树结构（懒加载模式）
    getFileTree: (path: string) => Promise<FileNode>;
    // 懒加载获取目录子节点
    getDirectoryChildren: (dirPath: string) => Promise<FileNode[]>;
    // 加载配置
    loadConfig: () => Promise<Config>;
    // 保存配置
    saveConfig: (config:Config) => Promise<void>;
    // 获取文件/目录基本信息
    getFileInfo: (filePath: string) => Promise<FileInfo>;
    // 控制红绿灯的显示/隐藏
    setWindowButtonVisibility: (visible: boolean) => Promise<void>;
}

// 扩展Window接口
declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}