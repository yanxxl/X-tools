import React, {useEffect, useState} from 'react';
import {Button, Typography} from 'antd';
import {FileTextOutlined, FolderOpenOutlined} from '@ant-design/icons';
import {detectFileType, getExtension, isElectronSupportedMedia, isOfficeParserSupported} from '../../utils/fileCommonUtil';
import {FileInfo} from '../../types';
import {ImageViewer} from './ImageViewer';
import {VideoViewer} from './VideoViewer';
import {PdfViewer} from './PdfViewer';
import {MarkdownViewer} from './MarkdownViewer';
import {TextViewer} from './TextViewer';
import {DocxViewer} from './DocxViewer';
import {PptxViewer} from './PptxViewer';
import {XlsxViewer} from './XlsxViewer';
import {FolderViewer} from './FolderViewer';

interface FilePreviewProps {
    filePath: string;
    fileName: string;
    initialLine?: number;
}

export const FileViewer: React.FC<FilePreviewProps> = ({filePath, fileName, initialLine}) => {
    const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
    const [loading, setLoading] = useState(true);

    const type = detectFileType(fileName);
    const ext = getExtension(fileName);

    useEffect(() => {
        const loadFileInfo = async () => {
            setLoading(true);
            try {
                const info = await window.electronAPI.getFileInfo(filePath);
                console.log('file info', info);
                setFileInfo(info);
            } catch (error) {
                console.error('Failed to load file info:', error);
            } finally {
                setLoading(false);
            }
        };
        
        loadFileInfo();
    }, [filePath]);    

    console.log('file', ext, type, filePath)

    // 如果还在加载中，显示加载状态，前面的类型明确，不需要等文件信息加载完成
    if (loading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%'
            }}>
                <Typography.Text>...</Typography.Text>
            </div>
        );
    }

    // 如果 fileInfo 为 null，提示文件已删除或不存在
    if (fileInfo === null) {
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
                    文件不存在
                </Typography.Title>
                <Typography.Text style={{marginBottom: 24, color: '#666'}}>
                    文件可能已被删除、移动或不存在
                </Typography.Text>
                <Typography.Text type="secondary" style={{fontSize: 12}}>
                    {fileName}
                </Typography.Text>
            </div>
        );
    }

    if (type === 'image') {
        return <div style={{height: '100%'}}><ImageViewer path={filePath}/></div>;
    }

    if ((type === 'video' || type === 'audio') && isElectronSupportedMedia(fileName)) {
        return <div style={{height: '100%'}}><VideoViewer path={filePath}/></div>;
    }

    if (type === 'pdf') {
        return <PdfViewer path={filePath}/>;
    }

    if (type === 'docx') {
        return <div style={{height: '100%'}}><DocxViewer path={filePath}/></div>;
    }

    if (type === 'doc') {
        return <TextViewer filePath={filePath} fileName={fileName}/>;
    }

    if (type === 'pptx') {
        return <div style={{height: '100%'}}><PptxViewer path={filePath}/></div>;
    }

    if (type === 'xlsx') {
        return <div style={{height: '100%'}}><XlsxViewer path={filePath}/></div>;
    }

    // Markdown 文件使用专门的 MarkdownViewer
    if (ext === 'md' || ext === 'markdown') {
        return <MarkdownViewer filePath={filePath} fileName={fileName} initialLine={initialLine}/>;
    }

    // 其他文本文件使用 TextViewer
    if (type === 'text') {
        return <TextViewer filePath={filePath} fileName={fileName}/>;
    }

    // officeparser 支持的文件格式使用 TextViewer
    if (isOfficeParserSupported(fileName)) {
        return <TextViewer filePath={filePath} fileName={fileName}/>;
    }
    
    // 如果是文本文件，使用 TextView 组件
    if (fileInfo.isText) {
        return <TextViewer filePath={filePath} fileName={fileName}/>;
    }

    // 如果是文件夹，使用 FolderViewer
    if (fileInfo.isDirectory) {
        return <FolderViewer folderPath={filePath} />;
    }

    // 对于不知道该如何打开的文件，提示
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