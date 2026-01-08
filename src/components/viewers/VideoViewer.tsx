import React, { useEffect, useRef, useState, CSSProperties } from "react";
import { Button, Splitter } from "antd";
import { SearchOutlined, LeftOutlined, RightOutlined, CloseOutlined } from "@ant-design/icons";
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
  padding: "10px",
  borderLeft: "1px solid #e0e0e0",
  display: "flex",
  flexDirection: "column",
};

const subtitleListStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
};

const subtitlePanelHeaderStyle: CSSProperties = {
  fontSize: "16px",
  fontWeight: "bold",
  marginBottom: "10px",
  paddingBottom: "5px",
  borderBottom: "1px solid #e0e0e0",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

// 移除不再使用的headerActionsStyle

const searchInputStyle: CSSProperties = {
  padding: "4px 8px",
  fontSize: "14px",
  border: "1px solid #d9d9d9",
  borderRadius: "4px",
  flex: 1,
  minWidth: "200px",
};
const subtitleItemStyle = (isCurrent: boolean, isHovered: boolean): CSSProperties => ({
  padding: "8px",
  marginBottom: "4px",
  borderRadius: "4px",
  backgroundColor: isCurrent ? "#e6f7ff" : (isHovered ? "#f5f5f5" : "#fff"),
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
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const subtitleItemTextStyle: CSSProperties = {
  whiteSpace: "pre-wrap",
};

const highlightStyle: CSSProperties = {
  backgroundColor: "#ffeb3b",
  padding: "1px 2px",
  borderRadius: "2px",
  fontWeight: "bold",
};

// 格式化时间函数
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

// 高亮关键词函数
const highlightKeyword = (text: string, keyword: string): React.ReactNode => {
  if (!keyword.trim()) {
    return text;
  }

  try {
    // 尝试将关键词作为正则表达式处理
    const regex = new RegExp(keyword, "gi");
    const matches: Array<{ text: string; start: number; end: number }> = [];
    let match;
    
    // 找出所有匹配的位置
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length
      });
      
      // 防止零长度匹配导致的无限循环
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }
    
    if (matches.length === 0) {
      return text;
    }
    
    // 构建高亮后的文本片段
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    
    matches.forEach((match, index) => {
      // 添加匹配前的文本
      if (match.start > lastIndex) {
        parts.push(text.substring(lastIndex, match.start));
      }
      
      // 添加高亮的匹配文本
      parts.push(
        <span key={index} style={highlightStyle}>
          {match.text}
        </span>
      );
      
      lastIndex = match.end;
    });
    
    // 添加最后一个匹配后的文本
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts;
  } catch (error) {
    // 如果正则表达式无效，回退到普通字符串高亮
    const lowerKeyword = keyword.toLowerCase();
    const parts = text.split(new RegExp(`(${keyword})`, "gi"));
    
    return parts.map((part, index) => {
      if (part.toLowerCase() === lowerKeyword) {
        return <span key={index} style={highlightStyle}>{part}</span>;
      }
      return part;
    });
  }
};

