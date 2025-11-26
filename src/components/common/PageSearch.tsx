import React, {useEffect, useRef, useState} from 'react';
import {Button, Input, Space} from 'antd';
import {LeftOutlined, RightOutlined} from '@ant-design/icons';

interface PageSearchProps {
    cssSelector: string; // CSS选择器，用于指定搜索范围
}

const PageSearch: React.FC<PageSearchProps> = ({cssSelector}) => {
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState<HTMLElement[]>([]);
    const [currentResultIndex, setCurrentResultIndex] = useState(0);
    const searchInputRef = useRef<any>(null);
    const highlightClass = 'page-search-highlight';
    const currentResultClass = 'current-result';

    // 切换搜索框显示/隐藏
    const toggleSearch = () => {
        setIsSearchVisible(!isSearchVisible);
        if (isSearchVisible) {
            // 关闭时清除高亮
            clearHighlights();
            setSearchResults([]);
            setSearchText('');
        }
    };

    // 清除高亮
    const clearHighlights = () => {
        const highlightedElements = document.querySelectorAll(`.${highlightClass}`);
        highlightedElements.forEach(el => {
            const parent = el.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode((el as HTMLElement).textContent || ''), el);
                parent.normalize(); // 合并相邻的文本节点
            }
        });
    };

    // 高亮搜索结果
    const highlightResults = (elements: HTMLElement[]) => {
        clearHighlights();

        elements.forEach((element, index) => {
            if (element.nodeType === Node.ELEMENT_NODE && element.textContent) {
                const text = element.textContent;
                const regex = new RegExp(`(${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                const highlightedText = text.replace(regex, `<mark class="${highlightClass}" data-result-index="${index}">$1</mark>`);

                // 只在有匹配时才进行高亮
                if (regex.test(text)) {
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
            }
        });
    };

    // 滚动到指定结果
    const scrollToResult = (index: number) => {
        const highlightedElements = document.querySelectorAll(`.${highlightClass}`);
        if (highlightedElements.length > 0 && index >= 0 && index < highlightedElements.length) {
            const element = highlightedElements[index] as HTMLElement;
            element.scrollIntoView({behavior: 'smooth', block: 'center'});

            // 更新当前结果的样式
            highlightedElements.forEach((el, i) => {
                if (i === index) {
                    el.classList.add(currentResultClass);
                } else {
                    el.classList.remove(currentResultClass);
                }
            });
        }
    };

    // 执行搜索
    const performSearch = () => {
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

        // 查找包含搜索文本的叶子元素（没有子元素的元素）
        const allElements = container.querySelectorAll('*');
        const matchedElements: HTMLElement[] = [];

        allElements.forEach(element => {
            // 只处理包含文本且不包含其他子元素的元素
            if (element.children.length === 0 && element.textContent &&
                element.textContent.toLowerCase().includes(searchText.toLowerCase())) {
                matchedElements.push(element as HTMLElement);
            }
        });

        setSearchResults(matchedElements);
        setCurrentResultIndex(0);

        if (matchedElements.length > 0) {
            highlightResults(matchedElements);
            setTimeout(() => scrollToResult(0), 100);
        } else {
            clearHighlights();
        }
    };

    // 上一个结果
    const goToPrevious = () => {
        if (searchResults.length === 0) return;

        const newIndex = currentResultIndex > 0 ? currentResultIndex - 1 : searchResults.length - 1;
        setCurrentResultIndex(newIndex);
        scrollToResult(newIndex);
    };

    // 下一个结果
    const goToNext = () => {
        if (searchResults.length === 0) return;

        const newIndex = currentResultIndex < searchResults.length - 1 ? currentResultIndex + 1 : 0;
        setCurrentResultIndex(newIndex);
        scrollToResult(newIndex);
    };

    // 监听输入变化自动搜索
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            performSearch();
        }, 300); // 300ms防抖

        return () => clearTimeout(timeoutId);
    }, [searchText]);

    // 监听键盘事件
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

    // 组件卸载时清除高亮
    useEffect(() => {
        return () => {
            clearHighlights();
        };
    }, []);

    return (
        <>
            {!isSearchVisible ? (
                <Button
                    onClick={toggleSearch}
                    type="text"
                    style={{color: '#666'}}
                >
                    🔍
                </Button>
            ) : (
                <Space style={{alignItems: 'center'}}>
                    <Input
                        ref={searchInputRef}
                        placeholder="搜索页面内容"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        style={{
                            width: 150,
                            border: 'none',
                            borderBottom: '1px solid #d9d9d9',
                            borderRadius: 0,
                            boxShadow: 'none',
                            backgroundColor: 'transparent'
                        }}
                        autoFocus
                    />
                    {searchResults.length > 0 && (
                        <>
                            <Button icon={<LeftOutlined/>} onClick={goToPrevious} size="small" type="text"/>
                            <span style={{fontSize: '12px', color: '#666'}}>{currentResultIndex + 1}/{searchResults.length}</span>
                            <Button icon={<RightOutlined/>} onClick={goToNext} size="small" type="text"/>
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
                    >
                        ✕
                    </Button>
                </Space>
            )}
        </>
    );
};

export default PageSearch;