/**
 * AST Utilities
 * 
 * This module contains utility functions for working with OfficeParserAST objects.
 * Each document type has its own specialized text conversion function for better control.
 */

import { OfficeParserAST, OfficeContentNode, OfficeParserConfig } from '../office/types';

/**
 * Converts an OfficeParserAST to structured JSON data based on document type.
 * 
 * This function provides structured data for frontend display and processing.
 * 
 * @param ast - The AST to convert to JSON
 * @returns A structured JSON representation of the document
 */
export const astToJson = (ast: OfficeParserAST): any => {
    switch (ast.type) {
        case 'xlsx':
            return excelToJson(ast);
        case 'pptx':
            return powerpointToJson(ast);
        case 'docx':
            return wordToJson(ast);
        case 'pdf':
            return pdfToJson(ast);
        case 'odt':
        case 'ods':
        case 'odp':
            return openDocumentToJson(ast);
        case 'rtf':
            return rtfToJson(ast);
        default:
            return genericToJson(ast);
    }
};

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
 * Excel-specific JSON conversion with simplified human-readable structure
 */
const excelToJson = (ast: OfficeParserAST): any => {
    const result = {
        type: ast.type,
        metadata: ast.metadata,
        sheets: [] as any[],
        attachments: ast.attachments || []
    };

    ast.content.forEach((sheetNode, sheetIndex) => {
        if (sheetNode.type === 'sheet' && sheetNode.children) {
            const sheetName = (sheetNode.metadata && 'sheetName' in sheetNode.metadata) 
                ? (sheetNode.metadata as any).sheetName 
                : `Sheet${sheetIndex + 1}`;
            
            // 从 rawContent 中提取工作表的总列数
            let totalCols = 0;
            if (sheetNode.rawContent) {
                const dimensionMatch = sheetNode.rawContent.match(/dimension ref="[A-Z]+(\d+):([A-Z]+)(\d+)"/);
                if (dimensionMatch) {
                    const endCol = dimensionMatch[2];
                    totalCols = endCol.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
                }
            }
            
            const sheetData = {
                name: sheetName,
                metadata: sheetNode.metadata,
                rows: [] as string[][],
                totalColumns: totalCols
            };
            
            // 处理工作表的每一行
            sheetNode.children.forEach((rowNode, rowIndex) => {
                if (rowNode.type === 'row' && rowNode.children) {
                    // 从行的 rawContent 中提取列范围
                    let rowTotalCols = totalCols;
                    if (rowNode.rawContent) {
                        const spansMatch = rowNode.rawContent.match(/spans="(\d+):(\d+)"/);
                        if (spansMatch) {
                            rowTotalCols = parseInt(spansMatch[2]);
                        }
                    }
                    
                    // 创建固定长度的数组来保存所有列的内容
                    const rowData: string[] = Array(rowTotalCols).fill('');
                    
                    // 填充有内容的单元格
                    rowNode.children.forEach(cellNode => {
                        if (cellNode.type === 'cell' && cellNode.metadata && 'col' in cellNode.metadata) {
                            const colIndex = (cellNode.metadata as any).col;
                            if (colIndex < rowTotalCols) {
                                // 内联提取单元格文本内容
                                const extractCellText = (node: OfficeContentNode): string => {
                                    if (node.children && node.children.length > 0) {
                                        return node.children.map(child => {
                                            if (child.type === 'text') {
                                                return child.text || '';
                                            }
                                            return extractCellText(child);
                                        }).join('');
                                    }
                                    return node.text || '';
                                };
                                
                                // 内联格式化Excel日期值
                                const formatExcelDate = (text: string, rawContent?: string): string => {
                                    const numValue = parseFloat(text);
                                    if (!isNaN(numValue)) {
                                        // 检查是否包含日期格式样式索引
                                        let hasDateStyle = false;
                                        if (rawContent) {
                                            // 使用正则表达式匹配样式索引 s="数字" 或 s=数字
                                            const styleMatch = rawContent.match(/s=(?:"|')?(\d+)(?:"|')?/);
                                            if (styleMatch) {
                                                const styleIndex = parseInt(styleMatch[1], 10);
                                                // 已知的日期样式索引列表 - 参考 XlsxViewer 的实现
                                                const dateStyleIndices = [1, 3]; // 可以根据需要添加更多
                                                hasDateStyle = dateStyleIndices.includes(styleIndex);
                                            }
                                        }
                                        
                                        // 只有当单元格有日期样式时才进行日期转换
                                        if (hasDateStyle) {
                                            // Excel epoch: December 30, 1899 (Windows)
                                            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                                            // 转换Excel序列号为JavaScript Date
                                            const date = new Date(excelEpoch.getTime() + numValue * 24 * 60 * 60 * 1000);
                                            
                                            // 确保日期有效
                                            if (!isNaN(date.getTime())) {
                                                // 格式化为 YYYY-MM-DD，确保日和月为两位数
                                                const year = date.getFullYear();
                                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                                const day = String(date.getDate()).padStart(2, '0');
                                                
                                                return `${year}-${month}-${day}`;
                                            }
                                        }
                                    }
                                    return text;
                                };
                                
                                const cellText = extractCellText(cellNode);
                                const formattedText = formatExcelDate(cellText, cellNode.rawContent);
                                rowData[colIndex] = formattedText;
                            }
                        }
                    });
                    
                    sheetData.rows.push(rowData);
                }
            });
            
            result.sheets.push(sheetData);
        }
    });

    return result;
};




/**
 * Excel-specific text conversion (基于 JSON 数据生成文本)
 */
const excelToText = (ast: OfficeParserAST, delimiter = '\n'): string => {
    const jsonData = excelToJson(ast);
    let text = '';
    
    jsonData.sheets.forEach((sheet: any, sheetIndex: number) => {
        text += `## ${sheet.name}${delimiter}`;
        
        sheet.rows.forEach((row: string[], rowIndex: number) => {
            text += `### 行 ${rowIndex + 1}${delimiter}`;
            
            // 将单元格内容转换为列表格式
            const rowContent = row.map(cell => cell || '');
            text += `[${rowContent.join(', ')}]${delimiter}`;
        });
        
        text += delimiter; // 工作表后添加空行
    });
    
    return text;
};

/**
 * PowerPoint-specific JSON conversion with simplified human-readable structure
 */
const powerpointToJson = (ast: OfficeParserAST): any => {
    const result = {
        type: ast.type,
        metadata: ast.metadata,
        slides: [] as any[],
        attachments: ast.attachments || []
    };

    const extractSlideData = (node: OfficeContentNode): any => {
        const slideData = {
            elements: [] as Array<{
                type: string;
                content: string | string[][];
                metadata?: any;
            }>
        };

        const processNode = (node: OfficeContentNode): void => {
            // 幻灯片标题
            if (node.type === 'heading') {
                slideData.elements.push({
                    type: 'title',
                    content: node.text || '',
                    metadata: node.metadata || {}
                });
            }
            
            // 处理表格
            if (node.type === 'table' && node.children) {
                const tableData: string[][] = [];
                
                node.children.forEach((row) => {
                    if (row.type === 'row' && row.children) {
                        const rowData: string[] = [];
                        row.children.forEach(cell => {
                            if (cell.type === 'cell') {
                                const cellText = extractTextFromNode(cell);
                                rowData.push(cellText);
                            }
                        });
                        tableData.push(rowData);
                    }
                });
                
                slideData.elements.push({
                    type: 'table',
                    content: tableData,
                    metadata: { rows: tableData.length, columns: tableData[0]?.length || 0 }
                });
                return;
            }
            
            // 处理段落
            if (node.type === 'paragraph') {
                const paragraphText = extractTextFromNode(node);
                if (paragraphText.trim()) {
                    slideData.elements.push({
                        type: 'paragraph',
                        content: paragraphText
                    });
                }
                return;
            }
            
            // 处理列表
            if (node.type === 'list') {
                const listItems = extractListItems(node);
                if (listItems.length > 0) {
                    slideData.elements.push({
                        type: 'list',
                        content: listItems.join('\n'),
                        metadata: { itemCount: listItems.length }
                    });
                }
                return;
            }
            
            // 处理图片
            if (node.type === 'image') {
                slideData.elements.push({
                    type: 'image',
                    content: node.text || '图片',
                    metadata: node.metadata
                });
                return;
            }
            
            // 处理其他节点类型
            if (node.children) {
                node.children.forEach(processNode);
            }
        };

        const extractTextFromNode = (node: OfficeContentNode): string => {
            if (node.children) {
                return node.children
                    .map(extractTextFromNode)
                    .filter(t => t !== '')
                    .join(' ');
            } else {
                return node.text || '';
            }
        };

        const extractListItems = (node: OfficeContentNode): string[] => {
            const items: string[] = [];
            
            if (node.children) {
                node.children.forEach(child => {
                    if (child.type === 'paragraph') {
                        const itemText = extractTextFromNode(child);
                        if (itemText.trim()) {
                            items.push(itemText);
                        }
                    }
                });
            }
            
            return items;
        };

        processNode(node);
        return slideData;
    };

    ast.content.forEach((node) => {
        const slideData = extractSlideData(node);
        result.slides.push(slideData);
    });

    return result;
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
 * Word document JSON conversion with simplified human-readable structure
 */
const wordToJson = (ast: OfficeParserAST): any => {
    const result = {
        type: ast.type,
        metadata: ast.metadata,
        paragraphs: [] as string[],
        headings: [] as {level: number, text: string}[],
        attachments: ast.attachments || []
    };

    const processNode = (node: OfficeContentNode): string => {
        let text = '';
        
        // 标题处理
        if (node.type === 'heading') {
            const level = (node.metadata && 'level' in node.metadata) ? node.metadata.level : 1;
            const headingText = node.text || '';
            result.headings.push({level, text: headingText});
            return '';
        }
        
        // 处理其他节点类型
        if (node.children) {
            text += node.children
                .map(processNode)
                .filter(t => t !== '')
                .join(' ');
        } else {
            text += node.text || '';
        }
        
        return text;
    };

    ast.content.forEach((node) => {
        const paragraphText = processNode(node);
        if (paragraphText) {
            result.paragraphs.push(paragraphText);
        }
    });

    return result;
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
 * PDF document JSON conversion with simplified human-readable structure
 */
const pdfToJson = (ast: OfficeParserAST): any => {
    const result = {
        type: ast.type,
        metadata: ast.metadata,
        pages: [] as string[],
        attachments: ast.attachments || []
    };

    const extractText = (node: OfficeContentNode): string => {
        let text = '';
        
        if (node.children) {
            text += node.children
                .map(extractText)
                .filter(t => t !== '')
                .join(' ');
        } else {
            text += node.text || '';
        }
        
        return text;
    };

    ast.content.forEach((node) => {
        const pageText = extractText(node);
        if (pageText) {
            result.pages.push(pageText);
        }
    });

    return result;
};

/**
 * PDF document text conversion
 */
const pdfToText = (ast: OfficeParserAST, delimiter = '\n'): string => {
    return genericToText(ast, delimiter);
};

/**
 * OpenDocument format JSON conversion with simplified human-readable structure
 */
const openDocumentToJson = (ast: OfficeParserAST): any => {
    const result = {
        type: ast.type,
        metadata: ast.metadata,
        content: [] as string[],
        attachments: ast.attachments || []
    };

    const extractText = (node: OfficeContentNode): string => {
        let text = '';
        
        if (node.children) {
            text += node.children
                .map(extractText)
                .filter(t => t !== '')
                .join(' ');
        } else {
            text += node.text || '';
        }
        
        return text;
    };

    ast.content.forEach((node) => {
        const contentText = extractText(node);
        if (contentText) {
            result.content.push(contentText);
        }
    });

    return result;
};

/**
 * OpenDocument format text conversion
 */
const openDocumentToText = (ast: OfficeParserAST, delimiter = '\n'): string => {
    return genericToText(ast, delimiter);
};

/**
 * RTF document JSON conversion with simplified human-readable structure
 */
const rtfToJson = (ast: OfficeParserAST): any => {
    const result = {
        type: ast.type,
        metadata: ast.metadata,
        paragraphs: [] as string[],
        attachments: ast.attachments || []
    };

    const extractText = (node: OfficeContentNode): string => {
        let text = '';
        
        if (node.children) {
            text += node.children
                .map(extractText)
                .filter(t => t !== '')
                .join(' ');
        } else {
            text += node.text || '';
        }
        
        return text;
    };

    ast.content.forEach((node) => {
        const paragraphText = extractText(node);
        if (paragraphText) {
            result.paragraphs.push(paragraphText);
        }
    });

    return result;
};

/**
 * RTF document text conversion
 */
const rtfToText = (ast: OfficeParserAST, delimiter = '\n'): string => {
    return genericToText(ast, delimiter);
};

/**
 * Generic JSON conversion for unsupported or simple document types
 */
const genericToJson = (ast: OfficeParserAST): any => {
    return {
        type: ast.type,
        metadata: ast.metadata,
        content: ast.content,
        attachments: ast.attachments || []
    };
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
