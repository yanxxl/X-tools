import React from 'react';
import { toFileUrl } from '../utils/fileType';

interface PdfViewerProps {
  path: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ path }) => {
  const src = toFileUrl(path);
  return (
    <div style={{width: '100%', height: '100%', background: '#fff', borderRadius: 8, overflow: 'hidden'}}>
      <embed src={src} type="application/pdf" style={{width: '100%', height: '100%'}} />
    </div>
  );
};
