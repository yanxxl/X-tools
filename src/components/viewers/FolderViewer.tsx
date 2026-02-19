import React, { useEffect, useState } from 'react';
import { Card, Space, Switch, Table, Typography, Empty, Spin, Statistic, Row, Col, Button, Checkbox, message, Modal } from 'antd';
import { FileOutlined, FolderOutlined, DeleteOutlined, FolderOpenOutlined, FileTextOutlined, BarChartOutlined } from '@ant-design/icons';
import { FileNode } from '../../types';
import { useAppContext } from '../../contexts/AppContext';
import { FileIcon } from '../common/FileIcon';
import { basename } from '../../utils/fileCommonUtil';

interface FileStats {
    ext: string;
    count: number;
    totalSize: number;
    totalTextSize: number;
}

interface FolderStats {
    totalFolders: number;
    totalFiles: number;
    totalSize: number;
    totalTextSize: number;
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
    const [fileListPageSize, setFileListPageSize] = useState(10);
    const [extensionPageSize, setExtensionPageSize] = useState(10);
    const [selectedExtension, setSelectedExtension] = useState<string | null>(null);
    const [selectedFileKeys, setSelectedFileKeys] = useState<React.Key[]>([]);
    const [includeTextSize, setIncludeTextSize] = useState(false);

