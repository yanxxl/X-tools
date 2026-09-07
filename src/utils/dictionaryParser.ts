import { parseDictionaryContent } from './dictionaryParserCore';
import type { DictionaryEntryData } from './dictionaryParserCore';

/**
 * 词典接口
 */
export interface Dictionary {
    id: string;
    name: string;
    filePath: string;
    entries: DictionaryEntry[];
    enabled: boolean;
    entryCount?: number; // 词条总数（由后端解析得到，渲染进程不一定持有全部词条）
    error?: string; // 错误信息，可选
}

/**
 * 词条接口
 * definition 保存释义的 Markdown 原文片段（渲染时才转换为 HTML），
 * 因此词典数据可以在线程池中生成并跨进程传输
 */
export interface DictionaryEntry {
    term: string;
    terms: string[];
    definition: string[];
    catalog: string[];
}

/**
 * 把线程池返回的词条数据转换为渲染进程使用的数据结构
 */
function toEntries(entries: DictionaryEntryData[]): DictionaryEntry[] {
    return (entries || []).map(entry => ({
        term: entry.term,
        terms: entry.terms,
        definition: entry.definition,
        catalog: entry.catalog
    }));
}

/**
 * 解析Markdown文件为词典
 * 优先交给主进程线程池处理（读文件 + 解析都在后台完成），
 * 大词典不会卡住渲染进程；线程池不可用时回退到渲染进程本地解析
 *
 * @param filePath 文件路径
 * @returns 词典对象
 */
export async function parseMarkdownToDictionary(filePath: string): Promise<Dictionary> {
    const fileName = filePath.split('/').pop() || filePath;

    if (window.electronAPI?.parseDictionary) {
        try {
            const summary = await window.electronAPI.parseDictionary(filePath);
            // 词条数据由后端（主进程）持有，渲染进程只保留轻量元数据，避免大词典卡顿
            return {
                id: summary.id || filePath,
                name: summary.name || fileName,
                filePath,
                entries: [],
                enabled: true,
                entryCount: summary.entryCount
            };
        } catch (error) {
            console.error(`线程池解析词典失败，回退到渲染进程解析: ${filePath}`, error);
        }
    }

    // 兜底：渲染进程本地解析（不依赖 DOM，逻辑与线程池完全一致）
    const content = await window.electronAPI.readFile(filePath);
    const data = parseDictionaryContent(content, filePath, fileName);

    return {
        id: data.id,
        name: data.name,
        filePath,
        entries: toEntries(data.entries),
        enabled: true
    };
}
