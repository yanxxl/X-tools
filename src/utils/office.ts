/**
 * AST Utilities
 * 
 * This module contains utility functions for working with OfficeParserAST objects.
 * Each document type has its own specialized text conversion function for better control.
 */

import { OfficeParserAST, OfficeContentNode, OfficeParserConfig } from '../office/types';

/**
 * Converts an OfficeParserAST to plain text based on document type.
 * 
 * This function routes to the appropriate specialized converter based on the document type.
 * 
 * @param ast - The AST to convert to text
 * @param delimiter - The delimiter to use for newlines (default: '\n')
 * @returns A plain text representation of the document
 */
export const astToText = (ast: OfficeParserAST, delimiter = '\n'): string => {
    switch (ast.type) {
        case 'xlsx':
            return excelToText(ast, delimiter);
        case 'pptx':
            return powerpointToText(ast, delimiter);
        case 'docx':
            return wordToText(ast, delimiter);
        case 'pdf':
            return pdfToText(ast, delimiter);
        case 'odt':
        case 'ods':
        case 'odp':
            return openDocumentToText(ast, delimiter);
        case 'rtf':
            return rtfToText(ast, delimiter);
        default:
            return genericToText(ast, delimiter);
    }
};

/**
 * Excel-specific text conversion with enhanced table formatting
 */
const excelToText = (ast: OfficeParserAST, delimiter = '\n'): string => {
    let sheetCounter = 0;
    
    const getText = (node: OfficeContentNode): string => {
        let text = '';
        
        // 特殊处理工作表（Excel中的表格）
        if (node.type === 'sheet' && node.children) {
            sheetCounter++;
            const sheetName = (node.metadata && 'sheetName' in node.metadata) ? node.metadata.sheetName : `工作表${sheetCounter}`;
            text += `## ${sheetName}${delimiter}`;
            
            // 从 rawContent 中提取工作表的总列数
            let totalCols = 0;
            if (node.rawContent) {
                const dimensionMatch = node.rawContent.match(/dimension ref="[A-Z]+(\d+):([A-Z]+)(\d+)"/);
                if (dimensionMatch) {
                    const endCol = dimensionMatch[2];
                    totalCols = endCol.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
                }
            }
            
            // 处理工作表的每一行
            node.children.forEach((row, rowIndex) => {
                if (row.type === 'row' && row.children) {
                    text += `### 行 ${rowIndex + 1}${delimiter}`;
                    
                    // 从行的 rawContent 中提取列范围
                    let rowTotalCols = totalCols;
                    if (row.rawContent) {
                        const spansMatch = row.rawContent.match(/spans="(\d+):(\d+)"/);
                        if (spansMatch) {
                            rowTotalCols = parseInt(spansMatch[2]);
                        }
                    }
                    
                    // 创建固定长度的数组来保存所有列的内容
                    const rowContent: string[] = Array(rowTotalCols).fill('');
                    
                    // 填充有内容的单元格
                    row.children.forEach(cell => {
                        if (cell.type === 'cell' && cell.metadata && 'col' in cell.metadata) {
                            const colIndex = (cell.metadata as any).col;
                            const cellText = getText(cell);
                            if (colIndex < rowTotalCols) {
                                rowContent[colIndex] = cellText || '';
                            }
                        }
                    });
                    
                    // 将行内容转换为列表格式
                    text += `[${rowContent.join(', ')}]${delimiter}`;
                }
            });
            
            text += delimiter; // 工作表后添加空行
            return text;
        }
        
        // 处理其他节点类型
        if (node.children) {
            text += node.children
                .map(getText)
                .filter(t => t !== '')
                .join(!node.children[0]?.children ? '' : delimiter);
        } else {
            text += node.text || '';
        }
        return text;
    };

    return ast.content
        .map(getText)
        .filter(t => t !== '')
        .join(delimiter);
};

/**
 * PowerPoint-specific text conversion
 */
const powerpointToText = (ast: OfficeParserAST, delimiter = '\n'): string => {
    let slideCounter = 0;
    
    const getText = (node: OfficeContentNode): string => {
        let text = '';
        
        // 幻灯片标题
         if (node.type === 'heading' && node.metadata && 'level' in node.metadata && node.metadata.level === 1) {
             slideCounter++;
             text += `## 幻灯片 ${slideCounter}: ${node.text}${delimiter}`;
             return text;
         }
        
        // 处理表格
        if (node.type === 'table' && node.children) {
            text += `### 表格${delimiter}`;
            
            node.children.forEach((row, rowIndex) => {
                if (row.type === 'row' && row.children) {
                    const rowContent: string[] = [];
                    row.children.forEach(cell => {
                        if (cell.type === 'cell') {
                            const cellText = getText(cell);
                            rowContent.push(cellText || '');
                        }
                    });
                    text += `行 ${rowIndex + 1}: [${rowContent.join(', ')}]${delimiter}`;
                }
            });
            
            text += delimiter;
            return text;
        }
        
        // 处理其他节点类型
        if (node.children) {
            text += node.children
                .map(getText)
                .filter(t => t !== '')
                .join(!node.children[0]?.children ? '' : delimiter);
        } else {
            text += node.text || '';
        }
        return text;
    };

    return ast.content
        .map(getText)
        .filter(t => t !== '')
        .join(delimiter);
};

/**
 * Word document text conversion
 */
const wordToText = (ast: OfficeParserAST, delimiter = '\n'): string => {
    const getText = (node: OfficeContentNode): string => {
        let text = '';
        
        // 标题处理
         if (node.type === 'heading') {
             const level = (node.metadata && 'level' in node.metadata) ? node.metadata.level : 1;
             const prefix = '#'.repeat(level) + ' ';
             text += prefix;
         }
        
        // 处理其他节点类型
        if (node.children) {
            text += node.children
                .map(getText)
                .filter(t => t !== '')
                .join(!node.children[0]?.children ? '' : delimiter);
        } else {
            text += node.text || '';
        }
        return text;
    };

    return ast.content
        .map(getText)
        .filter(t => t !== '')
        .join(delimiter);
};

/**
 * PDF document text conversion
 */
const pdfToText = (ast: OfficeParserAST, delimiter = '\n'): string => {
    return genericToText(ast, delimiter);
};

/**
 * OpenDocument format text conversion
 */
const openDocumentToText = (ast: OfficeParserAST, delimiter = '\n'): string => {
    return genericToText(ast, delimiter);
};

/**
 * RTF document text conversion
 */
const rtfToText = (ast: OfficeParserAST, delimiter = '\n'): string => {
    return genericToText(ast, delimiter);
};

/**
 * Generic text conversion for unsupported or simple document types
 */
const genericToText = (ast: OfficeParserAST, delimiter = '\n'): string => {
    const getText = (node: OfficeContentNode): string => {
        let text = '';
        if (node.children) {
            text += node.children
                .map(getText)
                .filter(t => t !== '')
                .join(!node.children[0]?.children ? '' : delimiter);
        } else {
            text += node.text || '';
        }
        return text;
    };

    return ast.content
        .map(getText)
        .filter(t => t !== '')
        .join(delimiter);
};
