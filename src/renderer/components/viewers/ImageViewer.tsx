import React, { useState, useRef, useEffect, WheelEvent } from 'react';
import { toFileUrl } from '@shared/utils/fileCommonUtil';
import { Button, Space, Tooltip, Slider, Typography } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, FullscreenExitOutlined, RotateLeftOutlined, RotateRightOutlined, SwapOutlined, InfoCircleOutlined } from '@ant-design/icons';

interface ImageViewerProps {
  path: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ path }) => {
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState<number>(0);
  const [flipped, setFlipped] = useState<boolean>(false);
  const [imageInfo, setImageInfo] = useState<{ width: number; height: number; type: string } | null>(null);
  const [showScrollbars, setShowScrollbars] = useState(true);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 适应屏幕的函数
  const adaptToScreen = (image: HTMLImageElement) => {
    const container = containerRef.current;
    if (container && image.complete) {
      // 获取容器的实际尺寸（减去一些边距）
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      // 根据旋转角度决定原始宽高的使用方式
      // 如果旋转了90度或270度（奇数倍的90度），则宽高需要交换
      const isRotatedByOdd90 = (rotation % 180) !== 0;
      const imgWidth = isRotatedByOdd90 ? image.naturalHeight : image.naturalWidth;
      const imgHeight = isRotatedByOdd90 ? image.naturalWidth : image.naturalHeight;
      
      // 计算适应容器的缩放比例
      const scaleX = containerWidth / imgWidth;
      const scaleY = containerHeight / imgHeight;
      let newScale = Math.min(scaleX, scaleY) * 0.9; // 保留一些边距
      
      // 限制缩放范围在合理区间内
      newScale = Math.max(0.1, Math.min(newScale, 3));
      
      setScale(newScale);
      setPosition({ x: 0, y: 0 });
    }
  };
  
  // 加载图片并获取信息
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageInfo({
        width: img.naturalWidth,
        height: img.naturalHeight,
        type: path.split('.').pop()?.toLowerCase() || ''
      });
      
      // 图片加载完成后自动适应窗口
      setTimeout(() => {
        adaptToScreen(img);
      }, 10);
    };
    img.src = toFileUrl(path);
    
    // 重置变换参数
    // setScale(1);
    // setPosition({ x: 0, y: 0 });
    setRotation(0);
    setFlipped(false);
  }, [path]);
  
  // 鼠标滚轮缩放事件
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.min(Math.max(0.1, scale + delta), 5);
    setScale(newScale);
  };
  
  // 鼠标按下事件（用于拖拽）
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // 只响应左键
    setDragging(true);
    setLastPos({ x: e.clientX - position.x, y: e.clientY - position.y });
  };
  
  // 鼠标移动事件（用于拖拽）
  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    setPosition({
      x: e.clientX - lastPos.x,
      y: e.clientY - lastPos.y
    });
  };
  
  // 鼠标释放事件
  const handleMouseUp = () => {
    setDragging(false);
  };
  
  // 添加鼠标事件监听器
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel as any, { passive: false });
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        container.removeEventListener('wheel', handleWheel as any);
        
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, lastPos, position, scale]);
  
  // 缩放控制函数
  const zoomIn = () => {
    const newScale = Math.min(scale + 0.2, 5);
    setScale(newScale);
  };
  
  const zoomOut = () => {
    const newScale = Math.max(scale - 0.2, 0.1);
    setScale(newScale);
  };
  
  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
    setFlipped(false);
  };
  
  // 旋转控制函数
  const rotateLeft = () => {
    setRotation((prev) => (prev - 90) % 360);
  };
  
  const rotateRight = () => {
    setRotation((prev) => (prev + 90) % 360);
  };
  
  // 翻转控制函数
  const flipHorizontal = () => {
    setFlipped(prev => !prev);
  };
  
  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 防止在输入框等元素上触发
      if ((e.target as HTMLElement).tagName === 'INPUT' || 
          (e.target as HTMLElement).tagName === 'TEXTAREA' || 
          (e.target as HTMLElement).contentEditable === 'true') {
        return;
      }
      
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        resetZoom();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        rotateRight();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        flipHorizontal();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPosition(pos => ({ ...pos, x: pos.x - 50 }));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPosition(pos => ({ ...pos, x: pos.x + 50 }));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPosition(pos => ({ ...pos, y: pos.y - 50 }));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPosition(pos => ({ ...pos, y: pos.y + 50 }));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [scale]);
  
  // 动态控制滚动条显示
  useEffect(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    
    if (container && img && imageInfo) {
      // 计算旋转后的图片尺寸
      const rotationRad = (rotation * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rotationRad));
      const sin = Math.abs(Math.sin(rotationRad));
      
      // 考虑旋转后的宽高
      const rotatedWidth = imageInfo.width * cos + imageInfo.height * sin;
      const rotatedHeight = imageInfo.width * sin + imageInfo.height * cos;
      
      // 应用缩放因子
      const scaledWidth = rotatedWidth * scale;
      const scaledHeight = rotatedHeight * scale;
      
      // 获取容器尺寸
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      // 判断是否需要显示滚动条
      const needsScrollbars = scaledWidth > containerWidth || scaledHeight > containerHeight;
      setShowScrollbars(needsScrollbars);
    }
  }, [scale, rotation, imageInfo]);
  
  // 计算变换样式
  const transformStyle = {
    transform: `translate(${position.x}px, ${position.y}px) scale(${flipped ? -scale : scale}, ${scale}) rotate(${rotation}deg)`,
    transition: dragging ? 'none' : 'transform 0.3s ease',
    cursor: dragging ? 'grabbing' : 'grab'
  };
  
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 工具栏 */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid var(--xt-border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--xt-bg-subtle)',
        zIndex: 1
      }}>
        <Space size="middle">
          <Tooltip title="放大 (+=)">
            <Button size="small" icon={<ZoomInOutlined />} onClick={zoomIn} />
          </Tooltip>
          <Tooltip title="缩小 (-_)">
            <Button size="small" icon={<ZoomOutOutlined />} onClick={zoomOut} />
          </Tooltip>
          <Tooltip title="重置 (0)">
            <Button size="small" icon={<FullscreenExitOutlined />} onClick={resetZoom} />
          </Tooltip>
          <Slider
            min={0.1}
            max={5}
            step={0.1}
            value={scale}
            onChange={(val) => setScale(val)}
            style={{ width: 100 }}
          />
          <span>{Math.round(scale * 100)}%</span>
          <Tooltip title="适应屏幕">
            <Button 
              size="small" 
              onClick={async () => {
                if (imgRef.current) {
                  // 等待图片完全加载
                  if (imgRef.current.complete) {
                    adaptToScreen(imgRef.current);
                  } else {
                    // 如果图片还未加载完成，等待加载后再计算
                    imgRef.current.onload = () => {
                      adaptToScreen(imgRef.current!);
                    };
                  }
                }
              }}
            >
              适应
            </Button>
          </Tooltip>
        </Space>
        
        <Space size="middle">
          <Tooltip title="向左旋转 (R)">
            <Button size="small" icon={<RotateLeftOutlined />} onClick={rotateLeft} />
          </Tooltip>
          <Tooltip title="向右旋转 (R)">
            <Button size="small" icon={<RotateRightOutlined />} onClick={rotateRight} />
          </Tooltip>
          <Tooltip title="水平翻转 (F)">
            <Button size="small" icon={<SwapOutlined />} onClick={flipHorizontal} />
          </Tooltip>
          <Tooltip title="居中对齐">
            <Button 
              size="small" 
              onClick={() => setPosition({ x: 0, y: 0 })}
            >
              居中
            </Button>
          </Tooltip>
        </Space>
        
        <Space size="middle">
          {imageInfo && (
            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
              <InfoCircleOutlined /> {imageInfo.width}×{imageInfo.height} {imageInfo.type.toUpperCase()}
            </Typography.Text>
          )}
        </Space>
      </div>
      
      {/* 图片容器 */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: showScrollbars ? 'auto' : 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        onMouseDown={handleMouseDown}
      >
        <img
          ref={imgRef}
          src={toFileUrl(path)}
          alt={path}
          style={transformStyle}
          draggable="false"
        />
      </div>
    </div>
  );
};
