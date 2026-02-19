import fs from 'node:fs';
import path from 'node:path';
import chardet from 'chardet';
import iconv from 'iconv-lite';
import { FileNode, FileInfo } from '../types';
import { getExtension, isTextFile, isOfficeParserSupported, isSearchableFile } from './fileCommonUtil';
import { readFileLines } from './fileCacheUtil';
import { parseOfficeDocument, astToText } from './office';

// =======================================
// 文件树相关功能
// =======================================

/**
 * 获取文件树结构（懒加载模式 - 只加载第一层）
 * @param dirPath 目录路径
 * @param deep 是否深度递归加载（默认false，只加载第一层）
 * @param includeHidden 是否包含隐藏文件（默认false，不包含以.开头的文件）
 * @param includeTextSize 是否包含文本长度统计（默认false）
 * @returns 文件树节点
 */
export async function getFileTree(dirPath: string, deep = false, includeHidden = false, includeTextSize = false): Promise<FileNode> {
  const stats = fs.statSync(dirPath);
  const name = path.basename(dirPath);
  const node: FileNode = {
    id: dirPath,
    name,
    path: dirPath,
    isDirectory: stats.isDirectory(),
    mtimeMs: stats.mtimeMs,
    size: stats.isDirectory() ? 0 : stats.size,
  };

  if (stats.isDirectory()) {
    try {
      const files = fs.readdirSync(dirPath);
      const children: FileNode[] = [];

      for (const file of files) {
        if (!includeHidden && file.startsWith('.')) {
          continue;
        }

        const filePath = path.join(dirPath, file);
        try {
          const fileStats = fs.statSync(filePath);
          const fileNode: FileNode = {
            id: filePath,
            name: file,
            path: filePath,
            isDirectory: fileStats.isDirectory(),
            mtimeMs: fileStats.mtimeMs,
            size: fileStats.isDirectory() ? 0 : fileStats.size,
          };

          // 如果是文件且需要计算文本长度，则计算文本长度
          if (!fileStats.isDirectory() && includeTextSize && isTextableFile(filePath)) {
            fileNode.textSize = await calculateTextSize(filePath);
          }

          // 深度模式下递归加载
          if (fileStats.isDirectory() && deep) {
            children.push(await getFileTree(filePath, true, includeHidden, includeTextSize));
          } else {
            children.push(fileNode);
          }
        } catch (error) {
          // 忽略无法访问的文件或目录
          console.warn(`无法访问文件: ${filePath}`, error);
        }
      }

      node.children = children.sort((a, b) => {
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
 * 获取目录的直接子节点（不递归）
 * @param dirPath 目录路径
 * @param includeHidden 是否包含隐藏文件（默认false，不包含以.开头的文件）
 * @param includeTextSize 是否包含文本长度统计（默认false）
 * @returns 直接子节点列表
 */
export async function getDirectoryChildren(dirPath: string, includeHidden = false, includeTextSize = false): Promise<FileNode[]> {
  const stats = fs.statSync(dirPath);

  if (!stats.isDirectory()) {
    return [];
  }

  try {
    const files = fs.readdirSync(dirPath);
    const fileNodes: FileNode[] = [];

    for (const file of files) {
      if (!includeHidden && file.startsWith('.')) {
        continue;
      }

      const filePath = path.join(dirPath, file);
      try {
        const fileStats = fs.statSync(filePath);
        const fileNode: FileNode = {
          id: filePath,
          name: file,
          path: filePath,
          isDirectory: fileStats.isDirectory(),
          mtimeMs: fileStats.mtimeMs,
          size: fileStats.isDirectory() ? 0 : fileStats.size,
        };

        // 如果是文件且需要计算文本长度，则计算文本长度
        if (!fileStats.isDirectory() && includeTextSize && isTextableFile(filePath)) {
          fileNode.textSize = await calculateTextSize(filePath);
        }

        fileNodes.push(fileNode);
      } catch (error) {
        // 忽略无法访问的文件或目录
        console.warn(`无法访问文件: ${filePath}`, error);
      }
    }

    return fileNodes.sort((a, b) => {
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
// 文本长度计算功能
// =======================================

/**
 * 计算文件的文本长度（读取文件行数并计算每行长度之和）
 * @param filePath 文件路径
 * @returns 文本长度（字符数），如果无法读取则返回0
 */
export async function calculateTextSize(filePath: string): Promise<number> {
  const startTime = Date.now();
  try {
    const lines = await readFileLines(filePath);
    const textSize = lines.reduce((total, line) => total + line.length, 0);
    const endTime = Date.now();
    console.log(`计算文本长度耗时: ${endTime - startTime}ms, 文件: ${filePath}, 字符数: ${textSize}`);
    return textSize;
  } catch (error) {
    const endTime = Date.now();
    console.error(`计算文本长度失败，耗时: ${endTime - startTime}ms, 文件: ${filePath}, 错误:`, error);
    return 0;
  }
}

// =======================================
// 文件信息相关功能
// =======================================

/**
 * 获取文件/目录的基本信息
 * @param targetPath 文件或目录路径
 * @returns 文件或目录的基本信息，如果文件不存在则返回null
 */
export function getFileInfo(targetPath: string): FileInfo | null {
  try {
    const stats = fs.statSync(targetPath);
    const name = path.basename(targetPath);
    const isDirectory = stats.isDirectory();

    const ext = isDirectory ? '' : (path.extname(name).replace('.', '').toLowerCase());
    let childrenCount = 0, isText = false;

    if (isDirectory) {
      try {
        childrenCount = fs.readdirSync(targetPath).filter(n => !n.startsWith('.')).length;
      } catch {
        childrenCount = 0;
      }
    } else {
      try {
        isText = ext ? isTextFile(name) : isTextFileByContent(targetPath);
      } catch (error) {
        console.error('读取文件内容失败:', error);
      }
    }

    return {
      path: targetPath,
      name,
      ext,
      isDirectory,
      childrenCount,
      isText,
      size: stats.size,
      atimeMs: stats.atimeMs,
      mtimeMs: stats.mtimeMs,
      ctimeMs: stats.ctimeMs,
      birthtimeMs: stats.birthtimeMs,
    };
  } catch (error) {
    // 处理文件不存在的情况
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      console.warn(`文件不存在: ${targetPath}`);
      return null;
    }
    // 重新抛出其他类型的错误
    throw error;
  }
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

    // 根据文件编码写入内容，空文件会被识别为 ascii 编码，默认也用 utf-8 写入
    if (fileEncoding === 'UTF-8' || fileEncoding === 'ASCII') {
      console.log(`文件编码为 UTF-8 或 ASCII，直接写入，路径: ${filePath}`);
      await fs.promises.writeFile(filePath, content, 'utf-8');
    } else {
      // 其他编码需要使用iconv-lite进行转换后写入
      console.log(`文件编码为 ${fileEncoding}，需要转换后写入，路径: ${filePath}`);
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

/**
 * 根据文件内容判断文件是否是文本文件
 * 1. 先排除目录
 * 2. 排除有扩展名的文件
 * 3. 排除大小超过1MB的文件
 * 4. 读取文件的前4KB内容进行检测
 * 5. 如果检测到编码是文本编码，则认为是文本文件
 * 6. 如果检测到文件内容包含大量不可打印字符，则认为是二进制文件
 * @param filePath 文件路径
 * @returns true（如果是文本文件）
 */
export function isTextFileByContent(filePath: string): boolean {
  try {
    const stats = fs.statSync(filePath);

    // 先排除目录
    if (stats.isDirectory()) {
      console.log(`路径 ${filePath} 是目录，不是文本文件`);
      return false;
    }

    // 读取文件的前4KB内容进行检测
    const buffer = fs.readFileSync(filePath);
    const sampleSize = Math.min(buffer.length, 4096);
    const sampleBuffer = buffer.slice(0, sampleSize);

    // 检测文件编码
    const detectedEncoding = chardet.detect(sampleBuffer);

    // 常见的文本文件编码
    const textEncodings = [
      'UTF-8', 'UTF-16LE', 'UTF-16BE', 'UTF-32LE', 'UTF-32BE',
      'ASCII', 'ISO-8859-1', 'ISO-8859-2', 'ISO-8859-15',
      // 'Windows-1252', 'Windows-1251', 'Windows-1250', 视频文件常被检测为这几个编码，去掉，只保留常见的
      'GB2312', 'GBK', 'GB18030', 'Big5', 'Shift_JIS', 'EUC-JP', 'EUC-KR'
    ];

    // 如果检测到编码是文本编码，则认为是文本文件
    if (detectedEncoding && textEncodings.includes(detectedEncoding)) {
      console.log(`路径 ${filePath} 是文本文件，编码: ${detectedEncoding}`);
      return true;
    }

    console.log(`路径 ${filePath} 不是文本文件，编码: ${detectedEncoding || 'unknown'}`);
    return false;
  } catch (error) {
    // 如果无法读取文件，返回false
    console.error('检测文件类型失败:', error);
    return false;
  }
}

/**
 * 判断文件是否可文本化（文本文件、parser支持的文件、DOC文件）
 * @param name 文件名或路径
 */
export function isTextableFile(name: string): boolean {
  // 先通过扩展名判断
  if (getExtension(name)) {
    return isSearchableFile(name);
  } else {
    return isTextFileByContent(name);
  }
}