import { FileNode } from '../types';

/**
 * 从文件树中提取所有文件和文件夹的路径列表
 * @param fileTree 文件树根节点
 * @returns 路径列表，包含所有文件和文件夹的路径
 */
export function extractPathsFromTree(fileTree: FileNode | undefined): string[] {
    const paths: string[] = [];
    
    if (!fileTree) {
        return paths;
    }
    
    /**
     * 递归遍历文件树
     * @param node 当前节点
     */
    function traverse(node: FileNode) {
        // 添加当前节点的路径
        paths.push(node.path);
        
        // 如果是目录，递归遍历所有子节点
        if (node.isDirectory && node.children && node.children.length > 0) {
            for (const child of node.children) {
                traverse(child);
            }
        }
    }
    
    // 从根节点开始遍历
    traverse(fileTree);
    
    return paths;
}
