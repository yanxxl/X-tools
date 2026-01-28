import React, { useEffect, useRef, useState } from "react";
import { toFileUrl, isElectronSupportedMedia, isVideoFile, isAudioFile } from "../../utils/fileCommonUtil";

interface MediaPlayerProps {
  file: string;
  currentTime?: number;
}

export const MediaPlayer: React.FC<MediaPlayerProps> = ({ file, currentTime = 0 }) => {
  const [canPlay, setCanPlay] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  const handleCanPlay = () => {
    setCanPlay(true);
  };

  useEffect(() => {
    setCanPlay(false);

    if (file) {
      const isMedia = isVideoFile(file) || isAudioFile(file);

      if (!isMedia) {
        setError('该文件不是有效的媒体文件（视频或音频）');
        return;
      }

      if (!isElectronSupportedMedia(file)) {
        setError('该媒体文件格式不受支持，无法播放');
        return;
      }

      setError(null);
    } else {
      setError('未选择媒体文件');
    }
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

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
      {error ? (
        <div style={{
          color: "#ff4d4f",
          textAlign: "center",
          padding: "16px",
          backgroundColor: "#fff2f0",
          border: "1px solid #ffccc7",
          borderRadius: "4px",
          maxWidth: "80%"
        }}>
          {error}
        </div>
      ) : isVideoFile(file) ? (
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
      ) : (
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          src={toFileUrl(file)}
          controls
          preload="auto"
          onCanPlay={handleCanPlay}
          style={{ width: "100%" }}
        />
      )}
    </div>
  );
};