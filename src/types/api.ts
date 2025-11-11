import { FileNode } from './index';

// 最近文件夹类型
export interface RecentFolder {
  path: string;
  name: string;
  timestamp: number;
}

// 预览改为使用 local-file:// 直接访问，不再返回文件内容数据

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
  // 获取文件树结构
  getFileTree: (path: string) => Promise<FileNode>;
  // 获取最近使用的文件夹列表
  getRecentFolders: () => Promise<RecentFolder[]>;
  // 获取上次打开的文件夹
  getLastOpenedFolder: () => Promise<RecentFolder | undefined>;
  // 更新文件夹的最后打开时间戳
  updateFolderTimestamp: (folderPath: string) => Promise<void>;
  // 从最近文件夹列表中删除指定文件夹
  removeRecentFolder: (folderPath: string) => Promise<void>;
  // 获取文件/目录基本信息
  getFileInfo: (filePath: string) => Promise<FileInfo>;
}

// 扩展Window接口
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}