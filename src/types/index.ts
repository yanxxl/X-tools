// 文件树节点类型
export interface FileNode {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

// 最近文件夹类型
export interface RecentFolder {
    path: string;
    name: string;
    timestamp: number;
}

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