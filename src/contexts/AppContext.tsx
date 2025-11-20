import React, { createContext, useContext, useState, ReactNode } from 'react';
import { fileHistoryManager, FileHistoryRecord } from '../utils/uiUtils';

export interface AppContextType {
  /** 当前选中的文件夹路径 */
  currentFolder: string | null;
  /** 当前选中的文件 */
  currentFile: any | null;
  /** 设置当前文件夹 */
  setCurrentFolder: (folder: string | null) => void;
  /** 设置当前文件 */
  setCurrentFile: (file: any | null) => void;
  /** 文件访问历史记录 */
  fileHistory: FileHistoryRecord[];
  /** 添加文件访问记录 */
  addFileAccess: (filePath: string, fileName: string) => void;
  /** 获取当前文件夹的最后访问文件 */
  getLastAccessedFile: () => FileHistoryRecord | null;
  /** 清除当前文件夹的历史记录 */
  clearFolderHistory: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<any | null>(null);
  const [fileHistory, setFileHistory] = useState<FileHistoryRecord[]>([]);

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
        setCurrentFile({
          path: lastFile.filePath,
          name: lastFile.fileName
        });
      }
    } else {
      setFileHistory([]);
    }
  };

  // 设置当前文件并添加到历史记录
  const handleSetCurrentFile = (file: any | null) => {
    setCurrentFile(file);
    if (file && file.path && file.name && currentFolder) {
      // 添加文件访问记录
      fileHistoryManager.addFileAccess(file.path, file.name);
      // 更新本地状态
      const updatedHistory = fileHistoryManager.getFolderHistory(currentFolder);
      setFileHistory(updatedHistory);
    }
  };

  // 添加文件访问记录
  const addFileAccess = (filePath: string, fileName: string) => {
    if (currentFolder) {
      fileHistoryManager.addFileAccess(filePath, fileName);
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