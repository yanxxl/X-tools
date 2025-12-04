import React, {useEffect, useRef, useState} from 'react';
import {Button, Input} from 'antd';
import type {InputRef} from 'antd/es/input';
import {CloseOutlined, LeftOutlined, RightOutlined, SearchOutlined} from '@ant-design/icons';
import {useAppContext} from '../../contexts/AppContext';

interface PageSearchProps {
    cssSelector: string; // CSS选择器，用于指定搜索范围
}

const PageSearch: React.FC<PageSearchProps> = ({cssSelector}) => {
    // 常量定义
    const HIGHLIGHT_CLASS = 'page-search-highlight';
    const CURRENT_RESULT_CLASS = 'current-result';
    const POLLING_INTERVAL = 500; // 轮询间隔，单位毫秒
    const SEARCH_DEBOUNCE = 300; // 搜索防抖时间，单位毫秒
    const SELECTION_DELAY = 300; // 选中文本延迟搜索时间，单位毫秒
    const SEARCH_CONTAINER_STYLE = {
        display: 'flex',
        alignItems: 'center',
        padding: '0px 4px',
        border: '1px solid #d9d9d9',
        borderRadius: '4px',
        backgroundColor: '#fff',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.3s ease'
    };
    const SEARCH_BUTTON_STYLE = {
        color: '#666',
        border: 'none',
        padding: '4px 8px',
        borderRadius: '4px',
        transition: 'all 0.3s ease'
    };
    const SEARCH_INPUT_STYLE = {
        flex: 1,
        border: 'none',
        borderRadius: '4px',
        boxShadow: 'none',
        padding: '4px 8px',
        minWidth: '150px'
    };
    const NAV_BUTTON_STYLE = {
        border: 'none',
        color: '#666',
        padding: '4px 8px',
        borderRadius: '4px',
        transition: 'all 0.3s ease'
    };
    const RESULT_COUNT_STYLE = {
        fontSize: '12px',
        color: '#666',
        padding: '0 4px'
    };

    // 状态管理
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState<HTMLElement[]>([]);
    const [currentResultIndex, setCurrentResultIndex] = useState(0);
    const [selectedText, setSelectedText] = useState('');
    const [tempSelectedText, setTempSelectedText] = useState('');
    

    // 引用管理
    const searchInputRef = useRef<InputRef>(null);
    const selectedTextPollingRef = useRef<number | null>(null);
    const selectionDelayTimerRef = useRef<NodeJS.Timeout | null>(null);
    

    // 上下文
    const {currentFile} = useAppContext();

    // 获取当前页面选中的文本
    const getSelectedText = (): string => {
        return window.getSelection()?.toString().trim() || '';
    };

    // 转义正则表达式特殊字符
    const escapeRegExp = (string: string): string => {
        return string.replace(/[.*+?^${}()|\\[\]]/g, '\\$&');
    };

    // 清除所有高亮
    const clearHighlights = (): void => {
        const highlightedElements = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
        highlightedElements.forEach(el => {
            const parent = el.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode((el as HTMLElement).textContent || ''), el);
                parent.normalize(); // 合并相邻的文本节点
            }
        });
    };

    // 高亮搜索结果
    const highlightResults = (elements: HTMLElement[]): void => {
        clearHighlights();

        elements.forEach((element, index) => {
            if (element.nodeType === Node.ELEMENT_NODE && element.textContent) {
                const text = element.textContent;
                // 使用专门的转义函数来避免转义字符问题
                const escapedSearchText = escapeRegExp(searchText);
                const regex = new RegExp(`(${escapedSearchText})`, 'gi');
                const highlightedText = text.replace(regex, `<mark class="${HIGHLIGHT_CLASS}" data-result-index="${index}">$1</mark>`);

                // 创建临时容器来设置innerHTML，然后替换原元素的内容
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = highlightedText;

                // 清空原元素内容并添加新的内容
                while (element.firstChild) {
                    element.removeChild(element.firstChild);
                }
                while (tempDiv.firstChild) {
                    element.appendChild(tempDiv.firstChild);
                }
            }
        });
    };

    // 滚动到指定结果并高亮显示
    const scrollToResult = (index: number): void => {
        const highlightedElements = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
        if (highlightedElements.length > 0 && index >= 0 && index < highlightedElements.length) {
            const element = highlightedElements[index] as HTMLElement;
            element.scrollIntoView({behavior: 'smooth', block: 'center'});

            // 更新当前结果的样式
            highlightedElements.forEach((el, i) => {
                if (i === index) {
                    el.classList.add(CURRENT_RESULT_CLASS);
                } else {
                    el.classList.remove(CURRENT_RESULT_CLASS);
                }
            });
        }
    };

    // 执行搜索
    const performSearch = (): void => {
        if (!searchText.trim()) {
            clearHighlights();
            setSearchResults([]);
            setCurrentResultIndex(0);
            return;
        }

        // 查找匹配的元素
        const container = document.querySelector(cssSelector);
        if (!container) {
            console.warn(`未找到CSS选择器 "${cssSelector}" 对应的元素`);
            return;
        }

        // 查找包含搜索文本的所有元素
        const allElements = container.querySelectorAll('*');
        const matchedElements: HTMLElement[] = [];

        allElements.forEach(element => {
            // 处理包含文本的元素，不管是否有子元素
            if (element.textContent &&
                element.textContent.toLowerCase().includes(searchText.toLowerCase())) {
                matchedElements.push(element as HTMLElement);
            }
        });

        setSearchResults(matchedElements);
        setCurrentResultIndex(0);

        if (matchedElements.length > 0) {
            highlightResults(matchedElements);
            // 只在有搜索文本时才自动滚动到第一个结果
            if (!selectedText) {
                setTimeout(() => scrollToResult(0), 100);
            }
        } else {
            clearHighlights();
        }
    };

    // 上一个结果
    const goToPrevious = (): void => {
        if (searchResults.length === 0) return;

        const newIndex = currentResultIndex > 0 ? currentResultIndex - 1 : searchResults.length - 1;
        setCurrentResultIndex(newIndex);
        scrollToResult(newIndex);
    };

    // 下一个结果
    const goToNext = (): void => {
        if (searchResults.length === 0) return;

        const newIndex = currentResultIndex < searchResults.length - 1 ? currentResultIndex + 1 : 0;
        setCurrentResultIndex(newIndex);
        scrollToResult(newIndex);
    };

    // 切换搜索框显示/隐藏
    const toggleSearch = (): void => {
        setIsSearchVisible(!isSearchVisible);
        if (isSearchVisible) {
            // 关闭时清除高亮和搜索状态
            clearHighlights();
            setSearchResults([]);
            setSearchText('');
        } else {
            // 打开时使用当前选中的文本进行搜索
            const text = getSelectedText();
            if (text) {
                setSearchText(text);
            }
        }
    };

    // 监听键盘事件
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
        if (e.key === 'Escape') {
            setIsSearchVisible(false);
            clearHighlights();
            setSearchResults([]);
            setSearchText('');
        } else if (e.key === 'Enter' && searchResults.length > 0) {
            // 按回车键切换到下一个结果
            goToNext();
        }
    };

    // 监听输入变化自动搜索（带防抖）
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            performSearch();
        }, SEARCH_DEBOUNCE);

        return () => clearTimeout(timeoutId);
    }, [searchText]);

    // 监听文件路径变化，清空搜索状态
    useEffect(() => {
        if (currentFile) {
            // 每次currentFile变化时都清空搜索状态
            clearHighlights();
            setSearchResults([]);
            setSearchText('');
            setCurrentResultIndex(0);
            setIsSearchVisible(false);
        }
    }, [currentFile]);

    // 监听ESC键关闭搜索
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsSearchVisible(false);
                clearHighlights();
                setSearchResults([]);
                setSearchText('');
            }
        };

        if (isSearchVisible) {
            document.addEventListener('keydown', handleGlobalKeyDown);
            // 自动聚焦到搜索输入框
            setTimeout(() => {
                if (searchInputRef.current) {
                    searchInputRef.current.focus();
                }
            }, 100);
        }

        return () => {
            document.removeEventListener('keydown', handleGlobalKeyDown);
        };
    }, [isSearchVisible]);

    // 轮询获取当前页面选中的文本
    useEffect(() => {
        // 启动轮询
        const startPolling = () => {
            if (selectedTextPollingRef.current) return;

            // 立即获取一次选中的文本
            setSelectedText(getSelectedText());

            // 设置轮询
            selectedTextPollingRef.current = window.setInterval(() => {
                setSelectedText(getSelectedText());
            }, POLLING_INTERVAL);
        };

        // 停止轮询
        const stopPolling = () => {
            if (selectedTextPollingRef.current) {
                clearInterval(selectedTextPollingRef.current);
                selectedTextPollingRef.current = null;
            }
        };

        // 启动轮询
        startPolling();

        // 组件卸载时停止轮询并清除高亮
        return () => {
            stopPolling();
            clearHighlights();
            // 清除所有定时器
            if (selectionDelayTimerRef.current) {
                clearTimeout(selectionDelayTimerRef.current);
                selectionDelayTimerRef.current = null;
            }
        };
    }, []);

    // 当有新的选中时，设置临时选中状态并启动延迟定时器
    useEffect(() => {
        if (selectedText && isSearchVisible) {
            // 清除之前的定时器
            if (selectionDelayTimerRef.current) {
                clearTimeout(selectionDelayTimerRef.current);
            }
            
            // 设置临时选中状态
            setTempSelectedText(selectedText);
            
            // 启动新的定时器
            selectionDelayTimerRef.current = setTimeout(() => {
                // 只有当临时选中状态与当前选中状态相同时，才更新搜索文本
                setSearchText(selectedText);
            }, SELECTION_DELAY);
        } else if (!selectedText) {
            // 如果没有选中任何文本，清除定时器
            if (selectionDelayTimerRef.current) {
                clearTimeout(selectionDelayTimerRef.current);
                selectionDelayTimerRef.current = null;
            }
            setTempSelectedText('');
        }
        
        return () => {
            // 清除定时器
            if (selectionDelayTimerRef.current) {
                clearTimeout(selectionDelayTimerRef.current);
            }
        };
    }, [selectedText, isSearchVisible]);

    return (
        <>
            {!isSearchVisible ? (
                <Button
                    onClick={toggleSearch}
                    type="text"
                    icon={<SearchOutlined/>}
                    style={SEARCH_BUTTON_STYLE}
                />
            ) : (
                <div style={SEARCH_CONTAINER_STYLE}>
                    <SearchOutlined style={{color: '#666', marginRight: '4px'}} />
                    <Input
                        ref={searchInputRef}
                        placeholder="搜索页面内容"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        style={SEARCH_INPUT_STYLE}
                        bordered={false}
                    />
                    {searchResults.length > 0 && (
                        <>
                            <Button 
                                icon={<LeftOutlined/>} 
                                onClick={goToPrevious} 
                                size="small" 
                                type="text"
                                style={NAV_BUTTON_STYLE}
                            />
                            <span style={RESULT_COUNT_STYLE}>
                                {currentResultIndex + 1}/{searchResults.length}
                            </span>
                            <Button 
                                icon={<RightOutlined/>} 
                                onClick={goToNext} 
                                size="small" 
                                type="text"
                                style={NAV_BUTTON_STYLE}
                            />
                        </>
                    )}
                    <Button
                        onClick={() => {
                            setIsSearchVisible(false);
                            clearHighlights();
                            setSearchResults([]);
                            setSearchText('');
                        }}
                        size="small"
                        type="text"
                        icon={<CloseOutlined/>}
                        style={SEARCH_BUTTON_STYLE}
                    />
                </div>
            )}
        </>
    );
};

export default PageSearch;