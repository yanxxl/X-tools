import React, {useMemo, useState} from 'react';
import {Button, Collapse, Space, Statistic, Typography} from 'antd';
import {DownOutlined, FolderOutlined, UpOutlined} from '@ant-design/icons';
import { SearchMatch, SearchResult } from '../../types';

const {Text} = Typography;
const {Panel} = Collapse;

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
    return parts.map((part, idx) => part.toLowerCase() === query.toLowerCase() ? <Text strong key={idx} style={{backgroundColor: '#fff3cd'}}>{part}</Text> : part);
};

export const GlobalSearchResults: React.FC<GlobalSearchResultsProps> = ({
    searchResults,
    searchQuery,
    searchMode,
    searchPath,
    onResultClick
}) => {
    const [collapsedKeys, setCollapsedKeys] = useState<string[]>([]);
    // 按文件夹分组搜索结果
    const groupedResults = useMemo(() => {
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

    // 检查是否全部折叠
    const isAllCollapsed = useMemo(() => {
        const folderGroups = groupedResults;
        return collapsedKeys.length === Object.keys(folderGroups).length && Object.keys(folderGroups).length > 0;
    }, [collapsedKeys, groupedResults]);

    // 处理折叠状态变化
    const handleCollapseChange = (keys: string | string[]) => {
        setCollapsedKeys(Array.isArray(keys) ? keys : [keys]);
    };

    // 全部折叠/展开
    const handleToggleAllCollapse = () => {
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

    if (searchResults.length === 0) {
        return (
            <div style={{textAlign: 'center', padding: 40, color: '#999'}}>
                <Text type="secondary">输入关键词开始搜索</Text>
            </div>
        );
    }

    const folderGroups = groupedResults;
    const folderKeys = Object.keys(folderGroups);

    return (
        <div style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
            {/* 搜索结果统计和排序 */}
            <div style={{marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
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
                        {/*<Text type="secondary">{sortBy === 'name' ? '文件名' : sortBy === 'ctime' ? '创建时间' : '修改时间'}</Text>*/}
                    </Space>
                    <Button
                        type="link"
                        size="small"
                        onClick={handleToggleAllCollapse}
                        icon={isAllCollapsed ? <DownOutlined/> : <UpOutlined/>}
                    >
                        {!isAllCollapsed ? '展开' : '折叠'}
                    </Button>
                </div>
            </div>

            {/* 搜索结果列表 */}
            <div style={{flex: 1, overflow: 'auto'}}>
                <Collapse
                    activeKey={collapsedKeys.map(key => key.toString())}
                    onChange={handleCollapseChange}
                    size="small"
                >
                    {folderKeys.map((folder, folderIdx) => (
                        <Panel
                            key={folderIdx.toString()}
                            header={
                                <Space>
                                    <FolderOutlined/>
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
                                        ({folderGroups[folder].length} 个文件
                                        {searchMode === 'content' && (
                                            <span>, {folderGroups[folder].reduce((sum, result) => sum + result.matches.length, 0)} 条匹配</span>
                                        )})
                                    </Text>
                                </Space>
                            }
                        >
                            <div style={{paddingLeft: 24}}>
                                {folderGroups[folder].map((result, resultIdx) => (
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
                </Collapse>
            </div>
        </div>
    );
};