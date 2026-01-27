import React, { useEffect, useState, useRef } from 'react';
import { Button, message, Tooltip, Select } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, TableOutlined, ReloadOutlined } from '@ant-design/icons';
import { OfficeAttachment } from '../../office/types';

const { Option } = Select;

interface XlsxViewerProps {
    path: string;
}

interface ExcelSheetData {
    name: string;
    metadata: Record<string, unknown>;
    rows: string[][];
    totalColumns: number;
}

interface ExcelJsonData {
    type: string;
    metadata: Record<string, unknown>;
    sheets: ExcelSheetData[];
    attachments: OfficeAttachment[];
}

export const XlsxViewer: React.FC<XlsxViewerProps> = ({ path }) => {
    const [spreadsheetData, setSpreadsheetData] = useState<ExcelJsonData | null>(null);
    const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
    const [zoomLevel, setZoomLevel] = useState(100);
    const [loading, setLoading] = useState(true);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // 解析 XLSX 文件
    useEffect(() => {
        const parseXlsx = async () => {
            setLoading(true);
            try {
                const contentJSON = await window.electronAPI.parseOffice(path, {
                    extractAttachments: true,
                    includeRawContent: true
                });
                setSpreadsheetData(contentJSON);
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

    // 渲染行数据
    const renderRow = (rowData: string[], rowIndex: number) => {
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
                {rowData.map((cellText, cellIndex) => (
                    <td
                        key={cellIndex}
                        style={{
                            border: '1px solid #e8e8e8',
                            padding: '4px 8px',
                            textAlign: 'left',
                            verticalAlign: 'top',
                            minWidth: '100px'
                        }}
                    >
                        {cellText || ''}
                    </td>
                ))}
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
    const renderSheetContent = (sheetData: ExcelSheetData) => {
        if (!sheetData.rows || sheetData.rows.length === 0) {
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

        // 计算最大列数
        const maxColumns = sheetData.totalColumns || Math.max(...sheetData.rows.map(row => row.length));

        return (
            <div style={{ overflow: 'auto', maxHeight: '100%' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    {renderHeader(maxColumns)}
                    <tbody>
                        {sheetData.rows.map((rowData, rowIndex) => renderRow(rowData, rowIndex))}
                    </tbody>
                </table>
            </div>
        );
    };

    // 渲染工作表图片
    const renderSheetImages = () => {
        if (!spreadsheetData || !spreadsheetData.attachments || spreadsheetData.attachments.length === 0) return null;

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
                    {spreadsheetData.attachments.map((image, index) => (
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

    if (!spreadsheetData || spreadsheetData.sheets.length === 0) {
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

    const currentSheet = spreadsheetData.sheets[currentSheetIndex];

    // 准备工作表选项
    const sheetOptions = spreadsheetData.sheets.map((sheet, index) => {
        const sheetName = sheet.name || `工作表 ${index + 1}`;
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
                            {currentSheet.name || `工作表 ${currentSheetIndex + 1}`}
                        </h2>
                    </div>

                    {/* 工作表内容 */}
                    {renderSheetContent(currentSheet)}

                    {/* 工作表图片 */}
                    {renderSheetImages()}
                </div>
            </div>
        </div>
    );
};
