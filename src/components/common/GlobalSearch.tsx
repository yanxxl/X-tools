import React, { useEffect, useState } from 'react';
import { Button, Card, Input, message, Radio, Select, Space, Splitter, Typography } from 'antd';
import { storage } from '../../utils/storage';
import { HistoryOutlined, SearchOutlined } from '@ant-design/icons';
import { useAppContext } from '../../contexts/AppContext';
import { GlobalSearchPreview } from './GlobalSearchPreview';
import { GlobalSearchResults } from './GlobalSearchResults';
import { FileNode } from '../../types';

const { Search } = Input;
const { Title } = Typography;

interface SearchMatch {
    line: number;
    content: string;
}

interface SearchResult {
    filePath: string;
    fileName: string;
    matches: SearchMatch[];
}

export const GlobalSearch: React.FC = () => {
    const { currentFolder, setCurrentFile } = useAppContext();
    
    // 状态定义
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [searchPath, setSearchPath] = useState<string>('');
    const [directories, setDirectories] = useState<Array<{ label: string, value: string }>>([]);
    const [searchMode, setSearchMode] = useState<'content' | 'filename'>('content');
    const [previewFilePath, setPreviewFilePath] = useState<string>('');
    const [previewFileName, setPreviewFileName] = useState<string>('');
    const [previewLine, setPreviewLine] = useState<number | undefined>(undefined);
    const [fileTree, setFileTree] = useState<FileNode | undefined>(undefined);

    // 事件处理函数
    const handleResultClick = (filePath: string, fileName: string, line?: number) => {
        setPreviewFilePath(filePath);
        setPreviewFileName(fileName);
        setPreviewLine(line);
    };

    const handleOpenFile = (filePath: string) => {
        setCurrentFile(filePath);
    };

    const handleSearch = (value: string) => {
        if (!value.trim()) {
            message.warning('请输入搜索关键词');
            return;
        }

        setSearchQuery(value);
        setLoading(true);
        setIsSearching(true);

        setSearchHistory(prev => {
            const newHistory = [value, ...prev.filter(item => item !== value)];
            return newHistory.slice(0, 10);
        });
    };

    const handleCancelSearch = () => {
        setIsSearching(false);
        setLoading(false);
        setSearchResults([]);
    };

    const handleHistoryItemClick = (item: string) => {
        setSearchQuery(item);
        handleSearch(item);
    };

    // Effect hooks - 初始化
    useEffect(() => {
        setSearchHistory(storage.get('search-history', []));
        setSearchMode(storage.get('search-mode', 'content'));
        setSearchResults([]);
        setSearchQuery('');
        setPreviewFilePath('');
        setPreviewFileName('');
        setPreviewLine(undefined);

        if (currentFolder && window.electronAPI) {
            window.electronAPI.getFileTree(currentFolder).then(tree => {
                setFileTree(tree);
            });
        }
    }, []);

    // Effect hooks - 依赖状态
    useEffect(() => {
        if (fileTree && fileTree.children) {
            const firstLevelDirs = fileTree.children
                .filter(child => child.isDirectory)
                .map(child => ({
                    label: child.name,
                    value: child.path
                }))
                .sort((a, b) => a.label.localeCompare(b.label));

            const options = [{ label: '/', value: currentFolder }, ...firstLevelDirs];
            setDirectories(options);
        } else {
            setDirectories([{ label: '/', value: currentFolder }]);
        }
    }, [fileTree]);


    return (<div style={{ height: '100%' }}>
        <Splitter style={{ height: '100%' }}>
            {/* 左侧面板 - 搜索 */}
            <Splitter.Panel defaultSize="40%" min="30%" max="60%">
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <Title level={4} style={{ margin: 0 }}>
                                    搜索
                                </Title>
                                <Radio.Group
                                    value={searchMode}
                                    onChange={(e) => setSearchMode(e.target.value)}
                                    size="small"
                                >
                                    <Radio.Button value="content">全文搜索</Radio.Button>
                                    <Radio.Button value="filename">文件名搜索</Radio.Button>
                                </Radio.Group>
                            </div>
                            {isSearching && (<Button
                                type="primary"
                                danger
                                size="small"
                                onClick={handleCancelSearch}
                            >
                                取消搜索
                            </Button>)}
                        </div>

                        {/* 搜索框和路径选择器组合（保持在一行） */}
                        <div style={{ marginBottom: 16 }}>
                            <Space.Compact style={{ width: '100%' }}>
                                <Select
                                    value={searchPath}
                                    onChange={setSearchPath}
                                    style={{ width: '30%' }}
                                    options={directories}
                                    showSearch
                                    optionFilterProp="label"
                                />
                                <Search
                                    placeholder={searchMode === 'content' ? '输入搜索关键词' : '输入文件名关键词'}
                                    allowClear
                                    enterButton={<SearchOutlined />}
                                    size="middle"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onSearch={handleSearch}
                                    loading={loading}
                                    style={{ width: '70%' }}
                                />
                            </Space.Compact>
                        </div>

                        {/* 搜索历史 */}
                        {searchHistory.length > 0 && !isSearching && searchResults.length === 0 && (
                            <Card size="small" title="搜索历史" style={{ marginBottom: 16 }}>
                                {searchHistory.map((item, index) => (
                                    <Button
                                        key={index}
                                        type="link"
                                        onClick={() => handleHistoryItemClick(item)}
                                        style={{ padding: '4px 8px', height: 'auto' }}
                                    >
                                        <HistoryOutlined style={{ marginRight: 8 }} />
                                        {item}
                                    </Button>
                                ))}
                            </Card>
                        )}

                        {/* 搜索结果展示 */}
                        <GlobalSearchResults
                            searchResults={searchResults}
                            searchQuery={searchQuery}
                            searchMode={searchMode}
                            searchPath={searchPath}
                            onResultClick={handleResultClick}
                        />
                    </div>
                </div>
            </Splitter.Panel>

            {/* 右侧面板 - 预览 */}
            <Splitter.Panel>
                <GlobalSearchPreview
                    filePath={previewFilePath}
                    fileName={previewFileName}
                    line={previewLine}
                    searchQuery={searchQuery}
                    onOpenFile={handleOpenFile}
                />
            </Splitter.Panel>
        </Splitter>
    </div>);
};