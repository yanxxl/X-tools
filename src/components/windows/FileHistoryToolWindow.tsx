import React from 'react';
import { Card, List, Typography, Empty, Tooltip } from 'antd';
import { HistoryOutlined, FileTextOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useAppContext } from '../../contexts/AppContext';
import { FileHistoryRecord } from '../../utils/uiUtils';
import './FileHistoryToolWindow.css';

const { Text } = Typography;

interface FileHistoryToolWindowProps {
  // 组件属性可以在这里定义
}

// 时间格式化工具函数
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return '刚刚';
  } else if (diffMins < 60) {
    return `${diffMins}分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours}小时前`;
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else {
    return date.toLocaleDateString('zh-CN');
  }
};

// 获取文件名工具函数
const getFileName = (filePath: string): string => {
  return filePath.split(/[/\\]/).pop() || filePath;
};

export const FileHistoryToolWindow: React.FC<FileHistoryToolWindowProps> = () => {
  const { currentFolder, fileHistory, setCurrentFile } = useAppContext();

  // 处理点击历史记录项
  const handleHistoryItemClick = (record: FileHistoryRecord) => {
    setCurrentFile({
      path: record.filePath,
      name: record.fileName
    });
  };

  return (
    <div className="file-history-tool-window">
      <Card
        size="small"
        title={
          <div className="history-header">
            <HistoryOutlined className="history-icon" />
            <span>文件访问历史</span>
          </div>
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
            dataSource={fileHistory}
            renderItem={(record) => (
              <List.Item
                className="history-item"
                onClick={() => handleHistoryItemClick(record)}
              >
                <div className="history-item-content">
                  <div className="history-item-main">
                    <FileTextOutlined className="file-icon" />
                    <Tooltip title={record.filePath}>
                      <Text strong className="file-name">
                        {getFileName(record.filePath)}
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

// 创建工具窗口实例
import { ToolWindow } from './toolWindow';

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