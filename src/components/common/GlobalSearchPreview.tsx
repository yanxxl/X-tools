import React, { useEffect, useState } from 'react';
import { Button, Empty, Skeleton, Select, Space } from 'antd';
import { Center } from './Center';
import { FileIcon } from './FileIcon';
import { isTextFile, isOfficeParserSupported, isDocFile, isVideoFile, isElectronSupportedMedia, isImageFile } from '../../utils/fileCommonUtil';
import { isSubtitleFile, findVideoFiles, timeToSeconds, isSubtitleTimeLine, extractTimeRange } from '../../utils/subtitleUtil';
import { GlobalSearchMedia } from './GlobalSearchMedia';
import { useAppContext } from '../../contexts/AppContext';

// 样式常量
const HIGHLIGHT_COLOR = '#fff3cd';
const SEARCH_HIGHLIGHT_COLOR = '#ffeb3b';
const HIGHLIGHT_DURATION = 1500;
const SCROLL_DELAY = 100;

// 高亮文本内容
const highlightContent = (text: string, query?: string) => {
    if (!query || !text) {
        return text || '\u00A0';
    }

    try {
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const parts = text.split(regex);

        return parts.map((part, index) => {
            if (regex.test(part)) {
                return <span key={index} style={{ backgroundColor: SEARCH_HIGHLIGHT_COLOR, fontWeight: 'bold', padding: '0 2px', borderRadius: '2px' }}>{part}</span>;
            }
            return part;
        });
    } catch (e) {
        return text;
    }
};

// 从行内容中提取时间戳
const extractTimeFromLine = (text: string): number | null => {
    if (isSubtitleTimeLine(text)) {
        const timeRange = extractTimeRange(text);
        if (timeRange && timeRange.startTime >= 0) {
            return timeRange.startTime;
        }
    }
    return null;
};

// 从当前行或上方行提取时间戳
const extractTimeFromContext = (lineNumber: number, content: string, allLines: string[]): number | null => {
    // 首先检查当前行
    const currentTime = extractTimeFromLine(content);
    if (currentTime !== null) {
        return currentTime;
    }

    // 如果当前行没有时间戳，向上寻找更多行（最多10行）
    if (allLines && lineNumber > 1) {
        const searchLimit = Math.max(1, lineNumber - 10); // 扩大搜索范围
        for (let i = lineNumber - 1; i >= searchLimit; i--) {
            const lineContent = allLines[i - 1] || '';
            const time = extractTimeFromLine(lineContent);
            if (time !== null) {
                return time;
            }
        }
    }

    return null;
};



interface GlobalSearchPreviewProps {
    filePath?: string;
    fileName?: string;
    line?: number;
    searchQuery?: string;
}

