import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface AppContextType {
  /** 当前选中的文件夹路径 */
  currentFolder: string | null;
  /** 当前选中的文件 */
  currentFile: any | null;
  /** 设置当前文件夹 */
  setCurrentFolder: (folder: string | null) => void;
  /** 设置当前文件 */
  setCurrentFile: (file: any | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<any | null>(null);

  const value: AppContextType = {
    currentFolder,
    currentFile,
    setCurrentFolder,
    setCurrentFile,
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