import React, {useEffect, useState} from 'react';
import {Button, Empty, Skeleton, Typography} from 'antd';
import {FileTextOutlined} from '@ant-design/icons';
import {Center} from './Center';
import {isTextFile} from '../../utils/fileCommonUtil';

const {Text} = Typography;

interface SearchMatch {
    line: number;
    content: string;
}

// 样式常量
const HIGHLIGHT_COLOR = '#fff3cd';
const SEARCH_HIGHLIGHT_COLOR = '#ffeb3b';
const HIGHLIGHT_DURATION = 1500;
const SCROLL_DELAY = 300;

// 代码行组件
const CodeLine: React.FC<{
    lineNumber: number; content: string; searchQuery?: string;
}> = ({lineNumber, content, searchQuery}) => {
    const highlightContent = (text: string, query?: string) => {
        if (!query || !text) {
            return text || '\u00A0';
        }

        try {
            const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            const parts = text.split(regex);

            return parts.map((part, index) => {
                if (part.toLowerCase() === query.toLowerCase()) {
                    return (<span
                        key={index}
                        style={{
                            backgroundColor: SEARCH_HIGHLIGHT_COLOR, fontWeight: 'bold', padding: '0 2px', borderRadius: '2px'
                        }}
                    >
                            {part}
                        </span>);
                }
                return part;
            });
        } catch (e) {
            return text;
        }
    };

    return (<div
        id={`search-preview-line-${lineNumber}`}
        style={{
            display: 'flex', padding: '2px 0', borderBottom: '1px solid #f0f0f0', transition: 'background-color 0.3s'
        }}
    >
        <div style={{
            minWidth: '50px', textAlign: 'right', paddingRight: '12px', color: '#999', fontSize: '14px', userSelect: 'none', fontFamily: 'monospace'
        }}>
            {lineNumber}
        </div>
        <div style={{
            flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '16px', lineHeight: '1.6'
        }}>
            {highlightContent(content, searchQuery)}
        </div>
    </div>);
};



interface GlobalSearchPreviewProps {
    filePath?: string;
    fileName?: string;
    line?: number;
    searchQuery?: string;
    onOpenFile?: (filePath: string, fileName: string) => void;
}

export const GlobalSearchPreview: React.FC<GlobalSearchPreviewProps> = ({
    filePath,
    fileName,
    line,
    searchQuery,
    onOpenFile
}) => {
    const [content, setContent] = useState<string>('');
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    // 加载文件内容
    const loadFileContent = async (path: string) => {
        try {
            setPreviewLoading(true);
            setPreviewError(null);

            // 检查是否为文本文件
            if (!isTextFile(path)) {
                setPreviewError('该文件不是文本文件，无法预览内容');
                setContent('');
                return;
            }

            if (window.electronAPI) {
                const fileContent = await window.electronAPI.readFile(path);
                setContent(fileContent);
            } else {
                setPreviewError('无法读取文件：需要在 Electron 环境中运行');
            }
        } catch (err) {
            console.error('读取文件失败:', err);
            setPreviewError('读取文件失败：' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setPreviewLoading(false);
        }
    };

    // 当预览文件变化时加载内容
    useEffect(() => {
        if (filePath) {
            loadFileContent(filePath);
        } else {
            setContent('');
            setPreviewError(null);
        }
    }, [filePath]);

    // 处理行号跳转
    useEffect(() => {
        if (line) {
            setTimeout(() => {
                const targetElement = document.getElementById(`search-preview-line-${line}`);
                if (targetElement) {
                    targetElement.scrollIntoView({behavior: 'smooth', block: 'center'});
                    targetElement.style.backgroundColor = HIGHLIGHT_COLOR;
                    setTimeout(() => {
                        targetElement.style.backgroundColor = '';
                    }, HIGHLIGHT_DURATION);
                }
            }, SCROLL_DELAY);
        }
    }, [line]);

    return (<div style={{height: '100%', display: 'flex', flexDirection: 'column', padding: 16}}>
        {filePath ? (<div style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
            {/* 预览标题栏 */}
            <div style={{
                padding: '8px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa',
            }}>
                <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                    <FileTextOutlined/>
                    <h2 style={{margin: 0, fontSize: '16px', fontWeight: 500}}>
                        {fileName}
                        {line && (<span style={{color: '#999', fontSize: '14px', marginLeft: '8px'}}>
                                    (行 {line})
                                </span>)}
                    </h2>
                </div>
                <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                    <Button
                        type="primary"
                        size="small"
                        onClick={() => onOpenFile?.(filePath, fileName || '')}
                        title="在主视图中打开文件"
                    >
                        打开文件
                    </Button>
                </div>
            </div>

            {/* 预览内容 */}
            <div style={{flex: 1, overflow: 'auto', backgroundColor: '#fafafa', padding: '16px', borderRadius: '4px'}}>
                {previewLoading ? (
                    <div style={{padding: 24}}>
                        <Skeleton active paragraph={{rows: 3}}/>
                    </div>
                ) : previewError ? (<Center>
                    <Empty
                        description={previewError}
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                </Center>) : (<div style={{
                    backgroundColor: '#fff', border: '1px solid #e8e8e8', borderRadius: '4px', padding: '16px'
                }}>
                    {content.split('\n').map((line, index) => (<CodeLine
                        key={index + 1}
                        lineNumber={index + 1}
                        content={line}
                        searchQuery={searchQuery}
                    />))}
                </div>)}
            </div>
        </div>) : (<Center>
            <div>请选择一个搜索结果进行预览</div>
        </Center>)}
    </div>);
};