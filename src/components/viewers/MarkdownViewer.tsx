import React, { useEffect, useRef, useState } from 'react';
import type { MenuProps } from 'antd';
import { Button, Dropdown, Empty, Flex, Menu, message, Space, Spin, Splitter, Tag, Tooltip, Typography } from 'antd';
import { CodeOutlined, EditOutlined, EyeOutlined, FileTextOutlined } from '@ant-design/icons';
import rehypeMermaid from 'rehype-mermaid';
import {
    buildOutline,
    FlatHeading,
    LARGE_FILE_THRESHOLD,
    MarkdownBlocksResult,
    OutlineItem,
    parseMarkdownBlocks,
    setMermaidPlugin,
    splitMarkdownSegments
} from '../../utils/markdown';
import { storage, STORAGE_KEYS } from '../../utils/storage';
import 'highlight.js/styles/github.css';
import './MarkdownViewer.css';
import 'katex/dist/katex.min.css';
import { Center } from "../common/Center";
import { Container } from "../common/Container";
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import Speaker from "../common/Speaker";
import PageSearch from "../common/PageSearch";
import EditorSearch, { searchHighlightField } from "../common/EditorSearch";
import { FontSizeAdjuster } from "../common/FontSizeAdjuster";
import "../common/EditorSearch.css";
import { EditableFilePath } from '../common/EditableFilePath';
import { useAppContext } from '../../contexts/AppContext';

interface MarkdownViewerProps {
    filePath: string;
    fileName: string;
    initialLine?: number;
}

// Mermaid 渲染依赖浏览器环境，在主进程线程池中无法使用，这里注册给渲染进程侧的解析兜底路径
setMermaidPlugin(rehypeMermaid);

/** 大纲最大渲染条数：超大文档可能有上万标题，全量渲染会拖垮界面 */
const MAX_OUTLINE_ITEMS = 1000;

/** 每帧用于插入 DOM 的时间预算（毫秒），保证渐进渲染期间界面不冻结 */
const RENDER_FRAME_BUDGET = 12;

/** 分段解析时首段的目标大小（字符）：首段更小，尽快渲染出首屏内容 */
const FIRST_SEGMENT_SIZE = 24 * 1024;

/** 分段解析时后续各段的目标大小（字符） */
const SEGMENT_SIZE = 384 * 1024;

