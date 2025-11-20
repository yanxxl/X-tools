import { marked } from 'marked';
import hljs from 'highlight.js';

// 大纲项接口
export interface OutlineItem {
  id: string;
  title: string;
  level: number;
  children: OutlineItem[];
}

// Markdown 解析结果接口
export interface MarkdownParseResult {
  html: string;
  outline: OutlineItem[];
}

// 配置 marked 选项
marked.setOptions({
  breaks: true,
  gfm: true,
});

// 生成锚点 ID
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

// 解析 Markdown 并生成大纲
export function parseMarkdown(markdown: string): MarkdownParseResult {
  // 自定义渲染器来处理标题
  const renderer = new marked.Renderer();
  const outline: OutlineItem[] = [];
  const stack: OutlineItem[] = [];
  const existingIds = new Set<string>();

  // 重写标题渲染方法
  renderer.heading = function(this: typeof marked.Renderer, { tokens, depth }: { tokens: any[], depth: number }) {
    const text = tokens.map((token: any) => token.text).join('');
    const level = depth;
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

    return `<h${level} id="${id}">${text}</h${level}>`;
  };

  // 重写代码块渲染方法以支持语法高亮
  renderer.code = function(this: typeof marked.Renderer, { text, lang }: { text: string, lang?: string }) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const highlighted = hljs.highlight(text, { language: lang }).value;
        return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
      } catch (err) {
        console.error('代码高亮失败:', err);
      }
    }
    const highlighted = hljs.highlightAuto(text).value;
    return `<pre><code class="hljs">${highlighted}</code></pre>`;
  };

  // 设置自定义渲染器
  marked.use({ renderer });

  // 解析 Markdown 为 HTML
  const html = marked.parse(markdown) as string;

  return {
    html,
    outline
  };
}

// 将大纲转换为扁平数组（用于渲染）
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

// 滚动到指定标题
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