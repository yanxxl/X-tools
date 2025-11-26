import React, {useCallback, useEffect, useState} from 'react';
import {Card, Input, List, message, Progress, Space, Typography} from 'antd';
import {FileTextOutlined, SearchOutlined} from '@ant-design/icons';
import {useAppContext} from '../../contexts/AppContext';
import {ToolWindow} from './toolWindow';

const {Search} = Input;
const {Title, Text} = Typography;

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
    // 搜索进度状态
    const [progress, setProgress] = useState({
        totalFiles: 0,
        currentFile: 0,
        totalLines: 0
    });
    const [isSearching, setIsSearching] = useState(false);

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
            message.success(`找到 ${results.length} 个匹配结果`);
        } catch (error) {
            console.error('搜索失败:', error);
            message.error('搜索失败，请重试');
        } finally {
            setLoading(false);
            setIsSearching(false);
        }
    };

    // 处理搜索结果点击
    const handleResultClick = (filePath: string, line?: number) => {
        const fileName = filePath.split('/').pop() || '';

        // 使用全局暴露的函数来打开文件并跳转到指定行
        if ((window as any).openFileWithLine) {
            (window as any).openFileWithLine(filePath, fileName, line || 1);
        } else {
            // 降级处理：如果全局函数不可用，使用原来的方法
            // 创建一个包含文件路径的对象，模拟FileNode结构
            const fileNode = {
                id: filePath,
                name: fileName,
                path: filePath,
                isDirectory: false
            };

            // 设置当前文件
            setCurrentFile(fileNode as any);
        }
    };

    return (
        <div style={{padding: 16, height: '100%', overflow: 'auto'}}>
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

            {searchResults.length > 0 ? (
                <List
                    size="small"
                    dataSource={searchResults}
                    renderItem={(result) => (
                        <List.Item>
                            <List.Item.Meta
                                avatar={<FileTextOutlined/>}
                                title={(
                                    <a onClick={() => handleResultClick(result.filePath)}>{result.fileName}</a>
                                )}
                                description={(
                                    <div>
                                        {result.matches.map((match, idx) => (
                                            <div key={idx} style={{marginBottom: 8, fontSize: 12}}>
                                                <Space>
                                                    <Text type="secondary">第 {match.line} 行:</Text>
                                                    <a
                                                        onClick={() => handleResultClick(result.filePath, match.line)}
                                                        style={{display: 'block', wordBreak: 'break-word', whiteSpace: 'normal'}}
                                                    >
                                                        {highlightText(match.content, searchQuery)}
                                                    </a>
                                                </Space>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            />
                        </List.Item>
                    )}
                />
            ) : isSearching ? null : (
                <div style={{textAlign: 'center', padding: 40, color: '#999'}}>
                    <Text type="secondary">输入关键词开始搜索</Text>
                </div>
            )}
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
