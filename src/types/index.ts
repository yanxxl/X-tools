import { OfficeAttachment } from '../office/types';

// ============================================================================
// 文件系统相关类型
// ============================================================================

/**
 * 文件树节点类型
 */
export interface FileNode {
    id: string;
    name: string;
    path: string;
    isDirectory: boolean;
    mtimeMs?: number;
    children?: FileNode[];
}

/**
 * 最近文件夹类型
 */
export interface RecentFolder {
    path: string;
    name: string;
    timestamp: number;
}

/**
 * 文件基本信息类型
 */
export interface FileInfo {
    path: string;
    name: string;
    ext: string;
    isDirectory: boolean;
    childrenCount: number;
    isText: boolean;
    size: number;
    atimeMs: number;
    mtimeMs: number;
    ctimeMs: number;
    birthtimeMs: number;
}

// ============================================================================
// 全局搜索相关类型
// ============================================================================

/**
 * 搜索匹配项类型
 */
export interface SearchMatch {
    line: number;
    content: string;
}

/**
 * 搜索结果类型
 */
export interface SearchResult {
    filePath: string;
    fileName: string;
    matches: SearchMatch[];
    lastModified?: number;
    searchTime?: number;
}

// ============================================================================
// Office文档JSON数据类型定义
// ============================================================================

/**
 * Office文档JSON数据的通用接口
 */
export interface BaseOfficeJsonData {
    type: string;
    metadata: Record<string, unknown>;
    attachments: OfficeAttachment[];
}

/**
 * Excel文档JSON数据
 */
export interface ExcelJsonData extends BaseOfficeJsonData {
    type: 'xlsx';
    sheets: {
        name: string;
        metadata: Record<string, unknown>;
        rows: string[][];
        totalColumns: number;
    }[];
}

/**
 * PowerPoint文档JSON数据
 */
export interface PowerPointJsonData extends BaseOfficeJsonData {
    type: 'pptx';
    slides: {
        elements: {
            type: string;
            content: string | string[][];
            metadata?: Record<string, unknown>;
        }[];
    }[];
}

/**
 * 其他Office文档JSON数据
 */
export interface OtherOfficeJsonData extends BaseOfficeJsonData {
    type: 'docx' | 'pdf' | 'odt' | 'odp' | 'ods' | 'rtf';
}

/**
 * Office文档JSON数据的联合类型
 */
export type OfficeJsonData = ExcelJsonData | PowerPointJsonData | OtherOfficeJsonData;