export type DetectedFileType = 'text' | 'image' | 'video' | 'pdf' | 'other';

const imageExtensions = new Set([
  'png','jpg','jpeg','gif','bmp','webp','svg','tiff','ico','avif'
]);

const videoExtensions = new Set([
  'mp4','webm','ogg','ogv','mov','m4v','avi','mkv'
]);

const pdfExtensions = new Set(['pdf']);

const textExtensions = new Set([
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
]);

export function getExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx === -1) return '';
  return name.slice(idx + 1).toLowerCase();
}

export function detectFileType(name: string): DetectedFileType {
  const ext = getExtension(name);
  if (imageExtensions.has(ext)) return 'image';
  if (videoExtensions.has(ext)) return 'video';
  if (pdfExtensions.has(ext)) return 'pdf';
  if (textExtensions.has(ext)) return 'text';
  return 'other';
}

export function isTextFile(name: string): boolean {
  return detectFileType(name) === 'text';
}

export function toFileUrl(absolutePath: string): string {
  // Properly encode the file path for URL use
  // Normalize path separators to / for URL
  const normalizedPath = absolutePath.replace(/\\/g, '/');
  
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
