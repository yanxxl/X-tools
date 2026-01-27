import React, { useEffect, useState, useRef } from 'react';
import { Button, message } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, ZoomInOutlined, ZoomOutOutlined, ReloadOutlined } from '@ant-design/icons';
import { OfficeAttachment } from '../../office/types';

interface PptxViewerProps {
    path: string;
}

interface SlideElement {
    type: string;
    content: string | string[][];
    metadata?: Record<string, unknown>;
}

interface SlideData {
    elements: SlideElement[];
}

interface PowerPointJsonData {
    type: string;
    metadata: Record<string, unknown>;
    slides: SlideData[];
    attachments: OfficeAttachment[];
}

export const PptxViewer: React.FC<PptxViewerProps> = ({ path }) => {
    const [presentationData, setPresentationData] = useState<PowerPointJsonData | null>(null);
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
            setCurrentSlideIndex(prev => Math.min(presentationData.slides.length - 1, prev + 1));
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



    // 渲染幻灯片内容
    const renderSlideContent = (slideData: SlideData) => {
        return (
            <div className="slide-content">
                {slideData.elements.map((element, index) => {
                    switch (element.type) {
                        case 'heading': {
                            const level = (element.metadata?.level as number) || 1;
                            const alignment = (element.metadata?.alignment as string) || 'left';
                            const headingStyle = {
                                textAlign: alignment as 'left' | 'center' | 'right' | 'justify',
                                marginBottom: '12px'
                            };

                            switch (Math.min(level, 6)) {
                                case 1:
                                    return <h1 key={index} style={headingStyle}>{element.content as string}</h1>;
                                case 2:
                                    return <h2 key={index} style={headingStyle}>{element.content as string}</h2>;
                                case 3:
                                    return <h3 key={index} style={headingStyle}>{element.content as string}</h3>;
                                case 4:
                                    return <h4 key={index} style={headingStyle}>{element.content as string}</h4>;
                                case 5:
                                    return <h5 key={index} style={headingStyle}>{element.content as string}</h5>;
                                default:
                                    return <h6 key={index} style={headingStyle}>{element.content as string}</h6>;
                            }
                        }
                        case 'paragraph': {
                            const paragraphAlignment = (element.metadata?.alignment as string) || 'left';
                            return (
                                <p key={index} style={{
                                    textAlign: paragraphAlignment as 'left' | 'center' | 'right' | 'justify',
                                    marginBottom: '12px',
                                    lineHeight: '1.5'
                                }}>
                                    {element.content as string}
                                </p>
                            );
                        }
                        case 'table':
                            if (Array.isArray(element.content)) {
                                return (
                                    <table key={index} style={{
                                        borderCollapse: 'collapse',
                                        width: '100%',
                                        marginBottom: '16px'
                                    }}>
                                        <tbody>
                                            {(element.content as string[][]).map((row, rowIndex) => (
                                                <tr key={rowIndex}>
                                                    {row.map((cell, cellIndex) => (
                                                        <td key={cellIndex} style={{
                                                            padding: '8px 12px',
                                                            border: '1px solid #d9d9d9',
                                                            textAlign: 'left',
                                                            verticalAlign: 'top'
                                                        }}>
                                                            {cell || ''}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                );
                            }
                            return null;
                        case 'list':
                            return (
                                <div key={index} style={{ marginBottom: '12px' }}>
                                    {(element.content as string).split('\n').map((item, itemIndex) => (
                                        <div key={itemIndex} style={{
                                            marginLeft: '20px',
                                            marginBottom: '4px'
                                        }}>
                                            • {item}
                                        </div>
                                    ))}
                                </div>
                            );
                        case 'image': {
                            // 在幻灯片内容中直接渲染图片
                            const imageAttachment = presentationData?.attachments.find(att =>
                                att.name === (element.metadata?.attachmentName as string)
                            );

                            if (imageAttachment) {
                                return (
                                    <div key={index} style={{
                                        textAlign: 'center',
                                        marginBottom: '16px',
                                        padding: '8px'
                                    }}>
                                        <img
                                            src={`data:${imageAttachment.mimeType};base64,${imageAttachment.data}`}
                                            alt={imageAttachment.altText || imageAttachment.name}
                                            style={{
                                                maxWidth: '100%',
                                                maxHeight: '300px',
                                                height: 'auto',
                                                borderRadius: '4px',
                                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                                objectFit: 'contain'
                                            }}
                                        />
                                        {imageAttachment.altText && (
                                            <div style={{
                                                marginTop: '8px',
                                                fontSize: '14px',
                                                color: '#666',
                                                fontStyle: 'italic'
                                            }}>
                                                {imageAttachment.altText}
                                            </div>
                                        )}
                                    </div>
                                );
                            }

                            // 如果没有找到对应的附件，显示占位符
                            return (
                                <div key={index} style={{
                                    padding: '20px',
                                    backgroundColor: '#f5f5f5',
                                    borderRadius: '4px',
                                    textAlign: 'center',
                                    marginBottom: '16px',
                                    border: '1px dashed #d9d9d9'
                                }}>
                                    [图片] - {element.content as string}
                                </div>
                            );
                        }
                        default:
                            return (
                                <div key={index} style={{ marginBottom: '8px' }}>
                                    {element.content as string}
                                </div>
                            );
                    }
                })}
            </div>
        );
    };



    // 解析 PPTX 文件
    useEffect(() => {
        const parsePptx = async () => {
            setLoading(true);
            try {
                const contentJSON = await window.electronAPI.parseOffice(path, {
                    extractAttachments: true,
                    includeRawContent: true
                });
                setPresentationData(contentJSON);
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

    if (!presentationData || presentationData.slides.length === 0) {
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

    const currentSlide = presentationData.slides[currentSlideIndex];
    const totalSlides = presentationData.slides.length;

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
                backgroundColor: '#f0f2f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {/* 16:9 宽高比的幻灯片容器 */}
                <div style={{
                    width: '80%',
                    maxWidth: '1200px',
                    aspectRatio: '16 / 9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div
                        ref={slideContainerRef}
                        style={{
                            transform: `scale(${zoomLevel / 100})`,
                            transformOrigin: 'center', // 从中心缩放
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                            padding: '40px',
                            width: '100%',
                            height: '100%',
                            boxSizing: 'border-box',
                            overflow: 'auto'
                        }}
                    >
                        <div className="slide">
                            {renderSlideContent(currentSlide)}
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