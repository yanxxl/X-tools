import React, {useEffect, useRef, useState} from 'react';
import {Button, Space, Tooltip} from 'antd';
import {LeftOutlined, PauseCircleOutlined, PlayCircleOutlined, RightOutlined} from '@ant-design/icons';
import {useAppContext} from '../../contexts/AppContext';

interface TextToSpeechProps {
    cssSelector: string; // CSS选择符参数
}

/**
 * 清理文本，移除HTML标签和特殊符号
 * @param text 原始文本
 * @returns 清理后的文本
 */
const cleanTextForSpeech = (text: string): string => {
    if (!text) return '';

    let cleanedText = text;

    // 1. 移除HTML标签
    cleanedText = cleanedText.replace(/<[^>]*>/g, '');

    // 2. 移除Markdown语法
    cleanedText = cleanedText
        // 移除标题标记
        .replace(/^#{1,6}\s+/gm, '')
        // 移除粗体和斜体标记
        .replace(/\*\*|__|\*|_/g, '')
        // 移除链接标记
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // 移除图片标记
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
        // 移除列表标记
        .replace(/^[\s]*[-*+]\s+/gm, '')
        .replace(/^[\s]*\d+\.\s+/gm, '')
        // 移除引用标记
        .replace(/^>\s+/gm, '')
        // 移除代码块标记
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1');

    // 3. 移除特殊符号
    cleanedText = cleanedText
        // 移除换行符和制表符，替换为空格
        .replace(/[\r\n\t]+/g, ' ')
        // 移除多余的空格
        .replace(/\s+/g, ' ')
        // 移除控制字符
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1F\x7F]/g, '')
        // 移除不必要的标点符号（保留基本标点）
        .replace(/[^\u4e00-\u9fa5a-zA-Z0-9，。！？：；、,.!?;: ]/g, '')
        // 移除连续的标点符号
        .replace(/([，。！？：；、,.!?;:]){2,}/g, '$1');

    // 4. 清理首尾空格
    return cleanedText.trim();
};

/**
 * 语音播放组件
 * 接收CSS选择符参数，实现语音朗读功能
 */
