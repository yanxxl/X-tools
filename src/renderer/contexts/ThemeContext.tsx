import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

/**
 * 主题模式
 * - light：浅色
 * - dark：深色
 */
export type ThemeMode = 'light' | 'dark';

/** 主题模式在 localStorage 中的键名，index.html 首次加载时会读取同一个键 */
export const THEME_STORAGE_KEY = 'theme-mode';

/**
 * 获取操作系统当前的配色偏好
 */
export const getSystemThemeMode = (): ThemeMode => {
    if (typeof window === 'undefined' || !window.matchMedia) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/**
 * 获取初始主题：优先使用用户上次的选择，其次跟随系统
 */
export const getInitialThemeMode = (): ThemeMode => {
    if (typeof window === 'undefined') return 'light';
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') return saved;
    } catch (error) {
        console.error('读取主题配置失败:', error);
    }
    return getSystemThemeMode();
};

/**
 * 将主题应用到根节点
 * 根节点上的 data-theme 供自定义 CSS 变量使用，color-scheme 让滚动条、表单控件等原生 UI 跟随
 */
export const applyThemeMode = (mode: ThemeMode): void => {
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    root.style.colorScheme = mode;
};

export interface ThemeContextType {
    /** 当前主题模式 */
    themeMode: ThemeMode;
    /** 是否为深色主题 */
    isDark: boolean;
    /** 设置主题模式 */
    setThemeMode: (mode: ThemeMode) => void;
    /** 在浅色/深色之间切换 */
    toggleThemeMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export interface ThemeProviderProps {
    children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [themeMode, setThemeModeState] = useState<ThemeMode>(getInitialThemeMode);

    // 主题变化时同步到根节点并持久化
    useEffect(() => {
        applyThemeMode(themeMode);
        try {
            localStorage.setItem(THEME_STORAGE_KEY, themeMode);
        } catch (error) {
            console.error('保存主题配置失败:', error);
        }
    }, [themeMode]);

    const setThemeMode = useCallback((mode: ThemeMode) => {
        setThemeModeState(mode);
    }, []);

    const toggleThemeMode = useCallback(() => {
        setThemeModeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
    }, []);

    const value = useMemo<ThemeContextType>(() => ({
        themeMode,
        isDark: themeMode === 'dark',
        setThemeMode,
        toggleThemeMode,
    }), [themeMode, setThemeMode, toggleThemeMode]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
