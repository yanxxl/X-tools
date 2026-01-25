import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, Input, message, Radio, Select, Space, Splitter, Typography } from 'antd';
import { storage } from '../../utils/storage';
import { HistoryOutlined, SearchOutlined } from '@ant-design/icons';
import { useAppContext } from '../../contexts/AppContext';
import { GlobalSearchPreview } from './GlobalSearchPreview';
import { GlobalSearchResults } from './GlobalSearchResults';
import { FileNode, SearchMatch, SearchResult } from '../../types';
import { extractPathsFromTree } from '../../utils/fileTreeUtils';
import { isTextFile } from '../../utils/fileCommonUtil';
import Title from 'antd/es/typography/Title';
import Search from 'antd/es/input/Search';

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
    // 搜索进度
    const [totalFiles, setTotalFiles] = useState<number>(0);
    const [completedFiles, setCompletedFiles] = useState<number>(0);
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
        setSearchResults([]);
        cancelSearchRef.current = false;

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

        // 初始化搜索进度
        const total = searchFiles.length;
        setTotalFiles(total);
        setCompletedFiles(0);

        console.log(`待搜索文件数: ${total}`);

        // 并发执行搜索，最多 6 个并发
        const executeSearchConcurrently = async () => {
            const totalFiles = searchFiles.length;
            const maxConcurrent = 6;
            let activeTasks = 0;
            let currentIndex = 0;

            const processNextFile = async () => {
                // 检查是否需要取消搜索
                if (cancelSearchRef.current) {
                    console.log('搜索已取消');
                    setSearching(false);
                    return;
                }

                // 检查是否所有文件都已处理
                if (currentIndex >= totalFiles) {
                    return;
                }

                // 增加活跃任务计数
                activeTasks++;

                const file = searchFiles[currentIndex];
                currentIndex++;

                console.log(`搜索文件: ${file}`);
                try {
                    const result = await window.electronAPI.threadPoolExecute('searchFileContent', [file, searchQuery, searchMode]);
                    if (result.success && result.result && !cancelSearchRef.current) {
                        console.log(`搜索结果: ${file} , ${result.result.matches.length} 个匹配，耗时 ${result.result.searchTime} ms`);
                        setSearchResults(prev => [...prev, result.result]);
                    }
                } catch (error) {
                    console.error(`搜索文件失败: ${file}`, error);
                } finally {
                    // 更新已完成文件数
                    setCompletedFiles(prev => prev + 1);
                    // 减少活跃任务计数
                    activeTasks--;
                    // 继续处理下一个文件
                    if (!cancelSearchRef.current) {
                        processNextFile();
                    }
                }
            };

            // 启动初始并发任务
            for (let i = 0; i < Math.min(maxConcurrent, totalFiles); i++) {
                processNextFile();
            }

            // 等待所有任务完成
            const checkCompletion = setInterval(() => {
                if (activeTasks === 0 && currentIndex >= totalFiles) {
                    clearInterval(checkCompletion);
                    setSearching(false);
                    cancelSearchRef.current = false;
                    // 重置进度状态
                    setTotalFiles(0);
                    setCompletedFiles(0);
                }
            }, 100);
        };

        // 开始执行搜索
        executeSearchConcurrently();

        setSearchHistory(prev => {
            const newHistory = [searchQuery, ...prev.filter(item => item !== searchQuery)];
            storage.set('search-history', newHistory);
            return newHistory.slice(0, 10);
        });
    };

    const handleCancelSearch = () => {
        cancelSearchRef.current = true;
        setSearching(false);
        // 重置进度状态
        setTotalFiles(0);
        setCompletedFiles(0);
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

    useEffect(() => {
        if (searchQuery.trim().length == 0) {
            setSearchHistory(storage.get('search-history', []));
            setSearchMode(storage.get('search-mode', 'content'));

            setSearchPath(currentFolder);
            setSearchQuery('');
            setSearchResults([]);

            setPreviewFilePath('');
            setPreviewFileName('');
            setPreviewLine(undefined);
        }
    }, [searchQuery]);


    return (
        <Splitter style={{ height: '100%', overflow: 'hidden' }}>
            {/* 左侧面板 - 搜索 */}
            <Splitter.Panel defaultSize="40%" min="30%" max="60%" style={{ overflow: 'hidden' }}>
                <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
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
                        {searching && (
                            <Space>
                                <Typography.Text style={{ fontSize: '14px' }}>
                                    已搜索 {completedFiles}/{totalFiles} 文件
                                </Typography.Text>
                                <Button
                                    type="primary"
                                    danger
                                    size="small"
                                    onClick={handleCancelSearch}
                                >
                                    取消
                                </Button>
                            </Space>
                        )}
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
                                onSearch={(v, e, i) => i?.source === 'input' && handleSearch()}
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
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <GlobalSearchResults
                            searchResults={searchResults}
                            searchQuery={searchQuery}
                            searchMode={searchMode}
                            searchPath={searchPath}
                            searching={searching}
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
    );
};