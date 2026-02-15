import React, { useState, useEffect } from 'react';
import { Button, Card, Empty, List, Tooltip, Typography } from 'antd';
import { ClockCircleOutlined, DeleteOutlined, HistoryOutlined } from '@ant-design/icons';
import { useAppContext } from '../../contexts/AppContext';
import { fileHistoryManager, FileHistoryRecord } from '../../utils/storage';
import { formatTime } from '../../utils/uiUtils';
import { FileIcon } from '../common/FileIcon';
import './FileHistoryToolWindow.css';
// 创建工具窗口实例
import { ToolWindow } from './toolWindow';

const { Text } = Typography;

import { basename } from '../../utils/fileCommonUtil';
import { DangerText } from '../common/DangerText';

export const FileHistoryToolWindow: React.FC = () => {
    const { currentFolder, currentFile, setCurrentFile } = useAppContext();
    const [fileHistory, setFileHistory] = useState<FileHistoryRecord[]>([]);

    // 当当前文件夹或当前文件变化时，更新历史记录
    useEffect(() => {
        if (currentFolder) {
            const history = fileHistoryManager.getFolderHistory(currentFolder);
            setFileHistory(history);
        } else {
            setFileHistory([]);
        }
    }, [currentFolder, currentFile]);

    // 处理点击历史记录项
    const handleHistoryItemClick = (record: FileHistoryRecord) => {
        setCurrentFile(record.filePath);
        // 添加文件访问记录
        fileHistoryManager.addFileAccess(record.filePath);
        // 更新历史记录列表
        if (currentFolder) {
            const updatedHistory = fileHistoryManager.getFolderHistory(currentFolder);
            setFileHistory(updatedHistory);
        }
    };

    // 处理清理历史记录
    const handleClearHistory = () => {
        if (currentFolder) {
            fileHistoryManager.clearFolderHistory(currentFolder);
            setFileHistory([]);
        }
    };

    return (
        <div className="file-history-tool-window">
            <Card
                style={{ margin: 0, overflow: 'hidden', flex: 1, borderRadius: 0 }}
                size="small"
                title={'文件访问历史'}
                extra={fileHistory.length > 0 &&
                    <Tooltip title="清空历史记录">
                        <DangerText onClick={handleClearHistory}>
                            清空
                        </DangerText>
                    </Tooltip>
                }
                className="history-card"
            >
                {!currentFolder ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="请先选择一个文件夹"
                        className="history-empty"
                    />
                ) : fileHistory.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="当前文件夹暂无访问历史"
                        className="history-empty"
                    />
                ) : (
                    <List
                        size="small"
                        className="history-list"
                        dataSource={fileHistory}
                        renderItem={(record) => (
                            <List.Item
                                className="history-item"
                                onClick={() => handleHistoryItemClick(record)}
                            >
                                <div className="history-item-content">
                                    <div className="history-item-main">
                                        <FileIcon fileName={record.filePath} className="file-icon" />
                                        <Tooltip title={record.filePath}>
                                            <Text strong className="file-name">
                                                {basename(record.filePath)}
                                            </Text>
                                        </Tooltip>
                                    </div>
                                    <div className="history-item-meta">
                                        <ClockCircleOutlined className="time-icon" />
                                        <Text type="secondary" className="access-time">
                                            {formatTime(record.lastAccessed)}
                                        </Text>
                                    </div>
                                </div>
                            </List.Item>
                        )}
                    />
                )}
            </Card>
        </div>
    );
};

export const fileHistoryToolWindow = new ToolWindow({
    id: 'file-history',
    name: '文件访问历史',
    description: '显示当前文件夹的文件访问历史记录',
    isVisible: false,
    view: <FileHistoryToolWindow />,
    icon: <HistoryOutlined />,
    shortcut: 'Ctrl+Shift+H',
    isResizable: true,
    defaultWidth: 300,
    defaultHeight: 400
});