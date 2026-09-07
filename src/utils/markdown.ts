import {unified} from 'unified';
import {VFile} from 'vfile';
import {dirname, join} from './fileCommonUtil';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkGemoji from 'remark-gemoji';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import {visit} from 'unist-util-visit';
import * as yaml from 'yaml';

/**
 * 大纲项接口
 * 用于表示 Markdown 文档的标题结构
 */
export interface OutlineItem {
    id: string;          // 标题的锚点 ID
    title: string;       // 标题文本内容
    level: number;       // 标题级别 (1-6)
    children: OutlineItem[]; // 子标题列表
}

/**
 * Markdown 解析结果接口
 * 包含解析后的 HTML、大纲结构和 frontmatter 数据
 */
export interface MarkdownParseResult {
    html: string;                    // 解析后的 HTML 字符串
    outline: OutlineItem[];          // 文档大纲结构
    frontmatter?: Record<string, any>; // 文档的 frontmatter 数据（如果存在）
}

/**
 * 大文件阈值（字符数）
 * 超过该阈值的文档自动进入"精简模式"：跳过代码高亮、代码行号与 Mermaid 渲染。
 * 这三项在超大文档上会产生海量 DOM 节点（每个高亮 token 一个 span、每行代码两个 span），
 * 是渲染卡死的主要原因。
 */
export const LARGE_FILE_THRESHOLD = 300 * 1024;

/**
 * 扁平标题项
 * 超大文档会被分段解析，各段返回扁平标题列表，由调用方累积后统一构建大纲树，
 * 这样跨段的层级关系仍然正确。
 */
export interface FlatHeading {
    id: string;      // 标题锚点 ID
    title: string;   // 标题文本
    level: number;   // 标题级别 (1-6)
}

/**
 * 分块解析结果
 * chunks 为按顶层块（标题、段落、代码块、表格等）切分后的 HTML 片段数组，
 * 渲染进程可以分批插入 DOM，避免一次性注入超大 HTML 造成的长时间冻结。
 */
export interface MarkdownBlocksResult {
    chunks: string[];                  // 分块后的 HTML 片段列表
    headings: FlatHeading[];           // 扁平标题列表（跨段累积后可构建完整大纲）
    frontmatter?: Record<string, any>; // 文档的 frontmatter 数据（如果存在）
}

/**
 * 由扁平标题列表构建大纲树
 */
export function buildOutline(headings: FlatHeading[]): OutlineItem[] {
    const outline: OutlineItem[] = [];
    const stack: OutlineItem[] = [];

    for (const heading of headings) {
        const item: OutlineItem = {
            id: heading.id,
            title: heading.title,
            level: heading.level,
            children: []
        };

        while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
            stack.pop();
        }

        if (stack.length === 0) {
            outline.push(item);
        } else {
            stack[stack.length - 1].children.push(item);
        }

        stack.push(item);
    }

    return outline;
}

/**
 * 单次解析的上下文
 * 通过 vfile.data 传入插件，使 processor 可以复用（单例）且不共享可变状态
 */
interface MarkdownContext {
    filePath?: string;                  // 当前文件路径（用于解析相对图片地址）
    idPrefix?: string;                  // 锚点 ID 前缀，保证分段解析时 ID 不冲突
    headings: FlatHeading[];            // 输出：扁平标题列表
    frontmatter?: Record<string, any>;  // 输出：frontmatter 数据
}

/**
 * 生成锚点 ID
 * 将标题文本转换为唯一的 HTML 锚点 ID
 * @param text 标题文本
 * @param existingIds 已存在的 ID 集合，用于确保 ID 唯一性
 * @param prefix ID 前缀（分段解析时使用）
 * @returns 生成的唯一锚点 ID
 */
function generateAnchorId(text: string, existingIds: Set<string> = new Set(), prefix = ''): string {
    const rawId = text
            .toLowerCase()
            .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
        || 'heading';

    const baseId = prefix ? `${prefix}${rawId}` : rawId;

    // 确保 ID 唯一性
    let finalId = baseId;
    let counter = 1;
    while (existingIds.has(finalId)) {
        finalId = `${baseId}-${counter}`;
        counter++;
    }

    existingIds.add(finalId);
    return finalId;
}

/**
 * rehype 插件：为代码块添加行号
 * 将 <pre><code> 转换为带行号的表格结构
 * 跳过 Mermaid 图表和 KaTeX 公式代码块
 */