/** 分段解析的并发度：允许多段同时解析，缩短整体完成时间 */
const PARSE_CONCURRENCY = 2;

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ filePath, fileName, initialLine }) => {
    const { setCurrentFile } = useAppContext();

    // ============================== State Management ==============================
    const [loading, setLoading] = useState(true);          // 文件读取中
    const [stage, setStage] = useState<'reading' | 'parsing' | 'done'>('reading');
    const [parseDone, setParseDone] = useState(0);         // 已解析并追加的段数
    const [parseTotal, setParseTotal] = useState(0);       // 总段数（大文件分段解析）
    const [firstPaint, setFirstPaint] = useState(false);   // 首屏内容是否已出现
    const [content, setContent] = useState('');            // 编辑器内容（仅在需要时更新）
    const [outline, setOutline] = useState<OutlineItem[]>([]);
    const [viewMode, setViewMode] = useState<'rendered' | 'source'>('rendered');
    const [error, setError] = useState<string | null>(null);
    const [editorView, setEditorView] = useState<any>(null);
    const [liteMode, setLiteMode] = useState(false);       // 大文件精简模式
    const [sidebarWidth, setSidebarWidth] = useState<number>(() =>
        storage.get<number>(STORAGE_KEYS.MARKDOWN_SIDEBAR_WIDTH, 250)
    );


    // ============================== Refs ==============================
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedContentRef = useRef<string>('');
    const editorRef = useRef<any>(null);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<string>('');        // 当前原文（避免大字符串反复进 state）
    const queueRef = useRef<{ items: string[]; index: number }>({ items: [], index: 0 }); // 待挂载的 HTML 分片队列
    const allChunksRef = useRef<string[]>([]);    // 已解析的全部分片，用于切回预览模式时重建 DOM
    const headingsRef = useRef<FlatHeading[]>([]); // 累积的扁平标题，用于构建大纲
    const mountedCountRef = useRef(0);            // 已挂载的分片数量
    const parseDoneRef = useRef(false);           // 所有段是否解析完成
    const firstPaintRef = useRef(false);          // 首屏是否已挂载（避免重复 setState）
    const renderTokenRef = useRef(0);             // 渲染令牌，用于丢弃过期的解析/渲染任务
    const rafRef = useRef<number | null>(null);   // 渐进渲染的动画帧
    const pendingScrollTopRef = useRef<number | null>(null); // 渲染完成后要恢复的滚动位置
    const dirtyRef = useRef(false);               // 编辑后预览是否需要刷新
    const isLargeRef = useRef(false);             // 当前文档是否为大文件
    const viewModeRef = useRef(viewMode);         // 供防抖回调读取最新视图模式

    // ============================== View Mode Switching ==============================
    // 切到编辑模式：若内容已修改，先把最新内容同步给编辑器，避免重新挂载后丢失改动
    const showSource = () => {
        if (dirtyRef.current) {
            setContent(contentRef.current);
        }
        setViewMode('source');
    };

    // 切到预览模式：若内容已修改，会在视图模式变化的副作用中重新解析
    const showRendered = () => {
        setViewMode('rendered');
    };

    // ============================== Keyboard Event Handlers ==============================
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Ctrl+E 或 Cmd+E 切换预览/编辑模式
            if (event.key === 'e' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                if (viewModeRef.current === 'rendered') {
                    showSource();
                } else {
                    showRendered();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // ============================== Markdown Parsing ==============================
    /**
     * 解析 Markdown：优先交给主进程线程池执行，避免渲染进程被长时间阻塞
     */
    const parseMarkdownRemote = async (text: string, path: string, lite: boolean, idPrefix = '') => {
        if (window.electronAPI?.parseMarkdownBlocks) {
            try {
                return await window.electronAPI.parseMarkdownBlocks(text, path, lite, idPrefix);
            } catch (err) {
                console.error('后台解析 Markdown 失败，回退到渲染进程解析:', err);
            }
        }
        // 浏览器环境或线程池不可用时的兜底
        return await parseMarkdownBlocks(text, path, lite, idPrefix);
    };

    /**
     * 累积一批解析结果：合并标题并更新大纲
     */
    const applyResult = (result: MarkdownBlocksResult) => {
        const headings = result.headings;
        if (headings && headings.length > 0) {
            for (const heading of headings) {
                headingsRef.current.push(heading);
            }
            setOutline(buildOutline(headingsRef.current));
        }

        if (result.chunks && result.chunks.length > 0) {
            for (const chunk of result.chunks) {
                allChunksRef.current.push(chunk);
            }
        }
    };

    /**
     * 把新一批 HTML 分片加入渲染队列，并驱动渐进挂载
     */
    const enqueueChunks = (chunks: string[], token: number) => {
        if (chunks.length === 0) return;
        const queue = queueRef.current;
        for (const chunk of chunks) {
            queue.items.push(chunk);
        }
        pumpRender(token);
    };

    /**
     * 渐进挂载：每帧只插入时间预算内的分片，保证界面不冻结
     * 队列由分段解析持续喂入，因此首屏内容可以尽早出现
     */
    const pumpRender = (token: number) => {
        if (rafRef.current !== null) return; // 已有渲染循环在运行

        const step = () => {
            if (token !== renderTokenRef.current) return; // 已切换到其他文件，丢弃本次渲染
            const container = previewContainerRef.current;
            const queue = queueRef.current;
            if (!container) {
                rafRef.current = null;
                return;
            }

            const start = performance.now();
            // do...while 保证至少插入一个分片，避免单个超大分片造成空转
            do {
                container.insertAdjacentHTML('beforeend', queue.items[queue.index++]);
                mountedCountRef.current++;
            } while (queue.index < queue.items.length && performance.now() - start < RENDER_FRAME_BUDGET);

            // 压缩已消费部分，避免队列数组无限增长
            if (queue.index > 512) {
                queue.items = queue.items.slice(queue.index);
                queue.index = 0;
            }

            // 首屏内容出现后取消占位提示（只触发一次重渲染）
            if (!firstPaintRef.current) {
                firstPaintRef.current = true;
                setFirstPaint(true);
            }

            // 可滚动高度一旦足够就立即恢复滚动位置，不必等全部渲染完成
            const pending = pendingScrollTopRef.current;
            if (pending !== null) {
                const maxScroll = Math.max(container.scrollHeight - container.clientHeight, 0);
                if (maxScroll >= pending || (parseDoneRef.current && queue.index >= queue.items.length)) {
                    container.scrollTop = Math.min(pending, maxScroll);
                    pendingScrollTopRef.current = null;
                }
            }

            if (queue.index < queue.items.length) {
                rafRef.current = requestAnimationFrame(step);
                return;
            }

            rafRef.current = null;
            if (parseDoneRef.current) {
                setStage('done');
            }
        };

        rafRef.current = requestAnimationFrame(step);
    };

    /**
     * 解析并渲染 Markdown 内容
     * 超大文档按段解析：首段更小，解析完立即挂载，后续段落边解析边追加，
     * 避免"等整个文件解析完才出现内容"的长时间空白
     */
    const parseAndRender = async (text: string, path: string) => {
        const token = ++renderTokenRef.current;
        const lite = text.length > LARGE_FILE_THRESHOLD;
        isLargeRef.current = lite;
        setLiteMode(lite);
        setStage('parsing');
        setParseDone(0);
        setParseTotal(0);
        setFirstPaint(false);

        const container = previewContainerRef.current;
        if (container) {
            container.innerHTML = '';
        }
        queueRef.current = { items: [], index: 0 };
        allChunksRef.current = [];
        mountedCountRef.current = 0;
        headingsRef.current = [];
        firstPaintRef.current = false;
        parseDoneRef.current = false;
        setOutline([]);

        try {
            if (text.length <= LARGE_FILE_THRESHOLD) {
                // 小文件一次解析即可
                const result = await parseMarkdownRemote(text, path, lite);
                if (token !== renderTokenRef.current) return;

                applyResult(result);
                parseDoneRef.current = true;
                setParseTotal(1);
                setParseDone(1);
                enqueueChunks(result.chunks || [], token);
                return;
            }

            // 大文件分段解析：首段较小以尽快出内容，后续段落并发解析
            const segments = splitMarkdownSegments(text, FIRST_SEGMENT_SIZE, SEGMENT_SIZE);
            setParseTotal(segments.length);

            const results: (MarkdownBlocksResult | null)[] = new Array(segments.length).fill(null);
            let nextIndex = 0;
            let flushIndex = 0;

            const runParser = async () => {
                for (;;) {
                    if (token !== renderTokenRef.current) return;
                    const index = nextIndex++;
                    if (index >= segments.length) return;

                    // 各段使用不同前缀，保证标题锚点 ID 不冲突
                    const result = await parseMarkdownRemote(segments[index], path, true, `s${index}_`);
                    if (token !== renderTokenRef.current) return;
                    results[index] = result;

                    // 按段落顺序追加，保证正文顺序正确
                    while (flushIndex < segments.length && results[flushIndex]) {
                        const current = results[flushIndex] as MarkdownBlocksResult;
                        applyResult(current);
                        enqueueChunks(current.chunks || [], token);
                        flushIndex++;
                        setParseDone(flushIndex);
                    }
                }
            };

            await Promise.all(Array.from({ length: PARSE_CONCURRENCY }, runParser));
            if (token !== renderTokenRef.current) return;

            parseDoneRef.current = true;
            if (queueRef.current.index >= queueRef.current.items.length) {
                setStage('done');
            }
        } catch (err) {
            if (token !== renderTokenRef.current) return;
            console.error('解析 Markdown 失败:', err);
            setError('解析 Markdown 内容失败');
            setStage('done');
        }
    };

    // 视图模式变化：中断未完成的渐进渲染；切回预览时重建或重新解析内容
    useEffect(() => {
        viewModeRef.current = viewMode;

        if (viewMode === 'source') {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            return;
        }

        // 从编辑模式切回预览：DOM 已被卸载，需要重新挂载
        const container = previewContainerRef.current;
        if (!container || container.childNodes.length > 0) return;

        if (dirtyRef.current) {
            dirtyRef.current = false;
            void parseAndRender(contentRef.current, filePath);
            return;
        }

        if (allChunksRef.current.length > 0) {
            const token = renderTokenRef.current;
            queueRef.current = { items: [...allChunksRef.current], index: 0 };
            firstPaintRef.current = false;
            setFirstPaint(false);
            setStage('parsing');
            pumpRender(token);
        }
    }, [viewMode, filePath]);



    // ============================== File Loading ==============================
    // 加载 Markdown 文件内容并触发解析渲染
    useEffect(() => {
        let cancelled = false;

        const loadMarkdownFile = async () => {
            try {
                setLoading(true);
                setError(null);
                setOutline([]);
                setFirstPaint(false);
                setStage('reading');
                allChunksRef.current = [];
                queueRef.current = { items: [], index: 0 };
                headingsRef.current = [];
                dirtyRef.current = false;
                firstPaintRef.current = false;
                parseDoneRef.current = false;
                renderTokenRef.current++; // 作废上一个文件的解析/渲染任务

                let fileContent: string;
                if (window.electronAPI) {
                    // Electron 环境下读取文件
                    fileContent = await window.electronAPI.readFile(filePath);
                    lastSavedContentRef.current = fileContent;
                } else {
                    // 浏览器环境下的模拟（实际使用中需要适配）
                    const response = await fetch(filePath);
                    if (response.ok) {
                        fileContent = await response.text();
                        lastSavedContentRef.current = fileContent;
                    } else {
                        throw new Error(`无法加载文件: ${response.statusText}`);
                    }
                }

                if (cancelled) return;

                contentRef.current = fileContent;
                dirtyRef.current = false;
                setContent(fileContent);

                // 计算渲染完成后需要恢复的滚动位置
                const key = `${STORAGE_KEYS.MARKDOWN_SCROLL_POSITION}_${filePath}`;
                const savedScrollTop = storage.get<number>(key, 0);
                pendingScrollTopRef.current = initialLine && initialLine > 0
                    ? (initialLine - 1) * 24 // 预览模式无行号，按估算行高换算
                    : (savedScrollTop > 0 ? savedScrollTop : null);

                void parseAndRender(fileContent, filePath);
            } catch (err) {
                console.error('加载 Markdown 文件失败:', err);
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : '加载文件失败');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadMarkdownFile();

        return () => {
            cancelled = true;
        };
    }, [filePath]);

    // ============================== Auto Save ==============================
    // 自动保存功能
    const saveFile = async (text: string) => {
        if (window.electronAPI && text !== lastSavedContentRef.current) {
            try {
                await window.electronAPI.writeFile(filePath, text);
                lastSavedContentRef.current = text;
                // message.success('文件已自动保存');
            } catch (err) {
                console.error('保存文件失败:', err);
                message.error('文件保存失败');
            }
        }
    };

    // 处理编辑器内容变化：防抖 1.5 秒后自动保存
    // 小文件顺带刷新预览；大文件留到切回预览模式时再解析，避免每次停顿都全量重解析
    const handleEditorChange = (value: string) => {
        contentRef.current = value;
        dirtyRef.current = true;

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
            saveFile(value);
            if (viewModeRef.current === 'rendered' && !isLargeRef.current) {
                dirtyRef.current = false;
                void parseAndRender(value, filePath);
            }
        }, 1500);
    };

    // ============================== Scroll Position ==============================
    // 监听滚动，节流后防抖保存滚动位置（替代固定间隔轮询，避免无意义的同步写入）
    useEffect(() => {
        if (viewMode !== 'rendered') return;
        const container = previewContainerRef.current;
        if (!container) return;

        let ticking = false;
        let writeTimer: NodeJS.Timeout | null = null;
        // 使用文件路径作为键的一部分，确保不同文件有不同的滚动位置
        const key = `${STORAGE_KEYS.MARKDOWN_SCROLL_POSITION}_${filePath}`;

        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                ticking = false;
                const scrollTop = container.scrollTop;
                if (writeTimer) clearTimeout(writeTimer);
                writeTimer = setTimeout(() => storage.set(key, scrollTop), 800);
            });
        };

        container.addEventListener('scroll', onScroll, { passive: true });

        return () => {
            container.removeEventListener('scroll', onScroll);
            if (writeTimer) clearTimeout(writeTimer);
        };
    }, [viewMode, filePath, firstPaint]);

    // 原文模式下跳转到指定行
    useEffect(() => {
        if (loading || error || viewMode !== 'source') return;
        if (!initialLine || initialLine <= 0) return;

        // 延迟跳转，确保 CodeMirror 已经完成渲染
        const timer = setTimeout(() => {
            if (!editorRef.current) return;
            const view = editorRef.current.view;
            const doc = view.state.doc;

            if (initialLine <= doc.lines) {
                const targetPos = doc.line(initialLine).from;
                view.dispatch({
                    selection: { anchor: targetPos },
                    effects: [
                        EditorView.scrollIntoView(targetPos, { y: 'start' })
                    ]
                });
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [loading, viewMode, error, filePath, initialLine]);

    // 组件卸载时清理定时器与未完成的渐进渲染
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, []);

    // ============================== Link Handling ==============================
    // 处理链接点击
    const handleLinkClick = (event: React.MouseEvent<HTMLDivElement>) => {
        // 阻止默认行为
        event.preventDefault();

        // 查找点击目标或其祖先元素中的 a 标签
        const target = event.target as HTMLElement;
        let anchorElement: HTMLAnchorElement | null = null;

        if (target.tagName === 'A') {
            anchorElement = target as HTMLAnchorElement;
        } else {
            // 向上查找最近的 a 标签祖先元素
            anchorElement = target.closest('a');
        }

        // 如果找到了 a 标签，则处理链接点击
        if (anchorElement) {
            const href = anchorElement.href;

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
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
                            selection: { anchor: targetPos },
                            effects: [
                                EditorView.scrollIntoView(targetPos, { y: 'center' })
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
                result.push({ ...item, level });
                if (item.children && item.children.length > 0) {
                    result.push(...flattenItems(item.children, level + 1));
                }
            }
            return result;
        };

        const allItems = flattenItems(items);
        // 超大文档可能有上万个标题，全量渲染会拖垮界面，这里只渲染前若干项
        const visibleItems = allItems.length > MAX_OUTLINE_ITEMS
            ? allItems.slice(0, MAX_OUTLINE_ITEMS)
            : allItems;

        const menu: NonNullable<MenuProps['items']> = visibleItems.map(item => ({
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

        if (allItems.length > visibleItems.length) {
            menu.push({
                key: '__outline_truncated__',
                disabled: true,
                label: (
                    <div style={{ paddingLeft: 16, fontSize: 12, color: '#999' }}>
                        仅显示前 {MAX_OUTLINE_ITEMS} 项（共 {allItems.length} 项）
                    </div>
                )
            });
        }

        return menu;
    };

    const menuItems = generateMenuItems(outline);

    // ============================== Context Menu ==============================
    const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        
        const target = event.target as HTMLElement;
        let element: HTMLElement | null = target;

        // console.log('target:', target);
        
        const blockElements = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE', 'TD', 'TH'];
        
        while (element && !element.classList.contains('markdown-content')) {
            if (blockElements.includes(element.tagName)) {
                break;
            }
            element = element.parentElement;
        }
        
        if (element && !element.classList.contains('markdown-content')) {
            element.classList.add('context-menu-highlight');
            // console.log('element:', element);
        }
    };

    const handleEdit = () => {
        const highlightedElement = document.querySelector('.context-menu-highlight');
        if (highlightedElement) {
            const text = highlightedElement.textContent || '';
            
            if (text) {
                showSource();
                
                setTimeout(() => {
                    if (editorRef.current) {
                        const editor = editorRef.current;
                        const view = editor.view;
                        const doc = view.state.doc;
                        
                        let targetLine = -1;
                        const searchLines = text.split('\n').slice(0, 5);
                        
                        for (let line = 0; line < doc.lines; line++) {
                            const lineText = doc.line(line + 1).text;
                            for (const searchLine of searchLines) {
                                if (searchLine.trim() && lineText.includes(searchLine.trim())) {
                                    targetLine = line;
                                    break;
                                }
                            }
                            if (targetLine >= 0) break;
                        }
                        
                        if (targetLine >= 0) {
                            const lineObj = doc.line(targetLine + 1);
                            const targetPos = lineObj.from;
                            
                            view.dispatch({
                                selection: { anchor: targetPos },
                                effects: [
                                    EditorView.scrollIntoView(targetPos, { y: 'center' })
                                ]
                            });
                        }
                    }
                }, 100);
            }
            
            highlightedElement.classList.remove('context-menu-highlight');
        }
    };

    const handleMenuOpenChange = (open: boolean) => {
        if (!open) {
            const highlightedElement = document.querySelector('.context-menu-highlight');
            if (highlightedElement) {
                highlightedElement.classList.remove('context-menu-highlight');
            }
        }
    };

    const contextMenuItems: MenuProps['items'] = [
        {
            key: 'edit',
            label: '编辑',
            icon: <EditOutlined />,
            onClick: handleEdit,
        },
    ];

    // ============================== Placeholder ==============================
    // 首屏内容出现前显示解析进度，避免长时间空白且无反馈
    const showPlaceholder = !firstPaint && stage !== 'done';
    const placeholderText = stage === 'reading'
        ? '正在读取文件…'
        : parseTotal > 1
            ? `正在解析第 ${Math.min(parseDone + 1, parseTotal)}/${parseTotal} 段…`
            : '正在解析…';

    // ============================== Loading & Error States ==============================
    if (loading) {
        return (
            <Center>
                <Space direction="vertical" align="center" size="middle">
                    <Spin />
                    <span style={{ fontSize: 13, color: '#888' }}>正在读取文件…</span>
                </Space>
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
        <Flex vertical={true} style={{ height: '100%', background: '#fff' }}>
            {/* 工具栏 */}
            <div style={{
                padding: '8px 16px',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fafafa'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8,flex: '1',marginRight: 16 }}>
                    <FileTextOutlined />
                    <EditableFilePath path={filePath} onRename={setCurrentFile} />
                </div>

                <Space size="large">
                    {stage === 'parsing' && (
                        <span style={{ fontSize: 12, color: '#888' }}>
                            {parseTotal > 1 ? `解析中 ${parseDone}/${parseTotal} 段` : '解析中…'}
                        </span>
                    )}

                    {stage === 'done' && liteMode && (
                        <Tooltip title="大文件精简模式：为保证流畅度，暂不渲染代码高亮、代码行号与 Mermaid 图表">
                            <Tag color="orange" style={{ marginInlineEnd: 0 }}>精简模式</Tag>
                        </Tooltip>
                    )}

                    {viewMode === 'rendered' && (
                        <>
                            <PageSearch cssSelector={'.markdown-content'} />
                            <Speaker cssSelector={'.markdown-content'} />
                        </>
                    )}

                    {viewMode === 'source' && editorView && (
                        <EditorSearch editorView={editorView} />
                    )}

                    <FontSizeAdjuster />

                    {/* 视图模式切换按钮 */}
                    <Button.Group>
                        <Button
                            type={viewMode === 'rendered' ? 'primary' : 'default'}
                            icon={<EyeOutlined />}
                            onClick={showRendered}
                            size="small"
                            title="预览模式 (Ctrl+E / Cmd+E)"
                        >
                            预览
                        </Button>
                        <Button
                            type={viewMode === 'source' ? 'primary' : 'default'}
                            icon={<CodeOutlined />}
                            onClick={showSource}
                            size="small"
                            title="编辑模式 (Ctrl+E / Cmd+E)"
                        >
                            编辑
                        </Button>
                    </Button.Group>
                </Space>
            </div>

            <Container style={{ flex: '1' }}>
                <Splitter
                    style={{ height: '100%' }}
                    onResize={(sizes) => {
                        storage.set(STORAGE_KEYS.MARKDOWN_SIDEBAR_WIDTH, sizes[0]);
                        setSidebarWidth(sizes[0]);
                    }}
                >
                    <Splitter.Panel
                        size={sidebarWidth}
                        min={'10%'}
                        max={'50%'}
                        style={{ background: '#fff', padding: '16px 0px' }}
                        collapsible
                    >
                        <Menu
                            mode="inline"
                            items={menuItems}
                        />
                    </Splitter.Panel>

                    <Splitter.Panel style={{ background: '#fff' }}>
                        <div className={'markdown-container'} style={{ height: '100%' }}>
                            {viewMode === 'rendered' ? (
                                <Dropdown menu={{ items: contextMenuItems }} trigger={['contextMenu']} onOpenChange={handleMenuOpenChange}>
                                    <div style={{ position: 'relative', height: '100%' }}>
                                        {/* 内容由渐进渲染直接写入 DOM：
                                            大文档一次性注入会导致长时间冻结，且 HTML 字符串不宜保存在 state 中 */}
                                        <div
                                            ref={previewContainerRef}
                                            className="markdown-content"
                                            style={{ overflowY: 'auto', height: '100%' }}
                                            onClick={handleLinkClick}
                                            onContextMenu={handleContextMenu}
                                        />

                                        {/* 首屏内容出现前的占位提示，避免长时间空白无反馈 */}
                                        {showPlaceholder && (
                                            <div style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                background: '#fff'
                                            }}>
                                                <Space direction="vertical" align="center" size="middle">
                                                    <Spin />
                                                    <span style={{ fontSize: 13, color: '#888' }}>{placeholderText}</span>
                                                </Space>
                                            </div>
                                        )}
                                    </div>
                                 </Dropdown>
                            ) : (
                                <div
                                    className="markdown-source"
                                    style={{ height: '100%' }}
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
                                            searchHighlightField, // 添加搜索高亮字段
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
                                        onCreateEditor={(view) => {
                                            // 保存编辑器实例
                                            setEditorView(view);
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