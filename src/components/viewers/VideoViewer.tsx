import React, { useEffect, useRef, useState, CSSProperties } from "react";
import { Splitter } from "antd";
import { toFileUrl, fullname, name } from "../../utils/fileCommonUtil";
import {
  findSubtitleFiles,
  loadAndParseSubtitle,
  SubtitleItem,
  getCurrentSubtitle,
} from "../../utils/subtitleUtil";
import { useAppContext } from "../../contexts/AppContext";

interface VideoViewerProps {
  path: string;
}

// 样式常量
const containerStyle: CSSProperties = {
  position: "relative",
  height: "100%",
  overflow: "hidden",
};

const videoContainerStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  position: "relative",
};

const videoStyle: CSSProperties = {
  maxWidth: "100%",
  maxHeight: "100%",
};

const subtitleDisplayStyle = (isDragging: boolean, x: number, y: number): CSSProperties => ({
  position: "absolute",
  left: `${x * 100}%`,
  top: `${y * 100}%`,
  transform: "translate(-50%, -50%)",
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  color: "#fff",
  padding: "8px 16px",
  borderRadius: "4px",
  fontSize: "20px",
  maxWidth: "80%",
  textAlign: "center",
  zIndex: 10,
  cursor: isDragging ? "grabbing" : "grab",
});

const subtitlePanelStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  backgroundColor: "#f5f5f5",
  overflowY: "auto",
  padding: "10px",
  borderLeft: "1px solid #e0e0e0",
};

const subtitlePanelHeaderStyle: CSSProperties = {
  fontSize: "16px",
  fontWeight: "bold",
  marginBottom: "10px",
  paddingBottom: "5px",
  borderBottom: "1px solid #e0e0e0",
};

const subtitleItemStyle = (isCurrent: boolean): CSSProperties => ({
  padding: "8px",
  marginBottom: "4px",
  borderRadius: "4px",
  backgroundColor: isCurrent ? "#e6f7ff" : "#fff",
  borderLeft: isCurrent ? "4px solid #1890ff" : "4px solid transparent",
  cursor: "pointer",
  fontSize: "14px",
  lineHeight: 1.5,
  transition: "all 0.3s",
});

const subtitleItemIndexStyle: CSSProperties = {
  fontSize: "12px",
  color: "#888",
  marginBottom: "4px",
};

const subtitleItemTextStyle: CSSProperties = {
  whiteSpace: "pre-wrap",
};

const subtitleSelectStyle: CSSProperties = {
  marginLeft: "10px",
  padding: "4px",
  fontSize: "14px",
};

// 获取视频播放进度的存储键
const getVideoProgressKey = (path: string): string => {
  return `video_progress_${path}`;
};

// 保存播放进度
const saveVideoProgress = (path: string, currentTime: number): void => {
  try {
    localStorage.setItem(getVideoProgressKey(path), currentTime.toString());
  } catch (error) {
    console.warn("Failed to save video progress:", error);
  }
};

// 解析字幕文件名，提取有意义的名称
const getSubtitleDisplayName = (subtitlePath: string, index: number): string => {
  const fileName = fullname(subtitlePath);
  const videoName = name(subtitlePath);
  
  // 尝试从文件名中提取语言代码或其他标识
  // 匹配格式：video.[identifier].ext
  const parts = fileName.split('.');
  if (parts.length >= 3) {
    // 移除扩展名和视频名称部分
    const identifierParts = parts.slice(1, -1);
    const identifier = identifierParts.join('.');
    
    if (identifier && fileName.startsWith(videoName + '.')) {
      return identifier;
    }
  }
  
  // 如果没有匹配到，使用索引+1作为序号
  return `字幕 ${index + 1}`;
};

// 获取播放进度
const getVideoProgress = (path: string): number => {
  try {
    const saved = localStorage.getItem(getVideoProgressKey(path));
    return saved ? parseFloat(saved) : 0;
  } catch (error) {
    console.warn("Failed to get video progress:", error);
    return 0;
  }
};

