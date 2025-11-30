import React, {createContext, ReactNode, useContext, useRef, useState} from 'react';
import {fileHistoryManager, FileHistoryRecord} from '../utils/uiUtils';
import {detectFileType} from "../utils/fileType";

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

    /** 标题栏是否可见 */
    titleBarVisible: boolean;
    /** 设置标题栏可见性 */
    setTitleBarVisible: (visible: boolean) => void;

    /** 搜索面板是否打开 */
    searchPanelOpen: boolean;
    /** 设置搜索面板开关 */
    setSearchPanelOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export interface AppProviderProps {
    children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({children}) => {
    const [currentFolder, setCurrentFolder] = useState<string | null>(null);
    const [currentFile, setCurrentFile] = useState<string | null>(null);
    const [fileHistory, setFileHistory] = useState<FileHistoryRecord[]>([]);
    const [titleBarVisible, setTitleBarVisible] = useState<boolean>(true);
    const [searchPanelOpen, setSearchPanelOpen] = useState<boolean>(false);

    const autoPlay = useRef(true); // 是否自动播放，当打开上次打开的视频时，不自动播放
    const isFirstOpen = useRef(true); // 第一次打开文件

    // 设置当前文件夹并加载历史记录
    const handleSetCurrentFolder = (folder: string | null) => {
        setCurrentFolder(folder);
        // 切换文件夹时清空当前文件
        setCurrentFile(null);
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

    // 设置当前文件并添加到历史记录
    const handleSetCurrentFile = (file: string | null) => {
        setCurrentFile(file);
        if (file && currentFolder) {
            // 添加文件访问记录
            fileHistoryManager.addFileAccess(file);
            // 更新本地状态
            const updatedHistory = fileHistoryManager.getFolderHistory(currentFolder);
            setFileHistory(updatedHistory);
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
        titleBarVisible,
        setTitleBarVisible,
        searchPanelOpen,
        setSearchPanelOpen,
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