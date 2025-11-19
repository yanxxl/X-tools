export function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatDate(ms: number): string {
  try {
    return new Date(ms).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch {
    return '-';
  }
}

/**
 * 计算文本字数（支持中英文）
 * 中文字符按1个字计算，英文单词按空格分隔计算
 * @param text 要计算字数的文本
 * @returns 字数统计结果
 */
export function countText(text: string): number {
  if (!text) return 0;
  // 移除空白字符后计算字数，中文字符按1个字计算，英文单词按空格分隔计算
  const trimmedText = text.trim();
  if (!trimmedText) return 0;
  
  // 统计中文字符数
  const chineseChars = (trimmedText.match(/[\u4e00-\u9fa5]/g) || []).length;
  // 统计英文单词数（非中文字符的单词）
  const nonChineseText = trimmedText.replace(/[\u4e00-\u9fa5]/g, ' ');
  const englishWords = nonChineseText.trim() ? nonChineseText.trim().split(/\s+/).filter(word => word.length > 0).length : 0;
  
  return chineseChars + englishWords;
}

/**
 * 获取当前选中的文本
 * @returns 选中的文本内容
 */
export function getSelectedText(): string {
  const selection = window.getSelection();
  return selection ? selection.toString() : '';
}

/**
 * 截断文本并添加省略号
 * @param text 原始文本
 * @param maxLength 最大长度
 * @returns 截断后的文本
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}