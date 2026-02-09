import React, { useEffect, useRef, useState } from 'react';
import { message, Button, Splitter } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, ReloadOutlined } from '@ant-design/icons';
// eslint-disable-next-line import/no-unresolved
import * as docxPreview from 'docx-preview';
import { EditableFilePath } from '../common/EditableFilePath';
import { useAppContext } from '../../contexts/AppContext';

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
    const { setCurrentFile } = useAppContext();
    const containerRef = useRef<HTMLDivElement>(null);
    const [outline, setOutline] = useState<OutlineItem[]>([]);
    const [zoomLevel, setZoomLevel] = useState<number>(100); // 缩放百分比

    // 缩放控制函数
    const handleZoomIn = () => {
        setZoomLevel(prev => Math.min(prev + 10, 200)); // 最大放大到200%
    };

    const handleZoomOut = () => {
        setZoomLevel(prev => Math.max(prev - 10, 50)); // 最小缩小到50%
    };

    const handleResetZoom = () => {
        setZoomLevel(100);
    };

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

    useEffect(() => {
        if (!containerRef.current) return;
        console.log('docx container', containerRef.current);
        const renderDocx = async () => {
            if (!containerRef.current) {
                console.warn('Container ref is null, skipping render');
                return;
            }

            try {
                // 安全地清空容器
                if (containerRef.current) {
                    containerRef.current.innerHTML = '';
                }

                // 读取文件内容
                const fileBuffer = await window.electronAPI.readFileBinary(path);

                // 再次检查容器引用是否仍然有效
                if (!containerRef.current) {
                    console.warn('Container ref became null during file reading');
                    return;
                }

                // 渲染 docx
                await docxPreview.renderAsync(fileBuffer, containerRef.current, containerRef.current, { inWrapper: true });

                // 文档渲染完成后，从DOM中提取大纲并设置ID
                extractOutline();

                console.log('docx rendered successfully');
                console.log('Outline extracted from DOM successfully');
            } catch (error) {
                console.error('Error rendering docx:', error);
                message.error('渲染 DOCX 文件失败');
            }
        };

        // 使用 setTimeout 确保 DOM 已经完全渲染
        setTimeout(() => {
            renderDocx();
        }, 0);
    }, [path]);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* 文件名显示和缩放控制栏 */}
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid #e8e8e8',
                backgroundColor: '#fafafa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <EditableFilePath path={path} onRename={setCurrentFile} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px',marginLeft: 16 }}>
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
                        onClick={handleResetZoom}
                        disabled={zoomLevel === 100}
                        icon={<ReloadOutlined />}
                    />
                </div>
            </div>

            <Splitter style={{ height: 'calc(100% - 48px)' }}>
                {/* 大纲面板 */}
                <Splitter.Panel
                    defaultSize="20%"
                    min="0"
                    max="45%"
                    collapsible
                >
                    <div style={{ padding: '16px' }}>
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
                    </div>
                </Splitter.Panel>
                <Splitter.Panel defaultSize="80%" min="55%">
                    {/* 文档内容区域 */}
                    <div style={{ overflow: 'auto' }}>
                        <style>
                            {
                                `
                                .docx-wrapper {
                                    min-width: 720pt;
                                    padding: 30px !important;
                                    box-sizing: border-box;
                                }
`}
                        </style>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'center',
                                overflow: 'hidden'
                            }}
                        >
                            <div ref={containerRef}
                                style={{
                                    transform: `scale(${zoomLevel / 100})`,
                                    transformOrigin: 'top',
                                    minWidth: '720pt',
                                    width: '720pt',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    </div>
                </Splitter.Panel>
            </Splitter>
        </div>
    );
};
