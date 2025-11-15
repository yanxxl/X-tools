// 文件树节点类型
export interface FileNode {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

// 导出工具窗口相关类型
export * from './toolWindow';