const subtitleSelectStyle: CSSProperties = {
  marginLeft: "8px", // 减小左边距使其更紧凑
  padding: "2px 6px", // 减小内边距使其更紧凑
  fontSize: "13px", // 减小字体使其低调
  border: "1px solid #d9d9d9",
  borderRadius: "4px",
  backgroundColor: "#fff",
  cursor: "pointer",
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

  // 字幕显示控制状态
  const [subtitleVisible, setSubtitleVisible] = useState(true);

  // 搜索功能状态
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filteredSubtitles, setFilteredSubtitles] = useState<SubtitleItem[]>([]);

  // 字幕列表面板显示状态
  const [subtitlePanelVisible, setSubtitlePanelVisible] = useState(true);

  // 视频可播放状态
  const [canPlay, setCanPlay] = useState(false);

  // 视频区域鼠标悬停状态
  const [videoHovered, setVideoHovered] = useState(false);

  // 处理面板大小变化
  const handleSplitterResize = (sizes: number[]) => {
    setPanelSizes(sizes);
    if (sizes[1] < 120) {
      setSubtitlePanelVisible(false);
    }
  };

  // 处理视频可播放事件
  const handleCanPlay = () => {
    setCanPlay(true);
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

  // 视频路径变化时的处理
  useEffect(() => {
    // 查找字幕文件
    const searchSubtitles = async () => {
      const files = await findSubtitleFiles(path);
      setSubtitleFiles(files);
      setSelectedSubtitleIndex(0);
    };

    searchSubtitles();

    setCanPlay(false);
  }, [path]);

  // 视频路径变化时的处理
  useEffect(() => {
    // 恢复播放进度
    const video = videoRef.current;
    if (video) {
      const savedProgress = getVideoProgress(path);
      if (savedProgress > 0) {
        // 定义恢复进度的函数
        const restoreProgress = () => {
          if (video.duration) {
            const END_THRESHOLD = 2; // 2秒的阈值
            if ((video.duration - savedProgress) > END_THRESHOLD) {
              video.currentTime = savedProgress;
              console.log(`Restored video progress: ${savedProgress}s`);
            } else {
              console.log(`Video progress (${savedProgress}s) is at the end (${video.duration}s), skipping restore`);
            }
          }
        };

        // 如果视频可以播放，直接恢复进度
        if (canPlay) {
          restoreProgress();
        }
      }
    }
  }, [canPlay]);

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
        if (subtitlePanelVisible) {
          setPanelSizes(["70%", 320]);
        }
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

  // 搜索过滤逻辑
  useEffect(() => {
    if (!searchKeyword.trim()) {
      setFilteredSubtitles(subtitles);
      return;
    }

    const filtered = subtitles.filter(subtitle => {
      // 尝试将搜索关键词作为正则表达式处理
      try {
        // 使用i标志忽略大小写
        const regex = new RegExp(searchKeyword, "i");
        return regex.test(subtitle.text);
      } catch (error) {
        // 如果不是有效的正则表达式，回退到普通字符串匹配
        const keyword = searchKeyword.toLowerCase();
        return subtitle.text.toLowerCase().includes(keyword);
      }
    });
    setFilteredSubtitles(filtered);
  }, [subtitles, searchKeyword]);

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
            onMouseEnter={() => setVideoHovered(true)}
            onMouseLeave={() => setVideoHovered(false)}
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
              onCanPlay={handleCanPlay}
              onTimeUpdate={handleTimeUpdate}
              autoPlay={autoPlay}
            />

            {/* 当前字幕显示 */}
            {currentSubtitle && subtitleVisible && (
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

            {/* 展开字幕列表图标 */}
            {!subtitlePanelVisible && videoHovered && subtitles.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  right: "20px",
                  top: "20px",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  backgroundColor: "#aaa",
                  color: "white",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  cursor: "pointer",
                  fontSize: "20px",
                  transition: "opacity 0.3s"
                }}
                onClick={() => {
                  setSubtitlePanelVisible(true);
                  // 恢复面板大小
                  setPanelSizes(["70%", 320]);
                }}
                title="展开字幕列表"
              >
                <LeftOutlined />
              </div>
            )}
          </div>
        </Splitter.Panel>

        {/* 字幕列表区域 */}
        <Splitter.Panel
          size={subtitlePanelVisible ? panelSizes[1] : 0}
          min={80}
          max="50%"
          style={{ 
            overflow: "hidden", 
            padding: "0px",
            display: subtitlePanelVisible ? "block" : "none"
          }}
        >
          {subtitles.length > 0 && (
            <div style={subtitlePanelStyle}>
              <div style={subtitlePanelHeaderStyle}>
                {/* 标题和操作按钮行 */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  {/* 左侧：标题 + 字幕选择下拉菜单 */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>字幕列表</span>
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

                  {/* 右侧：其他操作按钮 */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {/* 字幕显示/隐藏按钮 */}
                    <span className="span-icon"
                      title={"隐藏/显示当前字幕"}
                      onClick={() => setSubtitleVisible(!subtitleVisible)}
                      style={{ display: "inline-flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}
                    >
                      <span className="span-icon"
                        style={{ height: "0.2rem", width: "0.7rem", marginBottom: "0.15rem", background: subtitleVisible ? "#aaa" : "#eee" }}
                      />
                    </span>
                  
                    {/* 搜索按钮 */}
                    <Button
                      type="text"
                      icon={<SearchOutlined />}
                      title={searchVisible ? "关闭搜索" : "搜索字幕"}
                      onClick={() => setSearchVisible(!searchVisible)}
                      style={{ padding: 0, width: 24, height: 24, borderRadius: 4 }}
                    />

                    {/* 字幕面板隐藏/显示按钮 */}
                    <Button
                      type="text"
                      icon={<RightOutlined />}
                      title={subtitlePanelVisible ? "隐藏字幕列表" : "显示字幕列表"}
                      onClick={() => setSubtitlePanelVisible(!subtitlePanelVisible)}
                      style={{ padding: 0, width: 24, height: 24, borderRadius: 4 }}
                    />
                  </div>
                </div>

                {/* 搜索框行 */}
                {searchVisible && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
                    {/* 搜索框容器，包含输入框和命中条数 */}
                    <div style={{ display: "flex", alignItems: "center", width: "100%", position: "relative" }}>
                      <input
                        type="text"
                        style={{ ...searchInputStyle, paddingRight: "40px" }}
                        placeholder="搜索字幕..."
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setSearchVisible(false);
                            setSearchKeyword("");
                          }
                        }}
                      />
                      {/* 命中条数显示 */}
                      <div style={{
                        position: "absolute",
                        right: "12px",
                        fontSize: "12px",
                        color: "#999",
                        pointerEvents: "none"
                      }}>
                        {filteredSubtitles.length}
                      </div>
                    </div>
                    <Button
                      type="text"
                      icon={<CloseOutlined />}
                      title="关闭搜索"
                      onClick={() => {
                        setSearchVisible(false);
                        setSearchKeyword("");
                      }}
                      style={{ padding: 0, width: 24, height: 24, borderRadius: 4 }}
                    />
                  </div>
                )}
              </div>
              <div ref={subtitlesRef} style={subtitleListStyle}>
                {filteredSubtitles.map((subtitle) => (
                  <div
                    key={subtitle.index}
                    className="subtitle-item"
                    style={subtitleItemStyle(subtitle === currentSubtitle, false)}
                    onClick={() => {
                      const video = videoRef.current;
                      if (video) {
                        video.currentTime = subtitle.startTime;
                      }
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = subtitle === currentSubtitle ? "#d4edff" : "#f5f5f5";
                      const timeElement = e.currentTarget.querySelector('.subtitle-time') as HTMLElement;
                      if (timeElement) {
                        timeElement.style.opacity = '1';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = subtitle === currentSubtitle ? "#e6f7ff" : "#fff";
                      if (!searchKeyword) {
                        const timeElement = e.currentTarget.querySelector('.subtitle-time') as HTMLElement;
                        if (timeElement) {
                          timeElement.style.opacity = '0';
                        }
                      }
                    }}
                  >
                    <div style={subtitleItemIndexStyle}>
                      {subtitle.index}
                      <span style={{ 
                        opacity: searchKeyword ? 1 : 0, 
                        transition: 'opacity 0.3s',
                        pointerEvents: 'none'
                      }} 
                      className="subtitle-time">
                        {formatTime(subtitle.startTime)}
                      </span>
                    </div>
                    <div style={subtitleItemTextStyle}>
                      {highlightKeyword(subtitle.text, searchKeyword)}
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
