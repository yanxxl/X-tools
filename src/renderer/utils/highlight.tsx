/**
 * 高亮工具函数
 * 提供文本高亮功能，支持 React 组件和 HTML 两种模式
 */

import React from 'react';

/**
 * 高亮文本中的关键词（React 组件模式）
 * @param text 要处理的文本
 * @param query 搜索关键词
 * @param highlightStyle 高亮样式
 * @returns React 节点数组
 */
export const highlightText = (
    text: string, 
    query: string, 
    highlightStyle: React.CSSProperties = { backgroundColor: '#fff3cd', fontWeight: 'bold' }
): React.ReactNode => {
    if (!query || !text) return text;

    try {
        // 简单的字符串分割方法，避免正则表达式转义问题
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const index = lowerText.indexOf(lowerQuery);
        
        if (index === -1) return text;
        
        const before = text.substring(0, index);
        const match = text.substring(index, index + query.length);
        const after = text.substring(index + query.length);
        
        return (
            <span>
                {before}
                <span style={highlightStyle}>{match}</span>
                {after}
            </span>
        );
    } catch (error) {
        // 如果处理失败，返回原始文本
        console.warn('高亮处理失败:', error);
        return text;
    }
};

/**
 * 高亮文本中的关键词（HTML 模式）
 * @param text 要处理的文本
 * @param query 搜索关键词
 * @param highlightClass 高亮 CSS 类名
 * @returns HTML 字符串
 */
export const highlightTextHTML = (
    text: string, 
    query: string, 
    highlightClass = 'search-highlight'
): string => {
    if (!query || !text) return text;

    try {
        // 简单的字符串替换方法，避免正则表达式转义问题
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const index = lowerText.indexOf(lowerQuery);
        
        if (index === -1) return text;
        
        const before = text.substring(0, index);
        const match = text.substring(index, index + query.length);
        const after = text.substring(index + query.length);
        
        return `${before}<mark class="${highlightClass}">${match}</mark>${after}`;
    } catch (error) {
        // 如果处理失败，返回原始文本
        console.warn('HTML 高亮处理失败:', error);
        return text;
    }
};

/**
 * 检查文本是否包含关键词（不区分大小写）
 * @param text 要检查的文本
 * @param query 搜索关键词
 * @returns 是否包含
 */
export const containsQuery = (text: string, query: string): boolean => {
    if (!query || !text) return false;
    return text.toLowerCase().includes(query.toLowerCase());
};