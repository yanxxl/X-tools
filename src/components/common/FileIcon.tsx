import React from 'react';
import { FileTextOutlined, FileImageOutlined, PlayCircleOutlined, FilePdfOutlined, FileOutlined, FolderOutlined, FileWordOutlined } from '@ant-design/icons';
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
    if (isDirectory) {
        return <FolderOutlined className={className} style={style} />;
    }

    const fileType = detectFileType(fileName);
    switch (fileType) {
        case 'text':
            return <FileTextOutlined className={className} style={style} />;
        case 'image':
            return <FileImageOutlined className={className} style={style} />;
        case 'video':
            return <PlayCircleOutlined className={className} style={style} />;
        case 'pdf':
            return <FilePdfOutlined className={className} style={style} />;
        case 'docx':
            return <FileWordOutlined className={className} style={style} />;
        default:
            return <FileOutlined className={className} style={style} />;
    }
};