    const formatSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    };

    const getFilteredFileList = (): FileNode[] => {
        if (!stats) return [];

        if (selectedExtension) {
            return stats.fileList.filter(file => {
                const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() || '(no extension)' : '(no extension)';
                return ext === selectedExtension;
            });
        }

        return stats.fileList;
    };

    const handleDeleteFiles = async () => {
        if (selectedFileKeys.length === 0) {
            message.warning('请先选择要删除的文件');
            return;
        }

        // 显示删除确认对话框
        Modal.confirm({
            title: '确认删除',
            content: (
                <div>
                    <p>确定要删除选中的 {selectedFileKeys.length} 个文件吗？</p>
                    <p style={{ color: '#ff4d4f', fontSize: '12px', marginTop: '4px' }}>
                        此操作会将文件移动到回收站。
                    </p>
                </div>
            ),
            okText: '确认删除',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await Promise.all(selectedFileKeys.map(path => window.electronAPI.removeFile(path as string)));
                    message.success(`成功删除 ${selectedFileKeys.length} 个文件`);
                    setSelectedFileKeys([]);
                    loadFolderStats();
                } catch (error) {
                    console.error('删除文件失败:', error);
                    message.error(`删除文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
                }
            }
        });
    };

    const handleMoveFiles = async () => {
        if (selectedFileKeys.length === 0) {
            message.warning('请先选择要移动的文件');
            return;
        }

        try {
            const selectedFolder = await window.electronAPI.selectDirectory(currentFolder);

            if (!selectedFolder) {
                return;
            }

            const destination = selectedFolder;
            await Promise.all(selectedFileKeys.map(path =>
                window.electronAPI.moveFile(path as string, destination)
            ));
            message.success(`成功移动 ${selectedFileKeys.length} 个文件到 ${destination}`);
            setSelectedFileKeys([]);
            loadFolderStats();
        } catch (error) {
            console.error('移动文件失败:', error);
            message.error(`移动文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    };

    const handleOpenFile = async () => {
        if (selectedFileKeys.length !== 1) {
            message.warning('请选择一条文件进行打开');
            return;
        }

        try {
            const filePath = selectedFileKeys[0] as string;
            await window.electronAPI.openFile(filePath);
            message.success('文件已打开');
        } catch (error) {
            console.error('打开文件失败:', error);
            message.error(`打开文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    };

    const handleCountText = () => {
        if (selectedFileKeys.length === 0) {
            message.warning('请先选择要统计字数的文件');
            return;
        }

        if (!stats) {
            message.warning('暂无统计数据');
            return;
        }

        const selectedFiles = stats.fileList.filter(file => 
            selectedFileKeys.includes(file.path)
        );
        
        const totalTextSize = selectedFiles.reduce((sum, file) => sum + (file.textSize || 0), 0);
        message.success(`所选 ${selectedFileKeys.length} 个文件总字数: ${totalTextSize.toLocaleString()}`);
    };

    const isHiddenFile = (fileName: string): boolean => {
        return fileName.startsWith('.');
    };

    const collectFileStats = (node: FileNode, includeSub: boolean, showHidden: boolean): { files: FileNode[], folders: FileNode[], stats: Map<string, { count: number, totalSize: number, totalTextSize: number }> } => {
        const files: FileNode[] = [];
        const folders: FileNode[] = [];
        const extStats = new Map<string, { count: number, totalSize: number, totalTextSize: number }>();

        const traverse = (currentNode: FileNode, isRoot = false) => {
            if (!currentNode.isDirectory) {
                if (showHidden || !isHiddenFile(currentNode.name)) {
                    files.push(currentNode);
                    const ext = currentNode.name.includes('.') ? currentNode.name.split('.').pop()?.toLowerCase() || '(no extension)' : '(no extension)';
                    const existing = extStats.get(ext) || { count: 0, totalSize: 0, totalTextSize: 0 };
                    existing.count++;
                    existing.totalSize += currentNode.size || 0;
                    existing.totalTextSize += currentNode.textSize || 0;
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
            const tree = await window.electronAPI.getFileTree(targetFolder, includeSubfolders, showHiddenFiles, includeTextSize);

            const { files, folders, stats: extStats } = collectFileStats(tree, includeSubfolders, showHiddenFiles);

            const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
            const totalTextSize = files.reduce((sum, file) => sum + (file.textSize || 0), 0);
            const byExtension: FileStats[] = Array.from(extStats.entries())
                .map(([ext, data]) => ({
                    ext,
                    count: data.count,
                    totalSize: data.totalSize,
                    totalTextSize: data.totalTextSize
                }))
                .sort((a, b) => b.totalSize - a.totalSize);

            setStats({
                totalFolders: folders.length,
                totalFiles: files.length,
                totalSize,
                totalTextSize,
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
        setSelectedExtension(null);
    }, [targetFolder, showHiddenFiles, includeSubfolders, includeTextSize]);

    const columns = [
        {
            title: '文件类型',
            dataIndex: 'ext',
            key: 'ext',
            render: (ext: string) => (
                <Space>
                    <FileIcon fileName={`test.${ext}`} isDirectory={false} />
                    <span style={{
                        cursor: 'pointer',
                        color: selectedExtension === ext ? '#1890ff' : 'inherit',
                        fontWeight: selectedExtension === ext ? 'bold' : 'normal'
                    }}>
                        {ext}
                    </span>
                </Space>
            ),
            sorter: (a: FileStats, b: FileStats) => a.ext.localeCompare(b.ext),
            onCell: (record: FileStats) => ({
                onClick: () => {
                    if (selectedExtension === record.ext) {
                        setSelectedExtension(null);
                    } else {
                        setSelectedExtension(record.ext);
                    }
                }
            })
        },
        {
            title: '文件数量',
            dataIndex: 'count',
            key: 'count',
            sorter: (a: FileStats, b: FileStats) => a.count - b.count
        },
        {
            title: '字数统计',
            dataIndex: 'totalTextSize',
            key: 'totalTextSize',
            align: 'right' as const,
            render: (textSize: number) => textSize.toLocaleString(),
            sorter: (a: FileStats, b: FileStats) => a.totalTextSize - b.totalTextSize
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
            title: '选择',
            key: 'selection',
            width: 60,
            render: (_, record: FileNode) => (
                <Checkbox
                    checked={selectedFileKeys.includes(record.path)}
                    onChange={(e) => {
                        if (e.target.checked) {
                            setSelectedFileKeys([...selectedFileKeys, record.path]);
                        } else {
                            setSelectedFileKeys(selectedFileKeys.filter(key => key !== record.path));
                        }
                    }}
                />
            )
        },
        {
            title: '文件路径',
            dataIndex: 'path',
            key: 'path',
            ellipsis: true,
            render: (path: string) => (
                <Space>
                    <FileIcon fileName={path} isDirectory={false} />
                    <span title={path}>{path}</span>
                </Space>
            ),
            sorter: (a: FileNode, b: FileNode) => a.path.localeCompare(b.path)
        },
        {
            title: '字数统计',
            dataIndex: 'textSize',
            key: 'textSize',
            width: 120,
            align: 'right' as const,
            render: (textSize: number | undefined) => {
                if (textSize === undefined || textSize === null) {
                    return '-'
                }
                return textSize.toLocaleString();
            },
            sorter: (a: FileNode, b: FileNode) => (a.textSize || 0) - (b.textSize || 0)
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
        <Card
            title={
                <Space>
                    <FolderOutlined />
                    <span>{basename(targetFolder || '')}</span>
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
                    <Space size="small">
                        <Typography.Text style={{ fontSize: '12px' }}>包含字数统计</Typography.Text>
                        <Switch
                            size="small"
                            checked={includeTextSize}
                            onChange={setIncludeTextSize}
                        />
                    </Space>
                </Space>
            }
            styles={{
                root: { margin: 0, overflow: 'hidden', borderRadius: 0, height: '100%', display: 'flex', flexDirection: 'column' },
                header: { minHeight: 48 },
                body: { flex: 1, overflow: 'auto' }
            }}
        >
            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px' }}>
                    <Spin size="large" />
                </div>
            ) : stats ? (
                <div>
                    <Row gutter={16} style={{ marginBottom: '24px' }}>
                        <Col span={6}>
                            <Statistic
                                title="文件夹数"
                                value={stats.totalFolders}
                                prefix={<FolderOutlined />}
                            />
                        </Col>
                        <Col span={6}>
                            <Statistic
                                title="文件数"
                                value={stats.totalFiles}
                                prefix={<FileOutlined />}
                            />
                        </Col>
                        <Col span={6}>
                            <Statistic
                                title="占用空间"
                                value={formatSize(stats.totalSize)}
                                valueStyle={{ fontSize: '20px' }}
                            />
                        </Col>
                        <Col span={6}>
                            <Statistic
                                title="总字数"
                                value={stats.totalTextSize.toLocaleString()}
                                valueStyle={{ fontSize: '20px' }}
                            />
                        </Col>
                    </Row>

                    <Typography.Title level={5}>类型统计</Typography.Title>
                    <Table
                        columns={columns}
                        dataSource={stats.byExtension}
                        rowKey="ext"
                        size="small"
                        locale={{
                            triggerDesc: '点击降序',
                            triggerAsc: '点击升序',
                            cancelSort: '取消排序'
                        }}
                        pagination={{
                            pageSize: extensionPageSize,
                            pageSizeOptions: [10, 20, 50, 100],
                            showSizeChanger: true,
                            showTotal: (total) => `共 ${total} 种文件类型`,
                            onShowSizeChange: (current, size) => setExtensionPageSize(size)
                        }}
                    />

                    <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <Typography.Title level={5} style={{ margin: 0 }}>
                            {selectedExtension ? `文件列表 - ${selectedExtension} 类型` : '文件列表'}
                            {selectedExtension ? (
                                <span
                                    style={{
                                        marginLeft: '8px',
                                        fontSize: '14px',
                                        color: '#1890ff',
                                        cursor: 'pointer',
                                        fontWeight: 'normal'
                                    }}
                                    onClick={() => setSelectedExtension(null)}
                                >
                                    (清除筛选)
                                </span>
                            ) : (
                                <span
                                    style={{
                                        marginLeft: '8px',
                                        fontSize: '12px',
                                        color: '#999',
                                        fontWeight: 'normal'
                                    }}
                                >
                                    可选择上面的类型过滤文件
                                </span>
                            )}
                        </Typography.Title>
                        
                        <Space>
                            <span style={{ opacity: selectedFileKeys.length > 0 ? 1 : 0.3 }}>
                                已选择 {selectedFileKeys.length} 个文件
                            </span>
                            <Button
                                type="primary"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={handleDeleteFiles}
                                disabled={selectedFileKeys.length === 0}
                            >
                                删除
                            </Button>
                            <Button
                                type="primary"
                                size="small"
                                icon={<FileTextOutlined />}
                                onClick={handleOpenFile}
                                disabled={selectedFileKeys.length !== 1}
                            >
                                打开
                            </Button>
                            <Button
                                type="primary"
                                size="small"
                                icon={<FolderOpenOutlined />}
                                onClick={handleMoveFiles}
                                disabled={selectedFileKeys.length === 0}
                            >
                                移动到
                            </Button>
                            <Button
                                type="primary"
                                size="small"
                                icon={<BarChartOutlined />}
                                onClick={handleCountText}
                                disabled={selectedFileKeys.length === 0}
                            >
                                字数统计
                            </Button>
                            <Button
                                size="small"
                                onClick={() => setSelectedFileKeys([])}
                                disabled={selectedFileKeys.length === 0}
                            >
                                取消选择
                            </Button>
                        </Space>
                    </div>

                    <Table
                        columns={fileColumns}
                        dataSource={getFilteredFileList()}
                        rowKey="path"
                        size="small"
                        locale={{
                            triggerDesc: '点击降序',
                            triggerAsc: '点击升序',
                            cancelSort: '取消排序'
                        }}
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
    );
};
