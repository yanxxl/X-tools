import React, { useState, useEffect, useRef } from 'react';
import { Button, Tooltip } from 'antd';
import { ToolOutlined } from '@ant-design/icons';
import { ToolWindow } from './toolWindow';
import { toolWindowManager } from './toolWindowManager';
import { VersionChecker } from '../common/VersionChecker';
import './ToolWindowsPane.css';

export const ToolWindowsPane: React.FC = () => {
    const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
    const [availableWindows, setAvailableWindows] = useState<ToolWindow[]>([]);
    const toolWindowsPaneRef = useRef<HTMLDivElement>(null);

    // 初始化工具窗口
    useEffect(() => {
        const windows = toolWindowManager.getAll();
        setAvailableWindows(windows);

        // 如果没有活跃窗口且有可用窗口，自动显示第一个窗口
        if (!activeWindowId && windows.length > 0) {
            setActiveWindowId(windows[0].id);
        }

        console.log('toolWindowsPaneRef.current:', toolWindowsPaneRef.current);
    }, [activeWindowId]);

    // 切换工具窗口
    const toggleWindow = (windowId: string) => {
        setActiveWindowId(windowId);
    };

    // 获取当前活跃的工具窗口
    const activeWindow = availableWindows.find(w => w.id === activeWindowId);

    if (availableWindows.length === 0) {
        return (
            <div className="tool-windows-pane empty">
                <div className="empty-state">
                    <ToolOutlined style={{ fontSize: 24, color: '#ccc' }} />
                    <div style={{ color: '#999', marginTop: 8 }}>暂无工具窗口</div>
                </div>
            </div>
        );
    }

    return (
        <div className="tool-windows-pane">
            {/* 工具窗口显示区域 */}
            <div className="tool-window-content">
                {/* 主要查看器区域，占据大部分空间 */}
                <div className="viewer-container" ref={toolWindowsPaneRef}>
                    {activeWindow && activeWindow.view}
                </div>

                {/* 版本检查器区域，位于底部 */}
                <div className="checker-container">
                    {/* 这里显示版本更新通知 */}
                    <VersionChecker />
                </div>
            </div>

            {/* 右侧图标工具栏 */}
            <div className="tool-window-toolbar">
                {availableWindows.map((window) => (
                    <Tooltip key={window.id} title={window.name} placement="left">
                        <Button
                            type="text"
                            size="small"
                            className={`toolbar-button ${activeWindowId === window.id ? 'active' : ''}`}
                            onClick={() => toggleWindow(window.id)}
                            icon={window.icon || <ToolOutlined />}
                        />
                    </Tooltip>
                ))}
            </div>
        </div>
    );
};