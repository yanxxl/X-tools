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
  'py','rb','go','rs','java','kt','swift','c','h','cpp','hpp','cs','php','sh','bat','ps1'
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
  return `file://${absolutePath.split('/').map(encodeURIComponent).join('/')}`;
}
