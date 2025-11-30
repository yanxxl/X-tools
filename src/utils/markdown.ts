import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkGemoji from 'remark-gemoji';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeMermaid from 'rehype-mermaid';
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
 * 生成锚点 ID
 * 将标题文本转换为唯一的 HTML 锚点 ID
 * @param text 标题文本
 * @param existingIds 已存在的 ID 集合，用于确保 ID 唯一性
 * @returns 生成的唯一锚点 ID
 */
function generateAnchorId(text: string, existingIds: Set<string> = new Set()): string {
    const baseId = text
            .toLowerCase()
            .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
        || 'heading';

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
 * 解析 Markdown 文本并生成 HTML、大纲和 frontmatter 数据
 * 使用 remark.js 生态系统处理 Markdown，支持 frontmatter、GitHub 风格 Markdown 和代码高亮
 *
 * @param markdown 要解析的 Markdown 文本
 * @returns 包含 HTML、大纲和 frontmatter 的解析结果
 */
export async function parseMarkdown(markdown: string, filePath = ''): Promise<MarkdownParseResult> {
    const outline: OutlineItem[] = [];       // 存储文档大纲
    const stack: OutlineItem[] = [];         // 用于构建大纲树结构的栈
    const existingIds = new Set<string>();   // 用于存储已生成的锚点 ID，确保唯一性
    let frontmatter: Record<string, any> | undefined; // 存储解析出的 frontmatter 数据

    // 创建 remark 处理器，使用统一的管道处理 Markdown
    const processor = unified()
        .use(remarkParse) // 解析 Markdown
        .use(remarkBreaks) // 支持单换行作为硬换行
        .use(remarkFrontmatter) // 支持 frontmatter
        .use(remarkGfm) // 支持 GitHub 风格 Markdown（表格、删除线、任务列表、自动链接等）
        .use(remarkGemoji) // 支持 GitHub 表情符号
        .use(remarkMath) // 支持数学公式
        .use(() => (tree: any) => {
            // 提取 frontmatter 内容
            visit(tree, 'yaml', (node) => {
                try {
                    frontmatter = yaml.parse(node.value);
                } catch (error) {
                    console.error('解析 frontmatter 失败:', error);
                }
            });

            // 图片地址处理，本地文件，加上完整路径
            visit(tree, 'image', (node) => {
                try {
                    console.log('image', node.url, filePath);
                    if (!node.url.startsWith('http'))
                        node.url = "file://" + (filePath ? filePath.substring(0, filePath.lastIndexOf('/') + 1) : "") + node.url;
                    console.log('image now', node);
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
                        if (child.type === 'strong' || child.type === 'emphasis') {
                            return child.children.map((c: any) => c.value).join('');
                        }
                        return '';
                    })
                    .join('');

                const id = generateAnchorId(text, existingIds);
                const item: OutlineItem = {
                    id,
                    title: text,
                    level,
                    children: []
                };

                // 构建大纲树结构
                while (stack.length > 0 && stack[stack.length - 1].level >= level) {
                    stack.pop();
                }

                if (stack.length === 0) {
                    outline.push(item);
                } else {
                    stack[stack.length - 1].children.push(item);
                }

                stack.push(item);

                // 添加 id 属性到标题节点
                node.data = node.data || {};
                node.data.hProperties = node.data.hProperties || {};
                node.data.hProperties.id = id;
            });
        })
        .use(remarkRehype) // 将 Markdown 转换为 HTML
        .use(rehypeHighlight) // 添加代码高亮
        .use(rehypeMermaid) // 渲染 Mermaid 图表
        .use(rehypeKatex) // 数学公式渲染
        .use(rehypeStringify); // 将结果序列化为 HTML 字符串

    // 处理 Markdown 内容
    const result = await processor.process(markdown);
    let html = result.toString();

    // 如果存在 frontmatter，将其以简单格式附加到正文开头
    if (frontmatter) {
        try {
            // 创建简单的 frontmatter HTML 表格
            const frontmatterHtml = `
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
            html = frontmatterHtml + html;
        } catch (error) {
            console.error('格式化 frontmatter 失败:', error);
        }
    }

    return {
        html,
        outline,
        frontmatter
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