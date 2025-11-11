// 文件树节点类型
export interface FileNode {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}