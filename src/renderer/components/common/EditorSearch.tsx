import React, { useEffect, useRef, useState } from 'react';
import { Button, Input } from 'antd';
import type { InputRef } from 'antd/es/input';
import { CloseOutlined, LeftOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';

interface EditorSearchProps {
    editorView: EditorView; // CodeMirror 的 EditorView 实例
}

const EditorSearch: React.FC<EditorSearchProps> = ({ editorView }) => {
    // 状态管理
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [totalMatches, setTotalMatches] = useState(0);
    const [currentResultIndex, setCurrentResultIndex] = useState(0);
    const [searchExecuted, setSearchExecuted] = useState(false);

    // 引用管理
    const searchInputRef = useRef<InputRef>(null);
    const searchStateRef = useRef<{
        query: RegExp;
        matches: Array<{from: number, to: number, text: string}>;
        currentIndex: number;
    } | null>(null);

    // 样式常量
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

    // 构建搜索查询
    const buildSearchQuery = (text: string): RegExp | null => {
        if (!text.trim()) return null;
        
        const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        try {
            return new RegExp(escapedText, 'gi'); // 不区分大小写
        } catch (error) {
            console.error('Invalid regex pattern:', error);
            return null;
        }
    };

    // 执行搜索
    const performSearch = (): void => {
        if (!editorView) return;

        setSearchExecuted(true);
        clearSearchHighlights();

        const query = buildSearchQuery(searchText);
        if (!query) {
            setTotalMatches(0);
            setCurrentResultIndex(0);
            return;
        }

        const doc = editorView.state.doc;
        const matches: Array<{from: number, to: number, text: string}> = [];
        
        // 重正则表达式状态
        query.lastIndex = 0;
        
        // 查找所有匹配项
        const fullText = doc.toString();
        let match;
        while ((match = query.exec(fullText)) !== null) {
            matches.push({ 
                from: match.index, 
                to: match.index + match[0].length, 
                text: match[0] 
            });
            
            // 避免无限循环
            if (match.index === query.lastIndex) {
                query.lastIndex++;
            }
        }

        if (matches.length > 0) {
            setTotalMatches(matches.length);
            setCurrentResultIndex(0);
            
            // 保存搜索状态
            searchStateRef.current = {
                query,
                matches,
                currentIndex: 0
            };
            
            // 应用高亮
            applySearchHighlights();
            
            // 滚动到第一个结果
            setTimeout(() => {
                scrollToResult(0);
            }, 100);
        } else {
            setTotalMatches(0);
            setCurrentResultIndex(0);
            searchStateRef.current = null;
        }
    };

    // 应用搜索高亮
    const applySearchHighlights = (): void => {
        if (!editorView || !searchStateRef.current) return;

        const { matches } = searchStateRef.current;
        
        // 创建搜索装饰器
        const decorations = matches.map(({from, to}) => {
            return Decoration.mark({
                class: 'editor-search-highlight'
            }).range(from, to);
        });

        // 应用装饰器
        const decorationSet = Decoration.set(decorations);
        editorView.dispatch({
            effects: [searchHighlightEffect.of(decorationSet)]
        });
    };

    // 清除搜索高亮
    const clearSearchHighlights = (): void => {
        if (!editorView) return;
        
        // 清除搜索装饰器
        editorView.dispatch({
            effects: [searchHighlightEffect.of(Decoration.none)]
        });
        
        searchStateRef.current = null;
    };

    // 滚动到指定结果
    const scrollToResult = (index: number): void => {
        if (!editorView || !searchStateRef.current || index < 0 || index >= searchStateRef.current.matches.length) {
            return;
        }

        const { matches } = searchStateRef.current;
        const match = matches[index];
        
        // 滚动到匹配位置
        editorView.dispatch({
            selection: { anchor: match.from, head: match.to },
            effects: [EditorView.scrollIntoView(match.from, { y: 'center' })]
        });

        // 更新当前结果的样式
        updateCurrentHighlight(index);
    };

    // 更新当前高亮
    const updateCurrentHighlight = (currentIndex: number): void => {
        if (!searchStateRef.current) return;

        const { matches } = searchStateRef.current;
        const decorations = matches.map((match, index) => {
            const isCurrent = index === currentIndex;
            return Decoration.mark({
                class: isCurrent ? 'editor-search-highlight current-result' : 'editor-search-highlight'
            }).range(match.from, match.to);
        });

        if (editorView) {
            const decorationSet = Decoration.set(decorations);
            editorView.dispatch({
                effects: [searchHighlightEffect.of(decorationSet)]
            });
        }
    };

    // 上一个结果
    const goToPrevious = (): void => {
        if (!searchStateRef.current || totalMatches === 0) return;

        const newIndex = currentResultIndex > 0 ? currentResultIndex - 1 : totalMatches - 1;
        setCurrentResultIndex(newIndex);
        scrollToResult(newIndex);
    };

    // 下一个结果
    const goToNext = (): void => {
        if (!searchStateRef.current || totalMatches === 0) return;

        const newIndex = currentResultIndex < totalMatches - 1 ? currentResultIndex + 1 : 0;
        setCurrentResultIndex(newIndex);
        scrollToResult(newIndex);
    };

    // 切换搜索框显示/隐藏
    const toggleSearch = (): void => {
        setIsSearchVisible(!isSearchVisible);
        if (isSearchVisible) {
            // 关闭时清除高亮和搜索状态
            clearSearchHighlights();
            setSearchText('');
            setTotalMatches(0);
            setCurrentResultIndex(0);
            setSearchExecuted(false);
        }
    };

    // 监听键盘事件
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
        if (e.key === 'Escape') {
            toggleSearch();
        } else if (e.key === 'Enter' && totalMatches > 0) {
            // 按回车键切换到下一个结果
            goToNext();
        } else if (e.key === 'F3' && e.shiftKey) {
            // Shift+F3 上一个
            goToPrevious();
        } else if (e.key === 'F3') {
            // F3 下一个
            goToNext();
        }
    };

    // 监听ESC键关闭搜索
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isSearchVisible) {
                toggleSearch();
            }
        };

        document.addEventListener('keydown', handleGlobalKeyDown);

        return () => {
            document.removeEventListener('keydown', handleGlobalKeyDown);
        };
    }, [isSearchVisible]);

    // 自动聚焦到搜索输入框
    useEffect(() => {
        if (isSearchVisible && searchInputRef.current) {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [isSearchVisible]);

    // 监听搜索文本变化，自动搜索（带防抖）
    useEffect(() => {
        if (!isSearchVisible) return;

        const timeoutId = setTimeout(() => {
            if (searchText.trim()) {
                performSearch();
            } else {
                clearSearchHighlights();
                setTotalMatches(0);
                setCurrentResultIndex(0);
                setSearchExecuted(false);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchText, isSearchVisible]);

    // 监听编辑器内容变化，重新执行搜索
    useEffect(() => {
        if (!editorView || !isSearchVisible || !searchText.trim()) return;

        // TODO: 实现编辑器内容变化时自动重新搜索
        // 由于 CodeMirror 6 的复杂性，这里需要更深入的集成
        // 暂时通过用户手动触发搜索来实现
    }, [editorView, isSearchVisible, searchText]);

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
                        placeholder="搜索编辑器内容"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        style={SEARCH_INPUT_STYLE}
                        bordered={false}
                    />
                    <div style={{ minWidth: '120px', textAlign: 'center', justifyContent: 'center' }}>
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
                        onClick={toggleSearch}
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

// CodeMirror 搜索高亮效果的定义
import { EditorView, Decoration, DecorationSet } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';

// 定义搜索高亮效果
export const searchHighlightEffect = StateEffect.define<DecorationSet>();

// 定义搜索高亮状态字段
export const searchHighlightField = StateField.define<DecorationSet>({
    create() {
        return Decoration.none;
    },
    update(highlights, tr) {
        // 处理事务更新
        for (const effect of tr.effects) {
            if (effect.is(searchHighlightEffect)) {
                highlights = effect.value;
            }
        }
        return highlights;
    },
    provide: f => EditorView.decorations.from(f)
});

export default EditorSearch;