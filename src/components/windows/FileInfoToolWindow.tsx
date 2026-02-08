import React, {useEffect, useState} from 'react';
import {Alert, Button, Card, Descriptions, Skeleton, Space, Typography} from 'antd';
import {FileOutlined, FolderOpenOutlined} from '@ant-design/icons';

import {useAppContext} from '../../contexts/AppContext';
import {FileInfo} from '../../types';
import {ToolWindow} from './toolWindow';
import {formatDate, formatFileSize, getFileTextStats} from '../../utils/format';
import {isTextFile} from '../../utils/fileCommonUtil';
import {SelectedTextPanel} from './SelectedTextPanel';

const {Text} = Typography;

/**
 * 文件信息面板组件
 */
const FileInfoPanel: React.FC = () => {
    const {currentFile, currentFolder} = useAppContext();
    
    const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileTextStats, setFileTextStats] = useState<{ chars: number; words: number; chineseChars: number } | null>(null);

    const targetPath = currentFile || currentFolder;

    const handleOpenFile = async () => {
        if (targetPath && window.electronAPI) {
            try {
                await window.electronAPI.openFile(targetPath);
            } catch (error) {
                console.error('打开文件失败:', error);
            }
        }
    };

    const handleShowInFolder = async () => {
        if (targetPath && window.electronAPI) {
            try {
                await window.electronAPI.showItemInFolder(targetPath);
            } catch (error) {
                console.error('显示文件夹失败:', error);
            }
        }
    };

    useEffect(() => {
        const fetchFileInfo = async () => {
            if (!currentFile && !currentFolder) {
                setFileInfo(null);
                setFileTextStats(null);
                setError(null);
                return;
            }

            const targetPath = currentFile || currentFolder;
            if (!targetPath) {
                setFileInfo(null);
                setFileTextStats(null);
                setError(null);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                if (window.electronAPI) {
                    const info = await window.electronAPI.getFileInfo(targetPath);
                    setFileInfo(info);

                    if (!info.isDirectory && isTextFile(info.name)) {
                        const stats = await getFileTextStats(targetPath);
                        setFileTextStats(stats);
                    } else {
                        setFileTextStats(null);
                    }
                } else {
                    setError('浏览器环境下无法获取文件信息');
                }
            } catch (err) {
                console.error('获取文件信息失败:', err);
                setError('获取文件信息失败');
            } finally {
                setLoading(false);
            }
        };

        setTimeout(() => {
            fetchFileInfo();
        }, 10);
    }, [currentFile, currentFolder]);

    if (loading) {
        return (
            <div style={{padding: 24}}>
                <Skeleton active paragraph={{rows: 3}}/>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{padding: 16}}>
                <Alert
                    message="错误"
                    description={error}
                    type="error"
                    showIcon
                />
            </div>
        );
    }

    if (!fileInfo) {
        return (
            <div style={{padding: 16, textAlign: 'center'}}>
                <div style={{fontSize: 48, color: '#d9d9d9', marginBottom: 16}}>📄</div>
                <div>
                    <Text type="secondary">请选择文件或文件夹查看信息</Text>
                </div>
            </div>
        );
    }

    return (
        <div style={{height: '100%', padding: 8, display: 'flex', flexDirection: 'column', gap: 8}}>
            <Card
                size="small"
                title="基本信息"
                extra={
                    <Space>
                        <Button
                            type="text"
                            size="small"
                            icon={<FileOutlined/>}
                            onClick={handleOpenFile}
                            title="打开文件"
                        />
                        <Button
                            type="text"
                            size="small"
                            icon={<FolderOpenOutlined/>}
                            onClick={handleShowInFolder}
                            title="在文件夹中显示"
                        />
                    </Space>
                }
            >
                <Descriptions size="small" column={1} labelStyle={{width: '80px', textAlign: 'right'}}>
                    <Descriptions.Item label="名称">
                        <Text style={{wordBreak: 'break-all'}}>{fileInfo.name}</Text>
                    </Descriptions.Item>

                    <Descriptions.Item label="路径">
                        <Text copyable style={{fontSize: 12, wordBreak: 'break-all'}}>
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

            {!fileInfo.isDirectory && fileTextStats && (
                <Card
                    size="small"
                    title="字数统计"
                >
                    <Descriptions size="small" column={1} labelStyle={{width: '80px', textAlign: 'right'}}>
                        <Descriptions.Item label="总字符数">
                            <Text strong>{fileTextStats.chars.toLocaleString()}</Text>
                        </Descriptions.Item>

                        <Descriptions.Item label="中文字符">
                            <Text style={{color: '#1890ff'}}>{fileTextStats.chineseChars.toLocaleString()}</Text>
                        </Descriptions.Item>

                        <Descriptions.Item label="英文单词">
                            <Text style={{color: '#52c41a'}}>{fileTextStats.words.toLocaleString()}</Text>
                        </Descriptions.Item>
                    </Descriptions>
                </Card>
            )}

            <SelectedTextPanel />
        </div>
    );
};

/**
 * 文件信息图标组件
 */
const FileInfoIcon: React.FC = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
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
        view: <FileInfoPanel/>,
        icon: <FileInfoIcon/>,
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
export {FileInfoPanel};