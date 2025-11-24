import React, {useEffect, useState} from 'react';
import {Button, Card, Descriptions, message, Modal, Space, Tooltip, Typography} from 'antd';
import {DeleteOutlined, ReloadOutlined, SettingOutlined} from '@ant-design/icons';
import {clearAllLocalStorage, formatBytes, getLocalStorageInfo} from '../../utils/storageUtils';
import {ToolWindow} from './toolWindow';

const {Text, Paragraph} = Typography;

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
                        <li>文件访问历史</li>
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
                    window.location.reload();
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
        <div style={{height: '100%', padding: 8, display: 'flex', flexDirection: 'column', gap: 8}}>
            {/* 本地存储清理部分 */}
            <Card
                size="small"
                title="本地存储管理"
                extra={
                    <Space>
                        <Tooltip title="刷新存储信息">
                            <Button
                                size="small"
                                icon={<ReloadOutlined/>}
                                onClick={refreshStorageInfo}
                                loading={loading}
                                type="text"
                            />
                        </Tooltip>
                        <Tooltip title="清理所有存储">
                            <Button
                                size="small"
                                danger
                                icon={<DeleteOutlined/>}
                                onClick={showDeleteConfirm}
                                loading={loading}
                                type="text"
                            />
                        </Tooltip>
                    </Space>
                }
            >
                <Descriptions size="small" column={1} labelStyle={{width: '80px', textAlign: 'right'}}>
                    <Descriptions.Item label="总条目数">
                        <Text strong>{storageInfo.totalItems}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="占用空间">
                        <Text style={{color: '#1890ff'}}>{formatBytes(storageInfo.totalSize)}</Text>
                    </Descriptions.Item>
                </Descriptions>
            </Card>

            {/* 其他设置项可以在这里添加 */}
            <Card size="small" title="关于">
                <Paragraph type="secondary" style={{margin: 0}}>
                    X-tools 本地资料库浏览工具
                </Paragraph>
            </Card>
        </div>
    );
};

/**
 * 设置工具窗口
 */
export const settingsToolWindow = new ToolWindow({
    id: 'settings-tool-window',
    name: '设置',
    description: '应用设置和本地存储管理',
    isVisible: true,
    view: <SettingsPanel/>,
    icon: <SettingOutlined/>,
    isResizable: true
});
