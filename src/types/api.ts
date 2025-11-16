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