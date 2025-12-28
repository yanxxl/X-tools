import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Button, Card, Collapse, Empty, Input, message, Progress, Radio, Select, Skeleton, Space, Splitter, Statistic, Typography} from 'antd';
import {DownOutlined, FileTextOutlined, FolderOutlined, HistoryOutlined, SearchOutlined, UpOutlined} from '@ant-design/icons';
import {useAppContext} from '../../contexts/AppContext';
import {Center} from './Center';
import {isTextFile} from '../../utils/fileCommonUtil';

const {Search} = Input;
const {Title, Text} = Typography;
const {Panel} = Collapse;

interface SearchMatch {
    line: number;
    content: string;
}

interface SearchResult {
    filePath: string;
    fileName: string;
    matches: SearchMatch[];
}

// 样式常量
const HIGHLIGHT_COLOR = '#fff3cd';
const SEARCH_HIGHLIGHT_COLOR = '#ffeb3b';
const HIGHLIGHT_DURATION = 1500;
const SCROLL_DELAY = 300;

// 数字格式化函数 - 添加千分位分隔符
const formatNumber = (num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// 平台无关的路径处理函数
const dirname = (path: string): string => {
    // 使用平台无关的路径分隔符处理
    const lastSeparatorIndex = Math.max(
        path.lastIndexOf('/'),
        path.lastIndexOf('\\')
    );
    return lastSeparatorIndex === -1 ? path : path.substring(0, lastSeparatorIndex);
};

const basename = (path: string): string => {
    // 使用平台无关的路径分隔符处理
    const lastSeparatorIndex = Math.max(
        path.lastIndexOf('/'),
        path.lastIndexOf('\\')
    );
    return lastSeparatorIndex === -1 ? path : path.substring(lastSeparatorIndex + 1);
};

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
}

// 高亮文本中的搜索关键词
const highlightText = (text: string, query: string) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, idx) => part.toLowerCase() === query.toLowerCase() ? <Text strong key={idx} style={{backgroundColor: '#fff3cd'}}>{part}</Text> : part);
};

interface SearchSplitPanelProps {
    onClose: () => void;
}