const Speaker: React.FC<TextToSpeechProps> = ({cssSelector}) => {
    // 状态管理
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(-1); // 初始值为-1，避免默认选中第一行
    const [selectedText, setSelectedText] = useState('');
    const [elements, setElements] = useState<HTMLElement[]>([]);

    const synthRef = useRef<SpeechSynthesis | null>(null);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const originalStylesRef = useRef<Map<HTMLElement, string>>(new Map());
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const selectedTextRef = useRef(selectedText); // 保存最新的选中文本，解决闭包问题

    const {currentFile} = useAppContext();

    /**
     * 获取视口内第一个可见头部的元素索引，如果没有则找可见尾部的元素
     * @param elementsList 可选的元素列表，如果不提供则使用当前elements状态
     * @returns 可见元素的索引，如果没有可见元素则返回0
     */
    const getFirstVisibleElementIndex = (elementsList?: HTMLElement[]): number => {
        const targetElements = elementsList || elements;
        if (targetElements.length === 0) return 0;

        // 1. 寻找第一个可见头部的元素
        for (let i = 0; i < targetElements.length; i++) {
            const rect = targetElements[i].getBoundingClientRect();
            // 头部可见：top 在视口内，80 是考虑两层标题栏影响
            if (rect.top >= 80 && rect.top <= window.innerHeight) {
                return i;
            }
        }

        // 2. 如果没有可见头部的元素，寻找第一个可见尾部的元素
        for (let i = 0; i < targetElements.length; i++) {
            const rect = targetElements[i].getBoundingClientRect();
            // 尾部可见：bottom 在视口内
            if (rect.bottom >= 0 && rect.bottom <= window.innerHeight) {
                return i;
            }
        }

        // 3. 如果以上都没有找到，回退到原始逻辑
        for (let i = 0; i < targetElements.length; i++) {
            const rect = targetElements[i].getBoundingClientRect();
            if (rect.top <= window.innerHeight && rect.bottom >= 0 && rect.left <= window.innerWidth && rect.right >= 0) {
                return i;
            }
        }

        return 0;
    };

    /**
     * 处理文本选中
     */
    const handleSelectedText = () => {
        const selected = window.getSelection()?.toString().trim() || '';
        const currentSelectedText = selectedTextRef.current;

        setSelectedText(selected);

        // 如果选中文本有变化，停止当前播放，让用户可以点击播放选中文本
        if (selected !== currentSelectedText) {
            synthRef.current?.cancel();
            setIsPlaying(false);
        }
    };

    /**
     * 恢复原始样式
     */
    const restoreOriginalStyles = () => {
        originalStylesRef.current.forEach((style, element) => {
            element.style.backgroundColor = style;
        });
        originalStylesRef.current.clear();
    };

    /**
     * 高亮当前元素
     * @param index 当前元素索引
     */
    const highlightCurrentElement = (index: number) => {
        // 恢复之前的样式
        restoreOriginalStyles();

        if (index >= 0 && index < elements.length) {
            const element = elements[index];
            // 保存原始样式
            originalStylesRef.current.set(element, element.style.backgroundColor);
            // 设置高亮样式
            element.style.backgroundColor = 'rgba(255, 215, 0, 0.3)';
        }
    };

    /**
     * 检查当前元素是否需要重新定位（索引无效、元素不可见或不是头部可见元素）
     * @param index 当前元素索引
     * @param elementsList 元素列表
     * @returns 是否需要重新定位
     */
    const shouldRepositionElement = (index: number, elementsList: HTMLElement[]): boolean => {
        // 索引无效，需要重新定位
        if (index < 0 || index >= elementsList.length) {
            return true;
        }

        const element = elementsList[index];
        if (!element) {
            return true;
        }

        // 获取元素的位置信息
        const rect = element.getBoundingClientRect();

        // 完全不可见的条件：元素底部在视口顶部之上，或元素顶部在视口底部之下
        const isCompletelyInvisible = rect.bottom < 0 || rect.top > window.innerHeight;

        // 如果元素完全不可见，需要重新定位
        if (isCompletelyInvisible) {
            return true;
        }

        // 检查当前元素是否是头部可见的元素（优先播放头部可见元素）
        const isCurrentElementHeadVisible = rect.top >= 0 && rect.top <= window.innerHeight;

        // 如果当前元素不是头部可见的元素，检查是否存在头部可见的元素
        if (!isCurrentElementHeadVisible) {
            // 寻找是否存在头部可见的元素
            for (let i = 0; i < elementsList.length; i++) {
                const elementRect = elementsList[i].getBoundingClientRect();
                if (elementRect.top >= 0 && elementRect.top <= window.innerHeight) {
                    // 存在头部可见的元素，但当前元素不是，需要重新定位
                    return true;
                }
            }
        }

        // 元素完全可见，且是头部可见的元素（或没有头部可见的元素），不需要重新定位
        return false;
    };

    /**
     * 根据CSS选择符获取元素列表
     * @returns 元素列表
     */
    const getElementsFromSelector = (): HTMLElement[] => {
        if (typeof window === 'undefined') return [];

        const elements = document.querySelectorAll<HTMLElement>(cssSelector);
        if (elements.length === 0) return [];

        // 如果只有一个元素，使用其直接子元素作为列表
        if (elements.length === 1) {
            const element = elements[0];
            const children = Array.from(element.children) as HTMLElement[];
            return children.length > 0 ? children : [element];
        }

        return Array.from(elements);
    };

    /**
     * 播放语音
     * @param text 要播放的文本
     */
    const play = (text = '') => {
        // 创建新的语音实例
        const utterance = new SpeechSynthesisUtterance(cleanTextForSpeech(text));
        utterance.lang = 'zh-CN';
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onend = () => {
            // 朗读完毕，如果是选中文本，就停止播放；否则继续下一个
            if (selectedText) {
                setIsPlaying(false);
            } else {
                // 使用函数式更新获取最新的currentIndex，避免闭包问题
                setCurrentIndex(prevIndex => prevIndex + 1);
            }
        };

        utterance.onerror = (e) => {
            console.error('语音播放错误:', e);
        };

        utteranceRef.current = utterance;

        synthRef.current?.cancel();
        // 延后开始播放，避免cancel引发的异常打断当前播放
        setTimeout(() => {
            synthRef.current?.speak(utterance);
        }, 150);
    };

    // 初始化语音合成实例、轮询和滚动监听
    useEffect(() => {
        synthRef.current = window.speechSynthesis;

        // 启动选中文本轮询
        pollIntervalRef.current = setInterval(() => {
            handleSelectedText();
        }, 1000);

        // 添加滚动事件监听，当页面滚动时检查当前元素的可见性
        const handleScroll = () => {
            if (isPlaying && !selectedText && elements.length > 0) {
                // 检查当前播放的元素是否可见
                if (shouldRepositionElement(currentIndex, elements)) {
                    // 当前元素不可见或不是头部可见元素，重新定位到第一个可见头部的元素
                    const firstVisibleIndex = getFirstVisibleElementIndex();
                    if (firstVisibleIndex !== currentIndex) {
                        setCurrentIndex(firstVisibleIndex);
                    }
                }
            }
        };

        window.addEventListener('scroll', handleScroll);

        // 清理函数
        return () => {
            synthRef.current?.cancel();
            clearInterval(pollIntervalRef.current || 0);
            restoreOriginalStyles();
            window.removeEventListener('scroll', handleScroll);
        };
    }, [isPlaying, selectedText, elements, currentIndex]);

    // 当selectedText状态变化时，更新ref的值
    useEffect(() => {
        selectedTextRef.current = selectedText;
    }, [selectedText]);

    // 当currentIndex变化时，取消当前播放
    useEffect(() => {
        synthRef.current?.cancel();
    }, [currentIndex]);

    // 监听文件路径变化，清空状态
    useEffect(() => {
        // 每次currentFile变化时都清空状态
        synthRef.current?.cancel();
        setIsPlaying(false);
        setCurrentIndex(-1);
        setSelectedText('');
        restoreOriginalStyles(); // 清除高亮显示

        // 清空元素状态，确保重新计算
        setElements([]);
    }, [currentFile]);

    // 核心播放逻辑
    useEffect(() => {
        // 如果有选中文本且处于播放状态，播放选中文本
        if (isPlaying && selectedText) {
            play(selectedText);
            return;
        }

        // 只有在播放状态下且有有效索引才高亮当前元素
        if (isPlaying && currentIndex >= 0 && elements.length > 1 && !selectedText) {
            const element = elements[currentIndex];
            if (element) {
                element.scrollIntoView({behavior: 'smooth', block: 'center'});
                highlightCurrentElement(currentIndex);
            }
        }

        // 播放结束时，回到初始状态
        if (currentIndex >= elements.length) {
            synthRef.current?.cancel();
            setIsPlaying(false);
            setCurrentIndex(-1);
            return;
        }

        // 暂停状态处理
        if (!isPlaying) {
            if (synthRef.current?.speaking) {
                synthRef.current.pause();
            }
            return;
        }

        // 恢复播放处理
        if (synthRef.current?.paused && synthRef.current?.speaking) {
            synthRef.current.resume();
            return;
        }

        // 播放当前索引的文本
        let text = selectedText;
        if (!text && currentIndex >= 0 && currentIndex < elements.length) {
            text = elements[currentIndex].textContent || '';
        }

        if (!text) {
            setCurrentIndex(currentIndex + 1);
            return;
        }

        play(text);
    }, [isPlaying, currentIndex, elements, selectedText]);

    return (
        <Space size="small">
            <Tooltip title={isPlaying ? '暂停' : '播放'}>
                <Button
                    type="primary"
                    size="small"
                    icon={isPlaying ? <PauseCircleOutlined/> : <PlayCircleOutlined/>}
                    onClick={() => {
                        // 如果是第一次播放且currentIndex为-1，设置为当前可见元素的索引
                        if (!isPlaying) {
                            // 先获取元素列表并设置到状态中
                            const elementsList = getElementsFromSelector();
                            setElements(elementsList);
                            // 如果当前元素不可见，找到第一个可见元素的索引
                            if (shouldRepositionElement(currentIndex, elementsList)) {
                                const firstVisibleIndex = getFirstVisibleElementIndex(elementsList);
                                setCurrentIndex(firstVisibleIndex);
                            }
                        }
                        setIsPlaying(!isPlaying);
                    }}
                >
                    {isPlaying ? '暂停' : '播放'}
                </Button>
            </Tooltip>

            {selectedText
                ? (
                    <span style={{backgroundColor: 'lightgray', padding: '4px'}}>
                        {selectedText.substring(0, 2)}...
                    </span>
                )
                : currentIndex !== -1 && (
                <>
                    {/* 上一个按钮 */}
                    <Tooltip title="上一个">
                        <Button
                            size="small"
                            icon={<LeftOutlined/>}
                            onClick={() => setCurrentIndex(currentIndex > 0 ? currentIndex - 1 : 0)}
                            disabled={!(elements.length > 0 && currentIndex > 0)}
                        />
                    </Tooltip>

                    {/* 当前播放信息 */}
                    <span style={{fontSize: '12px', color: '#666', minWidth: '80px', textAlign: 'center'}}>
                            {currentIndex >= 0 ? currentIndex + 1 : 1} / {elements.length}
                        </span>

                    {/* 下一个按钮 */}
                    <Tooltip title="下一个">
                        <Button
                            size="small"
                            icon={<RightOutlined/>}
                            onClick={() => {
                                // 如果currentIndex为-1，设置为0，否则递增
                                setCurrentIndex(currentIndex === -1 ? 0 : currentIndex + 1);
                            }}
                            disabled={!(elements.length > 0 && currentIndex < elements.length - 1)}
                        />
                    </Tooltip>
                </>
            )
            }
        </Space>
    );
};

export default Speaker;