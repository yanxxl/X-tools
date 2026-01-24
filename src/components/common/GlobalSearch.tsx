import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, Input, message, Radio, Select, Space, Splitter, Typography } from 'antd';
import { storage } from '../../utils/storage';
import { HistoryOutlined, SearchOutlined } from '@ant-design/icons';
import { useAppContext } from '../../contexts/AppContext';
import { GlobalSearchPreview } from './GlobalSearchPreview';
import { GlobalSearchResults } from './GlobalSearchResults';
import { FileNode } from '../../types';
import { extractPathsFromTree } from '../../utils/fileTreeUtils';
import { isTextFile } from '../../utils/fileCommonUtil';

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
    const { currentFolder } = useAppContext();

    // 状态定义
    const [searching, setSearching] = useState(false);    
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [directories, setDirectories] = useState<Array<{ label: string, value: string }>>([]);
    // 搜索条件
    const [searchQuery, setSearchQuery] = useState('');
    const [searchPath, setSearchPath] = useState<string>('');
    const [searchMode, setSearchMode] = useState<'content' | 'filename'>('content');
    // 搜索结果
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    // 预览状态
    const [previewFilePath, setPreviewFilePath] = useState<string>('');
    const [previewFileName, setPreviewFileName] = useState<string>('');
    const [previewLine, setPreviewLine] = useState<number | undefined>(undefined);
    // 文件树
    const [fileTree, setFileTree] = useState<FileNode | undefined>(undefined);
    
    const cancelSearchRef = useRef(false);
    
    // 事件处理函数
    const handleResultClick = (filePath: string, fileName: string, line?: number) => {
        setPreviewFilePath(filePath);
        setPreviewFileName(fileName);
        setPreviewLine(line);
    };

    const handleSearch = () => {
        if (!searchQuery.trim()) {
            message.warning('请输入搜索关键词');
            return;
        }

        setSearching(true);
        cancelSearchRef.current = false;
        setSearchResults([]);

        // 生成待搜索文件列表
        const allFiles = extractPathsFromTree(fileTree);

        // 过滤出待搜索文件
        const searchFiles = allFiles.filter(file => {
            if (!isTextFile(file)) {
                return false;
            }

            // 如果选择了路径，只搜索该路径下的文件
            if (searchPath !== currentFolder) {
                return file.startsWith(searchPath);
            }
            // 否则搜索所有文件
            return true;
        });

        console.log(`待搜索文件数: ${searchFiles.length}`);

        // 顺序执行搜索
        const executeSearchSequentially = async () => {
            const totalFiles = searchFiles.length;

            for (let i = 0; i < totalFiles; i++) {
                // 检查是否需要取消搜索
                if (cancelSearchRef.current) {
                    console.log('搜索已取消');
                    break;
                }

                const file = searchFiles[i];
                
                console.log(`搜索文件: ${file}`);
                try {
                    const result = await window.electronAPI.threadPoolExecute('searchFileContent', [file, searchQuery, searchMode]);
                    if (result.success && result.result && !cancelSearchRef.current) {
                        console.log(`搜索到匹配项: ${file} , ${result.result.matches.length} 个匹配`);
                        setSearchResults(prev => [...prev, result.result]);
                    }
                } catch (error) {
                    console.error(`搜索文件失败: ${file}`, error);
                }
            }

            setSearching(false);
            cancelSearchRef.current = false;
        };

        // 开始执行搜索
        executeSearchSequentially();

        setSearchHistory(prev => {
            const newHistory = [searchQuery, ...prev.filter(item => item !== searchQuery)];
            storage.set('search-history', newHistory);
            return newHistory.slice(0, 10);
        });
    };

    const handleCancelSearch = () => {
        cancelSearchRef.current = true;
        setSearching(false);
    };

    // Effect hooks - 初始化
    useEffect(() => {
        setSearchHistory(storage.get('search-history', []));
        setSearchMode(storage.get('search-mode', 'content'));

        setSearchPath(currentFolder);
        setSearchQuery('');
        setSearchResults([]);
        
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
                            {searching && (<Button
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
                                />
                                <Search
                                    placeholder={searchMode === 'content' ? '输入搜索关键词' : '输入文件名关键词'}
                                    allowClear
                                    enterButton={<SearchOutlined />}
                                    size="middle"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onSearch={handleSearch}
                                    loading={searching}
                                    style={{ width: '70%' }}
                                />
                            </Space.Compact>
                        </div>

                        {/* 搜索历史 */}
                        {searchHistory.length > 0 && !searching && searchResults.length === 0 && (
                            <Card size="small" title="搜索历史" style={{ marginBottom: 16 }}>
                                {searchHistory.map((item, index) => (
                                    <Button
                                        key={index}
                                        type="link"
                                        onClick={() => setSearchQuery(item)}
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
                />
            </Splitter.Panel>
        </Splitter>
    </div>);
};