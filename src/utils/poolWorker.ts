// myWorker.ts - 线程池工作器脚本
import workerpool from 'workerpool';
import { isTextFile } from './fileCommonUtil';
import * as path from 'path';
import * as fs from 'fs/promises';
import { readFileText } from './fileLocalUtil';
import { truncateTextWithQuery } from './format';
import { SearchResult } from '../types';

// 搜索文件内容
async function searchFileContent(filePath: string, query: string, searchMode: 'content' | 'filename'): Promise<SearchResult | null> {
  const startTime = performance.now();
  try {
    // 检查是否为文本文件
    if (!isTextFile(filePath)) {
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

    // 文件名搜索
    if (searchMode === 'filename') {
      const fileName = path.basename(filePath);
      if (filePath.includes(query)) {
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

    // 内容搜索
    const content = await readFileText(filePath);
    const lines = content.split('\n');
    const matches: Array<{ line: number; content: string }> = [];

    lines.forEach((line, index) => {
      if (line.includes(query)) {
        matches.push({
          line: index + 1,
          content: truncateTextWithQuery(line, 50, query)
        });
      }
    });

    if (matches.length > 0 || filePath.includes(query)) {
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

// 创建worker并注册公共函数
workerpool.worker({
  searchFileContent: searchFileContent
});