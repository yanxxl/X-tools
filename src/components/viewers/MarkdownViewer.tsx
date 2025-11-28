import React, {useEffect, useRef, useState} from 'react';
import type {MenuProps} from 'antd';
import {Button, Empty, Flex, Menu, message, Space, Spin, Splitter, Typography} from 'antd';
import {CodeOutlined, EyeOutlined, FileTextOutlined, MinusOutlined, PlusOutlined} from '@ant-design/icons';
import {OutlineItem, parseMarkdown} from '../../utils/markdown';
import {storage, STORAGE_KEYS} from '../../utils/uiUtils';
import 'highlight.js/styles/github.css';
import './MarkdownViewer.css';
// 导入KaTeX样式，这对于数学公式的正确渲染是必需的
import 'katex/dist/katex.min.css';
import {Center} from "../common/Center";
import {Container} from "../common/Container";
import CodeMirror from '@uiw/react-codemirror';
import {markdown} from '@codemirror/lang-markdown';
import {EditorState} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import TextToSpeech from "../common/TextToSpeech";
import PageSearch from "../common/PageSearch";
import "../common/PageSearch.css";

const {Title} = Typography;

interface MarkdownViewerProps {
    filePath: string;
    fileName: string;
    initialLine?: number;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({filePath, fileName, initialLine}) => {
    // ============================== State Management ==============================
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState('');
    const [html, setHtml] = useState('');
    const [outline, setOutline] = useState<OutlineItem[]>([]);
    const [viewMode, setViewMode] = useState<'rendered' | 'source'>('rendered');
    const [error, setError] = useState<string | null>(null);
    const [fontSize, setFontSize] = useState(() => {
        // 从本地存储读取字体大小设置，默认为 16px
        return storage.get(STORAGE_KEYS.MARKDOWN_FONT_SIZE, 16);
    });

    // ============================== Refs ==============================
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedContentRef = useRef<string>('');
    const editorRef = useRef<any>(null);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const scrollPollingRef = useRef<NodeJS.Timeout | null>(null);

    // ============================== Font Size Functions ==============================
    // 字体大小调整函数
    const increaseFontSize = () => {
        const newSize = Math.min(fontSize + 2, 48);
        setFontSize(newSize);
        storage.set(STORAGE_KEYS.MARKDOWN_FONT_SIZE, newSize);
    };

    const decreaseFontSize = () => {
        const newSize = Math.max(fontSize - 2, 12);
        setFontSize(newSize);
        storage.set(STORAGE_KEYS.MARKDOWN_FONT_SIZE, newSize);
    };

    // 当字体大小状态改变时，更新 CSS 变量
    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--markdown-font-size', `${fontSize}px`);
    }, [fontSize]);

    // ============================== File Loading ==============================
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
                        lastSavedContentRef.current = fileContent;
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

    // ============================== Auto Save ==============================
    // 自动保存功能
    const saveFile = async (text: string) => {
        if (window.electronAPI && text !== lastSavedContentRef.current) {
            try {
                await window.electronAPI.writeFile(filePath, text);
                lastSavedContentRef.current = text;
                message.success('文件已自动保存');
            } catch (err) {
                console.error('保存文件失败:', err);
                message.error('文件保存失败');
            }
        }
    };

    // 处理编辑器内容变化
    const handleEditorChange = (value: string) => {
        setContent(value);

        // 防抖处理，3秒后自动保存
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
            saveFile(value);
        }, 3000);
    };

    // ============================== Scroll Position ==============================
    // 设置轮询保存滚动位置
    useEffect(() => {
        // 只有在预览模式下才启动轮询
        if (viewMode === 'rendered') {
            // 每1秒保存一次滚动位置
            scrollPollingRef.current = setInterval(() => {
                if (previewContainerRef.current) {
                    const scrollTop = previewContainerRef.current.scrollTop;
                    // 使用文件路径作为键的一部分，确保不同文件有不同的滚动位置
                    const key = `${STORAGE_KEYS.MARKDOWN_SCROLL_POSITION}_${filePath}`;
                    storage.set(key, scrollTop);
                }
            }, 1000);
        }

        return () => {
            if (scrollPollingRef.current) {
                clearInterval(scrollPollingRef.current);
            }
        };
    }, [viewMode, filePath]);

    // 在文件加载完成后处理滚动位置或初始行跳转
    useEffect(() => {
        if (!loading && !error) {
            // 延迟设置滚动位置，确保DOM已经完全渲染
            setTimeout(() => {
                // 如果有初始行要求，优先跳转到指定行
                if (initialLine && initialLine > 0) {
                    if (viewMode === 'rendered') {
                        // 预览模式下跳转到指定行
                        // 由于渲染后的HTML没有行号信息，我们通过行数近似估算
                        if (previewContainerRef.current) {
                            const lineHeight = 24; // 估算行高
                            previewContainerRef.current.scrollTop = (initialLine - 1) * lineHeight;
                        }
                    } else {
                        // 原文模式下使用CodeMirror跳转到指定行
                        if (editorRef.current) {
                            const editor = editorRef.current;
                            const view = editor.view;
                            const doc = view.state.doc;

                            if (initialLine <= doc.lines) {
                                const lineObj = doc.line(initialLine);
                                const targetPos = lineObj.from;

                                view.dispatch({
                                    selection: {anchor: targetPos},
                                    effects: [
                                        EditorView.scrollIntoView(targetPos, {y: 'start'})
                                    ]
                                });
                            }
                        }
                    }
                } else {
                    // 否则恢复之前的滚动位置
                    if (viewMode === 'rendered') {
                        const key = `${STORAGE_KEYS.MARKDOWN_SCROLL_POSITION}_${filePath}`;
                        const savedScrollTop = storage.get<number>(key, 0);

                        if (previewContainerRef.current && savedScrollTop > 0) {
                            previewContainerRef.current.scrollTop = savedScrollTop;
                        }
                    }
                }
            }, 200);
        }
    }, [loading, viewMode, error, filePath, initialLine]);

    // 组件卸载时清理定时器
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            if (scrollPollingRef.current) {
                clearInterval(scrollPollingRef.current);
            }
        };
    }, []);

    // ============================== Markdown Parsing ==============================
    // 解析 Markdown 内容
    useEffect(() => {
        const parseContent = async () => {
            if (content) {
                try {
                    const result = await parseMarkdown(content, filePath);
                    setHtml(result.html);
                    setOutline(result.outline);
                } catch (err) {
                    console.error('解析 Markdown 失败:', err);
                    setError('解析 Markdown 内容失败');
                }
            }
        };

        parseContent();
    }, [content]);

    // ============================== Link Handling ==============================
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

    // ============================== Outline Handling ==============================
    // 处理大纲点击
    const handleOutlineClick = (item: OutlineItem) => {
        console.log(`跳转到大纲项: ${item.title}, 视图模式: ${viewMode}`);

        // 增加延迟确保 DOM 已经完全渲染
        setTimeout(() => {
            // 预览模式下的跳转逻辑
            if (viewMode === 'rendered') {
                const element = document.getElementById(item.id);
                if (element) {
                    console.log('element', [element]);
                    element.scrollIntoView({behavior: 'smooth', block: 'start'});
                    // 添加临时高亮效果
                    element.classList.add('outline-highlight-animation');
                    setTimeout(() => {
                        element.classList.remove('outline-highlight-animation');
                    }, 1500);
                } else {
                    console.warn(`未找到预览元素: #${item.id}`);
                }
                return;
            }

            // 原文模式下使用 CodeMirror 6 API 进行跳转和高亮
            if (viewMode === 'source' && editorRef.current) {
                try {
                    // 获取 CodeMirror 实例
                    const editor = editorRef.current;
                    const view = editor.view;
                    const doc = view.state.doc;

                    // 逐行查找标题文本
                    let targetLine = -1;
                    for (let line = 0; line < doc.lines; line++) {
                        const lineText = doc.line(line + 1).text;
                        // 检查是否是标题行，并且文本内容匹配
                        if ((lineText.startsWith('#') || lineText.startsWith('##') || lineText.startsWith('###') ||
                                lineText.startsWith('####') || lineText.startsWith('#####') || lineText.startsWith('######')) &&
                            lineText.replace(/^#+\s*/, '').trim() === item.title.trim()) {
                            targetLine = line;
                            break;
                        }
                    }

                    if (targetLine >= 0) {
                        // 计算目标位置
                        const lineObj = doc.line(targetLine + 1);
                        const targetPos = lineObj.from;

                        // 应用滚动到目标位置
                        view.dispatch({
                            selection: {anchor: targetPos},
                            effects: [
                                EditorView.scrollIntoView(targetPos, {y: 'start'})
                            ]
                        });

                        // 优化高亮实现，使用更精确的DOM选择方式
                        setTimeout(() => {
                            try {
                                // 使用位置信息查找对应的DOM元素，更准确可靠
                                const rect = view.coordsAtPos(targetPos);
                                if (rect) {
                                    // 找到对应行的DOM元素
                                    const lineWidget = document.elementFromPoint(rect.left + 5, rect.top + 5);
                                    if (lineWidget) {
                                        // 向上查找包含整个行的父元素
                                        let lineElement = lineWidget;
                                        while (lineElement && !lineElement.classList.contains('cm-line') && lineElement !== view.dom) {
                                            lineElement = lineElement.parentElement!;
                                        }

                                        if (lineElement && lineElement.classList.contains('cm-line')) {
                                            const element = lineElement as HTMLElement;
                                            // 应用高亮样式
                                            element.classList.add('outline-highlight-animation');

                                            // 1.5秒后移除高亮
                                            setTimeout(() => {
                                                if (element.isConnected) { // 确保元素仍然在DOM中
                                                    element.classList.remove('outline-highlight-animation');
                                                }
                                            }, 1500);
                                        }
                                    }
                                }
                            } catch (error) {
                                console.warn('高亮应用失败:', error);
                            }
                        }, 200); // 增加延迟时间，确保滚动和渲染完成后再添加高亮
                    } else {
                        console.warn(`未找到匹配的标题行: ${item.title}`);
                    }
                } catch (error) {
                    console.error('CodeMirror 跳转失败:', error);
                }
            }
        }, 300);
    };

    // 生成大纲菜单项 - 使用扁平化结构避免事件冒泡
    const generateMenuItems = (items: OutlineItem[]): MenuProps['items'] => {
        const flattenItems = (items: OutlineItem[], level = 0): OutlineItem[] => {
            const result: OutlineItem[] = [];
            for (const item of items) {
                result.push({...item, level});
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
                    style={{paddingLeft: `${item.level * 16}px`}}
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

    // ============================== Loading & Error States ==============================
    if (loading) {
        return (
            <Center>
                <Spin size="large"/>
                <div>正在加载 Markdown 文件...</div>
            </Center>
        );
    }

    if (error) {
        return (
            <Center>
                <Empty
                    description={error}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
            </Center>
        );
    }

    // ============================== Main Render ==============================
    return (
        <Flex vertical={true} style={{height: '100%', background: '#fff'}}>
            {/* 工具栏 */}
            <div style={{
                padding: '8px 16px',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fafafa'
            }}>
                <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                    <FileTextOutlined/>
                    <Title level={5} style={{margin: 0}}>{fileName}</Title>
                </div>

                <Space size="large">
                    <PageSearch cssSelector={viewMode === 'rendered' ? '.markdown-content' : '.markdown-source .cm-line'}/>
                    <TextToSpeech cssSelector={'.markdown-content,.markdown-source .cm-line'}/>

                    {/* 字体大小调整按钮 */}
                    <Button.Group>
                        <Button
                            icon={<MinusOutlined/>}
                            onClick={decreaseFontSize}
                            size="small"
                            disabled={fontSize <= 12}
                            title="减小字体 (A-)"
                        />
                        <Button
                            size="small"
                            style={{
                                minWidth: '50px',
                                cursor: 'default',
                                margin: '0 4px'
                            }}
                            disabled
                        >
                            {fontSize}px
                        </Button>
                        <Button
                            icon={<PlusOutlined/>}
                            onClick={increaseFontSize}
                            size="small"
                            disabled={fontSize >= 48}
                            title="增大字体 (A+)"
                        />
                    </Button.Group>

                    {/* 视图模式切换按钮 */}
                    <Button.Group>
                        <Button
                            type={viewMode === 'rendered' ? 'primary' : 'default'}
                            icon={<EyeOutlined/>}
                            onClick={() => setViewMode('rendered')}
                            size="small"
                        >
                            预览
                        </Button>
                        <Button
                            type={viewMode === 'source' ? 'primary' : 'default'}
                            icon={<CodeOutlined/>}
                            onClick={() => setViewMode('source')}
                            size="small"
                        >
                            原文
                        </Button>
                    </Button.Group>
                </Space>
            </div>

            <Container style={{flex: '1'}}>
                <Splitter style={{height: '100%'}}>
                    <Splitter.Panel
                        defaultSize={250}
                        min={'10%'}
                        max={'50%'}
                        style={{background: '#fff', padding: '16px 0px'}}
                        collapsible
                    >
                        <Menu
                            mode="inline"
                            items={menuItems}
                        />
                    </Splitter.Panel>

                    <Splitter.Panel style={{background: '#fff'}}>
                        <div className={'markdown-container'} style={{height: '100%'}}>
                            {viewMode === 'rendered' ? (
                                <div
                                    ref={previewContainerRef}
                                    className="markdown-content"
                                    style={{overflowY: 'auto', height: '100%'}}
                                    dangerouslySetInnerHTML={{__html: html}}
                                    onClick={handleLinkClick}
                                />
                            ) : (
                                <div
                                    className="markdown-source"
                                    style={{height: '100%'}}
                                >
                                    <CodeMirror
                                        ref={editorRef}
                                        value={content}
                                        height="100%"
                                        theme="light"
                                        extensions={[
                                            markdown(),
                                            EditorView.updateListener.of((update) => {
                                                if (update.docChanged) {
                                                    handleEditorChange(update.state.doc.toString());
                                                }
                                            }),
                                            EditorView.lineWrapping,
                                            EditorState.readOnly.of(false),
                                            EditorView.theme({
                                                '& .outline-highlight': {
                                                    backgroundColor: '#fff3cd',
                                                    transition: 'background-color 1.5s ease-out'
                                                }
                                            })
                                        ]}
                                        onChange={(value) => {
                                            handleEditorChange(value);
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </Splitter.Panel>
                </Splitter>
            </Container>
        </Flex>
    );
};