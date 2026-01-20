import React, {createContext, ReactNode, useContext, useRef, useState, useEffect} from 'react';
import {fileHistoryManager, FileHistoryRecord} from '../utils/uiUtils';
import {detectFileType} from "../utils/fileCommonUtil";
import {Config, updateFolderPath} from "../utils/config";

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

    /** 应用配置 */
    config: Config | null;
    /** 设置应用配置 */
    setConfig: (config: Config | null) => void;

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

export const AppProvider: React.FC<AppProviderProps> = ({children}) => {
    const [currentFolder, setCurrentFolder] = useState<string | null>(null);
    const [currentFile, setCurrentFile] = useState<string | null>(null);
    const [fileHistory, setFileHistory] = useState<FileHistoryRecord[]>([]);
    const [titleBarVisible, setTitleBarVisible] = useState<boolean>(true);
    const [searchPanelOpen, setSearchPanelOpen] = useState<boolean>(false);
    const [config, setConfig] = useState<Config | null>(null);
    const [leftPanelVisible, setLeftPanelVisible] = useState<boolean>(() => {
        const saved = localStorage.getItem('leftPanelVisible');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [rightPanelVisible, setRightPanelVisible] = useState<boolean>(() => {
        const saved = localStorage.getItem('rightPanelVisible');
        return saved !== null ? JSON.parse(saved) : true;
    });

    const autoPlay = useRef(true);

    const handleSetCurrentFolder = (folder: string | null) => {
        console.log('setCurrentFolder', folder);
        if(!folder) return;

        setCurrentFolder(folder);
        window.electronAPI.saveConfig(updateFolderPath(config, folder));
        window.electronAPI.setCurrentWindowFolder(folder);
        
        setCurrentFile(null);
        if (folder) {
            const history = fileHistoryManager.getFolderHistory(folder);
            setFileHistory(history);

            const lastFile = fileHistoryManager.getLastAccessedFile(folder);
            if (lastFile) {
                const fileName = lastFile.filePath.split(/[\\/]/).pop() || '';
                if (detectFileType(fileName) == "video" || detectFileType(fileName) == "audio") autoPlay.current = false;

                setCurrentFile(lastFile.filePath);
            }
        } else {
            setFileHistory([]);
        }
    };

    const handleSetCurrentFile = (file: string | null) => {
        if (!autoPlay.current) autoPlay.current = true;

        setCurrentFile(file);

        if (file && currentFolder) {
            fileHistoryManager.addFileAccess(file);
            const updatedHistory = fileHistoryManager.getFolderHistory(currentFolder);
            setFileHistory(updatedHistory);
        }
    };

    const addFileAccess = (filePath: string) => {
        if (currentFolder) {
            fileHistoryManager.addFileAccess(filePath);
            const updatedHistory = fileHistoryManager.getFolderHistory(currentFolder);
            setFileHistory(updatedHistory);
        }
    };

    const getLastAccessedFile = (): FileHistoryRecord | null => {
        return currentFolder ? fileHistoryManager.getLastAccessedFile(currentFolder) : null;
    };

    const clearFolderHistory = () => {
        if (currentFolder) {
            fileHistoryManager.clearFolderHistory(currentFolder);
            setFileHistory([]);
        }
    };

    useEffect(() => {
        localStorage.setItem('leftPanelVisible', JSON.stringify(leftPanelVisible));
    }, [leftPanelVisible]);

    useEffect(() => {
        localStorage.setItem('rightPanelVisible', JSON.stringify(rightPanelVisible));
    }, [rightPanelVisible]);

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
        config,
        setConfig,
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