import React, { createContext, ReactNode, useContext, useRef, useState, useEffect } from 'react';
import { fileHistoryManager } from '../utils/uiUtils';
import { detectFileType } from "../utils/fileCommonUtil";

export interface AppContextType {
    /** 当前选中的文件夹路径 */
    currentFolder: string | null;
    /** 当前选中的文件路径 */
    currentFile: string | null;
    /** 设置当前文件 */
    setCurrentFile: (file: string | null) => void;


    autoPlay: boolean;

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
        // 运行到这里，便不是第一个打开的文件了，恢复自动播放，人点击视频不就是为了看吗？
        if (!autoPlay.current) autoPlay.current = true;
        fileHistoryManager.addFileAccess(file);
        setCurrentFile(file);
    };



    useEffect(() => {
        const init = async () => {
            console.log('开始初始化应用上下文');
            try {
                console.log('正在获取当前窗口文件夹');
                const currentFolder = await window.electronAPI.getCurrentWindowFolder();
                console.log('当前窗口文件夹:', currentFolder);

                if (currentFolder) {
                    console.log('设置当前文件夹:', currentFolder);
                    setCurrentFolder(currentFolder);

                    const lastFile = fileHistoryManager.getLastAccessedFile(currentFolder);
                    if (lastFile) {
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
        // 启动一个worker来处理搜索
        const searchWorker = new Worker(new URL('../utils/indexWorker.ts', import.meta.url), {
            type: 'module'
        });

        // 处理worker消息
        searchWorker.onmessage = (event) => {
            console.log('Worker message received:', event.data);
        };

        // 处理worker错误
        searchWorker.onerror = (error) => {
            console.error('Worker error:', error);
        };

        // 组件卸载时清理worker
        return () => {
            searchWorker.terminate();
        };
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
        autoPlay: autoPlay.current,
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