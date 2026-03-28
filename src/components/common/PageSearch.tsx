import React, { useEffect, useRef, useState } from 'react';
import { Button, Input } from 'antd';
import type { InputRef } from 'antd/es/input';
import { CloseOutlined, LeftOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';
import { useAppContext } from '../../contexts/AppContext';
import { getSelectedText } from '../../utils/format';

interface PageSearchProps {
    cssSelector: string; // CSS选择器，用于指定搜索范围
}

const STYLE_ID = 'page-search-highlight-style';
if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        .page-search-highlight {
            background-color: #ffec99;
        }
        .page-search-highlight.current-result {
            background-color: #ffd43b;
            animation: page-search-pulse 1s infinite;
        }
        @keyframes page-search-pulse {
            0% { background-color: #ffd43b; }
            50% { background-color: #ffc000; }
            100% { background-color: #ffd43b; }
        }
    `;
    document.head.appendChild(style);
}

const PageSearch: React.FC<PageSearchProps> = ({ cssSelector }) => {

    const HIGHLIGHT_CLASS = 'page-search-highlight';
    const CURRENT_RESULT_CLASS = 'current-result';
    const SEARCH_DEBOUNCE = 300; // 搜索防抖时间，单位毫秒
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
    const [totalMatches, setTotalMatches] = useState(0); // 实际匹配项数量
    const [currentResultIndex, setCurrentResultIndex] = useState(0);
    const [searchExecuted, setSearchExecuted] = useState(false); // 搜索是否已执行的状态


    // 引用管理
    const searchInputRef = useRef<InputRef>(null);


    // 上下文
    const { currentFile } = useAppContext();

    // 转义正则表达式特殊字符
    const escapeRegExp = (string: string): string => {
        return string.replace(/[.*+?^${}()|[\]]/g, '\\$&');
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



    // 滚动到指定结果并高亮显示
    const scrollToResult = (index: number): void => {
        const highlightedElements = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
        
        if (highlightedElements.length > 0 && index >= 0 && index < highlightedElements.length) {
            const element = highlightedElements[index] as HTMLElement;
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });

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
        setSearchExecuted(true); // 标记搜索已执行

        // 每次搜素都得先清空状态
        clearHighlights();
        setTotalMatches(0);
        setCurrentResultIndex(0);

        // 查找匹配的元素
        const container = document.querySelector(cssSelector);
        if (!container) {
            console.warn(`未找到CSS选择器 "${cssSelector}" 对应的元素`);
            return;
        }

        // 获取所有文本节点
        const textNodes: Text[] = [];
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
        let node;
        while ((node = walker.nextNode())) {
            textNodes.push(node as Text);
        }

        // 使用专门的转义函数来避免转义字符问题
        const escapedSearchText = escapeRegExp(searchText);
        const regex = new RegExp(`(${escapedSearchText})`, 'gi');
        
        // 计算总匹配数
        let totalMatches = 0;
        textNodes.forEach(textNode => {
            const text = textNode.textContent || '';
            const matches = text.match(regex);
            if (matches) {
                totalMatches += matches.length;
            }
        });
        
        if (totalMatches > 0) {
            // 设置匹配总数
            setTotalMatches(totalMatches);
            
            // 用于跟踪已创建的高亮标记数
            let highlightIndex = 0;
            
            // 处理每个文本节点
            textNodes.forEach(textNode => {
                const text = textNode.textContent || '';
                if (regex.test(text)) {
                    const highlightedText = text.replace(regex, (match) => {
                        const result = `<mark class="${HIGHLIGHT_CLASS}" data-result-index="${highlightIndex}">${match}</mark>`;
                        highlightIndex++;
                        return result;
                    });
                    
                    // 创建临时容器
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = highlightedText;
                    
                    // 替换文本节点
                    const parent = textNode.parentNode;
                    if (parent) {
                        while (tempDiv.firstChild) {
                            parent.insertBefore(tempDiv.firstChild, textNode);
                        }
                        parent.removeChild(textNode);
                    }
                }
            });
            
            // 添加延迟以确保DOM更新完成
            setTimeout(() => {
                scrollToResult(0);
            }, 100);
        } else {
            clearHighlights();
            setTotalMatches(0);
        }
    };

    // 上一个结果
    const goToPrevious = (): void => {
        const highlightedElements = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
        if (highlightedElements.length === 0) return;

        const newIndex = currentResultIndex > 0 ? currentResultIndex - 1 : highlightedElements.length - 1;
        setCurrentResultIndex(newIndex);
        scrollToResult(newIndex);
    };

    // 下一个结果
    const goToNext = (): void => {
        const highlightedElements = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
        if (highlightedElements.length === 0) return;

        const newIndex = currentResultIndex < highlightedElements.length - 1 ? currentResultIndex + 1 : 0;
        setCurrentResultIndex(newIndex);
        scrollToResult(newIndex);
    };

    // 切换搜索框显示/隐藏
    const toggleSearch = (): void => {
        setIsSearchVisible(!isSearchVisible);
        if (isSearchVisible) {
            // 关闭时清除高亮和搜索状态
            clearHighlights();
            setSearchText('');
        } else {
            // 打开时检查是否有选中文本
            const selected = getSelectedText();
            if (selected) {
                setSearchText(selected);
                // 延迟执行搜索，确保状态已更新
                setTimeout(() => {
                    performSearch();
                }, 0);
            }
        }
    };

    // 监听键盘事件
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
        if (e.key === 'Escape') {
            setIsSearchVisible(false);
            clearHighlights();
            setSearchText('');
        } else if (e.key === 'Enter' && totalMatches > 0) {
            // 按回车键切换到下一个结果
            goToNext();
        }
    };

    // 监听文件路径变化，清空搜索状态
    useEffect(() => {
        if (currentFile) {
            // 每次currentFile变化时都清空搜索状态
            clearHighlights();
            setSearchText('');
            setCurrentResultIndex(0);
            setIsSearchVisible(false);
            setSearchExecuted(false); // 重置搜索执行状态
        }
    }, [currentFile]);

    // 监听输入变化自动搜索（带防抖）
    useEffect(() => {
        // console.log('searchText', searchText);
        setSearchExecuted(false);
        clearHighlights();
        const timeoutId = setTimeout(() => {
            if (!getSelectedText() && searchText.trim()) performSearch();
        }, SEARCH_DEBOUNCE);

        return () => clearTimeout(timeoutId);
    }, [searchText]);


    // 监听ESC键关闭搜索
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsSearchVisible(false);
                clearHighlights();
                setSearchText('');
                setSearchExecuted(false); // 重置搜索执行状态
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

    // 监听文本选择变化
    useEffect(() => {
        const handleSelectionChange = () => {
            // 只有在搜索框可见时才处理选中文本
            if (isSearchVisible) {
                const selected = getSelectedText();
                if (selected && selected !== searchText) {
                    clearHighlights();
                    setSearchText(selected);
                }
            }
        };

        // 监听选择变化事件
        document.addEventListener('selectionchange', handleSelectionChange);

        // 清理函数
        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange);
        };
    }, [isSearchVisible, searchText]);

    return (
        <>
            {!isSearchVisible ? (
                <Button
                    onClick={toggleSearch}
                    type="text"
                    icon={<SearchOutlined />}
                    style={SEARCH_BUTTON_STYLE}
                />
            ) : (
                <div style={SEARCH_CONTAINER_STYLE}>
                    <Input
                        ref={searchInputRef}
                        placeholder="搜索页面内容"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        style={SEARCH_INPUT_STYLE}
                        bordered={false}
                    />
                    <div style={{ minWidth: '100px', textAlign: 'center', justifyContent: 'center' }}>
                        {totalMatches > 0 ? (
                            <>
                                <Button
                                    icon={<LeftOutlined />}
                                    onClick={goToPrevious}
                                    size="small"
                                    type="text"
                                    style={NAV_BUTTON_STYLE}
                                />
                                <span style={RESULT_COUNT_STYLE}>
                                    {currentResultIndex + 1}/{totalMatches}
                                </span>
                                <Button
                                    icon={<RightOutlined />}
                                    onClick={goToNext}
                                    size="small"
                                    type="text"
                                    style={NAV_BUTTON_STYLE}
                                />
                            </>
                        ) : searchExecuted && searchText.trim() ? (
                            <span style={{ ...RESULT_COUNT_STYLE, color: '#ff4d4f' }}>
                                无匹配结果
                            </span>
                        ) : null}
                    </div>
                    <Button
                        onClick={performSearch}
                        size="small"
                        type="text"
                        icon={<SearchOutlined />}
                        style={SEARCH_BUTTON_STYLE}
                    />
                    <Button
                        onClick={() => {
                            setIsSearchVisible(false);
                            clearHighlights();
                            setSearchText('');
                        }}
                        size="small"
                        type="text"
                        icon={<CloseOutlined />}
                        style={SEARCH_BUTTON_STYLE}
                    />
                </div>
            )}
        </>
    );
};

export default PageSearch;