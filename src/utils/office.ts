/**
 * AST Utilities
 * 
 * This module contains utility functions for working with OfficeParserAST objects.
 * Each document type has its own specialized text conversion function for better control.
 */

import { OfficeParser } from '../office/OfficeParser';
import { OfficeParserAST, OfficeContentNode, OfficeParserConfig } from '../office/types';

/**
 * Parse an office document and return the AST (Abstract Syntax Tree)
 * This is a convenience wrapper around OfficeParser.parseOffice with simplified interface
 * 
 * @param file - File path (string), Buffer, or ArrayBuffer containing the document
 * @param config - Optional configuration object for parsing
 * @returns A promise resolving to the parsed OfficeParserAST
 * 
 * @example
 * ```typescript
 * // Parse from file path
 * const ast = await parseOfficeDocument('document.docx');
 * 
 * // Parse from Buffer with configuration
 * const buffer = fs.readFileSync('document.pdf');
 * const ast = await parseOfficeDocument(buffer, {
 *   extractAttachments: true,
 *   ocr: true
 * });
 * 
 * // Convert to Markdown
 * const markdown = wordToMarkdown(ast);
 * ```
 */
const parseOfficeDocument = async (
    file: string | Buffer | ArrayBuffer,
    config?: OfficeParserConfig
): Promise<OfficeParserAST> => {
    return OfficeParser.parseOffice(file, config);
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
const excelToMarkdown = (ast: OfficeParserAST, delimiter = '\n'): string => {
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
const powerpointToMarkdown = (ast: OfficeParserAST, delimiter = '\n'): string => {
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
 * PDF-specific text conversion to Markdown format
 * 
 * PDF AST structure contains pages with headings, paragraphs, text, and images.
 * This function converts the PDF content to well-formatted Markdown with proper
 * heading levels, paragraph separation, and image references.
 */
const pdfToMarkdown = (ast: OfficeParserAST, delimiter = '\n'): string => {
    let markdown = '';
    let pageCounter = 0;

    const processNode = (node: OfficeContentNode, indentLevel = 0): string => {
        let content = '';
        const indent = '  '.repeat(indentLevel);

        switch (node.type) {
            case 'page':
                pageCounter++;
                content += `${indent}## 第 ${pageCounter} 页${delimiter}${delimiter}`;

                if (node.children) {
                    node.children.forEach(child => {
                        content += processNode(child, indentLevel + 1);
                    });
                }
                content += delimiter; // Add extra space between pages
                break;

            case 'heading': {
                const level = node.metadata && 'level' in node.metadata ? (node.metadata as any).level : 1;
                // 合理调整标题层级：页面是H2，页面内标题从H3开始
                const headingLevel = Math.min(Math.max(level, 1) + 1, 6); // 确保至少H3，最大H6
                const headingMark = '#'.repeat(headingLevel);
                content += `${indent}${headingMark} ${node.text || ''}${delimiter}${delimiter}`;

                // 标题的子节点通常只包含标题文本的格式化信息，不需要重复处理
                // 避免标题文本在正文中重复出现
                break;
            }

            case 'paragraph': {
                if (node.children) {
                    const paragraphText = node.children
                        .map(child => processNode(child, 0))
                        .join('')
                        .trim();

                    if (paragraphText) {
                        content += `${indent}${paragraphText}${delimiter}${delimiter}`;
                    }
                } else if (node.text && node.text.trim()) {
                    content += `${indent}${node.text.trim()}${delimiter}${delimiter}`;
                }
                break;
            }

            case 'text': {
                let textContent = node.text || '';

                // Apply text formatting
                if (node.formatting) {
                    if (node.formatting.bold) {
                        textContent = `**${textContent}**`;
                    }
                    if (node.formatting.italic) {
                        textContent = `*${textContent}*`;
                    }
                }

                // Handle links
                if (node.metadata && 'link' in node.metadata) {
                    const linkMetadata = node.metadata as any;
                    if (linkMetadata.link) {
                        textContent = `[${textContent}](${linkMetadata.link})`;
                    }
                }

                content += textContent;
                break;
            }

            case 'image': {
                const imageText = node.text || '图片';
                const imageMetadata = node.metadata as any;
                const attachmentName = imageMetadata?.attachmentName || 'image';

                content += `${indent}![${imageText}](${attachmentName})${delimiter}`;

                if (node.text && node.text.trim()) {
                    content += `${indent}*${node.text.trim()}*${delimiter}`;
                }
                content += delimiter;
                break;
            }

            default:
                // Handle other node types recursively
                if (node.children) {
                    node.children.forEach(child => {
                        content += processNode(child, indentLevel);
                    });
                } else if (node.text && node.text.trim()) {
                    content += `${indent}${node.text.trim()}${delimiter}`;
                }
                break;
        }

        return content;
    };

    // Process all content nodes
    ast.content.forEach(node => {
        markdown += processNode(node);
    });

    // Add attachments section at the end
    if (ast.attachments && ast.attachments.length > 0) {
        markdown += `${delimiter}# 附件${delimiter}${delimiter}`;

        ast.attachments.forEach((attachment, index) => {
            markdown += `${index + 1}. **${attachment.name}**`;
            if (attachment.mimeType) {
                markdown += ` (${attachment.mimeType})`;
            }
            markdown += delimiter;

            if (attachment.ocrText) {
                markdown += `   *OCR文本: ${attachment.ocrText}*${delimiter}`;
            }
        });
    }

    return markdown.trim();
};

/**
 * Word-specific Markdown conversion
 * Converts Word document AST to well-formatted Markdown with proper structure
 */
const wordToMarkdown = (ast: OfficeParserAST, delimiter = '\n'): string => {
    let markdown = '';
    let currentListLevel = -1;
    let currentListType: 'ordered' | 'unordered' = 'unordered';

    const processNode = (node: OfficeContentNode, indentLevel = 0): string => {
        let content = '';
        const indent = '  '.repeat(indentLevel);

        switch (node.type) {
            case 'heading': {
                const level = node.metadata && 'level' in node.metadata ? (node.metadata as any).level : 1;
                const headingLevel = Math.min(Math.max(level, 1), 6); // Ensure H1-H6
                const headingMark = '#'.repeat(headingLevel);

                // Reset list state when encountering a heading
                currentListLevel = -1;

                content += `${indent}${headingMark} ${node.text || ''}${delimiter}${delimiter}`;
                break;
            }

            case 'paragraph': {
                // Reset list state when encountering a regular paragraph
                currentListLevel = -1;

                // Check if this paragraph might be a heading based on formatting
                const isPotentialHeading = checkIfHeadingByFormatting(node);
                
                if (isPotentialHeading) {
                    // Treat as H2 heading if it looks like a heading
                    content += `${indent}## ${node.text || ''}${delimiter}${delimiter}`;
                } else if (node.children) {
                    const paragraphText = node.children
                        .map(child => processNode(child, 0))
                        .join('')
                        .trim();

                    if (paragraphText) {
                        content += `${indent}${paragraphText}${delimiter}${delimiter}`;
                    }
                } else if (node.text && node.text.trim()) {
                    content += `${indent}${node.text.trim()}${delimiter}${delimiter}`;
                }
                break;
            }

            case 'list': {
                const listMetadata = node.metadata as any;
                const listType = listMetadata?.listType || 'unordered';
                const listLevel = listMetadata?.indentation || 0;
                const itemIndex = listMetadata?.itemIndex || 0;

                // Handle list indentation and type changes
                if (listLevel !== currentListLevel || listType !== currentListType) {
                    // Start a new list or change list type/level
                    if (currentListLevel >= 0) {
                        content += delimiter; // Add space between different lists
                    }
                    currentListLevel = listLevel;
                    currentListType = listType;
                }

                // Process list item content
                const listPrefix = listType === 'ordered' ? `${itemIndex + 1}.` : '-';
                const itemIndent = '  '.repeat(listLevel);
                const itemText = node.children
                    ? node.children.map(child => processNode(child, 0)).join('').trim()
                    : node.text || '';

                if (itemText) {
                    content += `${itemIndent}${listPrefix} ${itemText}${delimiter}`;
                }
                break;
            }

            case 'table': {
                if (node.children) {
                    const tableData: string[][] = [];

                    // Extract table data
                    node.children.forEach(row => {
                        if (row.type === 'row' && row.children) {
                            const rowData: string[] = [];
                            row.children.forEach(cell => {
                                if (cell.type === 'cell' && cell.children) {
                                    const cellText = cell.children
                                        .map(child => processNode(child, 0))
                                        .join('')
                                        .trim();
                                    rowData.push(cellText || '');
                                }
                            });
                            tableData.push(rowData);
                        }
                    });

                    if (tableData.length > 0) {
                        // Create Markdown table
                        const header = tableData[0];
                        const separator = header.map(() => '---').join(' | ');

                        content += `${indent}| ${header.join(' | ')} |${delimiter}`;
                        content += `${indent}| ${separator} |${delimiter}`;

                        for (let i = 1; i < tableData.length; i++) {
                            content += `${indent}| ${tableData[i].join(' | ')} |${delimiter}`;
                        }
                        content += delimiter;
                    }
                }
                break;
            }

            case 'text': {
                let textContent = node.text || '';

                // Apply text formatting
                if (node.formatting) {
                    if (node.formatting.bold) {
                        textContent = `**${textContent}**`;
                    }
                    if (node.formatting.italic) {
                        textContent = `*${textContent}*`;
                    }
                    if (node.formatting.underline) {
                        textContent = `<u>${textContent}</u>`;
                    }
                    if (node.formatting.strikethrough) {
                        textContent = `~~${textContent}~~`;
                    }
                }

                // Handle links
                if (node.metadata && 'link' in node.metadata) {
                    const linkMetadata = node.metadata as any;
                    if (linkMetadata.link) {
                        textContent = `[${textContent}](${linkMetadata.link})`;
                    }
                }

                content += textContent;
                break;
            }

            case 'image': {
                const imageText = node.text || '图片';
                const imageMetadata = node.metadata as any;
                const attachmentName = imageMetadata?.attachmentName || 'image';

                content += `${indent}![${imageText}](${attachmentName})${delimiter}`;

                if (node.text && node.text.trim()) {
                    content += `${indent}*${node.text.trim()}*${delimiter}`;
                }
                content += delimiter;
                break;
            }

            default:
                // Handle other node types recursively
                if (node.children) {
                    node.children.forEach(child => {
                        content += processNode(child, indentLevel);
                    });
                } else if (node.text && node.text.trim()) {
                    content += `${indent}${node.text.trim()}${delimiter}`;
                }
                break;
        }

        return content;
    };

    // Process all content nodes
    ast.content.forEach(node => {
        markdown += processNode(node);
    });

    // Add attachments section at the end
    if (ast.attachments && ast.attachments.length > 0) {
        markdown += `${delimiter}# 附件${delimiter}${delimiter}`;

        ast.attachments.forEach((attachment, index) => {
            markdown += `${index + 1}. **${attachment.name}**`;
            if (attachment.mimeType) {
                markdown += ` (${attachment.mimeType})`;
            }
            markdown += delimiter;

            if (attachment.ocrText) {
                markdown += `   *OCR文本: ${attachment.ocrText}*${delimiter}`;
            }
        });
    }

    return markdown.trim();
};

/**
 * Check if a node might be a heading based on formatting characteristics
 * This is a fallback for when Word documents don't use proper heading styles
 */
const checkIfHeadingByFormatting = (node: OfficeContentNode): boolean => {
    // Skip empty nodes
    const text = node.text || '';
    if (!text.trim()) {
        return false;
    }
    
    // Check if this node has a style that indicates it's a heading
    // Based on the AST analysis, styles '2' and '3' are used for headings
    const hasHeadingStyle = node.metadata && 
                           'style' in node.metadata && 
                           typeof (node.metadata as any).style === 'string' &&
                           ['2', '3'].includes((node.metadata as any).style);
    
    if (hasHeadingStyle) {
        return true;
    }
    
    // Check if all text is bold AND has larger font size (common for headings)
    const isAllBold = checkIfAllTextIsBold(node);
    const hasLargeFont = checkIfHasLargeFont(node);
    
    // Only treat as heading if it's bold AND has large font size
    // This prevents normal bold text from being mistaken for headings
    if (isAllBold && hasLargeFont) {
        return true;
    }
    
    // Additional checks for specific heading patterns
    const isShortText = text.length > 0 && text.length < 20; // More restrictive
    const containsHeadingKeywords = /^(示例|标题|章节|第[一二三四五六七八九十]+[章节条页]|\d+\.)/.test(text.trim());
    
    // Only use keyword matching if it's also bold and short
    return isShortText && containsHeadingKeywords && isAllBold;
};

/**
 * Check if all text in a node is bold
 */
const checkIfAllTextIsBold = (node: OfficeContentNode): boolean => {
    if (node.formatting && node.formatting.bold) {
        return true;
    }
    
    if (node.children) {
        return node.children.every(child => checkIfAllTextIsBold(child));
    }
    
    return false;
};

/**
 * Check if a node has large font size (indicating it might be a heading)
 */
const checkIfHasLargeFont = (node: OfficeContentNode): boolean => {
    // Check if this node has a large font size
    if (node.formatting && node.formatting.size) {
        const sizeMatch = node.formatting.size.match(/(\d+)/);
        if (sizeMatch) {
            const size = parseInt(sizeMatch[1]);
            // Consider 14pt or larger as "large" font (headings are typically larger)
            return size >= 14;
        }
    }
    
    // Check children recursively
    if (node.children) {
        return node.children.some(child => checkIfHasLargeFont(child));
    }
    
    return false;
};

/**
 * Extract plain text from AST nodes recursively
 * Used as fallback for document types without specific converters
 */
const extractTextFromAST = (node: OfficeContentNode, delimiter = '\n'): string => {
    if (node.children) {
        return node.children.map(child => extractTextFromAST(child, delimiter)).join(delimiter);
    }
    return node.text || '';
};

/**
 * Convert AST to plain text for unsupported document types
 * This serves as the default fallback converter
 */
const defaultToText = (ast: OfficeParserAST, delimiter = '\n'): string => {
    return ast.content
        .map(node => extractTextFromAST(node, delimiter))
        .filter(t => t !== '')
        .join(delimiter);
};

/**
 * Universal text conversion function that routes to the appropriate converter
 * based on the document type
 */
const astToText = (ast: OfficeParserAST, delimiter = '\n'): string => {
    switch (ast.type) {
        case 'xlsx':
            return excelToMarkdown(ast, delimiter);
        case 'pptx':
            return powerpointToMarkdown(ast, delimiter);
        case 'pdf':
            return pdfToMarkdown(ast, delimiter);
        case 'docx':
            return wordToMarkdown(ast, delimiter);
        default: {
            // Fallback for other document types
            return defaultToText(ast, delimiter);
        }
    }
};

/**
 * Universal JSON conversion function that routes to the appropriate converter
 * based on the document type
 */
const astToJson = (ast: OfficeParserAST): any => {
    switch (ast.type) {
        case 'xlsx':
            return excelToJson(ast);
        case 'pptx':
            return powerpointToJson(ast);
        default:
            return ast;
    }
};

// Export the functions
export {
    parseOfficeDocument,
    excelToJson,
    excelToMarkdown,
    powerpointToJson,
    powerpointToMarkdown,
    pdfToMarkdown,
    wordToMarkdown,
    defaultToText,
    astToText,
    astToJson
};

