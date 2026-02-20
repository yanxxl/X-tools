import React, { useEffect, useRef, useState } from "react";
import { toFileUrl, isVideoFile, isAudioFile, isImageFile } from "../../utils/fileCommonUtil";

interface MediaPlayerProps {
  file: string;
  currentTime?: number;
}

export const GlobalSearchMedia: React.FC<MediaPlayerProps> = ({ file, currentTime = 0 }) => {
  const [canPlay, setCanPlay] = useState(false);

  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  const handleCanPlay = () => {
    setCanPlay(true);
  };

  useEffect(() => {
    setCanPlay(false);
  }, [file]);

  useEffect(() => {
    const media = mediaRef.current;
    if (media && media.duration > 0 && currentTime > 0) {
      const validCurrentTime = Math.min(currentTime, media.duration - 0.1);
      if (validCurrentTime >= 0) {
        media.currentTime = validCurrentTime;
      }
    }
  }, [canPlay, currentTime]);

  const renderContent = () => {
    if (!file) {
      return (
        <div style={{
          color: "#ff4d4f",
          textAlign: "center",
          padding: "16px",
          backgroundColor: "#fff2f0",
          border: "1px solid #ffccc7",
          borderRadius: "4px",
          maxWidth: "80%"
        }}>
          未选择媒体文件
        </div>
      );
    }

    if (isImageFile(file)) {
      return (
        <img
          src={toFileUrl(file)}
          alt=""
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
        />
      );
    }


    if (isVideoFile(file)) {
      return (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          width="100%"
          height="100%"
          src={toFileUrl(file)}
          controls
          playsInline
          preload="auto"
          onCanPlay={handleCanPlay}
          style={{ maxWidth: "100%", maxHeight: "100%" }}
        />
      );
    }
    
    if (isAudioFile(file)) {
      return (
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          src={toFileUrl(file)}
          controls
          preload="auto"
          onCanPlay={handleCanPlay}
          style={{ width: "100%" }}
        />
      );
    }

    // 默认显示不支持的文件格式提示
    return (
      <div style={{
        color: "#ff4d4f",
        textAlign: "center",
        padding: "16px",
        backgroundColor: "#fff2f0",
        border: "1px solid #ffccc7",
        borderRadius: "4px",
        maxWidth: "80%"
      }}>
        该媒体文件格式不受支持，无法播放
      </div>
    );
  };

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
      {renderContent()}
    </div>
  );
};