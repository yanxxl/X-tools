import { FileNode } from '../types';

/**
 * 从文件树中提取所有文件并构建路径到修改时间的映射
 * @param fileTree 文件树根节点
 * @returns 映射对象，键为文件路径，值为最后修改时间（毫秒）
 */
export function extractFilesFromTree(fileTree: FileNode | undefined): Map<string, number> {
    const fileMap = new Map<string, number>();
    
    if (!fileTree) {
        return fileMap;
    }
    
    /**
     * 递归遍历文件树
     * @param node 当前节点
     */
    function traverse(node: FileNode) {
        // 如果是文件，添加到映射中
        if (!node.isDirectory) {
            fileMap.set(node.path, node.mtimeMs);
            return;
        }
        
        // 如果是目录，递归遍历所有子节点
        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                traverse(child);
            }
        }
    }
    
    // 从根节点开始遍历
    traverse(fileTree);
    
    return fileMap;
}

/**
 * 从文件树中提取所有文件路径
 * @param fileTree 文件树根节点
 * @returns 文件路径数组
 */
export function extractFilePathsFromTree(fileTree: FileNode | undefined): string[] {
    const fileMap = extractFilesFromTree(fileTree);
    return Array.from(fileMap.keys());
}

/**
 * 从文件树中提取所有文件信息
 * @param fileTree 文件树根节点
 * @returns 文件信息数组
 */
export function extractFileInfosFromTree(fileTree: FileNode | undefined): Array<{ path: string; mtimeMs: number }> {
    const fileMap = extractFilesFromTree(fileTree);
    return Array.from(fileMap.entries()).map(([path, mtimeMs]) => ({
        path,
        mtimeMs
    }));
}