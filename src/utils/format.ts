/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化日期
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * 计算文本字数（支持中英文）
 * @param text 要计算的文本
 * @returns 字数统计对象
 */
export function countText(text: string): { chars: number; words: number; chineseChars: number } {
  if (!text) {
    return { chars: 0, words: 0, chineseChars: 0 };
  }

  // 去除空白字符后的字符数
  const chars = text.replace(/\s/g, '').length;

  // 匹配中文字符
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;

  // 匹配英文单词（由字母组成的连续序列）
  const words = (text.match(/[a-zA-Z]+/g) || []).length;

  return { chars, words, chineseChars };
}

/**
 * 获取当前选中的文本
 */
export function getSelectedText(): string {
  return window.getSelection()?.toString() || '';
}

/**
 * 截断文本并添加省略号
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * 截短文本，确保查询词可见
 */
export function truncateTextWithQuery(text: string, maxLength: number, query: string): string {
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

/**
 * 读取文本文件内容并统计字符数
 * @param filePath 文件路径
 * @returns Promise<{ chars: number; words: number; chineseChars: number }>
 */
export async function getFileTextStats(filePath: string): Promise<{ chars: number; words: number; chineseChars: number }> {
  try {
    if (window.electronAPI && window.electronAPI.readFile) {
      const content = await window.electronAPI.readFile(filePath);
      return countText(content);
    } else {
      // 浏览器环境下的模拟
      console.warn('浏览器环境下无法读取文件内容');
      return { chars: 0, words: 0, chineseChars: 0 };
    }
  } catch (error) {
    console.error('读取文件内容失败:', error);
    return { chars: 0, words: 0, chineseChars: 0 };
  }
}