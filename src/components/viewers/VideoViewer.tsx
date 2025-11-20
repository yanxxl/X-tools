import React, { useMemo, useRef, useState, useEffect } from 'react';
import { toFileUrl } from '../../utils/fileType';
import { Spin } from 'antd';

interface VideoViewerProps {
  path: string;
}

// 获取视频播放进度的存储键
const getVideoProgressKey = (path: string): string => {
  return `video_progress_${path}`;
};

// 保存播放进度
const saveVideoProgress = (path: string, currentTime: number): void => {
  try {
    localStorage.setItem(getVideoProgressKey(path), currentTime.toString());
  } catch (error) {
    console.warn('Failed to save video progress:', error);
  }
};

// 获取播放进度
const getVideoProgress = (path: string): number => {
  try {
    const saved = localStorage.getItem(getVideoProgressKey(path));
    return saved ? parseFloat(saved) : 0;
  } catch (error) {
    console.warn('Failed to get video progress:', error);
    return 0;
  }
};

export const VideoViewer: React.FC<VideoViewerProps> = ({ path }) => {
  const src = useMemo(() => toFileUrl(path), [path]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);

  useEffect(() => {
    setIsReady(false);
    setHasRestoredProgress(false);
    const el = videoRef.current;
    if (el) {
      // 触发重新加载，尽快获取元数据
      el.load();
    }
  }, [src]);

  // 恢复播放进度
  useEffect(() => {
    const video = videoRef.current;
    if (video && isReady && !hasRestoredProgress) {
      const savedProgress = getVideoProgress(path);
      if (savedProgress > 0) {
        // 设置一个小的延迟确保视频已经准备好
        const timer = setTimeout(() => {
          if (video.duration && savedProgress < video.duration - 2) {
            video.currentTime = savedProgress;
            console.log(`Restored video progress: ${savedProgress}s`);
          }
          setHasRestoredProgress(true);
        }, 100);
        return () => clearTimeout(timer);
      } else {
        setHasRestoredProgress(true);
      }
    }
  }, [isReady, hasRestoredProgress, path]);

  // 保存播放进度
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && video.duration) {
      // 只在播放时保存进度，避免在拖拽时频繁保存
      if (!video.paused && !video.seeking) {
        saveVideoProgress(path, video.currentTime);
      }
    }
  };

  const handleLoadedMetadata = () => {
    // 元数据已到，可尽快呈现第一帧
    setIsReady(true);
  };

  const handleCanPlay = () => {
    setIsReady(true);
  };

  const handlePlay = () => {
    setAutoPlay(true);
  };

  return (
    <div style={{position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%'}}>
      {!isReady && (
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <Spin tip="正在准备视频..." />
        </div>
      )}
      <video
        width="100%"
        height="100%"
        ref={videoRef}
        src={src}
        style={{ maxWidth: '100%', maxHeight: '100%', background: '#000' }}
        controls
        playsInline
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        autoPlay={autoPlay}
      />
    </div>
  );
};