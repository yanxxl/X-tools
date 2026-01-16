import React, { useEffect, useState, useRef } from 'react';
import { Button, message, Tooltip, Select } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, TableOutlined, ReloadOutlined } from '@ant-design/icons';
import { OfficeParserAST, OfficeContentNode, OfficeAttachment } from '../../office/types';

const { Option } = Select;

interface XlsxViewerProps {
    path: string;
}

export const XlsxViewer: React.FC<XlsxViewerProps> = ({ path }) => {
    const [spreadsheetData, setSpreadsheetData] = useState<OfficeParserAST | null>(null);
    const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
    const [zoomLevel, setZoomLevel] = useState(100);
    const [loading, setLoading] = useState(true);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // 解析 XLSX 文件
    useEffect(() => {
        const parseXlsx = async () => {
            setLoading(true);
            try {
                const contentAST = await window.electronAPI.parseOffice(path, {
                    extractAttachments: true,
                    includeRawContent: true
                });
                setSpreadsheetData(contentAST);
                setCurrentSheetIndex(0);
                setLoading(false);
            } catch (error) {
                console.error('解析 XLSX 文件失败:', error);
                message.error('解析 XLSX 文件失败');
                setLoading(false);
            }
        };

        parseXlsx();
    }, [path]);

    // 缩放控制函数
    const handleZoomIn = () => {
        setZoomLevel(prev => Math.min(prev + 10, 200));
    };

    const handleZoomOut = () => {
        setZoomLevel(prev => Math.max(prev - 10, 50));
    };

    // 获取当前工作表的图片
    const getSheetImages = (sheet: OfficeContentNode): OfficeAttachment[] => {
        if (!spreadsheetData) return [];
        
        const images: OfficeAttachment[] = [];
        
        // 递归查找工作表中的图片节点
        const findImages = (node: OfficeContentNode) => {
            if (node.type === 'image' && (node.metadata as any)?.attachmentName) {
                const image = spreadsheetData.attachments.find(att => att.name === (node.metadata as any)?.attachmentName);
                if (image) {
                    images.push(image);
                }
            }
            if (node.children) {
                node.children.forEach(findImages);
            }
        };
        
        findImages(sheet);
        return images;
    };

    // 检测并格式化Excel日期
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
                    // 已知的日期样式索引列表
                    const dateStyleIndices = [1, 3]; // 可以根据需要添加更多
                    hasDateStyle = dateStyleIndices.includes(styleIndex);
                }
            }
            
            // 检查数值是否在合理的日期范围内 (1900年到9999年对应的Excel序列号)
            // Excel日期：1900-01-01 = 1, 2000-01-01 = 36526, 2100-01-01 = 73012
            const isReasonableDate = numValue > 0 && numValue < 2958466; // 2958466 = 9999-12-31
            
            if (hasDateStyle || isReasonableDate) {
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

    // 渲染单元格内容
    const renderCellContent = (cell: OfficeContentNode) => {
        if (!cell.children || cell.children.length === 0) {
            return formatExcelDate(cell.text || '', cell.rawContent);
        }

        return (
            <div>
                {cell.children.map((child, index) => {
                    if (child.type === 'text') {
                        return (
                            <span
                                key={index}
                                style={{
                                    fontWeight: child.formatting?.bold ? 'bold' : 'normal',
                                    fontStyle: child.formatting?.italic ? 'italic' : 'normal',
                                    textDecoration: child.formatting?.underline ? 'underline' : 'none',
                                    color: child.formatting?.color || 'inherit',
                                    fontSize: child.formatting?.size || '14px',
                                    textAlign: child.formatting?.alignment || 'left',
                                    backgroundColor: child.formatting?.backgroundColor || 'transparent',
                                    fontFamily: child.formatting?.font || 'inherit'
                                }}
                            >
                                {formatExcelDate(child.text || '', cell.rawContent)}
                            </span>
                        );
                    }
                    return renderCellContent(child);
                })}
            </div>
        );
    };

    // 渲染行数据
    const renderRow = (row: OfficeContentNode, rowIndex: number) => {
        if (!row.children || row.children.length === 0) {
            return null;
        }

        return (
            <tr key={rowIndex} style={{ height: '40px' }}>
                <td
                    style={{
                        backgroundColor: '#fafafa',
                        border: '1px solid #e8e8e8',
                        padding: '4px 8px',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        minWidth: '40px',
                        position: 'sticky',
                        left: 0,
                        zIndex: 1
                    }}
                >
                    {rowIndex + 1}
                </td>
                {row.children.map((cell, cellIndex) => {
                    if (cell.type === 'cell') {
                        const cellMeta = cell.metadata as any;
                        return (
                            <td
                                key={cellIndex}
                                style={{
                                    border: '1px solid #e8e8e8',
                                    padding: '4px 8px',
                                    textAlign: cell.children?.[0]?.formatting?.alignment || 'left',
                                    verticalAlign: 'top',
                                    minWidth: '100px'
                                }}
                            >
                                {renderCellContent(cell)}
                            </td>
                        );
                    }
                    return null;
                })}
            </tr>
        );
    };

    // 渲染表头
    const renderHeader = (maxColumns: number) => {
        const columns = [];
        for (let i = 0; i < maxColumns; i++) {
            // 生成列名：A, B, C, ..., Z, AA, AB, ...
            let columnName = '';
            let num = i;
            while (num >= 0) {
                columnName = String.fromCharCode(65 + (num % 26)) + columnName;
                num = Math.floor(num / 26) - 1;
            }
            columns.push(columnName);
        }

        return (
            <thead>
                <tr>
                    <th
                        style={{
                            backgroundColor: '#fafafa',
                            border: '1px solid #e8e8e8',
                            padding: '4px 8px',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            minWidth: '40px',
                            position: 'sticky',
                            top: 0,
                            left: 0,
                            zIndex: 2
                        }}
                    />
                    {columns.map((columnName, index) => (
                        <th
                            key={index}
                            style={{
                                backgroundColor: '#fafafa',
                                border: '1px solid #e8e8e8',
                                padding: '4px 8px',
                                textAlign: 'center',
                                fontWeight: 'bold',
                                minWidth: '100px',
                                position: 'sticky',
                                top: 0,
                                zIndex: 1
                            }}
                        >
                            {columnName}
                        </th>
                    ))}
                </tr>
            </thead>
        );
    };

    // 渲染工作表内容
    const renderSheetContent = (sheet: OfficeContentNode) => {
        if (!sheet.children || sheet.children.length === 0) {
            return (
                <div style={{ 
                    height: '100%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: '#999' 
                }}>
                    工作表为空
                </div>
            );
        }

        // 过滤行节点
        const rows = sheet.children.filter(node => node.type === 'row');
        
        // 计算最大列数
        let maxColumns = 0;
        rows.forEach(row => {
            if (row.children) {
                const cellCount = row.children.filter(child => child.type === 'cell').length;
                maxColumns = Math.max(maxColumns, cellCount);
            }
        });

        return (
            <div style={{ overflow: 'auto', maxHeight: '100%' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    {renderHeader(maxColumns)}
                    <tbody>
                        {rows.map((row, rowIndex) => renderRow(row, rowIndex))}
                    </tbody>
                </table>
            </div>
        );
    };

    // 渲染工作表图片
    const renderSheetImages = (sheet: OfficeContentNode) => {
        const images = getSheetImages(sheet);
        if (images.length === 0) return null;

        return (
            <div style={{ 
                marginTop: '20px', 
                padding: '16px', 
                backgroundColor: '#fafafa', 
                borderRadius: '8px' 
            }}>
                <h3 style={{ marginBottom: '12px', fontSize: '16px', color: '#333' }}>
                    <TableOutlined style={{ marginRight: '8px' }} /> 图片
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {images.map((image, index) => (
                        <Tooltip key={index} title={image.altText || image.name}>
                            <div style={{ textAlign: 'center' }}>
                                <img 
                                    src={`data:${image.mimeType};base64,${image.data}`} 
                                    alt={image.altText || image.name} 
                                    style={{
                                        maxWidth: '100%',
                                        height: 'auto',
                                        borderRadius: '4px',
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                        objectFit: 'contain'
                                    }}
                                />
                            </div>
                        </Tooltip>
                    ))}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f5f5f5'
            }}>
                <div>加载中...</div>
            </div>
        );
    }

    if (!spreadsheetData || spreadsheetData.content.length === 0) {
        return (
            <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f5f5f5'
            }}>
                <div>无法解析电子表格内容</div>
            </div>
        );
    }

    const currentSheet = spreadsheetData.content[currentSheetIndex];
    const totalSheets = spreadsheetData.content.length;

    // 准备工作表选项
    const sheetOptions = spreadsheetData.content.map((sheet, index) => {
        const sheetName = (sheet.metadata as any)?.sheetName || `工作表 ${index + 1}`;
        return (
            <Option key={index} value={index}>
                <TableOutlined style={{ marginRight: '6px' }} /> {sheetName}
            </Option>
        );
    });

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* 顶部控制栏 */}
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid #e8e8e8',
                backgroundColor: '#fafafa',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* 工作表选择 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '500' }}>工作表：</span>
                        <Select
                            value={currentSheetIndex}
                            onChange={setCurrentSheetIndex}
                            style={{ width: '200px' }}
                            size="small"
                        >
                            {sheetOptions}
                        </Select>
                    </div>
                </div>
                
                {/* 缩放控制 - 移动到右侧并移除slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Button
                        type="text"
                        size="small"
                        onClick={handleZoomOut}
                        disabled={zoomLevel <= 50}
                        icon={<ZoomOutOutlined />}
                    />
                    <span style={{ minWidth: '50px', textAlign: 'center' }}>{zoomLevel}%</span>
                    <Button
                        type="text"
                        size="small"
                        onClick={handleZoomIn}
                        disabled={zoomLevel >= 200}
                        icon={<ZoomInOutlined />}
                    />
                    <Button
                        type="text"
                        size="small"
                        onClick={() => setZoomLevel(100)}
                        disabled={zoomLevel === 100}
                        icon={<ReloadOutlined />}
                    />
                </div>
            </div>

            {/* 工作表内容区域 */}
            <div 
                ref={tableContainerRef}
                style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: '20px',
                    backgroundColor: '#f0f2f5'
                }}
            >
                <div
                    style={{
                        transform: `scale(${zoomLevel / 100})`,
                        transformOrigin: 'top left',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        padding: '20px',
                        display: 'inline-block'
                    }}
                >
                    {/* 工作表标题 */}
                    <div style={{ 
                        marginBottom: '20px', 
                        paddingBottom: '12px', 
                        borderBottom: '1px solid #e8e8e8'
                    }}>
                        <h2 style={{ 
                            margin: 0, 
                            fontSize: '20px', 
                            color: '#333',
                            fontWeight: '500'
                        }}>
                            {(currentSheet.metadata as any)?.sheetName || `工作表 ${currentSheetIndex + 1}`}
                        </h2>
                    </div>

                    {/* 工作表内容 */}
                    {renderSheetContent(currentSheet)}

                    {/* 工作表图片 */}
                    {renderSheetImages(currentSheet)}
                </div>
            </div>
        </div>
    );
};
