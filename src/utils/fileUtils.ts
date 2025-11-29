import fs from 'node:fs';
import path from 'node:path';
import {FileNode} from '../types';
import chardet from 'chardet';
import iconv from 'iconv-lite';
import {isTextFile} from './fileType';

// =======================================
// 类型定义
// =======================================

/**
 * 搜索匹配结果的类型定义
 */
export interface SearchMatch {
    line: number;       // 匹配行号（从1开始）
    content: string;    // 匹配行的内容（可能被截断）
}

/**
 * 搜索结果类型定义
 * @param filePath 文件路径
 * @param fileName 文件名
 * @param matches 匹配结果数组
 */
export interface SearchResult {
    filePath: string;
    fileName: string;
    matches: SearchMatch[];
}

/**
 * 搜索进度回调类型定义
 * @param onFileProcessed 单个文件处理完成回调
 * @param onProgress 进度更新回调
 */
export interface SearchProgressCallback {
    onFileProcessed: (result: SearchResult | null) => void;
    onProgress: (totalFiles: number, currentFile: number, totalLines: number) => void;
}

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

// =======================================
// 文件搜索相关功能
// =======================================

/**
 * 逐步搜索文件内容
 * @param dirPath 搜索目录
 * @param query 搜索关键词
 * @param callbacks 进度回调
 */
export async function searchFilesContentProgressively(
    dirPath: string,
    query: string,
    callbacks: SearchProgressCallback
): Promise<void> {
    // 1. 收集所有文本文件
    const allFiles = await collectTextFiles(dirPath);
    const totalFiles = allFiles.length;
    let currentFileIndex = 0;
    let totalLinesSearched = 0;

    // 2. 逐个文件搜索
    for (const filePath of allFiles) {
        currentFileIndex++;
        try {
            // 3. 搜索单个文件
            const searchResult = await searchSingleFile(filePath, query);

            if (searchResult) {
                totalLinesSearched += searchResult.totalLines;

                // 4. 报告进度
                callbacks.onProgress(totalFiles, currentFileIndex, totalLinesSearched);

                // 5. 返回匹配结果
                if (searchResult.matches.length > 0) {
                    callbacks.onFileProcessed({
                        filePath,
                        fileName: path.basename(filePath),
                        matches: searchResult.matches
                    });
                }
            } else {
                // 即使文件搜索失败，也要报告进度
                callbacks.onProgress(totalFiles, currentFileIndex, totalLinesSearched);
            }
        } catch (error) {
            // 忽略无法访问的文件
            console.error(`无法读取文件: ${filePath}`, error);
            // 报告进度
            callbacks.onProgress(totalFiles, currentFileIndex, totalLinesSearched);
        }
    }

    // 6. 搜索完成，发送null表示结束
    callbacks.onFileProcessed(null);
}

/**
 * 递归收集指定目录下的所有文本文件
 * @param dirPath 目录路径
 * @returns 文本文件路径数组
 */
async function collectTextFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.promises.readdir(dirPath, {withFileTypes: true});

    for (const entry of entries) {
        // 跳过隐藏文件和目录
        if (entry.name.startsWith('.')) {
            continue;
        }

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            // 递归收集子目录中的文件
            const subFiles = await collectTextFiles(fullPath);
            files.push(...subFiles);
        } else if (isTextFile(entry.name)) {
            // 只收集文本文件
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * 搜索单个文件的内容
 * @param filePath 文件路径
 * @param query 搜索关键词
 * @returns 搜索结果，包含匹配行和总行数，搜索失败返回null
 */
async function searchSingleFile(filePath: string, query: string): Promise<{ matches: SearchMatch[], totalLines: number } | null> {
    try {
        // 1. 读取文件内容
        const content = await readFileWithEncoding(filePath);
        if (!content) {
            return null;
        }

        // 2. 搜索关键词
        const lines = content.split('\n');
        const matches: SearchMatch[] = [];
        const lowercaseQuery = query.toLowerCase();

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            if (line.toLowerCase().includes(lowercaseQuery)) {
                // 截短匹配行的内容，突出显示关键词
                const truncatedContent = truncateText(line.trim(), 100, query);
                matches.push({
                    line: lineIndex + 1, // 行号从1开始
                    content: truncatedContent
                });
            }
        }

        return {
            matches,
            totalLines: lines.length
        };
    } catch (error) {
        console.error(`搜索文件失败: ${filePath}`, error);
        return null;
    }
}

/**
 * 读取文件内容，自动检测编码
 * @param filePath 文件路径
 * @returns 文件内容，解码失败返回null
 */
async function readFileWithEncoding(filePath: string): Promise<string | null> {
    try {
        const buffer = await fs.promises.readFile(filePath);
        const detectedEncoding = chardet.detect(buffer);

        if (detectedEncoding && iconv.encodingExists(detectedEncoding)) {
            return iconv.decode(buffer, detectedEncoding);
        } else {
            // 尝试直接使用utf-8
            return buffer.toString('utf-8');
        }
    } catch (error) {
        // 忽略解码失败的文件
        return null;
    }
}

/**
 * 截短文本，确保查询词可见
 * @param text 原始文本
 * @param maxLength 最大长度
 * @param query 查询词
 * @returns 截短后的文本
 */
function truncateText(text: string, maxLength: number, query: string): string {
    if (text.length <= maxLength) {
        return text;
    }

    // 查找查询词在文本中的位置
    const queryIndex = text.toLowerCase().indexOf(query.toLowerCase());

    if (queryIndex === -1) {
        // 如果没有找到查询词，直接截短
        return text.substring(0, maxLength - 3) + '...';
    }

    // 确保查询词在截短后的文本中可见
    const queryStart = queryIndex;
    const queryEnd = queryIndex + query.length;

    // 计算左右两侧应该保留的字符数
    const totalAvailable = maxLength - query.length - 3; // 3个字符用于省略号
    const leftAvailable = Math.floor(totalAvailable / 2);
    const rightAvailable = totalAvailable - leftAvailable;

    // 计算实际截取范围
    let start = Math.max(0, queryStart - leftAvailable);
    let end = Math.min(text.length, queryEnd + rightAvailable);

    // 调整以确保不超过总长度
    if (end - start > maxLength - 3) {
        if (start > 0) {
            start = Math.max(0, end - maxLength + 3);
        } else {
            end = Math.min(text.length, start + maxLength - 3);
        }
    }

    // 添加省略号
    let result = text.substring(start, end);
    if (start > 0) {
        result = '...' + result;
    }
    if (end < text.length) {
        result = result + '...';
    }

    return result;
}
