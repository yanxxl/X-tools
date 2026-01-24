// myWorker.ts - 线程池工作器脚本
import workerpool from 'workerpool';
import { isTextFile } from './fileCommonUtil';
import * as path from 'path';
import { readFileText } from './fileLocalUtil';

// 搜索文件内容
async function searchFileContent(filePath: string, query: string, searchMode: 'content' | 'filename'): Promise<any> {
  try {
    // 检查是否为文本文件
    if (!isTextFile(filePath)) {
      return null;
    }

    // 文件名搜索
    if (searchMode === 'filename') {
      const fileName = path.basename(filePath);
      if (filePath.includes(query)) {
        return {
          filePath,
          fileName,
          matches: []
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
          content: line
        });
      }
    });

    if (matches.length > 0 || filePath.includes(query)) {
      return {
        filePath,
        fileName: path.basename(filePath),
        matches
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