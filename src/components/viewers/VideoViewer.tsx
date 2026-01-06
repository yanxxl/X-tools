import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toFileUrl } from '../../utils/fileCommonUtil';
import { Skeleton } from 'antd';
import { useAppContext } from "../../contexts/AppContext";

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
        // console.log('Saving video progress:', path, currentTime); 大概每秒保存三四次
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
    const { autoPlay } = useAppContext()
    const videoRef = useRef<HTMLVideoElement | null>(null);

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

    // 恢复播放进度
    useEffect(() => {
        const video = videoRef.current;
        if (video) {
            const savedProgress = getVideoProgress(path);
            if (savedProgress > 0) {
                // 设置一个小的延迟确保视频已经准备好
                const timer = setTimeout(() => {
                    if (video.duration && savedProgress < video.duration - 2) {
                        video.currentTime = savedProgress;
                        console.log(`Restored video progress: ${savedProgress}s`);
                    }
                }, 100);
                return () => clearTimeout(timer);
            }
        }
    }, [path]);

    return (
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <video
                width="100%"
                height="100%"
                ref={videoRef}
                src={toFileUrl(path)}
                style={{ maxWidth: '100%', maxHeight: '100%', background: '#000' }}
                controls
                playsInline
                preload="metadata"
                onTimeUpdate={handleTimeUpdate}
                autoPlay={autoPlay}
            />
        </div>
    );
};