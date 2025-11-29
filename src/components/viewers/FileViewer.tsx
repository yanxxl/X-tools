import React from 'react';
import {Button, Typography} from 'antd';
import {FileTextOutlined, FolderOpenOutlined} from '@ant-design/icons';
import {detectFileType, getExtension, toFileUrl} from '../../utils/fileType';
import {ImageViewer} from './ImageViewer';
import {VideoViewer} from './VideoViewer';
import {PdfViewer} from './PdfViewer';
import {MarkdownViewer} from './MarkdownViewer';
import {TextViewer} from './TextViewer';

interface FilePreviewProps {
    filePath: string;
    fileName: string;
    initialLine?: number;
}

export const FileViewer: React.FC<FilePreviewProps> = ({filePath, fileName, initialLine}) => {
    const type = detectFileType(fileName);
    const ext = getExtension(fileName);

    console.log('file', ext, type, filePath)

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
        return <MarkdownViewer filePath={filePath} fileName={fileName} initialLine={initialLine}/>;
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