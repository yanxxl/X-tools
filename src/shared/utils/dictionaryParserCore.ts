/**
 * 词典解析核心（纯逻辑，不依赖 DOM / Node，可同时被渲染进程与线程池复用）
 */
export interface DictionaryEntryData {
    term: string;         // 词条（标题原文）
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
        const term = heading.text.trim();

        if (term) {
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
                term,
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

// =========================================================================
// 通配符（简易正则）检索
// =========================================================================

/** 通配符元字符：? / ？ 匹配单个字符；* 匹配任意多个字符；$ / ￥ 表示结束 */
const WILDCARD_CHARS = /[?？*$￥]/;

/** 通配符检索最多返回的条目数，避免过宽的模式（如 *）一次性灌满列表 */
const WILDCARD_MAX_RESULTS = 500;

/**
 * 判断搜索词是否为通配符（简易正则）查询
 *
 * 只要含有 ?/？、*、$/￥ 中任意一个，即按正则方式检索，
 * 不再执行后续的模糊（包含/放宽）匹配。
 */
export function isWildcardQuery(term: string): boolean {
    return WILDCARD_CHARS.test(term);
}

/**
 * 把通配符模式编译成正则表达式
 *
 * - `?` / `？`：匹配单个字符
 * - `*`：匹配任意多个字符（含零个）
 * - `$` / `￥`：出现在末尾表示"到此结束"（结尾锚定），出现在中间按普通字符处理
 * - 其余字符一律转义，保证任何输入都能得到合法正则
 *
 * @param term 用户输入的搜索词
 * @returns 编译好的正则（忽略大小写），模式为空时返回 null
 */
export function buildWildcardRegExp(term: string): RegExp | null {
    const pattern = term.trim();
    if (!pattern) {
        return null;
    }

    let source = '';
    let anchorEnd = false;

    for (let i = 0; i < pattern.length; i++) {
        const ch = pattern[i];
        switch (ch) {
            case '?':
            case '？':
                source += '.';
                break;
            case '*':
                source += '[\\s\\S]*';
                break;
            case '$':
            case '￥':
                if (i === pattern.length - 1) {
                    anchorEnd = true;
                } else {
                    source += '\\$';
                }
                break;
            default:
                source += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
    }

    return new RegExp(`${source}${anchorEnd ? '$' : ''}`, 'i');
}

/**
 * 在多个词典中搜索词条
 *
 * 检索逻辑（与旧版渲染进程逻辑保持一致）：
 *   0) 搜索词含 ?/？、*、$/￥ 时走通配符（简易正则）检索，命中即返回，不再做模糊匹配；
 *   1) 先找词条完全匹配的条目；
 *   2) 没有完全匹配时，再找词条包含搜索词的条目；
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

    // 0. 通配符（简易正则）检索：命中即返回，不再走下面的模糊匹配
    if (isWildcardQuery(searchTerm)) {
        const regex = buildWildcardRegExp(searchTerm);
        if (!regex) {
            return [];
        }
        for (const dictionary of dictionaries) {
            for (const entry of dictionary.entries) {
                if (regex.test(entry.term)) {
                    results.push(entry);
                }
            }
        }
        // 短词条通常更贴近用户输入的模式，排在前面
        results.sort((a, b) => a.term.length - b.term.length);
        return results.length > WILDCARD_MAX_RESULTS ? results.slice(0, WILDCARD_MAX_RESULTS) : results;
    }

    // 1. 完全匹配
    for (const dictionary of dictionaries) {
        for (const entry of dictionary.entries) {
            if (entry.term.toLowerCase() === searchTerm) {
                results.push(entry);
            }
        }
    }
    if (results.length > 0) return results;

    // 2. 包含匹配
    for (const dictionary of dictionaries) {
        for (const entry of dictionary.entries) {
            if (entry.term.toLowerCase().includes(searchTerm)) {
                results.push(entry);
            }
        }
    }
    if (results.length > 0) return results;

    // 3. 按语言类型放宽匹配
    for (const dictionary of dictionaries) {
        for (const entry of dictionary.entries) {
            const entryTerm = entry.term.toLowerCase().trim();
            let matched = false;
            if (isEnglish) {
                matched = new RegExp(`\\b${entryTerm}\\b`, 'i').test(searchTerm);
            } else {
                matched = searchTerm.includes(entryTerm);
            }
            if (matched) {
                results.push(entry);
            }
        }
    }

    return results;
}