function rehypeLineNumbers() {
    return (tree: any) => {
        visit(tree, 'element', (node: any, index: number, parent: any) => {
            if (node.tagName === 'pre' && parent && Array.isArray(parent.children)) {
                const codeChild = node.children.find((child: any) => child.tagName === 'code');
                if (!codeChild || !codeChild.children) return;

                // 检查是否为 Mermaid 或数学公式代码块，跳过这些特殊代码块
                const classNames = codeChild.properties?.className || [];
                const classList = Array.isArray(classNames) ? classNames : [classNames];
                const isMermaid = classList.includes('language-mermaid') || classList.includes('mermaid');
                const isMath = classList.some((c: string) =>
                    c === 'language-math' ||
                    c === 'language-latex' ||
                    c === 'language-katex' ||
                    c.startsWith('language-math-')
                );

                // 如果是 Mermaid 或数学公式，跳过处理
                if (isMermaid || isMath) return;

                // 提取代码文本内容并按行分割
                const text = getTextContent(codeChild);
                // split('\n') 在末尾换行时会产生多余空元素，如 "a\n" → ["a", ""]
                const rawLines = text.split('\n');
                const lines = text.endsWith('\n') ? rawLines.slice(0, -1) : rawLines;

                // 构建带行号的 HTML 结构
                const lineNumbersHtml = lines.map((_line: string, i: number) =>
                    `<span class="code-line-number">${i + 1}</span>`
                ).join('');
                const codeLinesHtml = lines.map((line: string, i: number) => {
                    const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    // 空行用零宽空格占位，确保 span 有高度
                    const content = escaped || '\u200B';
                    return `<span class="code-line" data-line="${i + 1}">${content}</span>`;
                }).join('');

                // 替换原节点为包装结构
                const newNode: any = {
                    type: 'element',
                    tagName: 'div',
                    properties: { className: ['code-block-wrapper'] },
                    children: [
                        {
                            type: 'element',
                            tagName: 'div',
                            properties: { className: ['code-line-numbers'] },
                            children: [{ type: 'raw', value: lineNumbersHtml }]
                        },
                        {
                            type: 'element',
                            tagName: 'pre',
                            properties: node.properties || {},
                            children: [{
                                type: 'raw',
                                value: `<code class="${codeChild.properties?.className?.join(' ') || ''}">${codeLinesHtml}</code>`
                            }]
                        }
                    ]
                };

                parent.children[index] = newNode;
            }
        });
    };
}

/**
 * 从 AST 节点提取文本内容
 */
function getTextContent(node: any): string {
    if (!node) return '';
    if (node.type === 'text') return node.value;
    if (node.children) {
        return node.children.map(getTextContent).join('');
    }
    return '';
}

/**
 * remark 插件：提取 frontmatter、处理图片路径、生成大纲与标题锚点
 * 上下文通过 file.data.markdownContext 传入并回写，使 processor 可以复用为单例
 */
function remarkMarkdownMeta() {
    return (tree: any, file: any) => {
        const ctx: MarkdownContext | undefined = file?.data?.markdownContext;
        if (!ctx) return;

        const filePath = ctx.filePath || '';
        const idPrefix = ctx.idPrefix || '';             // 分段解析时的锚点前缀
        const headings = ctx.headings;                   // 输出：扁平标题列表
        const existingIds = new Set<string>();           // 已生成的锚点 ID，确保唯一性

        // 提取 frontmatter 内容
        visit(tree, 'yaml', (node: any) => {
            try {
                ctx.frontmatter = yaml.parse(node.value);
            } catch (error) {
                console.error('解析 frontmatter 失败:', error);
            }
        });

        // 图片地址处理，本地文件，加上完整路径
        visit(tree, 'image', (node: any) => {
            try {
                if (typeof node.url === 'string' && !node.url.startsWith('http')) {
                    if (filePath) {
                        // 获取文件所在目录的绝对路径
                        const dirPath = dirname(filePath);
                        // 构造完整的文件路径
                        const imagePath = join(dirPath, node.url);
                        // 使用 new URL() 构造 file URL
                        node.url = new URL(imagePath, 'file:').href;
                    } else {
                        // 如果没有文件路径，直接使用 file URL
                        node.url = new URL(node.url, 'file:').href;
                    }
                }
            } catch (error) {
                console.error('解析 image 失败:', error);
            }
        });

        // 处理标题并构建大纲
        visit(tree, 'heading', (node: any) => {
            const level = node.depth;
            // 提取标题文本内容
            const text = node.children
                .map((child: any) => {
                    if (child.type === 'text') return child.value;
                    if (child.type === 'html') return child.value;
                    if (child.type === 'strong' || child.type === 'emphasis') {
                        return child.children.map((c: any) => {
                            if (c.type === 'text') return c.value;
                            if (c.type === 'html') return c.value;
                            return '';
                        }).join('');
                    }
                    return '';
                })
                .join('').trim();

            const id = generateAnchorId(text, existingIds, idPrefix);
            // 记录扁平标题，大纲树由调用方在累积全部标题后统一构建
            headings.push({ id, title: text, level });

            // 添加 id 属性到标题节点
            node.data = node.data || {};
            node.data.hProperties = node.data.hProperties || {};
            node.data.hProperties.id = id;
        });
    };
}

