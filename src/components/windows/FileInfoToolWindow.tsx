import React, { useState, useEffect } from 'react';
import { Card, Descriptions, Tag, Space, Typography, Spin, Alert, Divider } from 'antd';
import { 
    FileOutlined, 
    FolderOutlined, 
    InfoCircleOutlined,
    ClockCircleOutlined,
    DatabaseOutlined,
    CalendarOutlined,
    EyeOutlined
} from '@ant-design/icons';
import { ToolWindow } from '../../types/toolWindow';
import { FileInfo } from '../../types/api';
import { formatFileSize, formatDate } from '../../utils/format';
import { detectFileType, getExtension } from '../../utils/fileType';
import { useAppContext } from '../../contexts/AppContext';

const { Title, Text } = Typography;

/**
 * 文件基本信息工具窗口组件
 */
const FileInfoPanel: React.FC = () => {
    const { currentFile, currentFolder } = useAppContext();
    const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 获取文件信息
    useEffect(() => {
        const fetchFileInfo = async () => {
            if (!currentFile && !currentFolder) {
                setFileInfo(null);
                setError(null);
                return;
            }

            const targetPath = currentFile?.path || currentFolder;
            if (!targetPath) {
                setFileInfo(null);
                setError(null);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                if (window.electronAPI) {
                    const info = await window.electronAPI.getFileInfo(targetPath);
                    setFileInfo(info);
                } else {
                    // 浏览器环境下的模拟数据
                    setError('浏览器环境下无法获取文件信息');
                }
            } catch (err) {
                console.error('获取文件信息失败:', err);
                setError('获取文件信息失败');
            } finally {
                setLoading(false);
            }
        };

        fetchFileInfo();
    }, [currentFile, currentFolder]);

    // 获取文件类型标签颜色
    const getFileTypeColor = (isDirectory: boolean, ext: string) => {
        if (isDirectory) return 'blue';
        
        const fileType = detectFileType(ext);
        switch (fileType) {
            case 'image': return 'green';
            case 'video': return 'purple';
            case 'pdf': return 'red';
            case 'text': return 'orange';
            default: return 'default';
        }
    };

    // 获取文件类型文本
    const getFileTypeText = (isDirectory: boolean, ext: string) => {
        if (isDirectory) return '文件夹';
        
        const fileType = detectFileType(ext);
        switch (fileType) {
            case 'image': return '图片';
            case 'video': return '视频';
            case 'pdf': return 'PDF文档';
            case 'text': return '文本文件';
            default: return ext ? `${ext.toUpperCase()}文件` : '文件';
        }
    };

    // 渲染加载状态
    if (loading) {
        return (
            <div style={{ padding: 16, textAlign: 'center' }}>
                <Spin tip="正在获取文件信息..." />
            </div>
        );
    }

    // 渲染错误状态
    if (error) {
        return (
            <div style={{ padding: 16 }}>
                <Alert
                    message="错误"
                    description={error}
                    type="error"
                    showIcon
                />
            </div>
        );
    }

    // 渲染空状态
    if (!fileInfo) {
        return (
            <div style={{ padding: 16, textAlign: 'center' }}>
                <InfoCircleOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                <div>
                    <Text type="secondary">请选择文件或文件夹查看详细信息</Text>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: 8, height: '100%', overflow: 'auto' }}>
            <Card 
                size="small" 
                title={
                    <Space>
                        {fileInfo.isDirectory ? <FolderOutlined /> : <FileOutlined />}
                        <span>文件信息</span>
                    </Space>
                }
                style={{ marginBottom: 16 }}
            >
                {/* 文件名和类型 */}
                <div style={{ marginBottom: 16 }}>
                    <Title level={5} style={{ marginBottom: 8, wordBreak: 'break-all' }}>
                        {fileInfo.name}
                    </Title>
                    <Tag color={getFileTypeColor(fileInfo.isDirectory, fileInfo.ext)}>
                        {getFileTypeText(fileInfo.isDirectory, fileInfo.ext)}
                    </Tag>
                </div>

                <Divider style={{ margin: '12px 0' }} />

                {/* 基本信息描述列表 */}
                <Descriptions size="small" column={1}>
                    <Descriptions.Item 
                        label={<><FileOutlined style={{ marginRight: 4 }} />路径</>}
                    >
                        <Text copyable style={{ fontSize: 12, wordBreak: 'break-all' }}>
                            {fileInfo.path}
                        </Text>
                    </Descriptions.Item>

                    <Descriptions.Item 
                        label={<><DatabaseOutlined style={{ marginRight: 4 }} />大小</>}
                    >
                        {fileInfo.isDirectory 
                            ? `${fileInfo.childrenCount || 0} 个项目`
                            : formatFileSize(fileInfo.size)
                        }
                    </Descriptions.Item>

                    <Descriptions.Item 
                        label={<><CalendarOutlined style={{ marginRight: 4 }} />修改时间</>}
                    >
                        {formatDate(fileInfo.mtimeMs)}
                    </Descriptions.Item>

                    <Descriptions.Item 
                        label={<><ClockCircleOutlined style={{ marginRight: 4 }} />创建时间</>}
                    >
                        {formatDate(fileInfo.ctimeMs)}
                    </Descriptions.Item>

                    <Descriptions.Item 
                        label={<><EyeOutlined style={{ marginRight: 4 }} />访问时间</>}
                    >
                        {formatDate(fileInfo.atimeMs)}
                    </Descriptions.Item>

                    {!fileInfo.isDirectory && fileInfo.ext && (
                        <Descriptions.Item label="扩展名">
                            <Tag>{getExtension(fileInfo.name)}</Tag>
                        </Descriptions.Item>
                    )}
                </Descriptions>
            </Card>

            {/* 额外信息卡片 */}
            {!fileInfo.isDirectory && (
                <Card size="small" title="文件详情">
                    <Descriptions size="small" column={1}>
                        <Descriptions.Item label="文件类型">
                            {detectFileType(fileInfo.ext)}
                        </Descriptions.Item>
                        <Descriptions.Item label="是否可读">
                            <Tag color="green">是</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="文件状态">
                            <Tag color="blue">正常</Tag>
                        </Descriptions.Item>
                    </Descriptions>
                </Card>
            )}

            {fileInfo.isDirectory && (
                <Card size="small" title="文件夹详情">
                    <Descriptions size="small" column={1}>
                        <Descriptions.Item label="包含项目">
                            {fileInfo.childrenCount || 0} 个
                        </Descriptions.Item>
                        <Descriptions.Item label="文件夹类型">
                            <Tag color="blue">目录</Tag>
                        </Descriptions.Item>
                    </Descriptions>
                </Card>
            )}
        </div>
    );
};

/**
 * 文件信息图标组件
 */
const FileInfoIcon: React.FC = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
    </svg>
);

/**
 * 创建并导出文件基本信息工具窗口实例
 */
export const createFileInfoToolWindow = (): ToolWindow => {
    return new ToolWindow({
        id: 'file-info',
        name: '文件信息',
        description: '显示选中文件或文件夹的详细基本信息',
        isVisible: false,
        view: <FileInfoPanel />,
        icon: <FileInfoIcon />,
        shortcut: 'Ctrl+Shift+I',
        defaultWidth: 350,
        defaultHeight: 500
    });
};

/**
 * 导出默认的工具窗口实例
 */
export const fileInfoToolWindow = createFileInfoToolWindow();

/**
 * 导出组件供其他地方使用
 */
export { FileInfoPanel };