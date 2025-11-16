import React from 'react';
import { ConfigProvider, App, Card, Button, Space } from 'antd';
import { AppProvider } from '../contexts/AppContext';
import { toolWindowManager } from '../components/windows/toolWindowManager';
import '../index.css';

/**
 * 文件信息工具窗口演示页面
 */
const FileInfoDemo: React.FC = () => {
    const handleShowFileInfo = () => {
        const fileInfoWindow = toolWindowManager.get('file-info');
        if (fileInfoWindow) {
            fileInfoWindow.show();
        }
    };

    const handleHideFileInfo = () => {
        const fileInfoWindow = toolWindowManager.get('file-info');
        if (fileInfoWindow) {
            fileInfoWindow.hide();
        }
    };

    const handleToggleFileInfo = () => {
        const fileInfoWindow = toolWindowManager.get('file-info');
        if (fileInfoWindow) {
            fileInfoWindow.toggle();
        }
    };

    return (
        <ConfigProvider>
            <App>
                <AppProvider>
                    <div style={{ padding: 20 }}>
                        <Card title="文件信息工具窗口演示" style={{ marginBottom: 20 }}>
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <Button 
                                    type="primary" 
                                    onClick={handleShowFileInfo}
                                    block
                                >
                                    显示文件信息工具窗口
                                </Button>
                                
                                <Button 
                                    type="default" 
                                    onClick={handleHideFileInfo}
                                    block
                                >
                                    隐藏文件信息工具窗口
                                </Button>
                                
                                <Button 
                                    type="default" 
                                    onClick={handleToggleFileInfo}
                                    block
                                >
                                    切换文件信息工具窗口状态
                                </Button>
                            </Space>
                        </Card>
                        
                        <Card title="使用说明">
                            <p>
                                1. 点击"显示文件信息工具窗口"来显示文件信息面板<br/>
                                2. 在左侧文件树中选择文件或文件夹来查看详细信息<br/>
                                3. 使用快捷键 Ctrl+Shift+I 也可以切换工具窗口显示状态
                            </p>
                        </Card>
                    </div>
                </AppProvider>
            </App>
        </ConfigProvider>
    );
};

export default FileInfoDemo;