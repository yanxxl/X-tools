import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Button, Collapse, Space, Statistic, Typography, Switch, Select } from 'antd';
import { DownOutlined, FolderOutlined, UpOutlined } from '@ant-design/icons';

const { Option } = Select;
import { SearchMatch, SearchResult } from '../../types';

const { Text } = Typography;

interface GlobalSearchResultsProps {
    searchResults: SearchResult[];
    searchQuery: string;
    searchMode: 'content' | 'filename';
    searchPath: string;
    onResultClick: (filePath: string, fileName: string, line?: number) => void;
}

// 数字格式化函数 - 添加千分位分隔符
const formatNumber = (num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// 平台无关的路径处理函数
const dirname = (path: string): string => {
    const lastSeparatorIndex = Math.max(
        path.lastIndexOf('/'),
        path.lastIndexOf('\\')
    );
    return lastSeparatorIndex === -1 ? path : path.substring(0, lastSeparatorIndex);
};

const basename = (path: string): string => {
    const lastSeparatorIndex = Math.max(
        path.lastIndexOf('/'),
        path.lastIndexOf('\\')
    );
    return lastSeparatorIndex === -1 ? path : path.substring(lastSeparatorIndex + 1);
};

// 高亮文本中的搜索关键词
const highlightText = (text: string, query: string) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, idx) => part.toLowerCase() === query.toLowerCase() ? <Text strong key={idx} style={{ backgroundColor: '#fff3cd' }}>{part}</Text> : part);
};

