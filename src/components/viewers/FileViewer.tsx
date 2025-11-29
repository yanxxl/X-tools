import React from 'react';
import {Tabs, Button, Typography} from 'antd';
import type {TabsProps} from 'antd';
import {FileTextOutlined, FolderOpenOutlined} from '@ant-design/icons';
import {detectFileType, getExtension} from '../../utils/fileType';
import {ImageViewer} from './ImageViewer';
import {VideoViewer} from './VideoViewer';
import {PdfViewer} from './PdfViewer';
import {MarkdownViewer} from './MarkdownViewer';
import {TextViewer} from './TextViewer';
import {useAppContext} from '../../contexts/AppContext';

export const FileViewer: React.FC = () => {
    const {tabs, activeTabId, switchTab, removeTab} = useAppContext();

    // 渲染单个文件查看器
    const renderViewer = (filePath: string, fileName: string) => {
        const type = detectFileType(fileName);
        const ext = getExtension(fileName);

        if (type === 'image') {
            return <div style={{height: '100%'}}><ImageViewer path={filePath}/></div>;
        }

        if (type === 'video') {
            return <div style={{height: '100%'}}><VideoViewer path={filePath}/></div>;
        }

        if (type === 'pdf') {
            return <PdfViewer path={filePath}/>;
        }

        // Markdown 文件使用专门的 MarkdownViewer
        if (ext === 'md' || ext === 'markdown') {
            return <MarkdownViewer filePath={filePath} fileName={fileName}/>;
        }

        // 其他文本文件使用 TextViewer
        if (type === 'text') {
            return <TextViewer filePath={filePath} fileName={fileName}/>;
        }

        // 对于不知道该如何打开的，提示
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                padding: '24px',
                backgroundColor: '#f5f5f5',
                borderRadius: 8
            }}>
                <FileTextOutlined style={{fontSize: 48, color: '#999', marginBottom: 16}}/>
                <Typography.Title level={4} style={{marginBottom: 8}}>
                    未知文件格式
                </Typography.Title>
                <Typography.Text style={{marginBottom: 24, color: '#666'}}>
                    无法在浏览器中预览此文件，请使用本地软件打开
                </Typography.Text>
                <Button
                    type="primary"
                    icon={<FolderOpenOutlined/>}
                    onClick={() => window.electronAPI.openFile(filePath)}
                >
                    在本地打开
                </Button>
            </div>
        );
    };

    // 构建标签页配置
    const tabItems: TabsProps['items'] = tabs.map(tab => ({
        key: tab.id,
        label: tab.fileName,
        closable: true,
        children: renderViewer(tab.filePath, tab.fileName),
    }));

    return (
        <div style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            margin: 0,
            padding: 0,
        }}>
            <Tabs
                activeKey={activeTabId || ''}
                items={tabItems}
                onChange={switchTab}
                onEdit={(key) => {
                    if (typeof key === 'string') {
                        removeTab(key);
                    }
                }}
                type="editable-card"
                hideAdd
                style={{
                    flex: '0 0 auto',
                    margin: 0,
                    padding: 0,
                }}
                contentStyle={{
                    padding: 0,
                    margin: 0,
                }}
            />
            <div style={{
                flex: '1 1 auto',
                overflow: 'auto',
                height: 0, // 触发 flex 布局的 overflow
            }}>
                {tabs.map(tab => (
                    <div
                        key={tab.id}
                        style={{
                            display: tab.id === activeTabId ? 'block' : 'none',
                            height: '100%',
                            width: '100%',
                        }}
                    >
                        {renderViewer(tab.filePath, tab.fileName)}
                    </div>
                ))}
            </div>
        </div>
    );
};