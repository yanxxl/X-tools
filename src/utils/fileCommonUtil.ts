// =======================================
// 类型定义
// =======================================
export type DetectedFileType = 'text' | 'image' | 'video' | 'pdf' | 'other';

// =======================================
// 常量定义
// =======================================

// 文件扩展名集合
const FILE_EXTENSIONS = {
  // 图片文件扩展名
  IMAGE: new Set([
    'png','jpg','jpeg','gif','bmp','webp','svg','tiff','ico','avif'
  ]),
  
  // 视频文件扩展名
  VIDEO: new Set([
    'mp4','webm','ogg','ogv','mov','m4v','avi','mkv'
  ]),
  
  // PDF文件扩展名
  PDF: new Set(['pdf']),
  
  // 文本文件扩展名
  TEXT: new Set([
    'txt','md','json','log','csv','tsv','ini','conf','cfg','env','yaml','yml','xml',
    'html','htm','css','scss','less',
    'js','jsx','ts','tsx',
    'py','rb','go','rs','java','kt','swift','c','h','cpp','hpp','cs','php','sh','bat','ps1',
    // 字幕文件
    'srt','ass','ssa','sub','vtt',
    // 其他程序文件
    'lua','pl','pm','tcl','sql','r','dart','scala','groovy','gradle',
    // 文档标记语言
    'tex','bib',
    // 配置和数据文件
    'toml','tf','tfvars','proto','graphql','gql',
    // 脚本文件
    'awk','sed',
    // 函数式编程语言
    'hs','lhs','elm','erl','hrl','ex','exs','fs','fsx',
    // 输出文件
    'out'
  ])
};

// 文件类型显示名称映射
const FILE_TYPE_DISPLAY_NAMES: Record<DetectedFileType, string> = {
  text: '文本文件',
  image: '图片文件',
  video: '视频文件',
  pdf: 'PDF文件',
  other: '其他文件'
};

// =======================================
// 文件类型检测
// =======================================

/**
 * 获取文件扩展名（小写）
 * @param name 文件名或路径
 */
export function getExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  // 处理隐藏文件（以.开头的文件）
  const fileName = fullname(name);
  if (idx === -1 || fileName.startsWith('.')) return '';
  return name.slice(idx + 1).toLowerCase();
}

/**
 * 检测文件类型
 * @param name 文件名或路径
 */
export function detectFileType(name: string): DetectedFileType {
  const ext = getExtension(name);
  if (FILE_EXTENSIONS.IMAGE.has(ext)) return 'image';
  if (FILE_EXTENSIONS.VIDEO.has(ext)) return 'video';
  if (FILE_EXTENSIONS.PDF.has(ext)) return 'pdf';
  if (FILE_EXTENSIONS.TEXT.has(ext)) return 'text';
  return 'other';
}

/**
 * 判断是否为文本文件
 * @param name 文件名或路径
 */
export function isTextFile(name: string): boolean {
  return detectFileType(name) === 'text';
}

/**
 * 判断是否为图片文件
 * @param name 文件名或路径
 */
export function isImageFile(name: string): boolean {
  return detectFileType(name) === 'image';
}

/**
 * 判断是否为视频文件
 * @param name 文件名或路径
 */
export function isVideoFile(name: string): boolean {
  return detectFileType(name) === 'video';
}

/**
 * 判断是否为PDF文件
 * @param name 文件名或路径
 */
export function isPdfFile(name: string): boolean {
  return detectFileType(name) === 'pdf';
}

// =======================================
// 路径处理
// =======================================

/**
 * 获取目录名
 * @param filePath 文件路径
 */
export function dirname(filePath: string): string {
  // 处理不同平台的路径分隔符
  const parts = filePath.split(/[/\\]/);
  parts.pop();
  return parts.join('/');
}

/**
 * 拼接路径
 * @param paths 路径片段
 */
export function join(...paths: string[]): string {
  // 处理不同平台的路径分隔符
  const normalizedPaths = paths.map(path => path.replace(/\\/g, '/'));
  return normalizedPaths.join('/');
}

/**
 * 获取文件名或文件夹名
 * @param filePath 文件或文件夹路径
 */
export function fullname(filePath: string): string {
  // 移除末尾的路径分隔符
  const normalizedPath = filePath.replace(/[/\\]+$/, '');
  const parts = normalizedPath.split(/[/\\]/);
  return parts[parts.length - 1];
}

/**
 * 获取文件名（不包含扩展名）
 * @param filePath 文件路径
 */
export function name(filePath: string): string {
  const filename = fullname(filePath);
  const idx = filename.lastIndexOf('.');
  if (idx === -1) return filename;
  return filename.slice(0, idx);
}

/**
 * 规范化路径分隔符
 * @param filePath 文件路径
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * 转换为文件URL
 * @param absolutePath 绝对路径
 */
export function toFileUrl(absolutePath: string): string {
  // Normalize path separators to / for URL
  const normalizedPath = normalizePath(absolutePath);
  
  // Handle Windows drive letters (e.g., C:) by adding three slashes
  // and not encoding the drive letter colon
  if (normalizedPath.match(/^[A-Za-z]:\//)) {
    const driveLetter = normalizedPath.substring(0, 2); // e.g., "C:"
    const restOfPath = normalizedPath.substring(2); // e.g., "/Users/..."
    const encodedRest = restOfPath.split('/').map(encodeURIComponent).join('/');
    return `file:///${driveLetter}${encodedRest}`;
  }
  
  // For non-Windows paths or paths without drive letters
  return `file://${normalizedPath.split('/').map(encodeURIComponent).join('/')}`;
}

// =======================================
// 文件信息格式化
// =======================================

/**
 * 格式化文件大小
 * @param bytes 字节数
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  if (i === 0) {
    // 如果是字节单位，不显示小数
    return `${bytes} ${sizes[i]}`;
  } else {
    // 其他单位保留两位小数
    const size = (bytes / Math.pow(k, i)).toFixed(2);
    return `${size} ${sizes[i]}`;
  }
}

// =======================================
// 文本处理
// =======================================

/**
 * 截断文本
 * @param text 原始文本
 * @param maxLength 最大长度
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * 截短文本，确保查询词可见
 * @param text 原始文本
 * @param maxLength 最大长度
 * @param query 查询词
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

// =======================================
// 文件操作辅助
// =======================================

/**
 * 判断是否为隐藏文件（以.开头）
 * @param name 文件名
 */
export function isHiddenFile(name: string): boolean {
  return name.startsWith('.');
}

/**
 * 获取文件类型的显示名称
 * @param type 文件类型
 */
export function getFileTypeDisplayName(type: DetectedFileType): string {
  return FILE_TYPE_DISPLAY_NAMES[type] || '未知文件';
}
