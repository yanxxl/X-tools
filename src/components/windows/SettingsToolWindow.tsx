import React, {useState, useEffect} from 'react';
import {Card, Button, Modal, Space, Typography, Tooltip, message} from 'antd';
import {SettingOutlined, DeleteOutlined, ReloadOutlined} from '@ant-design/icons';
import {getLocalStorageInfo, formatBytes, clearAllLocalStorage} from '../../utils/storageUtils';
import {ToolWindow} from './toolWindow';

const {Title, Text, Paragraph} = Typography;

/**
 * 设置面板组件
 */
const SettingsPanel: React.FC = () => {
  const [storageInfo, setStorageInfo] = useState(getLocalStorageInfo());
  const [loading, setLoading] = useState(false);

  // 刷新存储信息
  const refreshStorageInfo = () => {
    const newStorageInfo = getLocalStorageInfo();
    setStorageInfo(newStorageInfo);
    message.success('存储信息已刷新', 3);
  };

  // 显示删除确认对话框
  const showDeleteConfirm = () => {
    Modal.confirm({
      title: '确认清理',
      content: (
        <div>
          <p>此操作将清除所有本地存储数据，包括：</p>
          <ul style={{marginTop: 8, marginBottom: 0}}>
            <li>窗口大小设置</li>
            <li>布局偏好</li>
            <li>其他应用配置</li>
          </ul>
          <p style={{color: '#ff4d4f', marginTop: 8}}>此操作不可恢复，请谨慎操作！</p>
        </div>
      ),
      okText: '确认清理',
      okType: 'danger',
      cancelText: '取消',
      onOk: handleClearStorage,
    });
  };

  // 清理所有本地存储
  const handleClearStorage = () => {
    setLoading(true);
    setTimeout(() => {
      try {
        const success = clearAllLocalStorage();
        if (success) {
          message.success('本地存储已成功清理', 3);
          refreshStorageInfo();
        } else {
          message.error('清理失败，请重试', 3);
        }
      } catch (error) {
        console.error('清理本地存储时出错:', error);
        message.error('清理过程中发生错误', 3);
      } finally {
        setLoading(false);
      }
    }, 300); // 添加短暂延迟以提供更好的加载体验
  };

  // 初始加载
  useEffect(() => {
    refreshStorageInfo();
  }, []);

  return (
    <div className="settings-panel">
      <Title level={4} className="settings-panel-title">
        <SettingOutlined /> 设置
      </Title>

      {/* 本地存储清理部分 */}
      <Card 
        title="本地存储管理" 
        extra={
          <Space size={[0, 8]}>
            <Tooltip title="刷新存储信息">
              <Button 
                size="small" 
                icon={<ReloadOutlined />} 
                onClick={refreshStorageInfo}
                loading={loading}
                type="text"
              />
            </Tooltip>
            <Tooltip title="清理所有存储">
              <Button 
                size="small" 
                danger 
                icon={<DeleteOutlined />} 
                onClick={showDeleteConfirm}
                loading={loading}
                type="text"
              />
            </Tooltip>
          </Space>
        }
      >
        <Space direction="vertical" size="middle" className="storage-info-container">
          <div className="storage-info-item">
            <Text strong>总条目数：</Text>
            <Text className="storage-info-value">{storageInfo.totalItems}</Text>
          </div>
          <div className="storage-info-item">
            <Text strong>占用空间：</Text>
            <Text className="storage-info-value">{formatBytes(storageInfo.totalSize)}</Text>
          </div>
        </Space>
      </Card>

      {/* 其他设置项可以在这里添加 */}
      <Card title="关于" className="about-card">
        <Paragraph type="secondary">
          X-tools 本地资料库浏览工具
        </Paragraph>
      </Card>
    </div>
  );
};

// 添加样式
const style: HTMLStyleElement = document.createElement('style');
style.textContent = `
  .settings-panel {
    padding: 24px;
    height: 100%;
    overflow-y: auto;
    box-sizing: border-box;
    background-color: #fafafa;
  }
  
  .settings-panel-title {
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    color: rgba(0, 0, 0, 0.85);
  }
  
  .settings-panel-title .anticon {
    margin-right: 8px;
  }
  
  .storage-info-container {
    width: 100%;
  }
  
  .storage-info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
  }
  
  .storage-info-value {
    font-size: 16px;
    color: #1890ff;
    font-weight: 500;
  }
  
  .about-card {
    margin-top: 16px;
  }
`;
document.head.appendChild(style);

/**
 * 设置工具窗口
 */
export const settingsToolWindow = new ToolWindow({
  id: 'settings-tool-window',
  name: '设置',
  description: '应用设置和本地存储管理',
  isVisible: true,
  view: <SettingsPanel />,
  icon: <SettingOutlined />,
  isResizable: true
});