export const GlobalSearch: React.FC<SearchSplitPanelProps> = ({onClose}) => {
    const {currentFolder, setCurrentFile} = useAppContext();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [sortBy, setSortBy] = useState<'name' | 'ctime' | 'mtime'>('name');
    const [progress, setProgress] = useState({
        totalFiles: 0, currentFile: 0, totalLines: 0
    });
    const [isSearching, setIsSearching] = useState(false);
    const [previewFile, setPreviewFile] = useState<{ filePath: string; fileName: string; line?: number } | null>(null);
    const [content, setContent] = useState<string>('');
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [searchPath, setSearchPath] = useState<string>(''); // 搜索路径
    const [subDirectories, setSubDirectories] = useState<Array<{ label: string, value: string }>>([]); // 子目录列表
    const [collapsedKeys, setCollapsedKeys] = useState<string[]>([]); // 折叠的文件key
    const [currentSearchId, setCurrentSearchId] = useState<string>(''); // 当前搜索ID
    const [searchMode, setSearchMode] = useState<'content' | 'filename'>('content'); // 搜索模式

    // 安全地从localStorage获取数据
    const getLocalStorageItem = useCallback((key: string) => {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn('无法访问localStorage:', e);
            return null;
        }
    }, []);

    // 安全地向localStorage设置数据
    const setLocalStorageItem = useCallback((key: string, value: string) => {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn('无法写入localStorage:', e);
        }
    }, []);

    // 初始化搜索历史、搜索路径和搜索模式
    useEffect(() => {
        // 从localStorage加载搜索历史
        const history = getLocalStorageItem('search-history');
        if (history) {
            try {
                const parsedHistory = JSON.parse(history);
                console.log('加载搜索历史:', parsedHistory);
                setSearchHistory(Array.isArray(parsedHistory) ? parsedHistory : []);
            } catch (e) {
                console.error('解析搜索历史失败:', e);
                setSearchHistory([]);
            }
        }

        // 设置默认搜索路径为当前文件夹
        if (currentFolder) {
            setSearchPath(currentFolder);

            // 从localStorage加载当前文件夹的搜索模式
            const savedSearchMode = getLocalStorageItem(`search-mode-${currentFolder}`);
            if (savedSearchMode === 'content' || savedSearchMode === 'filename') {
                setSearchMode(savedSearchMode);
            } else {
                setSearchMode('content'); // 默认为全文搜索
            }

            // 从localStorage加载当前文件夹的搜索路径
            const savedSearchPath = getLocalStorageItem(`search-path-${currentFolder}`);
            if (savedSearchPath && savedSearchPath.startsWith(currentFolder)) {
                setSearchPath(savedSearchPath);
            }
        }
    }, [currentFolder, getLocalStorageItem]);

    // 获取子目录列表（支持两层深度）
    useEffect(() => {
        if (currentFolder && window.electronAPI) {
            const loadSubDirectories = async () => {
                try {
                    // 获取第一层子目录
                    const children = await window.electronAPI.getDirectoryChildren(currentFolder);
                    const firstLevelDirs = children
                        .filter(child => child.isDirectory)
                        .map(child => ({
                            label: child.name, value: child.path
                        }))
                        .sort((a, b) => a.label.localeCompare(b.label)); // 排序

                    // 获取第二层子目录
                    const secondLevelDirs: Array<{ label: string, value: string }> = [];
                    for (const dir of firstLevelDirs) {
                        try {
                            const subChildren = await window.electronAPI.getDirectoryChildren(dir.value);
                            const subDirs = subChildren
                                .filter(child => child.isDirectory)
                                .map(child => ({
                                    label: `${dir.label}/${child.name}`, value: child.path
                                }))
                                .sort((a, b) => a.label.localeCompare(b.label)); // 排序
                            secondLevelDirs.push(...subDirs);
                        } catch (error) {
                            console.error(`获取子目录失败: ${dir.value}`, error);
                        }
                    }

                    // 构建选项列表：当前目录 + 一级目录 + 二级目录
                    const options = [{label: '/', value: currentFolder}, ...firstLevelDirs, ...secondLevelDirs];

                    setSubDirectories(options);
                } catch (error) {
                    console.error('获取子目录失败:', error);
                    // 出错时只包含当前目录
                    setSubDirectories([{label: '/', value: currentFolder}]);
                }
            };
            loadSubDirectories();
        }
    }, [currentFolder]);

    // 保存搜索历史到localStorage
    useEffect(() => {
        console.log('搜索历史更新:', searchHistory);
        if (Array.isArray(searchHistory) && searchHistory.length > 0) {
            console.log('保存搜索历史到localStorage:', searchHistory);
            setLocalStorageItem('search-history', JSON.stringify(searchHistory));
        }
    }, [searchHistory, setLocalStorageItem]);

    // 保存搜索模式到localStorage并在切换时清空结果
    useEffect(() => {
        if (currentFolder) {
            setLocalStorageItem(`search-mode-${currentFolder}`, searchMode);
        }
        // 切换模式时清空结果
        setSearchResults([]);
        setCollapsedKeys([]);
    }, [searchMode, currentFolder, setLocalStorageItem]);

    // 保存搜索路径到localStorage并在切换时清空结果
    useEffect(() => {
        if (currentFolder && searchPath && searchPath.startsWith(currentFolder)) {
            setLocalStorageItem(`search-path-${currentFolder}`, searchPath);
        }
        // 切换路径时清空结果
        setSearchResults([]);
        setCollapsedKeys([]);
    }, [searchPath, currentFolder, setLocalStorageItem]);

    // 当当前文件夹变化时，清空搜索结果
    useEffect(() => {
        setSearchResults([]);
        setSearchQuery('');
        if (currentFolder) {
            setSearchPath(currentFolder);
        }
        // 关闭预览视图
        setPreviewFile(null);
    }, [currentFolder]);

    // 进度更新回调
    const handleProgressUpdate = useCallback((progressData: { totalFiles: number; currentFile: number; totalLines: number }) => {
        setProgress(progressData);
    }, []);

    // 单个文件搜索结果回调
    const handleFileResult = useCallback((resultData: { searchId: string, data: SearchResult | null }) => {
        // 确保这是当前搜索的结果
        if (resultData.searchId !== currentSearchId) {
            return;
        }

        if (resultData.data === null) {
            // 搜索完成
            setIsSearching(false);
            setLoading(false);
            // 重新计算匹配总数
            setSearchResults(currentResults => {
                const totalMatches = currentResults.reduce((sum: number, r: SearchResult) => sum + r.matches.length, 0);
                message.success(`在 ${formatNumber(currentResults.length)} 个文件中找到 ${formatNumber(totalMatches)} 条匹配`);
                return currentResults; // 返回相同的结果，不改变状态
            });
        } else {
            // 添加新的搜索结果
            setSearchResults(prevResults => {
                // 检查是否已存在该文件的结果
                const existingIndex = prevResults.findIndex(r => r.filePath === resultData.data.filePath);
                if (existingIndex >= 0) {
                    // 合并匹配结果
                    const updatedResults = [...prevResults];
                    updatedResults[existingIndex] = {
                        ...updatedResults[existingIndex], matches: [...updatedResults[existingIndex].matches, ...resultData.data.matches]
                    };
                    return updatedResults;
                } else {
                    // 添加新文件的结果
                    return [...prevResults, resultData.data];
                }
            });
        }
    }, [currentSearchId]);

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

    // 监听单个文件搜索结果
    useEffect(() => {
        if (window.electronAPI && window.electronAPI.onSearchFileResult) {
            window.electronAPI.onSearchFileResult(handleFileResult);
        }

        return () => {
            if (window.electronAPI && window.electronAPI.offSearchFileResult) {
                window.electronAPI.offSearchFileResult(handleFileResult);
            }
        };
    }, [handleFileResult]);

    // 执行搜索
    const handleSearch = async (query: string) => {
        if (!searchPath) {
            message.warning('请选择搜索路径');
            return;
        }
        if (!query.trim()) {
            message.warning('请输入搜索关键词');
            return;
        }

        // 添加到搜索历史
        if (query.trim() && !searchHistory.includes(query.trim())) {
            const newHistory = [query.trim(), ...searchHistory.slice(0, 9)]; // 保持最多10条历史
            console.log('更新搜索历史:', newHistory);
            setSearchHistory(newHistory);
        } else if (query.trim()) {
            // 如果查询已存在于历史中，将其移到最前面
            const newHistory = [query.trim(), ...searchHistory.filter(item => item !== query.trim())];
            console.log('重新排列搜索历史:', newHistory);
            setSearchHistory(newHistory);
        }

        // 生成新的搜索ID
        const searchId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setCurrentSearchId(searchId);

        setLoading(true);
        setIsSearching(true);
        setSearchResults([]);
        setProgress({totalFiles: 0, currentFile: 0, totalLines: 0});
        setCollapsedKeys([]); // 展开所有文件

        try {
            await window.electronAPI.searchFilesContent(searchPath, query, searchId, searchMode);
        } catch (error) {
            console.error('搜索失败:', error);
            message.error('搜索失败，请重试');
            setLoading(false);
            setIsSearching(false);
        }
    };

    // 取消搜索
    const handleCancelSearch = async () => {
        if (currentSearchId && window.electronAPI) {
            try {
                const cancelled = await window.electronAPI.cancelSearch(currentSearchId);
                if (cancelled) {
                    setIsSearching(false);
                    setLoading(false);
                    message.info('搜索已取消');
                } else {
                    message.warning('无法取消搜索');
                }
            } catch (error) {
                console.error('取消搜索失败:', error);
                message.error('取消搜索失败');
            }
        }
    };

    // 按文件夹分组搜索结果
    const groupedResults = useMemo(() => {
        // 统一按文件夹分组
        const folderGroups: { [folder: string]: SearchResult[] } = {};

        searchResults.forEach(result => {
            const folderPath = dirname(result.filePath);
            if (!folderGroups[folderPath]) {
                folderGroups[folderPath] = [];
            }
            folderGroups[folderPath].push(result);
        });

        // 对每个文件夹内的结果按文件名排序
        Object.keys(folderGroups).forEach(folder => {
            folderGroups[folder].sort((a, b) => a.fileName.localeCompare(b.fileName));
        });

        return folderGroups;
    }, [searchResults]);

    // 计算统计数据
    const totalMatches = searchResults.reduce((sum: number, r: SearchResult) => sum + r.matches.length, 0);

    // 处理搜索历史项点击
    const handleHistoryItemClick = (query: string) => {
        setSearchQuery(query);
        handleSearch(query);
    };

    // 处理结果点击
    const handleResultClick = (filePath: string, fileName: string, line?: number) => {
        // 对于文件名搜索，我们不需要行号
        if (searchMode === 'filename') {
            setPreviewFile({filePath, fileName, line: undefined});
            loadFileContent(filePath);
            return;
        }
        
        // 只有当文件路径不同时才重新加载文件内容
        if (!previewFile || previewFile.filePath !== filePath) {
            setPreviewFile({filePath, fileName, line});
            loadFileContent(filePath);
        } else {
            // 同一文件的不同行跳转，只需更新行号和目标行
            setPreviewFile({...previewFile, line});
        }

        // 延迟执行滚动以确保DOM已更新
        setTimeout(() => {
            if (line) {
                const targetElement = document.getElementById(`search-preview-line-${line}`);
                if (targetElement) {
                    targetElement.scrollIntoView({behavior: 'smooth', block: 'center'});
                    targetElement.style.backgroundColor = HIGHLIGHT_COLOR;
                    setTimeout(() => {
                        targetElement.style.backgroundColor = '';
                    }, HIGHLIGHT_DURATION);
                }
            }
        }, SCROLL_DELAY);
    };

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

    // 处理打开文件
    const handleOpenFile = (filePath: string, fileName: string) => {
        setCurrentFile(filePath);
        onClose();
    };

    // 切换文件折叠状态
    const toggleFileCollapse = (fileKey: string) => {
        if (collapsedKeys.includes(fileKey)) {
            setCollapsedKeys(collapsedKeys.filter(key => key !== fileKey));
        } else {
            setCollapsedKeys([...collapsedKeys, fileKey]);
        }
    };

    // 全部折叠/展开
    const toggleAllCollapse = () => {
        const folderGroups = groupedResults;
        const totalItems = Object.keys(folderGroups).length;
        if (collapsedKeys.length === totalItems) {
            // 当前全部折叠，执行展开（清空折叠key）
            setCollapsedKeys([]);
        } else {
            // 当前部分或全部展开，执行折叠（设置所有文件夹key为折叠状态）
            const allKeys = Object.keys(folderGroups).map((_, idx) => idx.toString());
            setCollapsedKeys(allKeys);
        }
    };

    // 检查是否全部折叠
    const isAllCollapsed = useMemo(() => {
        const folderGroups = groupedResults;
        return collapsedKeys.length === Object.keys(folderGroups).length && Object.keys(folderGroups).length > 0;
    }, [collapsedKeys, groupedResults]);

    return (<div style={{height: '100%'}}>
        <Splitter style={{height: '100%'}}>
            {/* 左侧面板 - 搜索 */}
            <Splitter.Panel defaultSize="40%" min="30%" max="60%">
                <div style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
                    <div style={{padding: 16, height: '100%', display: 'flex', flexDirection: 'column'}}>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16
                        }}>
                            <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                                <Title level={4} style={{margin: 0}}>
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
                        <div style={{marginBottom: 16}}>
                            <Space.Compact style={{width: '100%'}}>
                                <Select
                                    value={searchPath}
                                    onChange={setSearchPath}
                                    style={{width: '30%'}}
                                    options={subDirectories}
                                    showSearch
                                    optionFilterProp="label"
                                />
                                <Search
                                    placeholder={searchMode === 'content' ? '输入搜索关键词' : '输入文件名关键词'}
                                    allowClear
                                    enterButton={<SearchOutlined/>}
                                    size="middle"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onSearch={handleSearch}
                                    loading={loading}
                                    style={{width: '70%'}}
                                />
                            </Space.Compact>
                        </div>

                        {/* 搜索历史 */}
                        {searchHistory.length > 0 && !isSearching && searchResults.length === 0 && (<Card size="small" title="搜索历史" style={{marginBottom: 16}}>
                            {searchHistory.map((item, index) => (<Button
                                key={index}
                                type="link"
                                onClick={() => handleHistoryItemClick(item)}
                                style={{padding: '4px 8px', height: 'auto'}}
                            >
                                <HistoryOutlined style={{marginRight: 8}}/>
                                {item}
                            </Button>))}
                        </Card>)}

                        {/* 搜索进度显示 */}
                        {isSearching && (<Card size="small" style={{marginBottom: 16}}>
                            <div style={{marginBottom: 8}}>
                                <Text type="secondary">
                                    {progress.totalFiles > 0 ? `正在搜索: ${formatNumber(progress.currentFile)}/${formatNumber(progress.totalFiles)} 个文件` : '正在统计文件数量...'}
                                </Text>
                            </div>
                            <Progress
                                percent={progress.totalFiles > 0 ? Math.round((progress.currentFile / progress.totalFiles) * 100) : 0}
                                size="small"
                                status="active"
                            />
                            <div style={{marginTop: 8, fontSize: 12}}>
                                <Text type="secondary">
                                    已搜索 {formatNumber(progress.totalLines)} 行
                                </Text>
                            </div>
                        </Card>)}

                        {/* 搜索结果统计和排序（紧凑模式，保持在一行） */}
                        {searchResults.length > 0 && (<div style={{marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <Space size="small">
                                <Statistic
                                    title=""
                                    value={formatNumber(searchResults.length)}
                                    valueStyle={{fontSize: 14}}
                                    suffix="个文件"
                                />
                                {searchMode === 'content' && (
                                    <Statistic
                                        title=""
                                        value={formatNumber(totalMatches)}
                                        valueStyle={{fontSize: 14}}
                                        suffix="条匹配"
                                    />
                                )}
                            </Space>
                            <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                                <Space size="small">
                                    <Text type="secondary">排序:</Text>
                                    <Select
                                        size="small"
                                        value={sortBy}
                                        onChange={setSortBy}
                                        style={{width: 90}}
                                        options={[{label: '文件名', value: 'name'}, {label: '创建时间', value: 'ctime'}, {label: '修改时间', value: 'mtime'}]}
                                    />
                                </Space>
                                <Button
                                    type="link"
                                    size="small"
                                    onClick={toggleAllCollapse}
                                    icon={isAllCollapsed ? <DownOutlined/> : <UpOutlined/>}
                                >
                                    {!isAllCollapsed ? '展开' : '折叠'}
                                </Button>
                            </div>
                        </div>)}

                        {/* 搜索结果列表 */}
                        <div style={{flex: 1, overflow: 'auto'}}>
                            {(() => {
                                const folderGroups = groupedResults;
                                const folderKeys = Object.keys(folderGroups);
                                return folderKeys.length > 0 ? (<Collapse
                                    activeKey={collapsedKeys.map(key => key.toString())}
                                    onChange={(keys) => setCollapsedKeys(Array.isArray(keys) ? keys : [keys])}
                                    size="small"
                                >
                                    {folderKeys.map((folder, folderIdx) => (
                                        <Panel
                                            key={folderIdx.toString()}
                                            header={<Space>
                                                <FolderOutlined/>
                                                <Text
                                                    strong>{folder === searchPath ? '/' : folder.startsWith(searchPath) ? (() => {
                                                        // 计算相对路径，处理不同平台的路径分隔符
                                                        const searchPathLength = searchPath.length;
                                                        let relativePath = folder.substring(searchPathLength);
                                                        // 移除开头的路径分隔符
                                                        if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
                                                            relativePath = relativePath.substring(1);
                                                        }
                                                        return relativePath || '/';
                                                    })() : basename(folder)}</Text>
                                                <Text type="secondary">
                                                    ({folderGroups[folder].length} 个文件
                                                    {searchMode === 'content' && (
                                                        <span>, {folderGroups[folder].reduce((sum, result) => sum + result.matches.length, 0)} 条匹配</span>
                                                    )}
                                                    )
                                                </Text>
                                            </Space>}
                                        >
                                            <div style={{paddingLeft: 24}}>
                                                {folderGroups[folder].map((result, resultIdx) => (
                                                    <div key={resultIdx}>
                                                        <div
                                                            onClick={() => handleResultClick(result.filePath, result.fileName, 1)}
                                                            style={{
                                                                cursor: 'pointer',
                                                                padding: '8px 0',
                                                                fontSize: 14,
                                                                color: '#1890ff',
                                                                fontWeight: 'bold'
                                                            }}
                                                        >
                                                            {highlightText(result.fileName, searchQuery)}
                                                            {searchMode === 'content' && result.matches.length > 0 && (
                                                                <Text type="secondary" style={{fontSize: 12, marginLeft: 8}}>
                                                                    ({result.matches.length} 条匹配)
                                                                </Text>
                                                            )}
                                                        </div>
                                                        {searchMode === 'content' && result.matches.length > 0 && (
                                                            <div style={{paddingLeft: 16}}>
                                                                {result.matches.map((match, matchIdx) => (
                                                                    <div key={matchIdx} style={{marginBottom: 8}}>
                                                                        <div
                                                                            onClick={() => handleResultClick(result.filePath, result.fileName, match.line)}
                                                                            style={{
                                                                                cursor: 'pointer',
                                                                                padding: '4px 8px',
                                                                                background: '#f5f5f5',
                                                                                borderRadius: '4px',
                                                                                fontSize: 14,
                                                                                wordBreak: 'break-word',
                                                                                transition: 'background 0.2s'
                                                                            }}
                                                                            onMouseEnter={(e) => e.currentTarget.style.background = '#e6f7ff'}
                                                                            onMouseLeave={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                                                        >
                                                                            {match.line > 0 ? (
                                                                                <Text type="secondary" style={{fontSize: 12, marginRight: 8}}>
                                                                                    第 {match.line} 行:
                                                                                </Text>
                                                                            ) : null}
                                                                            {highlightText(match.content, searchQuery)}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </Panel>
                                    ))}
                                </Collapse>) : isSearching ? null : (<div style={{textAlign: 'center', padding: 40, color: '#999'}}>
                                    <Text type="secondary">输入关键词开始搜索</Text>
                                </div>);
                            })()}
                        </div>
                    </div>
                </div>
            </Splitter.Panel>

            {/* 右侧面板 - 预览 */}
            <Splitter.Panel>
                <div style={{height: '100%', display: 'flex', flexDirection: 'column', padding: 16}}>
                    {previewFile ? (<div style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
                        {/* 预览标题栏 */}
                        <div style={{
                            padding: '8px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa',
                        }}>
                            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                                <FileTextOutlined/>
                                <h2 style={{margin: 0, fontSize: '16px', fontWeight: 500}}>
                                    {previewFile.fileName}
                                    {previewFile.line && (<span style={{color: '#999', fontSize: '14px', marginLeft: '8px'}}>
                                                    (行 {previewFile.line})
                                                </span>)}
                                </h2>
                            </div>
                            <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                                <Button
                                    type="primary"
                                    size="small"
                                    onClick={() => handleOpenFile(previewFile.filePath, previewFile.fileName)}
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
                </div>
            </Splitter.Panel>
        </Splitter>
    </div>);
};