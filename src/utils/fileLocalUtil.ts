import fs from 'node:fs';
import path from 'node:path';
import chardet from 'chardet';
import iconv from 'iconv-lite';
import { FileNode } from '../types';

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

            // 深度模式下递归加载
            if (fileStats.isDirectory() && deep) {
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
// 文件内容读取相关功能
// =======================================

/**
 * 读取文件内容，自动检测编码
 * @param filePath 文件路径
 * @returns 文件内容（字符串）或null（如果读取失败）
 */
export async function readFileText(filePath: string): Promise<string | null> {
  try {
    // 先以buffer形式读取文件
    const buffer = await fs.promises.readFile(filePath);
    // 检测文件编码
    const detectedEncoding = chardet.detect(buffer);
    console.log(`检测到文件编码: ${detectedEncoding || 'unknown'}，路径: ${filePath}`);

    // 如果检测到编码，则使用iconv-lite转换为utf-8
    // 如果无法检测到编码或编码不支持，尝试使用utf-8
    let content: string;
    if (detectedEncoding && iconv.encodingExists(detectedEncoding)) {
      content = iconv.decode(buffer, detectedEncoding);
    } else {
      // 尝试直接使用utf-8
      try {
        content = buffer.toString('utf-8');
      } catch (e) {
        // 如果utf-8解码失败，尝试使用gbk作为备选
        content = iconv.decode(buffer, 'gbk');
      }
    }

    return content;
  } catch (error) {
    // 忽略解码失败的文件
    console.error('读取文件失败:', error);
    return null;
  }
}

/**
 * 写入文件内容，自动检测现有文件编码
 * @param filePath 文件路径
 * @param content 文件内容
 * @returns true（如果写入成功）
 */
export async function writeFileText(filePath: string, content: string): Promise<boolean> {
  try {
    // 首先检测文件是否存在并获取其编码
    let fileEncoding = 'utf-8'; // 默认使用utf-8

    try {
      // 检查文件是否存在
      await fs.promises.access(filePath);

      // 文件存在，读取文件以检测编码
      const buffer = await fs.promises.readFile(filePath);
      const detectedEncoding = chardet.detect(buffer);

      if (detectedEncoding && iconv.encodingExists(detectedEncoding)) {
        fileEncoding = detectedEncoding;
        console.log(`检测到文件编码: ${fileEncoding}，路径: ${filePath}`);
      }
    } catch (error) {
      // 文件不存在或读取失败，使用默认编码
      console.log(`文件不存在或无法读取，将使用默认编码: ${fileEncoding}，路径: ${filePath}`);
    }

    // 根据文件编码写入内容
    if (fileEncoding === 'utf-8') {
      // UTF-8编码直接写入
      await fs.promises.writeFile(filePath, content, 'utf-8');
    } else {
      // 其他编码需要使用iconv-lite进行转换后写入
      const encodedContent = iconv.encode(content, fileEncoding);
      await fs.promises.writeFile(filePath, encodedContent);
    }

    return true;
  } catch (error) {
    // 处理写入失败的情况
    console.error('写入文件失败:', error);
    throw error;
  }
}