export const VideoViewer: React.FC<VideoViewerProps> = ({ path }) => {
  const { autoPlay } = useAppContext();
  
  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const subtitlesRef = useRef<HTMLDivElement | null>(null);

  // 面板大小状态
  const [panelSizes, setPanelSizes] = useState<(number | string)[]>(["70%", 0]);
  
  // 字幕相关状态
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<SubtitleItem | null>(null);
  const [subtitleFiles, setSubtitleFiles] = useState<string[]>([]);
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(0);

  // 字幕位置状态（用于拖动功能）
  const [subtitlePosition, setSubtitlePosition] = useState({ x: 0.5, y: 0.9 }); // 使用相对位置 (0-1)
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // 处理面板大小变化
  const handleSplitterResize = (sizes: number[]) => {
    setPanelSizes(sizes);
  };

  // 更新字幕和保存播放进度
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video) {
      // 只在播放时保存进度，避免在拖拽时频繁保存
      if (video.duration && !video.paused && !video.seeking) {
        saveVideoProgress(path, video.currentTime);
      }

      // 更新当前字幕
      const subtitle = getCurrentSubtitle(subtitles, video.currentTime);
      setCurrentSubtitle(subtitle);
    }
  };

  // 拖动开始事件处理
  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);

    // 获取视频容器的位置和尺寸
    const videoContainer = videoContainerRef.current;
    if (videoContainer) {
      const rect = videoContainer.getBoundingClientRect();

      // 计算鼠标在视频容器内的绝对位置
      const absoluteX = e.clientX - rect.left;
      const absoluteY = e.clientY - rect.top;

      // 计算拖动偏移量
      setDragOffset({
        x: absoluteX - rect.width * subtitlePosition.x,
        y: absoluteY - rect.height * subtitlePosition.y,
      });
    }
  };

  // 拖动相关事件处理
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const videoContainer = videoContainerRef.current;
        if (videoContainer) {
          const rect = videoContainer.getBoundingClientRect();

          // 计算鼠标在视频容器内的绝对位置
          const absoluteX = e.clientX - rect.left - dragOffset.x;
          const absoluteY = e.clientY - rect.top - dragOffset.y;

          // 转换为相对位置 (0-1)
          const newX = Math.max(0, Math.min(1, absoluteX / rect.width));
          const newY = Math.max(0, Math.min(1, absoluteY / rect.height));

          // 更新字幕位置
          setSubtitlePosition({ x: newX, y: newY });
        }
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    // 监听全局鼠标事件
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    // 清理事件监听
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // 视频路径变化时的处理
  useEffect(() => {
    // 查找字幕文件
    const searchSubtitles = async () => {
      const files = await findSubtitleFiles(path);
      setSubtitleFiles(files);
      setSelectedSubtitleIndex(0);
    };

    searchSubtitles();

    // 恢复播放进度
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

  // 加载选中的字幕文件
  useEffect(() => {
    const loadSubtitle = async () => {
      if (
        subtitleFiles.length > 0 &&
        selectedSubtitleIndex < subtitleFiles.length
      ) {
        const subtitlePath = subtitleFiles[selectedSubtitleIndex];
        const parsedSubtitles = await loadAndParseSubtitle(subtitlePath);
        setSubtitles(parsedSubtitles);
        
        // 主动设置字幕，即使视频未播放
        const video = videoRef.current;
        if (video) {
          const subtitle = getCurrentSubtitle(parsedSubtitles, video.currentTime);
          setCurrentSubtitle(subtitle);
        } else {
          setCurrentSubtitle(null);
        }
        
        // 设置字幕面板大小
        setPanelSizes(["70%", 320]);
      } else {
        setSubtitles([]);
        setCurrentSubtitle(null);
        setPanelSizes(["70%", 0]);
      }
    };

    loadSubtitle();
  }, [subtitleFiles, selectedSubtitleIndex]);

  // 当当前字幕变化时，滚动到对应的字幕项
  useEffect(() => {
    if (currentSubtitle && subtitlesRef.current) {
      const subtitleElements = subtitlesRef.current.querySelectorAll(".subtitle-item");
      const currentElement = subtitleElements[currentSubtitle.index - 1];
      if (currentElement) {
        currentElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [currentSubtitle]);

  return (
    <div style={containerStyle}>
      <Splitter style={{ height: "100%" }} onResize={handleSplitterResize}>
        {/* 视频播放区域 */}
        <Splitter.Panel
          size={panelSizes[0]}
          min="50%"
          style={{ position: "relative", background: "#000", padding: 0 }}
        >
          <div
            ref={videoContainerRef}
            style={videoContainerStyle}
          >
            <video
              width="100%"
              height="100%"
              ref={videoRef}
              src={toFileUrl(path)}
              style={videoStyle}
              controls
              playsInline
              preload="metadata"
              onTimeUpdate={handleTimeUpdate}
              autoPlay={autoPlay}
            />

            {/* 当前字幕显示 */}
            {currentSubtitle && (
              <div
                style={subtitleDisplayStyle(
                  isDragging,
                  subtitlePosition.x,
                  subtitlePosition.y
                )}
                onMouseDown={handleDragStart}
              >
                {currentSubtitle.text.split("\n").map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
              </div>
            )}
          </div>
        </Splitter.Panel>

        {/* 字幕列表区域 */}
        <Splitter.Panel
          size={panelSizes[1]}
          min={0}
          max="50%"
          collapsible
          style={{ overflow: "hidden" }}
        >
          {subtitles.length > 0 && (
            <div style={subtitlePanelStyle}>
              <div style={subtitlePanelHeaderStyle}>
                字幕列表
                {subtitleFiles.length > 1 && (
                  <select
                    value={selectedSubtitleIndex}
                    onChange={(e) => setSelectedSubtitleIndex(Number(e.target.value))}
                    style={subtitleSelectStyle}
                  >
                    {subtitleFiles.map((file, index) => (
                      <option key={index} value={index}>
                        {getSubtitleDisplayName(file, index)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div ref={subtitlesRef}>
                {subtitles.map((subtitle) => (
                  <div
                    key={subtitle.index}
                    className="subtitle-item"
                    style={subtitleItemStyle(subtitle === currentSubtitle)}
                    onClick={() => {
                      const video = videoRef.current;
                      if (video) {
                        video.currentTime = subtitle.startTime;
                      }
                    }}
                  >
                    <div style={subtitleItemIndexStyle}>
                      {subtitle.index}
                    </div>
                    <div style={subtitleItemTextStyle}>
                      {subtitle.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Splitter.Panel>
      </Splitter>
    </div>
  );
};
