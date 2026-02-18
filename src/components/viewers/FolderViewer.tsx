import React, { useEffect, useState } from 'react';
import { Card, Space, Switch, Table, Typography, Empty, Spin, Statistic, Row, Col, type TableColumnType } from 'antd';
import { FileOutlined, FolderOutlined } from '@ant-design/icons';
import { FileNode } from '../../types';
import { useAppContext } from '../../contexts/AppContext';
import { FileIcon } from '../common/FileIcon';
import { basename } from '../../utils/fileCommonUtil';

interface FileStats {
    ext: string;
    count: number;
    totalSize: number;
}

interface FolderStats {
    totalFolders: number;
    totalFiles: number;
    totalSize: number;
    byExtension: FileStats[];
    fileList: FileNode[];
}

interface FolderViewerProps {
    folderPath?: string;
}

export const FolderViewer: React.FC<FolderViewerProps> = ({ folderPath }) => {
    const { currentFolder } = useAppContext();
    const targetFolder = folderPath || currentFolder;
    const [loading, setLoading] = useState(false);
    const [showHiddenFiles, setShowHiddenFiles] = useState(false);
    const [includeSubfolders, setIncludeSubfolders] = useState(false);
    const [stats, setStats] = useState<FolderStats | null>(null);
    const [fileListPageSize, setFileListPageSize] = useState(20);
    const [extensionPageSize, setExtensionPageSize] = useState(10);

    const formatSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    };

    const isHiddenFile = (fileName: string): boolean => {
        return fileName.startsWith('.');
    };

    const collectFileStats = (node: FileNode, includeSub: boolean, showHidden: boolean): { files: FileNode[], folders: FileNode[], stats: Map<string, { count: number, totalSize: number }> } => {
        const files: FileNode[] = [];
        const folders: FileNode[] = [];
        const extStats = new Map<string, { count: number, totalSize: number }>();

        const traverse = (currentNode: FileNode, isRoot = false) => {
            if (!currentNode.isDirectory) {
                if (showHidden || !isHiddenFile(currentNode.name)) {
                    files.push(currentNode);
                    const ext = currentNode.name.includes('.') ? currentNode.name.split('.').pop()?.toLowerCase() || '(no extension)' : '(no extension)';
                    const existing = extStats.get(ext) || { count: 0, totalSize: 0 };
                    existing.count++;
                    existing.totalSize += currentNode.size || 0;
                    extStats.set(ext, existing);
                }
            } else {
                if (!isRoot && (showHidden || !isHiddenFile(currentNode.name))) {
                    folders.push(currentNode);
                }
                if (currentNode.children) {
                    currentNode.children.forEach(child => traverse(child));
                }
            }
        };

        traverse(node, true);
        return { files, folders, stats: extStats };
    };

    const loadFolderStats = async () => {
        if (!targetFolder) {
            setStats(null);
            return;
        }

        setLoading(true);
        try {
            const tree = await window.electronAPI.getFileTree(targetFolder, includeSubfolders, showHiddenFiles);

            const { files, folders, stats: extStats } = collectFileStats(tree, includeSubfolders, showHiddenFiles);

            const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
            const byExtension: FileStats[] = Array.from(extStats.entries())
                .map(([ext, data]) => ({
                    ext,
                    count: data.count,
                    totalSize: data.totalSize
                }))
                .sort((a, b) => b.totalSize - a.totalSize);

            setStats({
                totalFolders: folders.length,
                totalFiles: files.length,
                totalSize,
                byExtension,
                fileList: files
            });
        } catch (error) {
            console.error('加载文件夹统计失败:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFolderStats();
    }, [targetFolder, showHiddenFiles, includeSubfolders]);

    const columns = [
        {
            title: '文件类型',
            dataIndex: 'ext',
            key: 'ext',
            render: (ext: string) => (
                <Space>
                    <FileIcon fileName={`test.${ext}`} isDirectory={false} />
                    <span>{ext}</span>
                </Space>
            ),
            sorter: (a: FileStats, b: FileStats) => a.ext.localeCompare(b.ext)
        },
        {
            title: '文件数量',
            dataIndex: 'count',
            key: 'count',
            sorter: (a: FileStats, b: FileStats) => a.count - b.count
        },
        {
            title: '占用空间',
            dataIndex: 'totalSize',
            key: 'totalSize',
            align: 'right' as const,
            render: (size: number) => formatSize(size),
            sorter: (a: FileStats, b: FileStats) => a.totalSize - b.totalSize
        }
    ];

    const fileColumns = [
        {
            title: '文件路径',
            dataIndex: 'path',
            key: 'path',
            ellipsis: true,
            render: (path: string) => (
                <Space>
                    <FileIcon fileName={path} isDirectory={false} />
                    <span>{path}</span>
                </Space>
            ),
            sorter: (a: FileNode, b: FileNode) => a.path.localeCompare(b.path)
        },
        {
            title: '占用空间',
            dataIndex: 'size',
            key: 'size',
            width: 150,
            align: 'right' as const,
            render: (size: number) => formatSize(size),
            sorter: (a: FileNode, b: FileNode) => (a.size || 0) - (b.size || 0)
        }
    ];

    if (!currentFolder) {
        return (
            <div style={{ padding: '24px', textAlign: 'center' }}>
                <Empty description="请先选择一个文件夹" />
            </div>
        );
    }

    return (
        <div style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
            <Card
                title={
                    <Space>
                        <FolderOutlined />
                        <span>{basename(targetFolder || '')} - 文件夹统计</span>
                    </Space>
                }
                extra={
                    <Space>
                        <Space size="small">
                            <Typography.Text style={{ fontSize: '12px' }}>包含隐藏文件</Typography.Text>
                            <Switch
                                size="small"
                                checked={showHiddenFiles}
                                onChange={setShowHiddenFiles}
                            />
                        </Space>
                        <Space size="small">
                            <Typography.Text style={{ fontSize: '12px' }}>包含子文件夹</Typography.Text>
                            <Switch
                                size="small"
                                checked={includeSubfolders}
                                onChange={setIncludeSubfolders}
                            />
                        </Space>
                    </Space>
                }
            >
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '48px' }}>
                        <Spin size="large" />
                    </div>
                ) : stats ? (
                    <div>
                        <Row gutter={16} style={{ marginBottom: '24px' }}>
                            <Col span={8}>
                                <Statistic
                                    title="文件夹数"
                                    value={stats.totalFolders}
                                    prefix={<FolderOutlined />}
                                />
                            </Col>
                            <Col span={8}>
                                <Statistic
                                    title="文件数"
                                    value={stats.totalFiles}
                                    prefix={<FileOutlined />}
                                />
                            </Col>
                            <Col span={8}>
                                <Statistic
                                    title="占用空间"
                                    value={formatSize(stats.totalSize)}
                                    valueStyle={{ fontSize: '20px' }}
                                />
                            </Col>
                        </Row>

                        <Typography.Title level={5}>按文件类型统计</Typography.Title>
                        <Table
                            columns={columns}
                            dataSource={stats.byExtension}
                            rowKey="ext"
                            size="small"
                            pagination={{
                                pageSize: extensionPageSize,
                                pageSizeOptions: [10, 20, 50, 100],
                                showSizeChanger: true,
                                showTotal: (total) => `共 ${total} 种文件类型`,
                                onShowSizeChange: (current, size) => setExtensionPageSize(size)
                            }}
                        />

                        <Typography.Title level={5} style={{ marginTop: '32px' }}>文件列表</Typography.Title>
                        <Table
                            columns={fileColumns}
                            dataSource={stats.fileList}
                            rowKey="path"
                            size="small"
                            pagination={{
                                pageSize: fileListPageSize,
                                pageSizeOptions: [10, 20, 50, 100],
                                showSizeChanger: true,
                                showTotal: (total) => `共 ${total} 个文件`,
                                onShowSizeChange: (current, size) => setFileListPageSize(size)
                            }}
                        />
                    </div>
                ) : (
                    <Empty description="暂无数据" />
                )}
            </Card>
        </div>
    );
};
