import React, { useEffect } from 'react';

const WINDOW_SIZE_KEY = 'window-size-key';

/**
 * 保存窗口大小到local storage
 * @param width - 窗口宽度
 * @param height - 窗口高度
 */
const saveWindowSize = (width: number, height: number): void => {
    try {
        const windowSize = { width, height };
        localStorage.setItem(WINDOW_SIZE_KEY, JSON.stringify(windowSize));
    } catch (error) {
        console.error('保存窗口大小失败:', error);
    }
};

/**
 * 从local storage读取窗口大小
 * @returns 保存的窗口大小对象 {width, height}，如果没有保存则返回null
 */
const getWindowSize = (): { width: number; height: number } | null => {
    try {
        const savedSize = localStorage.getItem(WINDOW_SIZE_KEY);
        return savedSize ? JSON.parse(savedSize) : null;
    } catch (error) {
        console.error('读取窗口大小失败:', error);
        return null;
    }
};

/**
 * 窗口大小管理组件
 * 处理窗口大小的保存、恢复和监听
 * 返回空内容，只处理窗口大小问题
 */
export const WindowSizeManager: React.FC = () => {
    useEffect(() => {
        // 组件挂载时恢复窗口大小
        const savedSize = getWindowSize();
        if (savedSize && window.resizeTo) {
            try {
                window.resizeTo(savedSize.width, savedSize.height);
            } catch (error) {
                console.error('恢复窗口大小失败:', error);
            }
        }

        /**
         * 处理窗口大小变化事件
         */
        const handleResize = (): void => {
            if (window.innerWidth && window.innerHeight) {
                saveWindowSize(window.innerWidth, window.innerHeight);
            }
        };

        window.addEventListener('resize', handleResize);

        // 组件卸载时移除监听器
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return null;
};
