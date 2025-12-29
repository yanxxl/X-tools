import fs from 'node:fs';
import path from 'node:path';
import {FileNode} from '../types';

// =======================================
// 文件树相关功能
// =======================================

/**
 * 获取文件树结构（懒加载模式 - 只加载第一层）
 * @param dirPath 目录路径
 * @param deep 是否深度递归加载（默认false，只加载第一层）
 * @returns 文件树节点
 */
export function getFileTree(dirPath: string, deep = false): FileNode {
  const stats = fs.statSync(dirPath);
  const name = path.basename(dirPath);
  const node: FileNode = {
    id: dirPath,
    name,
    path: dirPath,
    isDirectory: stats.isDirectory(),
  };

  if (stats.isDirectory()) {
    try {
      const files = fs.readdirSync(dirPath);
      node.children = files
        .filter(file => !file.startsWith('.')) // 过滤掉以.开头的隐藏文件和目录
        .map(file => {
          const filePath = path.join(dirPath, file);
          try {
            const fileStats = fs.statSync(filePath);
            const fileNode: FileNode = {
              id: filePath,
              name: file,
              path: filePath,
              isDirectory: fileStats.isDirectory(),
            };

            // 如果是目录且不是深度加载，则不加载子节点，只标记为有子节点
            if (fileStats.isDirectory() && !deep) {
              // 检查是否有子文件/目录（不包括隐藏文件）
              try {
                const subFiles = fs.readdirSync(filePath);
                const hasChildren = subFiles.some(subFile => !subFile.startsWith('.'));
                if (hasChildren) {
                  // 添加一个标记，表示这个目录有子节点但尚未加载
                  (fileNode as any).hasUnloadedChildren = true;
                }
              } catch {
                // 如果无法读取目录，忽略
              }
            } else if (fileStats.isDirectory() && deep) {
              // 深度模式下递归加载
              return getFileTree(filePath, true);
            }

            return fileNode;
          } catch (error) {
            // 忽略无法访问的文件或目录
            return null;
          }
        })
        .filter((item): item is FileNode => item !== null)
        .sort((a, b) => {
          // 目录排在文件前面
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          // 然后按名称排序
          return a.name.localeCompare(b.name);
        });
    } catch (error) {
      // 如果无法读取目录，设置children为空数组
      node.children = [];
    }
  }

  return node;
}

/**
 * 懒加载指定目录的直接子节点
 * @param dirPath 目录路径
 * @returns 直接子节点列表
 */
export function getDirectoryChildren(dirPath: string): FileNode[] {
  const stats = fs.statSync(dirPath);
  
  if (!stats.isDirectory()) {
    return [];
  }

  try {
    const files = fs.readdirSync(dirPath);
    return files
      .filter(file => !file.startsWith('.')) // 过滤掉以.开头的隐藏文件和目录
      .map(file => {
        const filePath = path.join(dirPath, file);
        try {
          const fileStats = fs.statSync(filePath);
          const fileNode: FileNode = {
            id: filePath,
            name: file,
            path: filePath,
            isDirectory: fileStats.isDirectory(),
          };

          // 如果是目录，检查是否有子文件/目录
          if (fileStats.isDirectory()) {
            try {
              const subFiles = fs.readdirSync(filePath);
              const hasChildren = subFiles.some(subFile => !subFile.startsWith('.'));
              if (hasChildren) {
                (fileNode as any).hasUnloadedChildren = true;
              }
            } catch {
              // 如果无法读取目录，忽略
            }
          }

          return fileNode;
        } catch (error) {
          // 忽略无法访问的文件或目录
          return null;
        }
      })
      .filter((item): item is FileNode => item !== null)
      .sort((a, b) => {
        // 目录排在文件前面
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        // 然后按名称排序
        return a.name.localeCompare(b.name);
      });
  } catch (error) {
    console.error('读取目录失败:', error);
    return [];
  }
}

// =======================================
// 文件信息相关功能
// =======================================

/**
 * 获取文件/目录的基本信息
 * @param targetPath 文件或目录路径
 * @returns 文件或目录的基本信息
 */
export function getFileInfo(targetPath: string) {
  const stats = fs.statSync(targetPath);
  const name = path.basename(targetPath);
  const isDirectory = stats.isDirectory();
  const ext = isDirectory ? '' : (path.extname(name).replace('.', '').toLowerCase());
  let childrenCount = 0;
  if (isDirectory) {
    try {
      childrenCount = fs.readdirSync(targetPath).filter(n => !n.startsWith('.')).length;
    } catch {
      childrenCount = 0;
    }
  }
  return {
    path: targetPath,
    name,
    isDirectory,
    size: stats.size,
    mtimeMs: stats.mtimeMs,
    ctimeMs: stats.ctimeMs,
    atimeMs: stats.atimeMs,
    ext,
    childrenCount
  };
}