export const GlobalSearchPreview: React.FC<GlobalSearchPreviewProps> = ({
    filePath,
    fileName,
    line,
    searchQuery
}) => {
    const { setCurrentFile, setSearchPanelOpen } = useAppContext();
    const [lines, setLines] = useState<string[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    // 分页相关状态
    const [displayedLines, setDisplayedLines] = useState<string[]>([]);
    const [currentStartLine, setCurrentStartLine] = useState<number>(1);
    const [totalLines, setTotalLines] = useState<number>(0);

    // 媒体相关状态
    const [mediaFiles, setMediaFiles] = useState<string[]>([]);
    const [selectedMediaIndex, setSelectedMediaIndex] = useState<number>(0);
    const [currentTime, setCurrentTime] = useState<number>(0);

    // 更新显示的行内容
    const updateDisplayedLines = (allLines: string[], targetLine?: number) => {
        setTotalLines(allLines.length);

        // 如果总行数不超过300行，显示所有行
        if (allLines.length <= 300) {
            setDisplayedLines(allLines);
            setCurrentStartLine(1);
            return;
        }

        // 如果有目标行，以目标行为中心显示300行
        if (targetLine && targetLine > 0) {
            const startLine = Math.max(1, targetLine - 150);
            const endLine = Math.min(allLines.length, startLine + 299);
            const actualStartLine = Math.max(1, endLine - 299);

            setDisplayedLines(allLines.slice(actualStartLine - 1, endLine));
            setCurrentStartLine(actualStartLine);
        } else {
            // 没有目标行，显示前300行
            setDisplayedLines(allLines.slice(0, 300));
            setCurrentStartLine(1);
        }
    };

    // 加载更多行
    const loadMoreLines = (direction: 'up' | 'down') => {
        if (lines.length === 0) return;

        const chunkSize = 300;
        let newStartLine = currentStartLine;

        if (direction === 'down') {
            // 向下加载更多行
            newStartLine = currentStartLine + chunkSize;
            const endLine = Math.min(lines.length, newStartLine + chunkSize - 1);
            setDisplayedLines(lines.slice(newStartLine - 1, endLine));

            gotoLine(newStartLine);
        } else {
            // 向上加载更多行
            newStartLine = Math.max(1, currentStartLine - chunkSize);
            const endLine = Math.min(lines.length, newStartLine + chunkSize - 1);
            setDisplayedLines(lines.slice(newStartLine - 1, endLine));
        }

        setCurrentStartLine(newStartLine);
    };

    const loadFileContent = async (path: string) => {
        try {
            setPreviewLoading(true);
            setPreviewError(null);

            // 如果是electron支持的媒体文件或图片文件
            if (isElectronSupportedMedia(path) || isImageFile(path)) {
                setMediaFiles([path]);
                setSelectedMediaIndex(0);
                setLines([]);
                setDisplayedLines([]);
                setPreviewLoading(false);
                return;
            }

            // 如果是图片文件
            if (isImageFile(path)) {
                setMediaFiles([path]);
                setSelectedMediaIndex(0);
                setLines([]);
                setDisplayedLines([]);
                setPreviewLoading(false);
                return;
            }

            if (!isTextFile(path) && !isOfficeParserSupported(path) && !isDocFile(path)) {
                // 获取文件信息，判断是否是文本
                const fileInfo = await window.electronAPI.getFileInfo(path);
                if (!fileInfo.isText) {
                    setPreviewError('该文件不是文本文件或支持的办公文档，无法预览内容');
                    setLines([]);
                    setDisplayedLines([]);
                    return;
                }
            }

            if (window.electronAPI) {
                const fileLines = await window.electronAPI.readFileLines(path);
                setLines(fileLines);
                updateDisplayedLines(fileLines, line);
            } else {
                setPreviewError('无法读取文件：需要在 Electron 环境中运行');
                setLines([]);
                setDisplayedLines([]);
            }
        } catch (err) {
            console.error('读取文件失败:', err);
            setPreviewError('读取文件失败：' + (err instanceof Error ? err.message : String(err)));
            setLines([]);
            setDisplayedLines([]);
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleOpenFile = () => {
        if (filePath) {
            setCurrentFile(filePath);
            setSearchPanelOpen(false);
        }
    };

    // 滚动到指定行
    const gotoLine = (lineNumber: number) => {
        const interval = setInterval(() => {
            const targetElement = document.getElementById(`search-preview-line-${lineNumber}`);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetElement.style.backgroundColor = HIGHLIGHT_COLOR;
                setTimeout(() => {
                    targetElement.style.backgroundColor = '';
                }, HIGHLIGHT_DURATION);

                if (isSubtitleFile(filePath || '')) {
                    const time = extractTimeFromContext(lineNumber, lines[lineNumber - 1] || '', lines);
                    if (time !== null) {
                        setCurrentTime(time);
                    }
                }

                clearInterval(interval);
            }
        }, SCROLL_DELAY);
    };

    const handleLineClick = (lineNumber: number, time?: number) => {
        if (line) {
            const previousElement = document.getElementById(`search-preview-line-${line}`);
            if (previousElement) {
                previousElement.style.backgroundColor = '';
            }
        }

        gotoLine(lineNumber);

        if (isSubtitleFile(filePath || '') && time !== undefined && time !== null) {
            setCurrentTime(time + Math.random() * 0.001);
        }
    };

    useEffect(() => {
        setLines([]);
        setDisplayedLines([]);
        setPreviewError(null);
        setMediaFiles([]);
        setSelectedMediaIndex(0);
        setTotalLines(0);
        setCurrentStartLine(1);

        if (filePath) {
            // 如果是媒体文件，在loadFileContent中已经处理，不需要清空
            if (isSubtitleFile(filePath)) {
                const findMediaFiles = async () => {
                    try {
                        const files = await findVideoFiles(filePath);
                        setMediaFiles(files);
                        setSelectedMediaIndex(0);
                    } catch (error) {
                        console.error('查找媒体文件失败:', error);
                        setMediaFiles([]);
                    }
                };
                findMediaFiles();
            } else if (!isElectronSupportedMedia(filePath)) {
                // 只有不是媒体文件的时候，才清空mediaFiles
                setMediaFiles([]);
            }

            loadFileContent(filePath);
        }
    }, [filePath]);

    useEffect(() => {
        if (line && lines.length > 0) {
            updateDisplayedLines(lines, line);
            gotoLine(line);
        }
    }, [line, filePath, lines]);


    return (<div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 16 }}>
        {filePath ? (<div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* 预览标题栏 */}
            <div style={{
                padding: '8px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileIcon fileName={fileName || ''} />
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>
                        {fileName}
                        {!line ? '' : (<span style={{ color: '#999', fontSize: '14px', marginLeft: '8px' }}>
                            (行 {line}/{totalLines})
                        </span>)}
                        {totalLines > 300 && (
                            <span style={{ color: '#666', fontSize: '12px', marginLeft: '8px' }}>
                                [显示 {currentStartLine}-{Math.min(totalLines, currentStartLine + displayedLines.length - 1)} 行]
                            </span>
                        )}
                    </h2>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Button
                        type="primary"
                        size="small"
                        onClick={handleOpenFile}
                        title="在主视图中打开文件"
                    >
                        打开文件
                    </Button>
                </div>
            </div>

            {/* 媒体播放器 - 有媒体文件时显示 */}
            {mediaFiles.length > 0 && (
                <div style={{ height: '400px', borderBottom: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* 媒体文件选择器 */}
                    {mediaFiles.length > 1 && (
                        <div style={{ padding: '8px 16px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #e0e0e0', flexShrink: 0 }}>
                            <Space>
                                <span>选择媒体文件:</span>
                                <Select
                                    style={{ minWidth: '200px' }}
                                    value={selectedMediaIndex}
                                    onChange={setSelectedMediaIndex}
                                    options={mediaFiles.map((file, index) => ({
                                        label: file.split('/').pop() || file,
                                        value: index
                                    }))}
                                />
                                <span>{`${selectedMediaIndex + 1}/${mediaFiles.length}`}</span>
                            </Space>
                        </div>
                    )}
                    <div style={{ flex: 1, padding: '8px', overflow: 'hidden', minHeight: 0 }}>
                        <GlobalSearchMedia
                            file={mediaFiles[selectedMediaIndex] || ''}
                            currentTime={currentTime}
                        />
                    </div>
                </div>
            )}

            {/* 预览内容 */}
            <div style={{
                flex: 1,
                overflow: 'auto',
                backgroundColor: '#fafafa',
                padding: '16px',
                borderRadius: '4px',
                height: mediaFiles.length > 0 ? 'calc(100% - 400px)' : '100%'
            }}>
                {previewLoading ? (
                    <div style={{ padding: 24 }}>
                        <Skeleton active paragraph={{ rows: 3 }} />
                    </div>
                ) : previewError ? (<Center>
                    <Empty
                        description={previewError}
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                </Center>) : (<div style={{
                    backgroundColor: '#fff', border: '1px solid #e8e8e8', borderRadius: '4px'
                }}>
                    {/* 加载更多按钮 - 顶部 */}
                    {currentStartLine > 1 && (
                        <div style={{
                            padding: '8px 16px',
                            borderBottom: '1px solid #f0f0f0',
                            textAlign: 'center',
                            backgroundColor: '#f8f9fa'
                        }}>
                            <Button
                                type="link"
                                size="small"
                                onClick={() => loadMoreLines('up')}
                                style={{ color: '#1890ff' }}
                            >
                                ↑ 加载前面 {Math.min(300, Math.max(0, currentStartLine - 1))} 行
                            </Button>
                        </div>
                    )}

                    {/* 文件内容 */}
                    <div style={{ padding: '16px' }}>
                        {(() => {
                            const isSubtitle = isSubtitleFile(filePath || '');
                            return displayedLines.map((lineContent, index) => {
                                const actualLineNumber = currentStartLine + index;

                                return (
                                    <div
                                        key={actualLineNumber}
                                        id={`search-preview-line-${actualLineNumber}`}
                                        style={{
                                            display: 'flex',
                                            padding: '2px 0',
                                            borderBottom: '1px solid #f0f0f0',
                                            transition: 'background-color 0.3s',
                                            cursor: isSubtitle ? 'pointer' : 'default'
                                        }}
                                        onClick={isSubtitle ? () => {
                                            const time = extractTimeFromContext(actualLineNumber, lineContent, lines);
                                            handleLineClick(actualLineNumber, time);
                                        } : undefined}
                                    >
                                        <div style={{
                                            minWidth: '50px',
                                            textAlign: 'right',
                                            paddingRight: '12px',
                                            color: '#999',
                                            fontSize: '14px',
                                            userSelect: 'none',
                                            fontFamily: 'monospace'
                                        }}>
                                            {actualLineNumber}
                                        </div>
                                        <div style={{
                                            flex: 1,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            fontFamily: 'monospace',
                                            fontSize: '16px',
                                            lineHeight: '1.6'
                                        }}>
                                            {highlightContent(lineContent, searchQuery)}
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>

                    {/* 加载更多按钮 - 底部 */}
                    {currentStartLine + displayedLines.length - 1 < totalLines && (
                        <div style={{
                            padding: '8px 16px',
                            borderTop: '1px solid #f0f0f0',
                            textAlign: 'center',
                            backgroundColor: '#f8f9fa'
                        }}>
                            <Button
                                type="link"
                                size="small"
                                onClick={() => loadMoreLines('down')}
                                style={{ color: '#1890ff' }}
                            >
                                ↓ 加载后面 {Math.min(300, Math.max(0, totalLines - (currentStartLine + displayedLines.length - 1)))} 行
                            </Button>
                        </div>
                    )}
                </div>)}
            </div>
        </div>) : (<Center>
            <div>请选择一个搜索结果进行预览</div>
        </Center>)}
    </div>);
};