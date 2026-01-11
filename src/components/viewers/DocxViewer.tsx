import React, { useEffect, useRef, useState } from 'react';
import { message, Button, InputNumber, Splitter } from 'antd';
import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
// eslint-disable-next-line import/no-unresolved
import * as docxPreview from 'docx-preview';

// 大纲项类型定义
interface OutlineItem {
    text: string;
    level: number;
    id: string;
}

interface DocxViewerProps {
    path: string;
}

export const DocxViewer: React.FC<DocxViewerProps> = ({ path }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [outline, setOutline] = useState<OutlineItem[]>([]);
    const [zoomLevel, setZoomLevel] = useState<number>(100); // 缩放百分比

    // 从DOM中提取大纲并设置到状态中
    // 同时会为标题元素设置ID以便点击跳转
    const extractOutline = () => {
        if (!containerRef.current) return;

        const outlineItems: OutlineItem[] = [];
        
        try {
            // 查找所有具有docx_heading类的元素
            const headingElements = containerRef.current.querySelectorAll('[class^="docx_heading"]');
            
            headingElements.forEach((element, index) => {
                if (!(element instanceof HTMLElement)) return;
                
                // 提取类名中的标题级别
                const classNames = element.className;
                const levelMatch = classNames.match(/docx_heading(\d+)/);
                if (!levelMatch || !levelMatch[1]) return;
                
                const level = parseInt(levelMatch[1], 10);
                
                // 提取文本内容
                const text = element.textContent?.trim() || '';
                
                if (text) {
                    const id = `heading-${index + 1}`;
                    // 直接为标题元素设置ID
                    element.id = id;
                    outlineItems.push({ text, level, id });
                }
            });
            
            setOutline(outlineItems);
        } catch (error) {
            console.error('Error extracting outline from DOM:', error);
        }
    };

    // 缩放控制函数
    const handleZoomIn = () => {
        setZoomLevel(prev => Math.min(prev + 10, 200)); // 最大放大到200%
    };

    const handleZoomOut = () => {
        setZoomLevel(prev => Math.max(prev - 10, 50)); // 最小缩小到50%
    };

    const handleZoomChange = (value: number | null) => {
        if (value !== null) {
            setZoomLevel(Math.max(50, Math.min(value, 200))); // 限制在50%-200%
        }
    };

    useEffect(() => {
        if (!containerRef.current) return;

        const renderDocx = async () => {
            if (!containerRef.current) return;
            
            try {
                // 清空容器
                containerRef.current.innerHTML = '';
                
                // 读取文件内容
                const fileBuffer = await window.electronAPI.readFileBinary(path);
                
                // 提取大纲（在渲染完成后从DOM中提取）
                
                // 渲染 docx
                await docxPreview.renderAsync(fileBuffer, containerRef.current, null, {});
                
                // 文档渲染完成后，从DOM中提取大纲并设置ID
                extractOutline();
                
                console.log('docx rendered successfully');
                console.log('Outline extracted from DOM successfully');
            } catch (error) {
                console.error('Error rendering docx:', error);
                message.error('渲染 DOCX 文件失败');
            }
        };

        renderDocx();
    }, [path]);

    return (
        <div style={{ height: '100%' }}>
            <Splitter>
                {/* 大纲面板 */}
                <Splitter.Panel defaultSize="250px" style={{
                    minWidth: '200px',
                    maxWidth: '500px',
                    padding: '16px',
                    overflow: 'auto',
                    backgroundColor: '#fafafa'
                }}>
                <h3 style={{ marginBottom: '16px' }}>文档大纲</h3>
                {outline.length > 0 ? (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {outline.map((item) => (
                            <li 
                                key={item.id}
                                style={{
                                    marginBottom: '8px',
                                    paddingLeft: `${(item.level - 1) * 20}px`,
                                    cursor: 'pointer'
                                }}
                                onClick={() => {
                                    const element = document.getElementById(item.id);
                                    if (element) {
                                       element.scrollIntoView({ behavior: 'smooth' });
                                    }
                                }}
                            >
                                <span style={{ fontSize: `${16 - item.level * 1}px`, fontWeight: 'bold' }}>
                                    {item.text}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p style={{ color: '#999' }}>无大纲信息</p>
                )}
            </Splitter.Panel>
            <Splitter.Panel>
            {/* 文档内容区域 */}
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* 缩放控制栏 */}
                <div style={{ 
                    padding: '8px 16px', 
                    borderBottom: '1px solid #e8e8e8',
                    backgroundColor: '#fafafa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '4px'
                }}>
                    <Button 
                        type="text" 
                        size="small" 
                        onClick={handleZoomOut}
                        disabled={zoomLevel <= 50}
                        icon={<MinusOutlined />}
                        style={{ minWidth: '28px' }}
                    />
                    <InputNumber
                        min={50}
                        max={200}
                        step={10}
                        value={zoomLevel}
                        onChange={handleZoomChange}
                        size="small"
                        style={{ width: 100 }}
                        formatter={(value) => `${value}%`}
                        parser={(value) => value?.replace('%', '') as unknown as number}
                    />
                    <Button 
                        type="text" 
                        size="small" 
                        onClick={handleZoomIn}
                        disabled={zoomLevel >= 200}
                        icon={<PlusOutlined />}
                        style={{ minWidth: '28px' }}
                    />
                </div>
                
                {/* 文档内容容器 */}
                <div style={{ 
                    flex: 1, 
                    overflow: 'auto',
                }}>
                    {/* 缩放内容 */}
                    <div 
                        ref={containerRef} 
                        style={{
                            transform: `scale(${zoomLevel / 100})`,
                            transformOrigin: 'top',
                            margin: '0 auto',
                            maxWidth: '100%'
                        }}
                    />
                </div>
            </div>
            </Splitter.Panel>
        </Splitter>
        </div>
    );
};
