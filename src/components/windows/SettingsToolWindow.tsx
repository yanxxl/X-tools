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
    const [name, setName] = useState('');
    const [version, setVersion] = useState('');
    const [description, setDescription] = useState('');

    // 获取应用信息
    useEffect(() => {
        const fetchAppInfo = async () => {
            try {
                const [appName, appVersion, appDescription] = await Promise.all([
                    window.electronAPI.getAppName(),
                    window.electronAPI.getAppVersion(),
                    window.electronAPI.getAppDescription()
                ]);
                setName(appName);
                setVersion(appVersion);
                setDescription(appDescription);
            } catch (error) {
                console.error('获取应用信息失败:', error);
                setName('X-tools');
                setVersion('未知');
                setDescription('X-tools 本地资料库浏览工具');
            }
        };
        fetchAppInfo();
    }, []);

    // 刷新存储信息
    const refreshStorageInfo = () => {
        const newStorageInfo = getLocalStorageInfo();
        setStorageInfo(newStorageInfo);
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
                                onClick={() => {
                                    refreshStorageInfo()
                                    message.success('存储信息已刷新', 3);
                                }}
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
            <Card size="small" title={`关于 ${name}`}>
                <div style={{marginBottom: 12}}>
                    <Paragraph type="secondary" style={{margin: 0}}>
                        {description}
                    </Paragraph>
                </div>
                <Descriptions size="small" column={1} labelStyle={{width: '80px', textAlign: 'right'}}>
                    <Descriptions.Item label="版本号">
                        <Text style={{color: '#1890ff'}}>v{version}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="许可证">
                        <Text>MIT</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="作者">
                        <a
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                window.electronAPI.openExternal('https://thinking.vip');
                            }}
                            style={{color: '#1890ff', cursor: 'pointer'}}
                        >
                            萝卜
                        </a>
                    </Descriptions.Item>
                    <Descriptions.Item label="源码">
                        <a
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                window.electronAPI.openExternal('https://github.com/yanxxl/x-tools');
                            }}
                            style={{display: 'flex', alignItems: 'center', gap: 4, color: '#1890ff', cursor: 'pointer'}}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path
                                    d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                            </svg>
                            GitHub 仓库
                        </a>
                    </Descriptions.Item>
                </Descriptions>
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
