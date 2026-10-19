import React from 'react';
import { Button, Tooltip } from 'antd';
import { BorderOutlined, CloseOutlined, MinusOutlined } from '@ant-design/icons';

export const WindowControls: React.FC = () => {
    const handleMinimize = () => {
        window.electronAPI?.minimizeWindow?.();
    };

    const handleToggleMaximize = () => {
        window.electronAPI?.toggleMaximizeWindow?.();
    };

    const handleClose = () => {
        window.electronAPI?.closeWindow?.();
    };

    return (
        <div style={{ display: 'flex', gap: 0, marginLeft: 8, marginRight: -14 }}>
            {/* 最小化按钮 */}
            <Tooltip title="最小化">
                <Button
                    type="text"
                    onClick={handleMinimize}
                    style={{ padding: 0, width: 36, height: 36, borderRadius: 0 }}
                >
                    <MinusOutlined />
                </Button>
            </Tooltip>

            {/* 最大化/还原按钮 */}
            <Tooltip title="最大化/还原">
                <Button
                    type="text"
                    onClick={handleToggleMaximize}
                    style={{ padding: 0, width: 36, height: 36, borderRadius: 0 }}
                >
                    <BorderOutlined />
                </Button>
            </Tooltip>

            {/* 关闭按钮 */}
            <Tooltip title="关闭" placement="left">
                <Button
                    type="text"
                    onClick={handleClose}
                    style={{ padding: 0, width: 36, height: 36, borderRadius: 0, color: 'var(--xt-text)' }}
                    onMouseEnter={(e) => {
                        const target = e.currentTarget;
                        target.style.backgroundColor = 'var(--xt-color-danger)';
                        target.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                        const target = e.currentTarget;
                        target.style.backgroundColor = 'transparent';
                        target.style.color = 'var(--xt-text)';
                    }}
                >
                    <CloseOutlined />
                </Button>
            </Tooltip>
        </div>
    );
};
