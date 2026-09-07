/**
 * 词典解析核心（纯逻辑，不依赖 DOM / Node，可同时被渲染进程与线程池复用）
 */
export interface DictionaryEntryData {
    term: string;         // 主词条
    terms: string[];      // 标题拆分出的所有词条
    definition: string[]; // 释义内容，Markdown 原文片段（渲染时才转成 HTML）
    catalog: string[];    // 所属目录（各级父标题）
}

/**
 * 词典数据
 */
export interface DictionaryData {
    id: string;
    name: string;
    filePath: string;
    entries: DictionaryEntryData[];
}

/**
 * 词典摘要（不含全部词条，用于渲染进程维护轻量元数据）
 * 真实的词条数据由后端（主进程）持有，查词时按需回传命中条目
 */
export interface DictionarySummary {
    id: string;
    name: string;
    filePath: string;
    entryCount: number;
}

/**
 * 扫描出的标题信息
 */
interface HeadingInfo {
    level: number;
    text: string;
    lineIndex: number;
}

/**
 * 使用非字符分割词条
 * @param text 要分割的文本
 * @returns 分割后的词条数组
 */
function splitTerm(text: string): string[] {
    return text
        .split(/[^\w\u4e00-\u9fa5]/) // 匹配非字母、数字和中文字符
        .filter(term => term.trim() !== '');
}

/**
 * 扫描 Markdown 中的所有标题（跳过围栏代码块内的 # 行）
 */
function scanHeadings(lines: string[]): HeadingInfo[] {
    const headings: HeadingInfo[] = [];
    let inFence = false;
    let fenceChar = '';
    let fenceLen = 0;

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        const fenceMatch = /^(```+|~~~+)/.exec(trimmed);
        if (fenceMatch) {
            const marker = fenceMatch[1];
            if (!inFence) {
                inFence = true;
                fenceChar = marker[0];
                fenceLen = marker.length;
            } else if (marker[0] === fenceChar && marker.length >= fenceLen) {
                inFence = false;
            }
            continue;
        }

        if (inFence) continue;

        const headingMatch = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
        if (headingMatch) {
            headings.push({
                level: headingMatch[1].length,
                text: headingMatch[2].trim(),
                lineIndex: i
            });
        }
    }

    return headings;
}

/**
 * 解析词典内容为词条数据
 *
 * 说明：这里只做"标题扫描 + 正文切片"，不把正文转成 HTML。
 * 完整 Markdown 解析在几 MB 的词典上需要数秒（实测 2MB 约 5~10 秒），
 * 而实际展示的只有搜索命中的少数条目，因此改为渲染时再转换，
 * 加载耗时从十几秒降到毫秒级。
 *
 * @param content 词典文件的 Markdown 原文
 * @param filePath 文件路径
 * @param name 词典名称
 */
export function parseDictionaryContent(content: string, filePath: string, name?: string): DictionaryData {
    const fileName = name || filePath.split('/').pop() || filePath;
    const lines = content.split('\n');
    const headings = scanHeadings(lines);
    const entries: DictionaryEntryData[] = [];
    const stack: { level: number; title: string }[] = [];

    for (let i = 0; i < headings.length; i++) {
        const heading = headings[i];

        // 关闭层级大于等于当前标题的父级
        while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
            stack.pop();
        }

        const catalog = stack.map(item => item.title);
        const terms = splitTerm(heading.text);

        if (terms.length > 0) {
            // 标题到下一个标题之间的内容即释义
            const start = heading.lineIndex + 1;
            const end = i + 1 < headings.length ? headings[i + 1].lineIndex : lines.length;
            const body = lines.slice(start, end).join('\n').trim();

            let definition: string[] = [];
            if (body) {
                definition = [body];
            } else {
                // 没有正文时，用其下紧跟的子标题拼一行（与原实现行为一致）
                const childTitles: string[] = [];
                for (let j = i + 1; j < headings.length; j++) {
                    if (headings[j].level > heading.level) {
                        childTitles.push(headings[j].text);
                    } else {
                        break;
                    }
                }
                if (childTitles.length > 0) {
                    definition = [childTitles.map(t => `**${t}**`).join('、')];
                }
            }

            entries.push({
                term: terms[0],
                terms,
                definition,
                catalog
            });
        }

        stack.push({ level: heading.level, title: heading.text });
    }

    return {
        id: filePath,
        name: fileName,
        filePath,
        entries
    };
}

/**
 * 在多个词典中搜索词条
 *
 * 检索逻辑（与旧版渲染进程逻辑保持一致）：
 *   1) 先找 term / terms 完全匹配的条目；
 *   2) 没有完全匹配时，再找包含搜索词的条目；
 *   3) 仍没有时，按语言类型放宽：
 *      - 英文：搜索词包含词条的"整词"（词边界）匹配；
 *      - 中文：搜索词包含词条（子串）匹配。
 *
 * 放在核心模块中，供后端（主进程线程池侧）与渲染进程兜底共用，
 * 这样查词的重活（扫描全部词条）只在后端执行，渲染进程只拿到命中结果。
 *
 * @param term 搜索词
 * @param dictionaries 待检索的词典列表（按优先级/顺序传入）
 * @returns 命中的词条数组
 */
export function searchDictionaries(term: string, dictionaries: DictionaryData[]): DictionaryEntryData[] {
    if (!term.trim()) {
        return [];
    }

    const searchTerm = term.toLowerCase().trim();
    const isEnglish = !/[\u4e00-\u9fa5]/.test(term);
    const results: DictionaryEntryData[] = [];

    // 1. 完全匹配
    for (const dictionary of dictionaries) {
        for (const entry of dictionary.entries) {
            if (
                entry.term.toLowerCase() === searchTerm ||
                entry.terms.some(t => t.toLowerCase() === searchTerm)
            ) {
                results.push(entry);
            }
        }
    }
    if (results.length > 0) return results;

    // 2. 包含匹配
    for (const dictionary of dictionaries) {
        for (const entry of dictionary.entries) {
            if (
                entry.term.toLowerCase().includes(searchTerm) ||
                entry.terms.some(t => t.toLowerCase().includes(searchTerm))
            ) {
                results.push(entry);
            }
        }
    }
    if (results.length > 0) return results;

    // 3. 按语言类型放宽匹配
    for (const dictionary of dictionaries) {
        for (const entry of dictionary.entries) {
            let matched = false;
            if (isEnglish) {
                matched =
                    new RegExp(`\\b${entry.term.toLowerCase().trim()}\\b`, 'i').test(searchTerm) ||
                    entry.terms.some(t => new RegExp(`\\b${t.toLowerCase().trim()}\\b`, 'i').test(searchTerm));
            } else {
                matched =
                    searchTerm.includes(entry.term.toLowerCase().trim()) ||
                    entry.terms.some(t => searchTerm.includes(t.toLowerCase().trim()));
            }
            if (matched) {
                results.push(entry);
            }
        }
    }

    return results;
}
