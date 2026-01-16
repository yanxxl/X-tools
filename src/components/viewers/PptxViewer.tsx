import React, { useEffect, useState, useRef } from 'react';
import { Button, message } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, ZoomInOutlined, ZoomOutOutlined, ReloadOutlined } from '@ant-design/icons';
import { OfficeParserAST, OfficeContentNode, OfficeAttachment } from '../../office/types';

interface PptxViewerProps {
    path: string;
}

export const PptxViewer: React.FC<PptxViewerProps> = ({ path }) => {
    const [presentationData, setPresentationData] = useState<OfficeParserAST | null>(null);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [zoomLevel, setZoomLevel] = useState(100);
    const [loading, setLoading] = useState(true);
    const slideContainerRef = useRef<HTMLDivElement>(null);

    // 导航控制
    const handlePrevSlide = () => {
        setCurrentSlideIndex(prev => Math.max(0, prev - 1));
    };

    const handleNextSlide = () => {
        if (presentationData) {
            setCurrentSlideIndex(prev => Math.min(presentationData.content.length - 1, prev + 1));
        }
    };

    // 缩放控制
    const handleZoomIn = () => {
        setZoomLevel(prev => Math.min(prev + 10, 200));
    };

    const handleZoomOut = () => {
        setZoomLevel(prev => Math.max(prev - 10, 50));
    };

    const handleResetZoom = () => {
        setZoomLevel(100);
    };

    // 键盘事件处理
    const handleKeyDown = (e: KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowLeft':
            case 'ArrowUp':
                handlePrevSlide();
                e.preventDefault();
                break;
            case 'ArrowRight':
            case 'ArrowDown':
                handleNextSlide();
                e.preventDefault();
                break;
        }
    };

    // 获取当前幻灯片的图片
    const getSlideImages = (slide: OfficeContentNode): OfficeAttachment[] => {
        if (!presentationData) return [];
        
        const images: OfficeAttachment[] = [];
        
        // 递归查找幻灯片中的图片节点
        const findImages = (node: OfficeContentNode) => {
            if (node.type === 'image' && (node.metadata as any)?.attachmentName) {
                const image = presentationData.attachments.find(att => att.name === (node.metadata as any)?.attachmentName);
                if (image) {
                    images.push(image);
                }
            }
            if (node.children) {
                node.children.forEach(findImages);
            }
        };
        
        findImages(slide);
        return images;
    };

    // 渲染幻灯片内容
    const renderSlideContent = (slide: OfficeContentNode) => {
        const renderNode = (node: OfficeContentNode) => {
            switch (node.type) {
                case 'slide':
                    return (
                        <div className="slide-content">
                            {node.children?.map((child, index) => (
                                <div key={index} className="slide-element">
                                    {renderNode(child)}
                                </div>
                            ))}
                        </div>
                    );
                case 'text':
                    return (
                        <span 
                            style={{
                                fontWeight: node.formatting?.bold ? 'bold' : 'normal',
                                fontStyle: node.formatting?.italic ? 'italic' : 'normal',
                                textDecoration: node.formatting?.underline ? 'underline' : 'none',
                                color: node.formatting?.color || 'inherit',
                                fontSize: node.formatting?.size || '16px',
                                textAlign: node.formatting?.alignment || 'left'
                            }}
                        >
                            {node.text}
                        </span>
                    );
                case 'paragraph':
                    return (
                        <p style={{ textAlign: (node.metadata as any)?.alignment || 'left' }}>
                            {node.children?.map((child, index) => (
                                <span key={index}>{renderNode(child)}</span>
                            ))}
                        </p>
                    );
                case 'heading': {
                    const level = (node.metadata as any)?.level || 1;
                    const headingProps = {
                        style: { textAlign: (node.metadata as any)?.alignment || 'left' },
                        children: node.children?.map((child, index) => (
                            <span key={index}>{renderNode(child)}</span>
                        ))
                    };
                    
                    switch (Math.min(level, 6)) {
                        case 1:
                            return <h1 {...headingProps} />;
                        case 2:
                            return <h2 {...headingProps} />;
                        case 3:
                            return <h3 {...headingProps} />;
                        case 4:
                            return <h4 {...headingProps} />;
                        case 5:
                            return <h5 {...headingProps} />;
                        default:
                            return <h6 {...headingProps} />;
                    }
                }
                case 'list': {
                    const ListTag = (node.metadata as any)?.listType === 'ordered' ? 'ol' : 'ul';
                    const indentation = (node.metadata as any)?.indentation || 0;
                    return (
                        <ListTag style={{ marginLeft: `${indentation * 20}px` }}>
                            {node.children?.map((child, index) => (
                                <li key={index}>{renderNode(child)}</li>
                            ))}
                        </ListTag>
                    );
                }
                case 'image':
                    // 图片会在单独的区域渲染
                    return null;
                case 'table':
                    // 渲染表格
                    return (
                        <table style={{
                            borderCollapse: 'collapse',
                            width: '100%',
                            marginBottom: '16px'
                        }}>
                            <tbody>
                                {node.children?.map((row, rowIndex) => (
                                    <React.Fragment key={rowIndex}>{renderNode(row)}</React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    );
                case 'row':
                    // 渲染表格行
                    return (
                        <tr>
                            {node.children?.map((cell, cellIndex) => (
                                <React.Fragment key={cellIndex}>{renderNode(cell)}</React.Fragment>
                            ))}
                        </tr>
                    );
                case 'cell':
                    // 渲染表格单元格
                    return (
                        <td style={{
                            padding: '8px 12px',
                            border: '1px solid #d9d9d9',
                            textAlign: 'left',
                            verticalAlign: 'top'
                        }}>
                            {node.children?.map((child, index) => (
                                <div key={index}>{renderNode(child)}</div>
                            ))}
                        </td>
                    );
                case 'chart':
                    // 渲染图表占位符
                    return (
                        <div style={{
                            padding: '20px',
                            backgroundColor: '#f5f5f5',
                            borderRadius: '4px',
                            textAlign: 'center',
                            marginBottom: '16px'
                        }}>
                            [图表] - {node.text || '未命名图表'}
                        </div>
                    );
                case 'drawing':
                    // 渲染绘图占位符
                    return (
                        <div style={{
                            padding: '20px',
                            backgroundColor: '#f5f5f5',
                            borderRadius: '4px',
                            textAlign: 'center',
                            marginBottom: '16px'
                        }}>
                            [绘图] - {node.text || '未命名绘图'}
                        </div>
                    );
                case 'note':
                    // 渲染备注
                    return (
                        <div style={{
                            padding: '12px',
                            backgroundColor: '#fff3cd',
                            borderRadius: '4px',
                            border: '1px solid #ffeaa7',
                            marginBottom: '16px'
                        }}>
                            <strong>备注:</strong> {renderNode({ ...node, type: 'paragraph' })}
                        </div>
                    );
                default:
                    // 处理其他未识别的节点类型
                    return (
                        <div style={{ marginBottom: '8px' }}>
                            {node.children?.map((child, index) => (
                                <div key={index}>{renderNode(child)}</div>
                            ))}
                        </div>
                    );
            }
        };

        return renderNode(slide);
    };

    // 渲染幻灯片图片
    const renderSlideImages = (slide: OfficeContentNode) => {
        const images = getSlideImages(slide);
        return (
            <div className="slide-images">
                {images.map((image, index) => (
                    <img 
                        key={index}
                        src={`data:${image.mimeType};base64,${image.data}`} 
                        alt={image.altText || image.name} 
                        className="slide-image"
                    />
                ))}
            </div>
        );
    };

    // 解析 PPTX 文件
    useEffect(() => {
        const parsePptx = async () => {
            setLoading(true);
            try {
                const contentAST = await window.electronAPI.parseOffice(path, {
                    extractAttachments: true,
                    includeRawContent: true
                });
                setPresentationData(contentAST);
                setCurrentSlideIndex(0);
                setLoading(false);
            } catch (error) {
                console.error('解析 PPTX 文件失败:', error);
                message.error('解析 PPTX 文件失败');
                setLoading(false);
            }
        };

        parsePptx();
    }, [path]);

    // 键盘事件监听
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

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

    if (!presentationData || presentationData.content.length === 0) {
        return (
            <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f5f5f5'
            }}>
                <div>无法解析演示文稿内容</div>
            </div>
        );
    }

    const currentSlide = presentationData.content[currentSlideIndex];
    const totalSlides = presentationData.content.length;

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
                    <Button
                        type="primary"
                        icon={<ArrowLeftOutlined />}
                        onClick={handlePrevSlide}
                        disabled={currentSlideIndex === 0}
                    >
                        上一张
                    </Button>
                    
                    <span>幻灯片 {currentSlideIndex + 1} / {totalSlides}</span>
                    
                    <Button
                        type="primary"
                        icon={<ArrowRightOutlined />}
                        onClick={handleNextSlide}
                        disabled={currentSlideIndex === totalSlides - 1}
                    >
                        下一张
                    </Button>
                </div>
                
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
                        onClick={handleResetZoom}
                        disabled={zoomLevel === 100}
                        icon={<ReloadOutlined />}
                    />
                </div>
            </div>

            {/* 幻灯片内容区域 */}
            <div style={{
                flex: 1,
                overflow: 'auto',
                padding: '20px',
                backgroundColor: '#f0f2f5'
            }}>
                {/* 确保容器与内容区域大小一致，避免缩放影响滚动 */}
                <div style={{
                    width: '100%',
                    minHeight: '100%',
                    display: 'flex',
                    justifyContent: 'center' // 仅水平居中，不垂直居中
                }}>
                    <div
                        ref={slideContainerRef}
                        style={{
                            transform: `scale(${zoomLevel / 100})`,
                            transformOrigin: 'top center', // 调整缩放原点到顶部中心
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                            padding: '20px',
                            width: 'auto', // 让宽度完全由内容决定
                            minWidth: '800px', // 保持合理的最小宽度
                            maxWidth: '100%', // 确保不超过容器宽度
                            overflow: 'visible'
                        }}
                    >
                        <div className="slide">
                            {renderSlideContent(currentSlide)}
                            {renderSlideImages(currentSlide)}
                        </div>
                    </div>
                </div>
            </div>

            {/* 样式 */}
            <style>{`
                .slide {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .slide-content {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .slide-element {
                    margin-bottom: 12px;
                }

                .slide-images {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    margin-top: 20px;
                }

                .slide-image {
                    max-width: 100%;
                    height: auto;
                    border-radius: 4px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    object-fit: contain;
                }
            `}</style>
        </div>
    );
};