/**
 * Mermaid 渲染插件
 * Mermaid 依赖浏览器环境，在主进程线程池中加载会直接崩溃，
 * 因此不在本模块中静态引入，而是由渲染进程通过 setMermaidPlugin 注册
 */
let mermaidPlugin: any = null;

/**
 * 注册 Mermaid 渲染插件（仅渲染进程调用）
 */
export function setMermaidPlugin(plugin: any) {
    mermaidPlugin = plugin;
}

/**
 * 构建 remark/rehype 处理管道
 * @param lite 是否为精简模式（跳过代码高亮、代码行号、Mermaid 渲染）
 */
function buildProcessor(lite: boolean) {
    const processor = unified()
        .use(remarkParse) // 解析 Markdown
        .use(remarkFrontmatter) // 支持 frontmatter
        .use(remarkGfm) // 支持 GitHub 风格 Markdown（表格、删除线、任务列表、自动链接等）
        .use(remarkGemoji) // 支持 GitHub 表情符号
        .use(remarkMath) // 支持数学公式
        .use(remarkMarkdownMeta) // frontmatter / 图片路径 / 大纲与锚点
        .use(remarkRehype, { allowDangerousHtml: true }); // 将 Markdown 转换为 HTML，允许危险 HTML

    if (!lite) {
        // 代码高亮：每个 token 生成一个 span；Mermaid：需要启动浏览器渲染。
        // 两者在超大文档上开销极高，精简模式下跳过
        processor.use(rehypeHighlight);

        // Mermaid 插件由渲染进程注册，主进程线程池中不可用
        if (mermaidPlugin) {
            processor.use(mermaidPlugin);
        }
    }

    processor.use(rehypeKatex); // 数学公式渲染（必须在 rehypeLineNumbers 之前）

    if (!lite) {
        processor.use(rehypeLineNumbers); // 添加代码行号（每个代码行两个 span）
    }

    // 将结果序列化为 HTML 字符串，允许危险 HTML
    return processor.use(rehypeStringify, { allowDangerousHtml: true }).freeze();
}

// processor 构建结果缓存（避免每次解析都重新组装管道）
const processorCache: { full?: any; lite?: any } = {};

/**
 * 获取 processor 单例
 */
function getProcessor(lite: boolean) {
    const key = lite ? 'lite' : 'full';
    if (!processorCache[key]) {
        processorCache[key] = buildProcessor(lite);
    }
    return processorCache[key];
}

/**
 * 生成 frontmatter 展示用的 HTML 表格
 */
function buildFrontmatterHtml(frontmatter: Record<string, any>): string {
    try {
        return `
        <div class="markdown-frontmatter">
          <h3 style="margin-bottom: 8px; color: #666; font-size: 14px; font-weight: normal;">文档信息</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; background: #f5f5f5; border-radius: 4px; overflow: hidden;">
            ${Object.entries(frontmatter).map(([key, value]) => `
              <tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e8e8e8; font-weight: 500; color: #333; min-width: 100px;">${key}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e8e8e8; color: #666;">${formatFrontmatterValue(value)}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      `;
    } catch (error) {
        console.error('格式化 frontmatter 失败:', error);
        return '';
    }
}

/**
 * 将超大 Markdown 切分为多段，用于分段解析（先出首屏，后续逐步追加）
 * 切分点优先选在空行处并跳过围栏代码块内部，尽量避免破坏语法结构
 *
 * @param text Markdown 原文
 * @param firstSegmentSize 首段目标大小（首段更小，尽快出内容）
 * @param segmentSize 后续各段目标大小
 */
