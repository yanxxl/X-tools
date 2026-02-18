import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { isOfficeParserSupported, isDocFile } from './fileCommonUtil';
import { parseOfficeDocument, astToText } from './office';
import WordExtractor from 'word-extractor';

// 缓存目录路径 - 直接使用用户主目录下的 .x-tools/search-cache
const CACHE_DIR = path.join(process.env.HOME || '', '.x-tools', 'search-cache');

// 缓存版本，当解析逻辑或格式发生变化时更新此版本号
const CACHE_VERSION = '1.0';

/**
 * 确保缓存目录存在
 */
async function ensureCacheDir(): Promise<void> {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (error) {
        console.error('创建缓存目录失败:', error);
    }
}

/**
 * 读取文件内容并返回行列表，支持缓存
 * @param filePath 文件路径
 * @returns 文件内容行列表
 */
export async function readFileLines(filePath: string): Promise<string[]> {
    try {
        // 获取文件信息
        const stats = await fs.stat(filePath);
        const fileSize = stats.size;
        const mtimeMs = stats.mtimeMs;
        
        // 生成缓存键
        const cacheKey = crypto.createHash('md5').update(`${CACHE_VERSION}|${filePath}|${fileSize}|${mtimeMs}`).digest('hex');
        const cacheFilePath = path.join(CACHE_DIR, `${cacheKey}.json`);
        
        // 尝试从缓存读取
        try {
            await fs.access(cacheFilePath);
            const cacheContent = await fs.readFile(cacheFilePath, 'utf8');
            return JSON.parse(cacheContent);
        } catch {
            // 缓存不存在，继续读取文件
        }
        
        // 读取文件内容
        let lines: string[];
        if (isOfficeParserSupported(filePath)) {
            const ast = await parseOfficeDocument(filePath, {extractAttachments: false, includeRawContent: true});
            const textContent = astToText(ast);
            lines = textContent.split('\n');
        } else if (isDocFile(filePath)) {
            // 如果是 doc 文件，使用 WordExtractor 获取正文内容
            try {
                const extractor = new WordExtractor();
                const extracted = await extractor.extract(filePath);
                const bodyContent = extracted.getBody();
                lines = bodyContent.split('\n');
            } catch (error) {
                console.warn('WordExtractor 提取失败，回退到文本读取:', error);
                // 如果 WordExtractor 失败，回退到文本读取
                const { readFileText } = await import('./fileLocalUtil');
                const content = await readFileText(filePath);
                if (content === null) {
                    throw new Error(`无法读取文件: ${filePath}`);
                }
                lines = content.split('\n');
            }
        } else {
            const { readFileText } = await import('./fileLocalUtil');
            const content = await readFileText(filePath);
            if (content === null) {
                throw new Error(`无法读取文件: ${filePath}`);
            }
            lines = content.split('\n');
        }
        
        // 写入缓存
        await ensureCacheDir();
        await fs.writeFile(cacheFilePath, JSON.stringify(lines, null, 2), 'utf8');
        
        return lines;
        
    } catch (error) {
        console.error('读取文件内容失败:', error);
        throw error;
    }
}

/**
 * 清理缓存目录
 * @param maxAgeMs 最大缓存年龄（毫秒），默认7天
 */
export async function clearCache(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
        await ensureCacheDir();
        
        const files = await fs.readdir(CACHE_DIR);
        const now = Date.now();
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(CACHE_DIR, file);
                try {
                    const stats = await fs.stat(filePath);
                    if (now - stats.mtimeMs > maxAgeMs) {
                        await fs.unlink(filePath);
                    }
                } catch (error) {
                    console.error('删除缓存文件失败:', error);
                }
            }
        }
        
    } catch (error) {
        console.error('清理缓存失败:', error);
    }
}

/**
 * 获取缓存统计信息
 * @returns 缓存统计信息
 */
export async function getCacheStats(): Promise<{
    totalFiles: number;
    totalSize: number;
}> {
    try {
        await ensureCacheDir();
        
        const files = await fs.readdir(CACHE_DIR);
        const cacheFiles = files.filter(file => file.endsWith('.json'));
        
        let totalSize = 0;
        
        for (const file of cacheFiles) {
            const filePath = path.join(CACHE_DIR, file);
            try {
                const stats = await fs.stat(filePath);
                totalSize += stats.size;
            } catch (error) {
                console.error('获取缓存文件信息失败:', error);
            }
        }
        
        return {
            totalFiles: cacheFiles.length,
            totalSize
        };
        
    } catch (error) {
        console.error('获取缓存统计信息失败:', error);
        return {
            totalFiles: 0,
            totalSize: 0
        };
    }
}