import React, {useEffect, useState} from 'react';
import {Button, Empty, Spin} from 'antd';
import {FileTextOutlined} from '@ant-design/icons';
import {Center} from '../common/Center';

interface SearchPreviewViewerProps {
    filePath: string;
    fileName: string;
    targetLine?: number;
    searchQuery?: string; // 添加搜索关键词参数
    onClose: () => void;
    onOpenFile?: () => void; // 添加打开文件回调
}

// 样式常量
const STYLES = {
    container: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99,
        backgroundColor: '#fff',
        display: 'flex',
        flexDirection: 'column' as const
    },
    header: {
        padding: '8px 16px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        background: '#fafafa'
    },
    headerTitle: {
        display: 'flex',
        alignItems: 'center' as const,
        gap: 8
    },
    title: {
        margin: 0,
        fontSize: '16px',
        fontWeight: 500 as const
    },
    lineInfo: {
        color: '#999',
        fontSize: '14px',
        marginLeft: '8px'
    },
    closeButton: {
        padding: 0,
        width: 24,
        height: 24,
        borderRadius: 4
    },
    contentWrapper: {
        flex: 1,
        overflow: 'auto' as const,
        padding: '8px',
        backgroundColor: '#fafafa'
    },
    contentContainer: {
        backgroundColor: '#fff',
        border: '1px solid #e8e8e8',
        borderRadius: '4px',
        padding: '8px'
    },
    lineRow: {
        display: 'flex',
        padding: '2px 0',
        borderBottom: '1px solid #f0f0f0',
        transition: 'background-color 0.3s'
    },
    lineNumber: {
        minWidth: '50px',
        textAlign: 'right' as const,
        paddingRight: '12px',
        color: '#999',
        fontSize: '12px',
        userSelect: 'none' as const,
        fontFamily: 'monospace'
    },
    lineContent: {
        flex: 1,
        whiteSpace: 'pre-wrap' as const,
        wordBreak: 'break-word' as const,
        fontFamily: 'monospace',
        fontSize: '14px',
        lineHeight: '1.6'
    }
};

// 配置常量
const HIGHLIGHT_COLOR = '#fff3cd';
const SEARCH_HIGHLIGHT_COLOR = '#ffeb3b'; // 搜索关键词高亮色
const HIGHLIGHT_DURATION = 3000;
const SCROLL_DELAY = 100;

// 标题栏组件
const Header: React.FC<{
    fileName?: string;
    targetLine?: number;
    onClose: () => void;
    onOpenFile?: () => void;
}> = ({fileName, targetLine, onClose, onOpenFile}) => (
    <div style={STYLES.header}>
        <div style={STYLES.headerTitle}>
            <FileTextOutlined/>
            <h2 style={STYLES.title}>
                {fileName || '搜索预览'}
                {targetLine && (
                    <span style={STYLES.lineInfo}>(行 {targetLine})</span>
                )}
            </h2>
        </div>
        <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
            {onOpenFile && (
                <Button
                    type="primary"
                    size="small"
                    onClick={onOpenFile}
                    title="在主视图中打开文件"
                >
                    打开文件
                </Button>
            )}
            <Button
                type="text"
                danger
                icon={<span style={{fontSize: '18px', fontWeight: 'bold'}}>✕</span>}
                onClick={onClose}
                title="关闭预览"
                style={{
                    padding: '4px 8px',
                    fontSize: '18px',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            />
        </div>
    </div>
);

// 代码行组件
const CodeLine: React.FC<{
    lineNumber: number;
    content: string;
    searchQuery?: string;
}> = ({lineNumber, content, searchQuery}) => {
    // 高亮搜索关键词
    const highlightContent = (text: string, query?: string) => {
        if (!query || !text) {
            return text || '\u00A0';
        }

        try {
            // 使用正则表达式进行不区分大小写的匹配
            const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            const parts = text.split(regex);

            return parts.map((part, index) => {
                if (part.toLowerCase() === query.toLowerCase()) {
                    return (
                        <span
                            key={index}
                            style={{
                                backgroundColor: SEARCH_HIGHLIGHT_COLOR,
                                fontWeight: 'bold',
                                padding: '0 2px',
                                borderRadius: '2px'
                            }}
                        >
                            {part}
                        </span>
                    );
                }
                return part;
            });
        } catch (e) {
            // 如果正则表达式有问题，返回原文本
            return text;
        }
    };

    return (
        <div
            id={`line-${lineNumber}`}
            style={STYLES.lineRow}
        >
            <div style={STYLES.lineNumber}>{lineNumber}</div>
            <div style={STYLES.lineContent}>
                {highlightContent(content, searchQuery)}
            </div>
        </div>
    );
};

export const SearchPreviewViewer: React.FC<SearchPreviewViewerProps> = ({
                                                                            filePath,
                                                                            fileName,
                                                                            targetLine,
                                                                            searchQuery,
                                                                            onClose,
                                                                            onOpenFile
                                                                        }) => {
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    // 加载文件内容
    useEffect(() => {
        const loadFileContent = async () => {
            if (!filePath) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                if (window.electronAPI) {
                    const fileContent = await window.electronAPI.readFile(filePath);
                    setContent(fileContent);
                } else {
                    setError('无法读取文件：需要在 Electron 环境中运行');
                }
            } catch (err) {
                console.error('读取文件失败:', err);
                setError('读取文件失败：' + (err instanceof Error ? err.message : String(err)));
            } finally {
                setLoading(false);
            }
        };

        loadFileContent();
    }, [filePath]);

    // 跳转到目标行并高亮
    useEffect(() => {
        if (!loading && targetLine) {
            setTimeout(() => {
                const targetElement = document.getElementById(`line-${targetLine}`);
                if (targetElement) {
                    targetElement.scrollIntoView({behavior: 'smooth', block: 'center'});
                    targetElement.style.backgroundColor = HIGHLIGHT_COLOR;
                    setTimeout(() => {
                        targetElement.style.backgroundColor = '';
                    }, HIGHLIGHT_DURATION);
                }
            }, SCROLL_DELAY);
        }
    }, [loading, targetLine]);

    // 渲染内容
    const renderContent = () => {
        if (loading) {
            return (
                <Center>
                    <Spin size="large"/>
                    <div>正在加载文件...</div>
                </Center>
            );
        }

        if (error) {
            return (
                <Center>
                    <Empty
                        description={error}
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                </Center>
            );
        }

        const lines = content.split('\n');
        return (
            <div style={STYLES.contentWrapper}>
                <div style={STYLES.contentContainer}>
                    {lines.map((line, index) => (
                        <CodeLine
                            key={index + 1}
                            lineNumber={index + 1}
                            content={line}
                            searchQuery={searchQuery}
                        />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div style={STYLES.container}>
            <Header
                fileName={loading ? undefined : fileName}
                targetLine={targetLine}
                onClose={onClose}
                onOpenFile={onOpenFile}
            />
            {renderContent()}
        </div>
    );
};
