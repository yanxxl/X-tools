import React, { useState, useEffect } from 'react';
import { Card, Descriptions, Typography, Spin, Alert } from 'antd';
import { ToolWindow } from '../../types/toolWindow';
import { FileInfo } from '../../types/api';
import { formatFileSize, formatDate } from '../../utils/format';
import { useAppContext } from '../../contexts/AppContext';

const { Text } = Typography;

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
                <div style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }}>📄</div>
                <div>
                    <Text type="secondary">请选择文件或文件夹查看信息</Text>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: 8, height: '100%', overflow: 'auto' }}>
            <Card 
                size="small" 
                title="文件信息"
            >
                <Descriptions size="small" column={1} labelStyle={{ width: '80px', textAlign: 'right' }}>
                    <Descriptions.Item label="名称">
                        <Text style={{ wordBreak: 'break-all' }}>{fileInfo.name}</Text>
                    </Descriptions.Item>

                    <Descriptions.Item label="路径">
                        <Text copyable style={{ fontSize: 12, wordBreak: 'break-all' }}>
                            {fileInfo.path}
                        </Text>
                    </Descriptions.Item>

                    <Descriptions.Item label="大小">
                        {fileInfo.isDirectory 
                            ? `${fileInfo.childrenCount || 0} 个项目`
                            : formatFileSize(fileInfo.size)
                        }
                    </Descriptions.Item>

                    <Descriptions.Item label="修改时间">
                        {formatDate(fileInfo.mtimeMs)}
                    </Descriptions.Item>

                    <Descriptions.Item label="创建时间">
                        {formatDate(fileInfo.ctimeMs)}
                    </Descriptions.Item>
                </Descriptions>
            </Card>
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
        description: '显示选中文件或文件夹的基本信息',
        isVisible: false,
        view: <FileInfoPanel />,
        icon: <FileInfoIcon />,
        shortcut: 'Ctrl+Shift+I',
        defaultWidth: 300,
        defaultHeight: 400
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