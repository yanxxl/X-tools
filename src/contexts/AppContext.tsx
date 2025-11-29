import React, {createContext, useContext, useState, ReactNode, useRef} from 'react';
import {fileHistoryManager, FileHistoryRecord} from '../utils/uiUtils';
import {detectFileType} from "../utils/fileType";

/** 标签页数据结构 */
export interface Tab {
    id: string;          // 唯一标识符
    filePath: string;    // 文件路径
    fileName: string;    // 文件名
    fileType: string;    // 文件类型
}

export interface AppContextType {
    /** 当前选中的文件夹路径 */
    currentFolder: string | null;
    /** 当前选中的文件路径 */
    currentFile: string | null;
    /** 设置当前文件夹 */
    setCurrentFolder: (folder: string | null) => void;
    /** 设置当前文件 */
    setCurrentFile: (file: string | null) => void;
    /** 文件访问历史记录 */
    fileHistory: FileHistoryRecord[];
    /** 添加文件访问记录 */
    addFileAccess: (filePath: string) => void;
    /** 获取当前文件夹的最后访问文件 */
    getLastAccessedFile: () => FileHistoryRecord | null;
    /** 清除当前文件夹的历史记录 */
    clearFolderHistory: () => void;

    autoPlay: boolean;
    
    /** 标签页相关 */
    tabs: Tab[];                 // 所有打开的标签页
    activeTabId: string | null;  // 当前激活的标签页ID
    addTab: (filePath: string) => void;   // 添加标签页
    removeTab: (tabId: string) => void;    // 移除标签页
    switchTab: (tabId: string) => void;    // 切换标签页
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export interface AppProviderProps {
    children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({children}) => {
    const [currentFolder, setCurrentFolder] = useState<string | null>(null);
    const [currentFile, setCurrentFile] = useState<string | null>(null);
    const [fileHistory, setFileHistory] = useState<FileHistoryRecord[]>([]);
    
    // 标签页相关状态
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);

    const autoPlay = useRef(true); // 是否自动播放，当打开上次打开的视频时，不自动播放
    const isFirstOpen = useRef(true); // 第一次打开文件

    // 设置当前文件夹并加载历史记录
    const handleSetCurrentFolder = (folder: string | null) => {
        setCurrentFolder(folder);
        if (folder) {
            // 加载当前文件夹的历史记录
            const history = fileHistoryManager.getFolderHistory(folder);
            setFileHistory(history);

            // 检查是否有最后访问的文件，如果有则自动打开
            const lastFile = fileHistoryManager.getLastAccessedFile(folder);
            if (lastFile) {
                setCurrentFile(lastFile.filePath);

                // 从路径中提取文件名来检测文件类型
                const fileName = lastFile.filePath.split('/').pop() || '';
                // 如果上次打开的是视频，不自动播放，避免突兀。
                if (detectFileType(fileName) == "video") autoPlay.current = false;
            }
        } else {
            setFileHistory([]);
        }
    };

    // 添加标签页
    const addTab = (filePath: string) => {
        if (!filePath) return;
        
        // 检查标签是否已存在
        const existingTab = tabs.find(tab => tab.filePath === filePath);
        if (existingTab) {
            // 如果已存在，切换到该标签
            switchTab(existingTab.id);
            return;
        }
        
        // 解析文件名和文件类型
        const fileName = filePath.split('/').pop() || '';
        const fileType = detectFileType(fileName);
        
        // 创建新标签
        const newTab: Tab = {
            id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            filePath,
            fileName,
            fileType
        };
        
        // 添加到标签列表
        const updatedTabs = [...tabs, newTab];
        setTabs(updatedTabs);
        
        // 切换到新标签
        switchTab(newTab.id);
    };
    
    // 移除标签页
    const removeTab = (tabId: string) => {
        const tabIndex = tabs.findIndex(tab => tab.id === tabId);
        if (tabIndex === -1) return;
        
        // 获取当前标签信息
        const isActiveTab = activeTabId === tabId;
        const updatedTabs = tabs.filter(tab => tab.id !== tabId);
        
        // 更新标签列表
        setTabs(updatedTabs);
        
        // 如果关闭的是当前激活标签，自动切换到前一个标签
        if (isActiveTab) {
            if (updatedTabs.length > 0) {
                // 切换到前一个标签，如果是第一个标签则切换到新的第一个标签
                const newActiveIndex = Math.min(tabIndex, updatedTabs.length - 1);
                switchTab(updatedTabs[newActiveIndex].id);
            } else {
                // 如果没有标签了，清空当前文件
                setCurrentFile(null);
                setActiveTabId(null);
            }
        }
    };
    
    // 切换标签页
    const switchTab = (tabId: string) => {
        const tab = tabs.find(tab => tab.id === tabId);
        if (tab) {
            setActiveTabId(tabId);
            setCurrentFile(tab.filePath);
            
            // 添加文件访问记录
            fileHistoryManager.addFileAccess(tab.filePath);
            // 更新本地状态
            if (currentFolder) {
                const updatedHistory = fileHistoryManager.getFolderHistory(currentFolder);
                setFileHistory(updatedHistory);
            }
        }
    };
    
    // 设置当前文件并添加到历史记录
    const handleSetCurrentFile = (file: string | null) => {
        if (file) {
            // 添加到标签页
            addTab(file);
        } else {
            setCurrentFile(null);
        }

        // 如果不是第一次打开文件，修改自动播放为 true。
        if (isFirstOpen.current) {
            isFirstOpen.current = false;
        } else {
            if (!autoPlay.current) autoPlay.current = true;
        }
    };

    // 添加文件访问记录
    const addFileAccess = (filePath: string) => {
        if (currentFolder) {
            fileHistoryManager.addFileAccess(filePath);
            const updatedHistory = fileHistoryManager.getFolderHistory(currentFolder);
            setFileHistory(updatedHistory);
        }
    };

    // 获取当前文件夹的最后访问文件
    const getLastAccessedFile = (): FileHistoryRecord | null => {
        return currentFolder ? fileHistoryManager.getLastAccessedFile(currentFolder) : null;
    };

    // 清除当前文件夹的历史记录
    const clearFolderHistory = () => {
        if (currentFolder) {
            fileHistoryManager.clearFolderHistory(currentFolder);
            setFileHistory([]);
        }
    };

    const value: AppContextType = {
        currentFolder,
        currentFile,
        setCurrentFolder: handleSetCurrentFolder,
        setCurrentFile: handleSetCurrentFile,
        fileHistory,
        addFileAccess,
        getLastAccessedFile,
        clearFolderHistory,
        autoPlay: autoPlay.current,
        
        // 标签页相关
        tabs,
        activeTabId,
        addTab,
        removeTab,
        switchTab,
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