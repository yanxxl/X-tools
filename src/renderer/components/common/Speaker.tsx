import React, { useEffect, useRef, useState } from 'react';
import { Button, Space, Tooltip } from 'antd';
import { CloseOutlined, LeftOutlined, PauseCircleOutlined, PlayCircleOutlined, RightOutlined } from '@ant-design/icons';
import { useAppContext } from '../../contexts/AppContext';

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
        .replace(/[^一-龥a-zA-Z0-9，。！？：；、,.!?;: ]/g, '')
        // 移除连续的标点符号
        .replace(/([，。！？：；、,.!?;:]){2,}/g, '$1');

    // 4. 清理首尾空格
    return cleanedText.trim();
};

/**
 * 语音播放组件
 * 接收CSS选择符参数，实现语音朗读功能
 */
const Speaker: React.FC<TextToSpeechProps> = ({ cssSelector }) => {
    // ==================== 状态管理 ====================

    // 状态定义
    const [opened, setOpened] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(-1); // 初始值为-1，避免默认选中第一行
    const [selectedText, setSelectedText] = useState('');
    const [elements, setElements] = useState<HTMLElement[]>([]);

    // ==================== 引用与上下文 ====================

    // 引用管理
    const synthRef = useRef<SpeechSynthesis | null>(null);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const originalStylesRef = useRef<Map<HTMLElement, string>>(new Map());
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const selectedTextRef = useRef(selectedText); // 保存最新的选中文本，解决闭包问题

    // 上下文
    const { currentFile } = useAppContext();

    // ==================== 工具函数 ====================

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

    // ==================== 副作用处理 ====================

    // 初始化语音合成实例、轮询和滚动监听
    useEffect(() => {
        synthRef.current = window.speechSynthesis;

        // 启动选中文本轮询
        pollIntervalRef.current = setInterval(() => {
            handleSelectedText();
        }, 1000);

        // 清理函数
        return () => {
            synthRef.current?.cancel();
            clearInterval(pollIntervalRef.current || 0);
            restoreOriginalStyles();
        };
    }, [isPlaying, selectedText, elements, currentIndex]);

    // 当selectedText状态变化时，更新ref的值
    useEffect(() => {
        selectedTextRef.current = selectedText;
    }, [selectedText]);

    // 当currentIndex变化时，取消当前播放
    useEffect(() => {
        synthRef.current?.cancel();
        highlightCurrentElement(currentIndex);
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
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

    // 当opened状态改变时的处理
    useEffect(() => {
        if (!opened) {
            // 重置元素光标样式
            elements.forEach(element => {
                element.style.cursor = '';
            });
            // 关闭时清理所有状态
            synthRef.current?.cancel();
            setIsPlaying(false);
            setCurrentIndex(-1);
            setSelectedText('');
            setElements([]);
            restoreOriginalStyles();
        } else {
            // 打开时初始化元素列表
            const elementsList = getElementsFromSelector();
            setElements(elementsList);

            // 为元素列表添加手型光标样式
            elementsList.forEach(element => {
                element.style.cursor = 'pointer';

                element.addEventListener('click', () => {
                    setCurrentIndex(elementsList.indexOf(element));
                });
            });
        }
    }, [opened]);

    // ==================== 渲染输出 ====================

    // 当 open 为 false 时，返回一个 play 按钮
    if (!opened) {
        return (
            <Button
                type="default"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => setOpened(true)}
            />
        );
    }

    return (
        <Space size="small" style={{ border: '1px solid #eee', padding: '2px' }}>
            <Tooltip title={isPlaying ? '暂停' : '播放'}>
                <Button
                    type="primary"
                    size="small"
                    icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                    onClick={() => {
                        setIsPlaying(!isPlaying);
                    }}
                />
            </Tooltip>

            {selectedText
                ? <span style={{ backgroundColor: 'lightgray', padding: '4px' }}>{selectedText.substring(0, 2)}...</span>
                : (
                    <>
                        {/* 上一个按钮 */}
                        <Tooltip title="上一个">
                            <Button
                                size="small"
                                icon={<LeftOutlined />}
                                onClick={() => setCurrentIndex(currentIndex > 0 ? currentIndex - 1 : 0)}
                                disabled={!(elements.length > 0 && currentIndex > 0)}
                            />
                        </Tooltip>

                        {/* 当前播放信息 */}
                        <span style={{ fontSize: '12px', color: '#666', minWidth: '80px', textAlign: 'center' }}>
                            {currentIndex >= 0 ? currentIndex + 1 : 1} / {elements.length}
                        </span>

                        {/* 下一个按钮 */}
                        <Tooltip title="下一个">
                            <Button
                                size="small"
                                icon={<RightOutlined />}
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

            <Tooltip title="关闭">
                <Button
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={() => setOpened(false)}
                />
            </Tooltip>
        </Space>
    );
};

export default Speaker;