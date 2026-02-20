import React, { createContext, ReactNode, useContext, useRef, useState, useEffect, RefObject } from 'react';
import { fileHistoryManager } from '../utils/storage';
import { detectFileType } from "../utils/fileCommonUtil";

export interface AppContextType {
    /** 当前选中的文件夹路径 */
    currentFolder: string | null;
    /** 当前选中的文件路径 */
    currentFile: string | null;
    /** 设置当前文件 */
    setCurrentFile: (file: string | null) => void;

    /** 历史文件导航 - 是否可以后退 */
    canGoBack: boolean;
    /** 历史文件导航 - 是否可以前进 */
    canGoForward: boolean;
    /** 后退到上一个文件 */
    goBack: () => void;
    /** 前进到下一个文件 */
    goForward: () => void;

    autoPlay: RefObject<boolean>;

    /** 循环播放状态 */
    loopPlay: boolean;
    /** 设置循环播放状态 */
    setLoopPlay: (loop: boolean) => void;

    /** 标题栏是否可见 */
    titleBarVisible: boolean;
    /** 设置标题栏可见性 */
    setTitleBarVisible: (visible: boolean) => void;

    /** 搜索面板是否打开 */
    searchPanelOpen: boolean;
    /** 设置搜索面板开关 */
    setSearchPanelOpen: (open: boolean) => void;

    /** 左侧面板是否可见 */
    leftPanelVisible: boolean;
    /** 设置左侧面板可见性 */
    setLeftPanelVisible: (visible: boolean) => void;

    /** 右侧面板是否可见 */
    rightPanelVisible: boolean;
    /** 设置右侧面板可见性 */
    setRightPanelVisible: (visible: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export interface AppProviderProps {
    children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    const [currentFolder, setCurrentFolder] = useState<string | null>(null);
    const [currentFile, setCurrentFile] = useState<string | null>(null);
    const [titleBarVisible, setTitleBarVisible] = useState<boolean>(true);
    const [searchPanelOpen, setSearchPanelOpen] = useState<boolean>(false);
    const [loopPlay, setLoopPlay] = useState<boolean>(false);

    // 历史文件导航状态
    const [fileHistory, setFileHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState<number>(-1);

    const [leftPanelVisible, setLeftPanelVisible] = useState<boolean>(() => {
        const saved = localStorage.getItem('leftPanelVisible');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [rightPanelVisible, setRightPanelVisible] = useState<boolean>(() => {
        const saved = localStorage.getItem('rightPanelVisible');
        return saved !== null ? JSON.parse(saved) : true;
    });

    const autoPlay = useRef(true);

    const handleSetCurrentFile = (file: string | null) => {
        console.log('handleSetCurrentFile:', file, 'autoPlay.current:', autoPlay.current);
        // 运行到这里，便不是第一个打开的文件了，恢复自动播放，人点击视频不就是为了看吗？
        if (!autoPlay.current) autoPlay.current = true;
        // 每次文件改变时，重置循环播放状态为false
        setLoopPlay(false);
        fileHistoryManager.addFileAccess(file);

        // 更新历史记录
        if (file) {
            const newHistory = [...fileHistory];
            // 如果当前有历史记录，删除当前索引之后的所有记录
            if (historyIndex < newHistory.length - 1) {
                newHistory.splice(historyIndex + 1);
            }
            // 添加新文件到历史记录
            newHistory.push(file);
            setFileHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
        }

        setCurrentFile(file);
    };

    // 后退到上一个文件
    const goBack = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setCurrentFile(fileHistory[newIndex]);
            fileHistoryManager.addFileAccess(fileHistory[newIndex]);
        }
    };

    // 前进到下一个文件
    const goForward = () => {
        if (historyIndex < fileHistory.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setCurrentFile(fileHistory[newIndex]);
            fileHistoryManager.addFileAccess(fileHistory[newIndex]);
        }
    };

    // 检查是否可以后退
    const canGoBack = historyIndex > 0;
    // 检查是否可以前进
    const canGoForward = historyIndex < fileHistory.length - 1;



    useEffect(() => {
        const init = async () => {
            console.log('开始初始化应用上下文');
            try {
                console.log('正在获取当前窗口文件夹');
                const currentFolder = await window.electronAPI.getCurrentWindowFolder();
                console.log('当前窗口文件夹:', currentFolder);

                if (currentFolder) {
                    console.log('设置当前文件夹:', currentFolder);

                    // 检查文件夹是否存在
                    try {
                        const folderExists = await window.electronAPI.fileExists(currentFolder);
                        if (!folderExists) {
                            console.warn('文件夹不存在:', currentFolder);
                            return;
                        }
                    } catch (error) {
                        console.error('检查文件夹存在性失败:', error);
                        return;
                    }

                    setCurrentFolder(currentFolder);

                    // 从文件历史记录中获取最近访问的文件
                    const lastFile = fileHistoryManager.getFolderHistory(currentFolder)[0];
                    if (lastFile) {
                        // 检查文件是否存在
                        try {
                            const fileExists = await window.electronAPI.fileExists(lastFile.filePath);
                            if (!fileExists) {
                                console.warn('文件不存在:', lastFile.filePath);
                                return;
                            }
                        } catch (error) {
                            console.error('检查文件存在性失败:', error);
                            return;
                        }

                        const fileName = lastFile.filePath.split(/[\\/]/).pop() || '';
                        if (detectFileType(fileName) == "video" || detectFileType(fileName) == "audio") autoPlay.current = false;

                        setCurrentFile(lastFile.filePath);
                    }
                }
            } catch (error) {
                console.error('初始化过程中出错:', error);
            } finally {
                console.log('应用上下文初始化完成');
            }
        };
        if (!currentFolder) init();
    }, []);

    useEffect(() => {
        localStorage.setItem('leftPanelVisible', JSON.stringify(leftPanelVisible));
    }, [leftPanelVisible]);

    useEffect(() => {
        localStorage.setItem('rightPanelVisible', JSON.stringify(rightPanelVisible));
    }, [rightPanelVisible]);

    const value: AppContextType = {
        currentFolder,
        currentFile,
        setCurrentFile: handleSetCurrentFile,
        canGoBack,
        canGoForward,
        goBack,
        goForward,
        autoPlay: autoPlay,
        loopPlay,
        setLoopPlay,
        titleBarVisible,
        setTitleBarVisible,
        searchPanelOpen,
        setSearchPanelOpen,
        leftPanelVisible,
        setLeftPanelVisible,
        rightPanelVisible,
        setRightPanelVisible,
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = (): AppContextType => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};