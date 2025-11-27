import React, {useCallback, useEffect, useState} from 'react';
import {Card, Collapse, Input, message, Progress, Select, Space, Statistic, Typography} from 'antd';
import {FileTextOutlined, SearchOutlined} from '@ant-design/icons';
import {useAppContext} from '../../contexts/AppContext';
import {ToolWindow} from './toolWindow';

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

/**
 * 搜索工具窗口组件
 */
const SearchPanel: React.FC = () => {
    const {currentFolder, setCurrentFile} = useAppContext();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [sortBy, setSortBy] = useState<'name' | 'ctime' | 'mtime'>('name'); // 排序方式
    // 搜索进度状态
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
        // 注册进度监听器
        if (window.electronAPI && window.electronAPI.onSearchProgress) {
            window.electronAPI.onSearchProgress(handleProgressUpdate);
        }

        // 清理监听器
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

        // 重置状态
        setLoading(true);
        setIsSearching(true);
        setSearchResults([]);
        setProgress({totalFiles: 0, currentFile: 0, totalLines: 0});

        try {
            const results = await window.electronAPI.searchFilesContent(currentFolder, searchQuery);
            setSearchResults(results);
            // 计算总命中数
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

    // 处理搜索结果点击
    const handleResultClick = (filePath: string, fileName: string, line?: number) => {
        // 使用搜索预览视图，传递搜索关键词
        if ((window as any).openSearchPreview) {
            (window as any).openSearchPreview(filePath, fileName, line, searchQuery);
        } else {
            // 降级处理：直接设置当前文件
            const fileNode = {
                id: filePath,
                name: fileName,
                path: filePath,
                isDirectory: false
            };
            setCurrentFile(fileNode as any);
        }
    };

    // 排序搜索结果
    const sortedResults = React.useMemo(() => {
        const sorted = [...searchResults];
        // TODO: 需要后端返回文件的创建时间和修改时间
        // 目前先按文件名排序
        sorted.sort((a, b) => {
            if (sortBy === 'name') {
                return a.fileName.localeCompare(b.fileName);
            }
            // 后续支持按时间排序
            return 0;
        });
        return sorted;
    }, [searchResults, sortBy]);

    // 计算统计数据
    const totalMatches = searchResults.reduce((sum: number, r: SearchResult) => sum + r.matches.length, 0);

    return (
        <div style={{padding: 16, height: '100%', display: 'flex', flexDirection: 'column'}}>
            <Title level={4} style={{marginBottom: 16}}>搜索文件内容</Title>

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

            {/* 搜索结果列表 - 按文件组织，可折叠 */}
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
                                                onClick={() => handleResultClick(result.filePath, result.fileName, match.line)}
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

/**
 * 高亮文本中的搜索关键词
 */
const highlightText = (text: string, query: string) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, idx) =>
        part.toLowerCase() === query.toLowerCase() ?
            <Text strong key={idx} style={{backgroundColor: '#fff3cd'}}>{part}</Text> :
            part
    );
};

export const searchToolWindow = new ToolWindow({
    id: 'search-tool-window',
    name: '搜索',
    description: '搜索当前文件夹下的文件内容',
    isVisible: true,
    view: <SearchPanel/>,
    icon: <SearchOutlined/>,
    isResizable: true
});
