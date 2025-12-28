// searchWorker.ts - 用于后台执行搜索任务的Worker线程
import {parentPort, workerData} from 'worker_threads';
import fs from 'node:fs';
import path from 'node:path';
import chardet from 'chardet';
import iconv from 'iconv-lite';
import {isTextFile} from './fileCommonUtil';

// 类型定义
interface SearchMatch {
    line: number;
    content: string;
}

interface SearchResult {
    filePath: string;
    fileName: string;
    matches: SearchMatch[];
}

interface SearchProgressCallback {
    onFileProcessed: (result: SearchResult | null) => void;
    onProgress: (totalFiles: number, currentFile: number, totalLines: number) => void;
}



// 辅助函数：读取文件内容，自动检测编码
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

// 辅助函数：截短文本，确保查询词可见
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

// 辅助函数：递归收集指定目录下的所有文本文件
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

// 辅助函数：递归收集指定目录下的所有文件（包括非文本文件）
async function collectAllFiles(dirPath: string): Promise<string[]> {
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
            const subFiles = await collectAllFiles(fullPath);
            files.push(...subFiles);
        } else {
            // 收集所有非隐藏文件
            files.push(fullPath);
        }
    }

    return files;
}

// 辅助函数：搜索单个文件的内容
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
        // 忽略无法访问的文件
        return null;
    }
}

// 主要搜索函数：逐步搜索文件内容
async function searchFilesContentProgressively(
    dirPath: string,
    query: string,
    callbacks: SearchProgressCallback,
    searchMode: 'content' | 'filename' = 'content'
): Promise<void> {
    // 1. 根据搜索模式选择文件收集函数
    const allFiles = searchMode === 'filename' 
        ? await collectAllFiles(dirPath) 
        : await collectTextFiles(dirPath);
    const totalFiles = allFiles.length;
    let currentFileIndex = 0;
    let totalLinesSearched = 0;

    // 2. 根据搜索模式进行搜索
    if (searchMode === 'filename') {
        // 文件名搜索模式
        for (const filePath of allFiles) {
            currentFileIndex++;
            const fileName = path.basename(filePath);

            // 检查文件名是否匹配查询
            if (fileName.toLowerCase().includes(query.toLowerCase())) {
                // 文件名搜索模式下，matches 为空
                callbacks.onFileProcessed({
                    filePath,
                    fileName,
                    matches: []
                });
            }

            // 报告进度（文件名搜索不统计行数）
            callbacks.onProgress(totalFiles, currentFileIndex, totalLinesSearched);
        }
    } else {
        // 全文搜索模式
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
                // 报告进度
                callbacks.onProgress(totalFiles, currentFileIndex, totalLinesSearched);
            }
        }
    }

    // 6. 搜索完成，发送null表示结束
    callbacks.onFileProcessed(null);
}

// 直接使用workerData执行搜索，不需要等待message事件
const {dirPath, query, searchId, searchMode} = workerData;

// 立即执行搜索
(async () => {
    try {
        // 执行逐步搜索
        await searchFilesContentProgressively(dirPath, query, {
            onFileProcessed: (result) => {
                // 发送单个文件的搜索结果到主进程
                parentPort?.postMessage({
                    type: 'fileResult',
                    searchId,
                    data: result
                });
            },
            onProgress: (totalFiles, currentFile, totalLines) => {
                // 发送进度更新到主进程
                parentPort?.postMessage({
                    type: 'progress',
                    searchId,
                    data: {totalFiles, currentFile, totalLines}
                });
            }
        }, searchMode);
    } catch (error) {
        // 发送错误信息到主进程
        parentPort?.postMessage({
            type: 'error',
            searchId,
            data: error instanceof Error ? error.message : 'Unknown error'
        });
    }
})();