import React, { useState, useEffect } from 'react';
import { Card, List, Typography, Tag, Space } from 'antd';
import { FileTextOutlined, ClockCircleOutlined, FolderOutlined } from '@ant-design/icons';
import { useAppContext } from '../../contexts/AppContext';

const { Text } = Typography;

interface FileHistoryItem {
    path: string;
    name: string;
    timestamp: number;
    type: 'file' | 'folder';
}

// 文件历史工具窗口
export const FileHistoryWindow: React.FC = () => {
    const [history, setHistory] = useState<FileHistoryItem[]>([]);

    useEffect(() => {
        // 模拟文件历史数据
        const mockHistory: FileHistoryItem[] = [
            { path: '/Users/yan/projects/X-tools/src/App.tsx', name: 'App.tsx', timestamp: Date.now() - 1000 * 60 * 5, type: 'file' },
            { path: '/Users/yan/projects/X-tools/package.json', name: 'package.json', timestamp: Date.now() - 1000 * 60 * 15, type: 'file' },
            { path: '/Users/yan/projects/X-tools/src/components', name: 'components', timestamp: Date.now() - 1000 * 60 * 30, type: 'folder' },
            { path: '/Users/yan/projects/X-tools/README.md', name: 'README.md', timestamp: Date.now() - 1000 * 60 * 60, type: 'file' },
        ];
        setHistory(mockHistory);
    }, []);

    const formatTime = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        
        if (minutes < 60) {
            return `${minutes} 分钟前`;
        } else if (hours < 24) {
            return `${hours} 小时前`;
        } else {
            return new Date(timestamp).toLocaleDateString();
        }
    };

    return (
        <div style={{ padding: '12px', height: '100%' }}>
            <Card title="最近访问" size="small" style={{ height: '100%' }}>
                <List
                    size="small"
                    dataSource={history}
                    renderItem={(item) => (
                        <List.Item>
                            <List.Item.Meta
                                avatar={
                                    item.type === 'file' ? 
                                    <FileTextOutlined style={{ color: '#1890ff' }} /> : 
                                    <FolderOutlined style={{ color: '#faad14' }} />
                                }
                                title={
                                    <Space>
                                        <Text strong>{item.name}</Text>
                                        <Tag color="blue" size="small">{item.type}</Tag>
                                    </Space>
                                }
                                description={
                                    <Space>
                                        <ClockCircleOutlined style={{ fontSize: '12px' }} />
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            {formatTime(item.timestamp)}
                                        </Text>
                                    </Space>
                                }
                            />
                        </List.Item>
                    )}
                />
            </Card>
        </div>
    );
};

// 搜索工具窗口
export const SearchWindow: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<string[]>([]);

    useEffect(() => {
        // 模拟搜索结果
        if (searchQuery) {
            const mockResults = [
                `包含 "${searchQuery}" 的文件1.ts`,
                `包含 "${searchQuery}" 的文件2.js`,
                `包含 "${searchQuery}" 的文件3.md`,
            ];
            setSearchResults(mockResults);
        } else {
            setSearchResults([]);
        }
    }, [searchQuery]);

    return (
        <div style={{ padding: '12px', height: '100%' }}>
            <Card title="搜索" size="small" style={{ height: '100%' }}>
                <div style={{ marginBottom: 16 }}>
                    <input
                        type="text"
                        placeholder="输入搜索内容..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #d9d9d9',
                            borderRadius: '6px',
                            fontSize: '14px'
                        }}
                    />
                </div>
                <List
                    size="small"
                    dataSource={searchResults}
                    renderItem={(item) => (
                        <List.Item>
                            <Text>{item}</Text>
                        </List.Item>
                    )}
                />
            </Card>
        </div>
    );
};

// 属性工具窗口
export const PropertiesWindow: React.FC = () => {
    const { currentFile } = useAppContext();
    
    return (
        <div style={{ padding: '12px', height: '100%' }}>
            <Card title="属性" size="small" style={{ height: '100%' }}>
                {currentFile ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div>
                            <Text strong>名称：</Text>
                            <Text>{currentFile.name || '-'}</Text>
                        </div>
                        <div>
                            <Text strong>路径：</Text>
                            <Text copyable style={{ wordBreak: 'break-all' }}>
                                {currentFile.path || '-'}
                            </Text>
                        </div>
                        <div>
                            <Text strong>类型：</Text>
                            <Text>{currentFile.isDirectory ? '目录' : '文件'}</Text>
                        </div>
                    </div>
                ) : (
                    <Text type="secondary">请选择一个文件或目录查看属性</Text>
                )}
            </Card>
        </div>
    );
};