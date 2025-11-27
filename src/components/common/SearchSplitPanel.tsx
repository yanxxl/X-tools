import React, {useCallback, useEffect, useState} from 'react';
import {Button, Card, Collapse, Empty, Input, message, Progress, Select, Space, Spin, Splitter, Statistic, Typography} from 'antd';
import {FileTextOutlined, SearchOutlined} from '@ant-design/icons';
import {useAppContext} from '../../contexts/AppContext';
import {Center} from './Center';

const {Search} = Input;
const {Title, Text} = Typography;
const {Panel} = Collapse;

interface SearchResult {
    filePath: string;
    fileName: string;
    matches: {
        line: number;
        content: string;
    }[];
}

// 样式常量
const HIGHLIGHT_COLOR = '#fff3cd';
const SEARCH_HIGHLIGHT_COLOR = '#ffeb3b';
const HIGHLIGHT_DURATION = 3000;
const SCROLL_DELAY = 100;

// 代码行组件
const CodeLine: React.FC<{
    lineNumber: number;
    content: string;
    searchQuery?: string;
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
            return text;
        }
    };

    return (
        <div
            id={`line-${lineNumber}`}
            style={{
                display: 'flex',
                padding: '2px 0',
                borderBottom: '1px solid #f0f0f0',
                transition: 'background-color 0.3s'
            }}
        >
            <div style={{
                minWidth: '50px',
                textAlign: 'right',
                paddingRight: '12px',
                color: '#999',
                fontSize: '12px',
                userSelect: 'none',
                fontFamily: 'monospace'
            }}>
                {lineNumber}
            </div>
            <div style={{
                flex: 1,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'monospace',
                fontSize: '14px',
                lineHeight: '1.6'
            }}>
                {highlightContent(content, searchQuery)}
            </div>
        </div>
    );
};

// 高亮文本中的搜索关键词
const highlightText = (text: string, query: string) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, idx) =>
        part.toLowerCase() === query.toLowerCase() ?
            <Text strong key={idx} style={{backgroundColor: '#fff3cd'}}>{part}</Text> :
            part
    );
};