export const GlobalSearchResults: React.FC<GlobalSearchResultsProps> = ({
    searchResults,
    searchQuery,
    searchMode,
    searchPath,
    onResultClick
}) => {
    // 状态
    const [groupByFolder, setGroupByFolder] = useState<boolean>(false);
    const [sortBy, setSortBy] = useState<'matches' | 'mtime' | 'name' | 'default'>('default');
    const [sortOrder, setSortOrder] = useState<'ascend' | 'descend'>('ascend');
    const [sortedResults, setSortedResults] = useState<SearchResult[]>([]);
    const [sortedGroupedResults, setSortedGroupedResults] = useState<{ [folder: string]: SearchResult[] }>({});
    const [totalMatches, setTotalMatches] = useState<number>(0);

    // 当搜索结果变化时，直接设置为默认排序
    useEffect(() => {
        setSortedResults([...searchResults]);
        const matches = searchResults.reduce((sum: number, r: SearchResult) => sum + r.matches.length, 0);
        setTotalMatches(matches);
    }, [searchResults]);

    // 当排序条件变化时，重新排序
    useEffect(() => {
        // 如果是默认排序，直接使用原始搜索结果的顺序
        if (sortBy === 'default') {
            setSortedResults([...searchResults]);
            return;
        }

        const results = [...searchResults];

        results.sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case 'name':
                    comparison = a.fileName.localeCompare(b.fileName);
                    break;
                case 'matches':
                    comparison = a.matches.length - b.matches.length;
                    break;
                case 'mtime':
                    // 假设 SearchResult 类型有 lastModified 属性
                    comparison = (a.lastModified || 0) - (b.lastModified || 0);
                    break;
                default:
                    break;
            }

            return sortOrder === 'ascend' ? comparison : -comparison;
        });

        setSortedResults(results);
    }, [sortBy, sortOrder]);

    // 按文件夹分组并排序的结果
    useEffect(() => {
        if (!groupByFolder) {
            setSortedGroupedResults({});
            return;
        }

        const folderGroups: { [folder: string]: SearchResult[] } = {};

        sortedResults.forEach(result => {
            const folderPath = dirname(result.filePath);
            if (!folderGroups[folderPath]) {
                folderGroups[folderPath] = [];
            }
            folderGroups[folderPath].push(result);
        });

        setSortedGroupedResults(folderGroups);
    }, [groupByFolder]);


    if (searchResults.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                <Text type="secondary">暂无搜索结果</Text>
            </div>
        );
    }

    const folderKeys = Object.keys(sortedGroupedResults);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* 搜索结果统计和排序 */}
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <Space size="small">
                    <Statistic
                        title=""
                        value={formatNumber(searchResults.length)}
                        valueStyle={{ fontSize: 14 }}
                        suffix="个文件"
                    />
                    {searchMode === 'content' && (
                        <Statistic
                            title=""
                            value={formatNumber(totalMatches)}
                            valueStyle={{ fontSize: 14 }}
                            suffix="条匹配"
                        />
                    )}
                </Space>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <Space size="small">
                        <Text type="secondary">分组:</Text>
                        <Switch
                            checked={groupByFolder}
                            onChange={setGroupByFolder}
                            size="small"
                        />
                    </Space>
                    <Space size="small">
                        <Text type="secondary">排序:</Text>
                        <Select
                            value={sortBy}
                            onChange={setSortBy}
                            size="small"
                            style={{ width: 120 }}
                        >
                            <Option value="default">默认</Option>
                            <Option value="name">文件名称</Option>
                            <Option value="matches">匹配数</Option>
                            <Option value="mtime">修改时间</Option>
                        </Select>
                        <Button
                            type="text"
                            size="small"
                            onClick={() => setSortOrder(sortOrder === 'ascend' ? 'descend' : 'ascend')}
                            icon={sortOrder === 'ascend' ? <UpOutlined /> : <DownOutlined />}
                        />
                    </Space>

                </div>
            </div>

            {/* 搜索结果列表 */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ height: '100%', overflowY: 'auto' }}>
                    {groupByFolder ? (
                        <Collapse
                            size="small"
                            items={folderKeys.map((folder, folderIdx) => ({
                                key: folderIdx.toString(),
                                label: (
                                    <Space>
                                        <FolderOutlined />
                                        <Text strong>
                                            {folder === searchPath ? '/' : folder.startsWith(searchPath) ? (() => {
                                                const searchPathLength = searchPath.length;
                                                let relativePath = folder.substring(searchPathLength);
                                                if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
                                                    relativePath = relativePath.substring(1);
                                                }
                                                return relativePath || '/';
                                            })() : basename(folder)}
                                        </Text>
                                        <Text type="secondary">
                                            ({sortedGroupedResults[folder].length} 个文件
                                            {searchMode === 'content' && (
                                                <span>, {sortedGroupedResults[folder].reduce((sum, result) => sum + result.matches.length, 0)} 条匹配</span>
                                            )})
                                        </Text>
                                    </Space>
                                ),
                                children: (
                                    <div style={{ paddingLeft: 24 }}>
                                        {sortedGroupedResults[folder].map((result, resultIdx) => (
                                            <div key={resultIdx}>
                                                <div
                                                    onClick={() => onResultClick(result.filePath, result.fileName, 1)}
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
                                                        <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                                                            ({result.matches.length} 条匹配)
                                                        </Text>
                                                    )}
                                                </div>
                                                {searchMode === 'content' && result.matches.length > 0 && (
                                                    <div style={{ paddingLeft: 16 }}>
                                                        {result.matches.map((match, matchIdx) => (
                                                            <div key={matchIdx} style={{ marginBottom: 8 }}>
                                                                <div
                                                                    onClick={() => onResultClick(result.filePath, result.fileName, match.line)}
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
                                                                        <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
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
                                )
                            }))}
                        />
                    ) : (
                        <Collapse size="small" style={{ padding: '0 8px' }} items={
                            sortedResults.map((result, resultIdx) => ({
                                key: resultIdx.toString(),
                                label: (
                                    <div
                                        onClick={() => onResultClick(result.filePath, result.fileName, 1)}
                                        style={{
                                            cursor: 'pointer',
                                            padding: '4px 0',
                                            fontSize: 14,
                                            color: '#1890ff',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        {highlightText(result.fileName, searchQuery)}
                                        {searchMode === 'content' && result.matches.length > 0 && (
                                            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                                                ({result.matches.length} 条匹配)
                                            </Text>
                                        )}
                                    </div>
                                ),
                                children: (
                                    searchMode === 'content' && result.matches.length > 0 && (
                                        <div style={{ paddingLeft: 16, marginTop: 8 }}>
                                            {result.matches.map((match, matchIdx) => (
                                                <div key={matchIdx} style={{ marginBottom: 8 }}>
                                                    <div
                                                        onClick={() => onResultClick(result.filePath, result.fileName, match.line)}
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
                                                            <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
                                                                第 {match.line} 行:
                                                            </Text>
                                                        ) : null}
                                                        {highlightText(match.content, searchQuery)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                )
                            }))
                        } />
                    )}
                </div>
            </div>
        </div>
    );
};