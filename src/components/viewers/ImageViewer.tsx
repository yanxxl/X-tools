import React from 'react';
import { toFileUrl } from '../../utils/fileCommonUtil';

interface ImageViewerProps {
  path: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ path }) => {
  return (
    <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%'}}>
      <img
        src={toFileUrl(path)}
        alt={path}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          borderRadius: 8,
          background: '#fff'
        }}
      />
    </div>
  );
};
