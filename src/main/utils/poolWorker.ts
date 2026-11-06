// myWorker.ts - 线程池工作器脚本
import workerpool from 'workerpool';
import { isDocFile, isOfficeParserSupported, isTextFile } from '@shared/utils/fileCommonUtil';
import * as path from 'path';
import * as fs from 'fs/promises';
import { clearCache, getCacheStats, readFileLines } from './fileCacheUtil';
import { truncateTextWithQuery } from '@shared/utils/format';
import { SearchResult } from '@shared/types/index';
import {isTextableFile} from './fileLocalUtil';
import {parseMarkdownBlocks} from '@shared/utils/markdown';
import {parseDictionaryContent} from '@shared/utils/dictionaryParserCore';
import {readTextFile} from './fileTextUtil';

/**
 * 构造忽略大小写的字面量匹配器
 * 与渲染层的高亮逻辑保持一致，避免同一关键词因大小写不同得到不同结果
 * @param query 搜索关键词（按字面量匹配，正则元字符会被转义）
 */
function createQueryMatcher(query: string): RegExp {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, 'i');
}

// 搜索文件内容
async function searchFileContent(filePath: string, query: string, searchMode: 'content' | 'filename'): Promise<SearchResult | null> {
  const startTime = performance.now();
  try {
    // 获取文件最后修改时间
    let lastModified: number | undefined;
    try {
      const stats = await fs.stat(filePath);
      lastModified = stats.mtimeMs;
    } catch (error) {
      console.error(`获取文件状态出错: ${filePath}`, error);
    }

    const fileName = path.basename(filePath);
    // 忽略大小写的匹配器，本次搜索内复用
    const matcher = createQueryMatcher(query);

    // 文件名搜索
    if (searchMode === 'filename') {
      if (matcher.test(fileName)) {
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
      if (matcher.test(line)) {
        matches.push({
          line: index + 1,
          content: truncateTextWithQuery(line, 50, query)
        });
      }
    });

    if (matches.length > 0 || matcher.test(fileName)) {
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

/**
 * 解析 Markdown 为分块 HTML（在线程池中执行，避免阻塞渲染进程与主线程）
 * @param markdown Markdown 原文
 * @param filePath 文件路径，用于解析相对图片地址
 * @param lite 是否使用精简模式
 */
async function parseMarkdown(markdown: string, filePath: string, lite?: boolean, idPrefix?: string) {
  const startTime = performance.now();
  const result = await parseMarkdownBlocks(markdown, filePath, lite, idPrefix || '');
  return {
    ...result,
    parseTime: performance.now() - startTime
  };
}

/**
 * 解析词典文件（读取 + Markdown 解析 + 条目提取都在线程池中完成）
 * @param filePath 词典文件路径
 */
async function parseDictionary(filePath: string) {
  const startTime = performance.now();
  const content = await readTextFile(filePath);
  const result = parseDictionaryContent(content, filePath);
  return {
    ...result,
    parseTime: performance.now() - startTime
  };
}

// 创建worker并注册公共函数
workerpool.worker({
  searchFileContent: searchFileContent,
  checkAndCleanExpiredCache: checkAndCleanExpiredCache,
  parseMarkdown: parseMarkdown,
  parseDictionary: parseDictionary
});