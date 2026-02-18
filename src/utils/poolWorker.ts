// myWorker.ts - 线程池工作器脚本
import workerpool from 'workerpool';
import { isDocFile, isOfficeParserSupported, isTextFile } from './fileCommonUtil';
import * as path from 'path';
import * as fs from 'fs/promises';
import { clearCache, getCacheStats, readFileLines } from './fileCacheUtil';
import { truncateTextWithQuery } from './format';
import { SearchResult } from '../types';
import { isTextFileByContent } from './fileLocalUtil';

// 搜索文件内容
async function searchFileContent(filePath: string, query: string, searchMode: 'content' | 'filename'): Promise<SearchResult | null> {
  const startTime = performance.now();
  try {
    // 检查是否为可搜索文件（文本文件或officeparser支持的文件）
    if (!isTextFile(filePath) && !isOfficeParserSupported(filePath) && !isTextFileByContent(filePath) && !isDocFile(filePath)) {
      return null;
    }

    // 获取文件最后修改时间
    let lastModified: number | undefined;
    try {
      const stats = await fs.stat(filePath);
      lastModified = stats.mtimeMs;
    } catch (error) {
      console.error(`获取文件状态出错: ${filePath}`, error);
    }

    const fileName = path.basename(filePath);

    // 文件名搜索
    if (searchMode === 'filename') {
      if (fileName.includes(query)) {
        const searchTime = performance.now() - startTime;
        return {
          filePath,
          fileName,
          matches: [],
          lastModified,
          searchTime
        };
      }
      return null;
    }

    // 内容搜索 - 使用缓存的文件行列表
    const lines = await readFileLines(filePath);
    const matches: Array<{ line: number; content: string }> = [];

    lines.forEach((line, index) => {
      if (line.includes(query)) {
        matches.push({
          line: index + 1,
          content: truncateTextWithQuery(line, 50, query)
        });
      }
    });

    if (matches.length > 0 || fileName.includes(query)) {
      const searchTime = performance.now() - startTime;
      return {
        filePath,
        fileName: path.basename(filePath),
        matches,
        lastModified,
        searchTime
      };
    }

    return null;
  } catch (error) {
    console.error(`搜索文件出错: ${filePath}`, error);
    return null;
  }
}

// 检查并清理过期缓存
async function checkAndCleanExpiredCache(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<string> {
  try {
    // 清理前获取缓存统计
    const statsBefore = await getCacheStats();
    const beforeMessage = `清理前缓存统计: ${statsBefore.totalFiles} 个文件, 总大小: ${statsBefore.totalSize} 字节`;

    // 执行清理（默认清理7天前的缓存）
    await clearCache(maxAgeMs);

    // 清理后获取缓存统计
    const statsAfter = await getCacheStats();
    const afterMessage = `清理后缓存统计: ${statsAfter.totalFiles} 个文件, 总大小: ${statsAfter.totalSize} 字节`;

    const cleanedCount = statsBefore.totalFiles - statsAfter.totalFiles;
    const cleanedSize = statsBefore.totalSize - statsAfter.totalSize;

    const days = Math.round(maxAgeMs / (24 * 60 * 60 * 1000));

    if (cleanedCount > 0) {
      return `${beforeMessage}\n${afterMessage}\n已清理 ${cleanedCount} 个过期缓存文件（${days}天前），释放 ${cleanedSize} 字节空间`;
    } else {
      return `${beforeMessage}\n${afterMessage}\n没有发现过期缓存文件（${days}天前）`;
    }

  } catch (error) {
    console.error('检查并清理缓存失败:', error);
    return `检查并清理缓存失败: ${error}`;
  }
}

// 创建worker并注册公共函数
workerpool.worker({
  searchFileContent: searchFileContent,
  checkAndCleanExpiredCache: checkAndCleanExpiredCache
});