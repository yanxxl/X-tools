import React from 'react';
import { detectFileType, toFileUrl } from '../utils/fileType';
import { ImageViewer } from './ImageViewer';
import { VideoViewer } from './VideoViewer';
import { PdfViewer } from './PdfViewer';

interface FilePreviewProps {
  filePath: string;
  fileName: string;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ filePath, fileName }) => {
  const type = detectFileType(fileName);

  if (type === 'image') {
    return <div style={{height: '100%'}}><ImageViewer path={filePath} /></div>;
  }

  if (type === 'video') {
    return <div style={{height: '100%'}}><VideoViewer path={filePath} /></div>;
  }

  if (type === 'pdf') {
    return <PdfViewer path={filePath} />;
  }

  // text 或其它：用 iframe 直接打开本地文件（最简单直接）
  return (
    <iframe
      src={toFileUrl(filePath)}
      title={fileName}
      style={{width: '100%', height: '100%', border: 'none', background: '#fff', borderRadius: 8}}
    />
  );
};
