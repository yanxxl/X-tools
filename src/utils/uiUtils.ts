/**
 * 限制文件夹名称长度，中文10个字符以内，英文20个字符以内
 */
export const truncateFolderName = (name: string): string => {
  // 计算字符串长度，中文字符计为1，英文字符计为0.5
  let length = 0;
  let result = '';
  
  for (let i = 0; i < name.length; i++) {
    const char = name[i];
    // 检查是否为中文字符（Unicode范围）
    const isChinese = /[\u4e00-\u9fa5]/.test(char);
    
    if (isChinese) {
      // 中文字符，占1个单位
      if (length + 1 <= 10) {
        result += char;
        length += 1;
      } else {
        break;
      }
    } else {
      // 英文字符，占0.5个单位
      if (length + 0.5 <= 10) {
        result += char;
        length += 0.5;
      } else {
        break;
      }
    }
  }
  
  // 如果有截断，添加省略号
  if (result.length < name.length) {
    return result + '...';
  }
  
  return result;
};

// 本地存储相关的工具函数
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
 * 时间格式化工具函数
 */
export const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) {
        return '刚刚';
    } else if (diffMins < 60) {
        return `${diffMins}分钟前`;
    } else if (diffHours < 24) {
        return `${diffHours}小时前`;
    } else if (diffDays < 7) {
        return `${diffDays}天前`;
    } else {
        return date.toLocaleDateString('zh-CN');
    }
};
// 存储键名常量
export const STORAGE_KEYS = {
  MARKDOWN_FONT_SIZE: 'markdown-viewer-font-size',
  FILE_ACCESS_HISTORY: 'file-access-history',
  MARKDOWN_SCROLL_POSITION: 'markdown-viewer-scroll-position'
} as const;

// 文件访问历史记录接口
export interface FileHistoryRecord {
  filePath: string;
  lastAccessed: number; // 时间戳
}

// 文件访问历史记录管理
export const fileHistoryManager = {
  /**
   * 获取指定文件夹的文件访问历史记录
   */
  getFolderHistory: (folderPath: string): FileHistoryRecord[] => {
    const allHistory = storage.get<FileHistoryRecord[]>(STORAGE_KEYS.FILE_ACCESS_HISTORY, []);
    return allHistory.filter(record => record.filePath.startsWith(folderPath));
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
   * 获取指定文件夹的最后访问文件
   */
  getLastAccessedFile: (folderPath: string): FileHistoryRecord | null => {
    const folderHistory = fileHistoryManager.getFolderHistory(folderPath);
    return folderHistory.length > 0 ? folderHistory[0] : null;
  },

  /**
   * 清除指定文件夹的历史记录
   */
  clearFolderHistory: (folderPath: string): void => {
    try {
      const allHistory = storage.get<FileHistoryRecord[]>(STORAGE_KEYS.FILE_ACCESS_HISTORY, []);
      const filteredHistory = allHistory.filter(record => !record.filePath.startsWith(folderPath));
      storage.set(STORAGE_KEYS.FILE_ACCESS_HISTORY, filteredHistory);
    } catch (error) {
      console.error('清除文件夹历史记录失败:', error);
    }
  }
};