interface SearchPanelProps {
    onResultClick: (filePath: string, fileName: string, line?: number) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
                                                            onResultClick,
                                                            searchQuery,
                                                            setSearchQuery
                                                        }) => {
    const {currentFolder} = useAppContext();
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [sortBy, setSortBy] = useState<'name' | 'ctime' | 'mtime'>('name');
    const [progress, setProgress] = useState({
        totalFiles: 0,
        currentFile: 0,
        totalLines: 0
    });
    const [isSearching, setIsSearching] = useState(false);

    // 当当前文件夹变化时，清空搜索结果
    useEffect(() => {
        setSearchResults([]);
        setSearchQuery('');
    }, [currentFolder]);

    // 进度更新回调
    const handleProgressUpdate = useCallback((progressData: { totalFiles: number; currentFile: number; totalLines: number }) => {
        setProgress(progressData);
    }, []);

    // 监听搜索进度
    useEffect(() => {
        if (window.electronAPI && window.electronAPI.onSearchProgress) {
            window.electronAPI.onSearchProgress(handleProgressUpdate);
        }

        return () => {
            if (window.electronAPI && window.electronAPI.offSearchProgress) {
                window.electronAPI.offSearchProgress(handleProgressUpdate);
            }
        };
    }, [handleProgressUpdate]);

    // 执行搜索
    const handleSearch = async () => {
        if (!currentFolder) {
            message.warning('请先选择文件夹');
            return;
        }
        if (!searchQuery.trim()) {
            message.warning('请输入搜索关键词');
            return;
        }

        setLoading(true);
        setIsSearching(true);
        setSearchResults([]);
        setProgress({totalFiles: 0, currentFile: 0, totalLines: 0});

        try {
            const results = await window.electronAPI.searchFilesContent(currentFolder, searchQuery);
            setSearchResults(results);
            const totalMatches = results.reduce((sum: number, r: SearchResult) => sum + r.matches.length, 0);
            message.success(`在 ${results.length} 个文件中找到 ${totalMatches} 条匹配`);
        } catch (error) {
            console.error('搜索失败:', error);
            message.error('搜索失败，请重试');
        } finally {
            setLoading(false);
            setIsSearching(false);
        }
    };

    // 排序搜索结果
    const sortedResults = React.useMemo(() => {
        const sorted = [...searchResults];
        sorted.sort((a, b) => {
            if (sortBy === 'name') {
                return a.fileName.localeCompare(b.fileName);
            }
            return 0;
        });
        return sorted;
    }, [searchResults, sortBy]);

    // 计算统计数据
    const totalMatches = searchResults.reduce((sum: number, r: SearchResult) => sum + r.matches.length, 0);

    return (
        <div style={{padding: 16, height: '100%', display: 'flex', flexDirection: 'column'}}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16
            }}>
                <Title level={4} style={{margin: 0}}>搜索文件内容</Title>
            </div>

            <Search
                placeholder="输入搜索关键词"
                allowClear
                enterButton={<SearchOutlined/>}
                size="large"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onSearch={handleSearch}
                loading={loading}
                style={{marginBottom: 16}}
            />

            {/* 搜索进度显示 */}
            {isSearching && (
                <Card size="small" style={{marginBottom: 16}}>
                    <div style={{marginBottom: 8}}>
                        <Text type="secondary">
                            {progress.totalFiles > 0 ? `正在搜索: ${progress.currentFile}/${progress.totalFiles} 个文件` : '正在统计文件数量...'}
                        </Text>
                    </div>
                    <Progress
                        percent={progress.totalFiles > 0 ? Math.round((progress.currentFile / progress.totalFiles) * 100) : 0}
                        size="small"
                        status="active"
                    />
                    <div style={{marginTop: 8, fontSize: 12}}>
                        <Text type="secondary">
                            已搜索 {progress.totalLines} 行
                        </Text>
                    </div>
                </Card>
            )}

            {/* 搜索结果统计和排序 */}
            {searchResults.length > 0 && (
                <div style={{marginBottom: 16}}>
                    <Space split="|　">
                        <Statistic
                            title="匹配文件"
                            value={searchResults.length}
                            valueStyle={{fontSize: 16}}
                            suffix="个"
                        />
                        <Statistic
                            title="命中条目"
                            value={totalMatches}
                            valueStyle={{fontSize: 16}}
                            suffix="条"
                        />
                    </Space>
                    <div style={{marginTop: 12}}>
                        <Space>
                            <Text type="secondary">排序方式:</Text>
                            <Select
                                size="small"
                                value={sortBy}
                                onChange={setSortBy}
                                style={{width: 120}}
                                options={[
                                    {label: '文件名', value: 'name'},
                                    {label: '创建时间', value: 'ctime', disabled: true},
                                    {label: '修改时间', value: 'mtime', disabled: true}
                                ]}
                            />
                        </Space>
                    </div>
                </div>
            )}

            {/* 搜索结果列表 */}
            <div style={{flex: 1, overflow: 'auto'}}>
                {sortedResults.length > 0 ? (
                    <Collapse
                        defaultActiveKey={sortedResults.map((_, idx) => idx.toString())}
                        size="small"
                    >
                        {sortedResults.map((result, idx) => (
                            <Panel
                                key={idx.toString()}
                                header={
                                    <Space>
                                        <FileTextOutlined/>
                                        <Text strong>{result.fileName}</Text>
                                        <Text type="secondary">({result.matches.length} 条匹配)</Text>
                                    </Space>
                                }
                            >
                                <div style={{paddingLeft: 24}}>
                                    {result.matches.map((match, matchIdx) => (
                                        <div key={matchIdx} style={{marginBottom: 12}}>
                                            <div style={{marginBottom: 4}}>
                                                <Text type="secondary" style={{fontSize: 12}}>第 {match.line} 行:</Text>
                                            </div>
                                            <div
                                                onClick={() => onResultClick(result.filePath, result.fileName, match.line)}
                                                style={{
                                                    cursor: 'pointer',
                                                    padding: '4px 8px',
                                                    background: '#f5f5f5',
                                                    borderRadius: '4px',
                                                    fontSize: 12,
                                                    wordBreak: 'break-word',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = '#e6f7ff'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                            >
                                                {highlightText(match.content, searchQuery)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Panel>
                        ))}
                    </Collapse>
                ) : isSearching ? null : (
                    <div style={{textAlign: 'center', padding: 40, color: '#999'}}>
                        <Text type="secondary">输入关键词开始搜索</Text>
                    </div>
                )}
            </div>
        </div>
    );
};

interface FilePreviewProps {
    filePath: string;
    fileName: string;
    searchQuery: string;
    onBack: () => void;
    onOpenFile: (filePath: string, fileName: string) => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({
                                                     filePath,
                                                     fileName,
                                                     searchQuery,
                                                     onBack,
                                                     onOpenFile
                                                 }) => {
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [targetLine, setTargetLine] = useState<number | null>(null);

    // 解析带行号的文件路径
    useEffect(() => {
        const pathParts = filePath.split('#line=');
        const actualFilePath = pathParts[0];
        const line = pathParts[1] ? parseInt(pathParts[1], 10) : null;

        setTargetLine(line);
        loadFileContent(actualFilePath);
    }, [filePath]);

    const loadFileContent = async (path: string) => {
        try {
            setLoading(true);
            setError(null);

            if (window.electronAPI) {
                const fileContent = await window.electronAPI.readFile(path);
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

    return (
        <div style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
            {/* 预览标题栏 */}
            <div style={{
                padding: '8px 16px',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#fafafa'
            }}>
                <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                    <Button
                        type="text"
                        icon={<span>←</span>}
                        onClick={onBack}
                        title="返回搜索结果"
                    >
                        返回
                    </Button>
                    <FileTextOutlined/>
                    <h2 style={{margin: 0, fontSize: '16px', fontWeight: 500}}>
                        {fileName}
                        {targetLine && (
                            <span style={{color: '#999', fontSize: '14px', marginLeft: '8px'}}>
                                (行 {targetLine})
                            </span>
                        )}
                    </h2>
                </div>
                <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                    <Button
                        type="primary"
                        size="small"
                        onClick={() => onOpenFile(filePath, fileName)}
                        title="在主视图中打开文件"
                    >
                        打开文件
                    </Button>
                </div>
            </div>

            {/* 预览内容 */}
            <div style={{flex: 1, overflow: 'auto', padding: '8px', backgroundColor: '#fafafa'}}>
                {loading ? (
                    <Center>
                        <Spin size="large"/>
                        <div>正在加载文件...</div>
                    </Center>
                ) : error ? (
                    <Center>
                        <Empty
                            description={error}
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                    </Center>
                ) : (
                    <div style={{
                        backgroundColor: '#fff',
                        border: '1px solid #e8e8e8',
                        borderRadius: '4px',
                        padding: '8px'
                    }}>
                        {content.split('\n').map((line, index) => (
                            <CodeLine
                                key={index + 1}
                                lineNumber={index + 1}
                                content={line}
                                searchQuery={searchQuery}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

interface SearchSplitPanelProps {
    onClose: () => void;
}

export const SearchSplitPanel: React.FC<SearchSplitPanelProps> = ({onClose}) => {
    const {setCurrentFile} = useAppContext();
    const [searchQuery, setSearchQuery] = useState('');
    const [previewFile, setPreviewFile] = useState<{ filePath: string; fileName: string } | null>(null);

    const handleResultClick = (filePath: string, fileName: string, line?: number) => {
        // 将行号附加到文件路径中
        const filePathWithLine = line ? `${filePath}#line=${line}` : filePath;
        setPreviewFile({filePath: filePathWithLine, fileName});
    };

    const handleOpenFile = (filePath: string, fileName: string) => {
        // 移除行号部分
        const actualFilePath = filePath.split('#line=')[0];
        const fileNode = {
            id: actualFilePath,
            name: fileName,
            path: actualFilePath,
            isDirectory: false
        };
        setCurrentFile(fileNode as any);
        onClose();
    };

    return (
        <div style={{height: '100%'}}>
            <Splitter style={{height: '100%'}}>
                <Splitter.Panel defaultSize="50%" min="30%" max="70%">
                    <div style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
                        <SearchPanel
                            onResultClick={handleResultClick}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                        />
                    </div>
                </Splitter.Panel>
                <Splitter.Panel>
                    <div style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
                        {previewFile ? (
                            <FilePreview
                                filePath={previewFile.filePath}
                                fileName={previewFile.fileName}
                                searchQuery={searchQuery}
                                onBack={() => setPreviewFile(null)}
                                onOpenFile={handleOpenFile}
                            />
                        ) : (
                            <Center>
                                <div>请选择一个搜索结果进行预览</div>
                            </Center>
                        )}
                    </div>
                </Splitter.Panel>
            </Splitter>
        </div>
    );
};