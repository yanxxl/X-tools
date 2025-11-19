import React, { useState, useEffect } from 'react';
import { Card, Spin, Empty, Menu, Layout, Typography, Button, Space } from 'antd';
import { FileTextOutlined, MenuOutlined, CodeOutlined, EyeOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { parseMarkdown, OutlineItem } from '../../utils/markdown';
import 'highlight.js/styles/github.css';
import './MarkdownViewer.css';

const { Sider, Content } = Layout;
const { Title } = Typography;

interface MarkdownViewerProps {
  filePath: string;
  fileName: string;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ filePath, fileName }) => {
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [html, setHtml] = useState('');
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [outlineVisible, setOutlineVisible] = useState(true);
  const [viewMode, setViewMode] = useState<'rendered' | 'source'>('rendered');
  const [error, setError] = useState<string | null>(null);

  // 加载 Markdown 文件内容
  useEffect(() => {
    const loadMarkdownFile = async () => {
      try {
        setLoading(true);
        setError(null);

        if (window.electronAPI) {
          // Electron 环境下读取文件
          const fileContent = await window.electronAPI.readFile(filePath);
          setContent(fileContent);
        } else {
          // 浏览器环境下的模拟（实际使用中需要适配）
          const response = await fetch(filePath);
          if (response.ok) {
            const fileContent = await response.text();
            setContent(fileContent);
          } else {
            throw new Error(`无法加载文件: ${response.statusText}`);
          }
        }
      } catch (err) {
        console.error('加载 Markdown 文件失败:', err);
        setError(err instanceof Error ? err.message : '加载文件失败');
      } finally {
        setLoading(false);
      }
    };

    loadMarkdownFile();
  }, [filePath]);

  // 解析 Markdown 内容
  useEffect(() => {
    if (content) {
      try {
        const result = parseMarkdown(content);
        setHtml(result.html);
        setOutline(result.outline);
      } catch (err) {
        console.error('解析 Markdown 失败:', err);
        setError('解析 Markdown 内容失败');
      }
    }
  }, [content]);

  // 处理链接点击
  const handleLinkClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'A') {
      const anchorElement = target as HTMLAnchorElement;
      const href = anchorElement.href;
      
      // 阻止默认行为
      event.preventDefault();
      
      try {
        // 检查链接类型
        const url = new URL(href);
        const isExternal = url.protocol !== 'file:' && url.protocol !== 'http:' && url.protocol !== 'https:';
        const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
        const isMailto = url.protocol === 'mailto:';
        const isAnchor = href.includes('#') && url.pathname === window.location.pathname;
        
        if (isAnchor) {
          // 锚点链接 - 页面内跳转
          const elementId = href.split('#')[1];
          const element = document.getElementById(elementId);
          if (element) {
            element.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        } else if (isHttp || isMailto || isExternal) {
          // 外部链接 - 在系统默认应用中打开
          if (window.electronAPI) {
            window.electronAPI.openExternal(href);
          } else {
            window.open(href, '_blank');
          }
        } else {
          // 相对链接或文件链接
          if (window.electronAPI) {
            window.electronAPI.openExternal(href);
          } else {
            window.open(href, '_blank');
          }
        }
      } catch (error) {
        // 如果 URL 解析失败，直接使用默认方式打开
        if (window.electronAPI) {
          window.electronAPI.openExternal(href);
        } else {
          window.open(href, '_blank');
        }
      }
    }
  };

  // 处理大纲点击
  const handleOutlineClick = (item: OutlineItem) => {
    // 增加延迟确保 DOM 已经完全渲染
    setTimeout(() => {
      const element = document.getElementById(item.id);
      
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        // 添加视觉反馈
        element.style.backgroundColor = '#fff3cd';
        setTimeout(() => {
          element.style.backgroundColor = '';
        }, 1000);
      }
    }, 300);
  };

  // 生成大纲菜单项 - 使用扁平化结构避免事件冒泡
  const generateMenuItems = (items: OutlineItem[]): MenuProps['items'] => {
    const flattenItems = (items: OutlineItem[], level = 0): OutlineItem[] => {
      const result: OutlineItem[] = [];
      for (const item of items) {
        result.push({ ...item, level });
        if (item.children && item.children.length > 0) {
          result.push(...flattenItems(item.children, level + 1));
        }
      }
      return result;
    };

    return flattenItems(items).map(item => ({
      key: `${item.id}-${item.level}`,
      label: (
        <div 
          style={{ paddingLeft: `${item.level * 16}px` }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleOutlineClick(item);
          }}
        >
          {item.title}
        </div>
      ),
    }));
  };

  const menuItems = generateMenuItems(outline);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%',
        flexDirection: 'column',
        gap: 16
      }}>
        <Spin size="large" />
        <div>正在加载 Markdown 文件...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%',
        flexDirection: 'column',
        gap: 16
      }}>
        <Empty 
          description={error}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <Layout style={{ height: '100%', background: '#fff' }}>
      {/* 工具栏 */}
      <div style={{ 
        padding: '8px 16px', 
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#fafafa'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileTextOutlined />
          <Title level={5} style={{ margin: 0 }}>{fileName}</Title>
        </div>
        
        <Space>
          {/* 视图模式切换按钮 */}
          <Button.Group>
            <Button
              type={viewMode === 'rendered' ? 'primary' : 'default'}
              icon={<EyeOutlined />}
              onClick={() => setViewMode('rendered')}
              size="small"
            >
              预览
            </Button>
            <Button
              type={viewMode === 'source' ? 'primary' : 'default'}
              icon={<CodeOutlined />}
              onClick={() => setViewMode('source')}
              size="small"
            >
              原文
            </Button>
          </Button.Group>
          
          {outline.length > 0 && viewMode === 'rendered' && (
            <div
              style={{ 
                cursor: 'pointer', 
                padding: '4px 8px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
              onClick={() => setOutlineVisible(!outlineVisible)}
            >
              <MenuOutlined />
              <span>大纲</span>
            </div>
          )}
        </Space>
      </div>

      <Layout>
        {/* 大纲侧边栏 - 只在渲染视图下显示 */}
        {outlineVisible && outline.length > 0 && viewMode === 'rendered' && (
          <Sider 
            width={250} 
            style={{ 
              background: '#fff',
              borderRight: '1px solid #f0f0f0',
              overflow: 'auto'
            }}
          >
            <Card 
              title="文档大纲" 
              size="small" 
              style={{ margin: 8 }}
              bodyStyle={{ padding: 0 }}
            >
              <Menu
                mode="inline"
                items={menuItems}
                style={{ border: 'none' }}
              />
            </Card>
          </Sider>
        )}

        {/* 内容区域 */}
        <Content style={{ 
          padding: '16px 24px',
          overflow: 'auto',
          background: '#fff'
        }}>
          {viewMode === 'rendered' ? (
            <div 
              className="markdown-content"
              dangerouslySetInnerHTML={{ __html: html }}
              onClick={handleLinkClick}
            />
          ) : (
            <div className="markdown-source">
              <pre><code>{content}</code></pre>
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};