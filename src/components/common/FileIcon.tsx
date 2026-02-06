import React from 'react';
import { FileTextOutlined, FileImageOutlined, PlayCircleOutlined, FilePdfOutlined, FileOutlined, FolderOutlined, FileWordOutlined, AudioOutlined, FilePptOutlined, FileExcelOutlined } from '@ant-design/icons';
import { detectFileType } from '../../utils/fileCommonUtil';

interface FileIconProps {
    fileName: string;
    isDirectory?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

export const FileIcon: React.FC<FileIconProps> = ({ 
    fileName, 
    isDirectory = false, 
    className,
    style = {} 
}) => {
    // 默认添加右边距，确保与文本对齐
    const defaultStyle = {
        marginRight: 8,
        ...style
    };
    if (isDirectory) {
        return <FolderOutlined className={className} style={defaultStyle} />;
    }

    const fileType = detectFileType(fileName);
    switch (fileType) {
        case 'text':
            return <FileTextOutlined className={className} style={defaultStyle} />;
        case 'image':
            return <FileImageOutlined className={className} style={defaultStyle} />;
        case 'video':
            return <PlayCircleOutlined className={className} style={defaultStyle} />;
        case 'audio':
            return <AudioOutlined className={className} style={defaultStyle} />;
        case 'pdf':
            return <FilePdfOutlined className={className} style={defaultStyle} />;
        case 'docx':
            return <FileWordOutlined className={className} style={defaultStyle} />;
        case 'pptx':
            return <FilePptOutlined className={className} style={defaultStyle} />;
        case 'xlsx':
            return <FileExcelOutlined className={className} style={defaultStyle} />;
        default:
            return <FileOutlined className={className} style={defaultStyle} />;
    }
};
