/**
 * 本地存储工具函数
 * 提供通用的 localStorage 操作接口，包含错误处理
 */

// 存储键名常量
export const STORAGE_KEYS = {
  MARKDOWN_FONT_SIZE: 'markdown-viewer-font-size',
  FILE_ACCESS_HISTORY: 'file-access-history',
  MARKDOWN_SCROLL_POSITION: 'markdown-viewer-scroll-position',
  SUBTITLE_VISIBLE: 'video-viewer-subtitle-visible',
  SUBTITLE_PANEL_VISIBLE: 'video-viewer-subtitle-panel-visible'
} as const;

// 文件访问历史记录接口
export interface FileHistoryRecord {
  filePath: string;
  lastAccessed: number; // 时间戳
}

/**
 * 本地存储工具对象
 * 提供安全的 localStorage 操作，包含错误处理
 */
export const storage = {
  /**
   * 保存数据到本地存储
   */
  set: (key: string, value: any): void => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error('保存到本地存储失败:', error);
    }
  },

  /**
   * 从本地存储读取数据
   */
  get: <T>(key: string, defaultValue: T): T => {
    try {
      if (typeof window !== 'undefined') {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      }
      return defaultValue;
    } catch (error) {
      console.error('从本地存储读取失败:', error);
      return defaultValue;
    }
  },

  /**
   * 删除本地存储中的数据
   */
  remove: (key: string): void => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error('删除本地存储数据失败:', error);
    }
  }
};

/**
 * 文件访问历史记录管理
 */
export const fileHistoryManager = {
  /**
   * 获取指定文件夹的文件访问历史记录
   */
  getFolderHistory: (folderPath: string): FileHistoryRecord[] => {
    const allHistory = storage.get<FileHistoryRecord[]>(STORAGE_KEYS.FILE_ACCESS_HISTORY, []);
    return allHistory.filter(record => record.filePath?.startsWith(folderPath));
  },

  /**
   * 添加文件访问记录
   */
  addFileAccess: (filePath: string): void => {
    try {
      const allHistory = storage.get<FileHistoryRecord[]>(STORAGE_KEYS.FILE_ACCESS_HISTORY, []);
      const now = Date.now();
      
      // 移除该文件的旧记录（如果存在）
      const filteredHistory = allHistory.filter(record => record.filePath !== filePath);
      
      // 添加新记录到开头
      const newHistory = [
        {
          filePath,
          lastAccessed: now
        },
        ...filteredHistory
      ];
      
      // 限制历史记录数量（最多保存100条）
      const limitedHistory = newHistory.slice(0, 100);
      
      storage.set(STORAGE_KEYS.FILE_ACCESS_HISTORY, limitedHistory);
    } catch (error) {
      console.error('添加文件访问记录失败:', error);
    }
  },

  /**
   * 清理指定文件夹的文件访问历史记录
   */
  clearFolderHistory: (folderPath: string): void => {
    try {
      const allHistory = storage.get<FileHistoryRecord[]>(STORAGE_KEYS.FILE_ACCESS_HISTORY, []);
      // 过滤掉指定文件夹的记录
      const filteredHistory = allHistory.filter(record => !record.filePath.startsWith(folderPath));
      storage.set(STORAGE_KEYS.FILE_ACCESS_HISTORY, filteredHistory);
    } catch (error) {
      console.error('清理文件夹历史记录失败:', error);
    }
  }
};