export function splitMarkdownSegments(text: string, firstSegmentSize: number, segmentSize: number): string[] {
    const len = text.length;
    if (len <= firstSegmentSize) return [text];

    const segments: string[] = [];
    let start = 0;
    let target = firstSegmentSize;
    let pos = 0;

    // 围栏代码块状态（``` 或 ~~~）
    let inFence = false;
    let fenceChar = '';
    let fenceLen = 0;

    while (pos < len) {
        const lineEnd = text.indexOf('\n', pos);
        const end = lineEnd === -1 ? len : lineEnd;
        const trimmedEnd = text.slice(pos, end).trim();

        const fenceMatch = /^(```+|~~~+)/.exec(trimmedEnd);
        if (fenceMatch) {
            const marker = fenceMatch[1];
            if (!inFence) {
                inFence = true;
                fenceChar = marker[0];
                fenceLen = marker.length;
            } else if (marker[0] === fenceChar && marker.length >= fenceLen) {
                inFence = false;
            }
        }

        if (!inFence) {
            const currentSize = end - start;
            // 优先在空行处切分；若一直遇不到空行则退化为按行边界切分，避免单段过大
            if (trimmedEnd === '' ? currentSize >= target : currentSize >= target * 2) {
                segments.push(text.slice(start, pos));
                start = pos;
                target = segmentSize;
            }
        }

        pos = end + 1;
    }

    if (start < len) {
        segments.push(text.slice(start));
    }

    return segments.length > 0 ? segments : [text];
}

/**
 * 解析 Markdown 并输出分块 HTML、扁平标题和 frontmatter 数据
 * 分块输出便于渲染进程渐进式挂载 DOM，避免一次性注入造成的长时间卡顿
 *
 * @param markdown 要解析的 Markdown 文本
 * @param filePath 文件路径，用于解析相对图片地址
 * @param lite 是否强制使用精简模式，默认按文档大小自动判断
 * @param idPrefix 锚点 ID 前缀，分段解析时传入以保证跨段唯一
 */
/**
 * 解析 Markdown 得到 hast 语法树（不产生完整 HTML 字符串）
 * 适用于需要在 AST 层面做二次处理的场景（如词典解析），避免额外的序列化与 DOM 解析开销
 *
 * @param markdown 要解析的 Markdown 文本
 * @param filePath 文件路径，用于解析相对图片地址
 * @param lite 是否强制使用精简模式，默认按文档大小自动判断
 * @param idPrefix 锚点 ID 前缀
 */

/**
 * 保留空行预处理
 * 标准 Markdown 会把段间多余的空行折叠成一个段落间距，作者敲出的空行在预览中不可见。
 * 这里把「3 个及以上连续换行」产生的多余空行还原为独立的 <br> 块，
 * 使预览中的空行数与源码一致：
 *   - 2 个连续换行（1 个空行）  -> 普通段落分隔，正常折叠
 *   - 3 个连续换行（2 个空行）  -> 段落分隔 + 1 个保留的空行
 *   - 4 个连续换行（3 个空行）  -> 段落分隔 + 2 个保留的空行，依此类推
 * 注意：<br> 单独成行会被 remark 识别为 HTML 块而原样输出，因此只把第 3 个及以上的换行替换为 <br>。
 * 围栏代码块（``` 或 ~~~）内部不处理，避免破坏代码原文的空行。
 *
 * @param markdown 原始 Markdown 文本
 * @returns 处理后的 Markdown 文本
 */
function preserveBlankLines(markdown: string): string {
    const lines = markdown.split('\n');

    let inFence = false;
    let fenceChar = '';
    let fenceLen = 0;
    let blankRun = 0; // 当前连续空行数（仅统计段间空行）
    let lastWasBr = false; // 上一行是否为注入的保留空行 <br>

    const result: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
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
            blankRun = 0;
            lastWasBr = false;
            result.push(line);
            continue;
        }

        // 围栏代码块内部不做任何处理
        if (inFence) {
            result.push(line);
            continue;
        }

        if (trimmed === '') {
            blankRun++;
            // 第 1 个空行是正常段落分隔（2 个换行），第 2 个起保留为空行
            if (blankRun >= 2) {
                result.push('<br>');
                lastWasBr = true;
            } else {
                result.push('');
            }
        } else {
            blankRun = 0;
            // 保留的空行（<br>）之后必须补一个空行，否则紧随其后的内容会被
            // remark 视为上一行的延续（吞并进 <br> 所在的块）而非独立段落
            if (lastWasBr) {
                result.push('');
                lastWasBr = false;
            }
            result.push(line);
        }
    }

    return result.join('\n');
}

export async function parseMarkdownHast(
    markdown: string,
    filePath = '',
    lite?: boolean,
    idPrefix = ''
): Promise<{ tree: any; headings: FlatHeading[]; frontmatter?: Record<string, any>; stringify: (node: any) => string }> {
    // 未显式指定时，按文档大小自动降级为精简模式
    const useLite = lite ?? markdown.length > LARGE_FILE_THRESHOLD;
    const processor = getProcessor(useLite);

    // 保留 3 个及以上连续换行产生的空行（2 个换行仍按段落分隔处理）
    const processedMarkdown = preserveBlankLines(markdown);

    const ctx: MarkdownContext = { filePath, idPrefix, headings: [] };
    const file = new VFile({ value: processedMarkdown, data: { markdownContext: ctx } });

    // mdast -> hast（元数据插件在此阶段填充 ctx）
    const tree = await processor.run(processor.parse(processedMarkdown), file);

    return {
        tree,
        headings: ctx.headings,
        frontmatter: ctx.frontmatter,
        stringify: (node: any) => processor.stringify(node, file)
    };
}

export async function parseMarkdownBlocks(
    markdown: string,
    filePath = '',
    lite?: boolean,
    idPrefix = ''
): Promise<MarkdownBlocksResult> {
    const { tree, headings, frontmatter, stringify } = await parseMarkdownHast(markdown, filePath, lite, idPrefix);

    // 按顶层块逐个序列化，得到可分批插入 DOM 的 HTML 片段
    const chunks: string[] = [];
    for (const child of (tree as any).children || []) {
        const chunkHtml = stringify(child);
        if (chunkHtml) {
            chunks.push(chunkHtml);
        }
    }

    // frontmatter 表格置于正文开头
    if (frontmatter) {
        chunks.unshift(buildFrontmatterHtml(frontmatter));
    }

    return {
        chunks,
        headings,
        frontmatter
    };
}

/**
 * 解析 Markdown 文本并生成完整 HTML、大纲和 frontmatter 数据
 * 适用于需要一次性拿到完整 HTML 的场景（如词典解析）；
 * 大文档的界面渲染请使用 parseMarkdownBlocks，避免生成巨大的中间字符串
 *
 * @param markdown 要解析的 Markdown 文本
 * @param filePath 文件路径，用于解析相对图片地址
 * @param lite 是否强制使用精简模式，默认按文档大小自动判断
 */
export async function parseMarkdown(
    markdown: string,
    filePath = '',
    lite?: boolean,
    idPrefix = ''
): Promise<MarkdownParseResult> {
    const result = await parseMarkdownBlocks(markdown, filePath, lite, idPrefix);
    return {
        html: result.chunks.join(''),
        outline: buildOutline(result.headings),
        frontmatter: result.frontmatter
    };
}

/**
 * 将嵌套的大纲结构转换为扁平数组
 * 便于在 UI 中渲染大纲列表
 *
 * @param outline 嵌套的大纲结构
 * @returns 扁平的大纲项数组
 */
export function flattenOutline(outline: OutlineItem[]): OutlineItem[] {
    const result: OutlineItem[] = [];

    function traverse(items: OutlineItem[]) {
        for (const item of items) {
            result.push(item);
            if (item.children && item.children.length > 0) {
                traverse(item.children);
            }
        }
    }

    traverse(outline);
    return result;
}

/**
 * 格式化 frontmatter 值为 HTML 安全的字符串
 * @param value 要格式化的值
 * @returns 格式化后的 HTML 字符串
 */
function formatFrontmatterValue(value: any): string {
    // 确保正确检测数组
    if (Array.isArray(value)) {
        return value.map(v => formatFrontmatterValue(v)).join(', ');
    } else if (value !== null && typeof value === 'object') {
        // 改进对象格式化，提供更好的可读性
        try {
            const entries = Object.entries(value);
            return entries.map(([key, val]) => `${key}: ${formatFrontmatterValue(val)}`).join('; ');
        } catch {
            return JSON.stringify(value);
        }
    } else if (value === null) {
        return 'null';
    }
    // 转换为字符串并确保HTML安全
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 平滑滚动到页面中指定 ID 的标题元素
 * 并为目标元素添加临时的背景色作为视觉反馈
 *
 * @param headingId 要滚动到的标题元素的 ID
 */
export function scrollToHeading(headingId: string) {
    const element = document.getElementById(headingId);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
        // 添加视觉反馈
        element.style.backgroundColor = '#fff3cd';
        setTimeout(() => {
            element.style.backgroundColor = '';
        }, 1000);
    } else {
        console.warn(`未找到标题元素: ${headingId}`);
    }
}