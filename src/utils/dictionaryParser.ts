import { parseMarkdown } from './markdown';

/**
 * 词典接口
 */
export interface Dictionary {
    id: string;
    name: string;
    filePath: string;
    entries: DictionaryEntry[];
    enabled: boolean;
    error?: string; // 错误信息，可选
}

/**
 * 词条接口
 */
export interface DictionaryEntry {
    term: string;
    definition: Element[];
    catalog: string[];
    header: HTMLElement;
}

/**
 * 解析Markdown文件为词典
 * @param filePath 文件路径
 * @returns 词典对象
 */
export async function parseMarkdownToDictionary(filePath: string): Promise<Dictionary> {
    const fileName = filePath.split('/').pop() || filePath;
    const content = await window.electronAPI.readFile(filePath);
    
    // Parse markdown to HTML
    const result = await parseMarkdown(content, filePath);
    
    // Use DOM parser to extract headers and their content
    const parser = new DOMParser();
    const doc = parser.parseFromString(result.html, 'text/html');
    
    // Get all header elements
    const headers = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    // 构建header层次结构栈
    const headerStack: { level: number; element: HTMLElement; text: string }[] = [];
    const entries: DictionaryEntry[] = [];
    
    headers.forEach((headerElement) => {
        const header = headerElement as HTMLElement;
        const level = parseInt(header.tagName.charAt(1));
        const textContent = header.textContent?.trim() || '';
        
        // 使用非字符分割词条
        const terms = splitTerm(textContent);
        
        // 更新header层次栈
        updateHeaderStack(headerStack, level, header, textContent);
        
        // 获取当前词条的目录路径（所有更高层级的header文本）
        const catalog = headerStack.slice(0, -1).map(item => item.text);
        
        // Get content between this header and the next one
        let nextElement = header.nextElementSibling;
        const definition: Element[] = [];
        
        while (nextElement && !nextElement.tagName.match(/^H[1-6]$/)) {
            definition.push(nextElement.cloneNode(true) as Element);
            nextElement = nextElement.nextElementSibling;
        }
        
        // If no content found, look for child headers
        if (definition.length === 0 && nextElement) {
            const currentLevel = parseInt(header.tagName.charAt(1));
            const childHeaders: HTMLElement[] = [];
            
            // Collect all child headers (headers with higher level than current)
            let siblingElement = nextElement;
            while (siblingElement) {
                if (siblingElement.tagName.match(/^H[1-6]$/)) {
                    const siblingLevel = parseInt(siblingElement.tagName.charAt(1));
                    if (siblingLevel > currentLevel) {
                        childHeaders.push(siblingElement as HTMLElement);
                    } else if (siblingLevel <= currentLevel) {
                        // Stop when we reach a header with same or lower level
                        break;
                    }
                }
                siblingElement = siblingElement.nextElementSibling;
            }
            
            // If we found child headers, create a paragraph with them
            if (childHeaders.length > 0) {
                const paragraph = doc.createElement('p');
                paragraph.innerHTML = childHeaders.map(child => 
                    `<strong>${child.textContent || ''}</strong>`
                ).join('、');
                definition.push(paragraph);
            }
        }
        
        // 为每个分割后的词条创建一个条目
        terms.forEach(term => {
            entries.push({
                term,
                definition,
                catalog,
                header
            });
        });
    });
    
    return {
        id: filePath,
        name: fileName,
        filePath,
        entries,
        enabled: true
    };
}

/**
 * 使用非字符分割词条
 * @param text 要分割的文本
 * @returns 分割后的词条数组
 */
function splitTerm(text: string): string[] {
    // 使用非字符（如空格、标点等）分割文本
    // 使用更兼容的方式匹配中文字符、字母和数字
    return text
        .split(/[^\w\u4e00-\u9fa5]/) // 匹配非字母、数字和中文字符
        .filter(term => term.trim() !== ''); // 过滤空字符串
}

/**
 * 更新header层次栈
 * @param stack 当前header栈
 * @param level 当前header级别
 * @param header 当前header元素
 * @param text 当前header文本
 */
function updateHeaderStack(
    stack: { level: number; element: HTMLElement; text: string }[],
    level: number,
    header: HTMLElement,
    text: string
): void {
    // 移除栈中级别大于等于当前级别的header
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
    }
    
    // 添加当前header到栈中
    stack.push({ level, element: header, text });
}
