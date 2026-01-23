import React, { useState, useEffect } from 'react';
import { Card, Tag } from 'antd';
import { LinkOutlined, CloseOutlined } from '@ant-design/icons';

interface VersionUpdateInfo {
    isLatest: boolean | undefined;
    version: string;
    message: string;
    link: string;
}

export const VersionChecker: React.FC = () => {
    const [updateInfo, setUpdateInfo] = useState<VersionUpdateInfo | null>(null);
    const [isVisible, setIsVisible] = useState(true);

    // 检查版本更新
    const checkVersionUpdate = async () => {
        try {
            // 获取当前应用版本和操作系统平台信息
            const [appVersion, platform] = await Promise.all([
                window.electronAPI.getAppVersion(),
                window.electronAPI.getPlatform()
            ]);

            // 格式化版本字符串：appname-version-os
            const currentVersion = `x-tools-${appVersion}-${platform}`;

            // const response = await fetch(`http://localhost:5174/version?v=${currentVersion}`);
            const response = await fetch(`https://thinking.vip/version?v=${currentVersion}`);
            if (!response.ok) {
                console.error(`HTTP error! status: ${response.status}`);
                return;
            }
            const data = await response.json();
            setUpdateInfo(data);

            console.log('检查版本更新:', data);
        } catch (error) {
            console.error('检查版本更新失败:', error);
        }
    };

    useEffect(() => {
        // 组件挂载时检查一次
        checkVersionUpdate();

        // 设置定时器，每十分钟检查一次
        const intervalId = setInterval(() => {
            checkVersionUpdate();
        }, 10 * 60 * 1000); // 10分钟 * 60秒 * 1000毫秒

        // 组件卸载时清除定时器
        return () => clearInterval(intervalId);
    }, []);

    // 关闭通知
    const handleClose = () => {
        setIsVisible(false);
    };

    return (
        <>
            {/* 版本更新通知UI */}
            {updateInfo && updateInfo.message && isVisible && (
                <Card size="small" style={{ margin: '8px', borderRadius: '4px' }}>
                    {/* 第一行：发现新版本 + 版本号 + 关闭按钮 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        {/* 最新版本标签 */}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{updateInfo.isLatest ? '' : '发现新版本'}</span>
                            {!updateInfo.isLatest && <Tag color="blue">{updateInfo.version}</Tag>}
                        </div>

                        {/* 关闭按钮 */}
                        <a
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                handleClose();
                            }}
                            style={{ fontSize: '12px', color: '#999', cursor: 'pointer' }}
                        >
                            <CloseOutlined style={{ fontSize: '14px' }} />
                        </a>
                    </div>

                    {/* 第二行：信息带链接 */}
                    <div>
                        <a
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                window.electronAPI.openExternal(updateInfo.link);
                            }}
                            style={{ marginLeft: '0px', color: '#1890ff', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            {updateInfo.message} <LinkOutlined style={{ marginLeft: '4px', fontSize: '12px' }} />
                        </a>
                    </div>
                </Card>
            )}
        </>
    );
};
