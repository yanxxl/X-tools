import React, { useMemo, useRef, useState, useEffect } from 'react';
import { toFileUrl } from '../utils/fileType';
import { Spin } from 'antd';

interface VideoViewerProps {
  path: string;
}

export const VideoViewer: React.FC<VideoViewerProps> = ({ path }) => {
  const src = useMemo(() => toFileUrl(path), [path]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(false);
    const el = videoRef.current;
    if (el) {
      // 触发重新加载，尽快获取元数据
      el.load();
    }
  }, [src]);

  const handleLoadedMetadata = () => {
    // 元数据已到，可尽快呈现第一帧
    setIsReady(true);
  };

  const handleCanPlay = () => {
    setIsReady(true);
  };

  return (
    <div style={{position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%'}}>
      {!isReady && (
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <Spin tip="正在准备视频..." />
        </div>
      )}
      <video
        ref={videoRef}
        src={src}
        style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, background: '#000' }}
        controls
        playsInline
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
      />
    </div>
  );
};
