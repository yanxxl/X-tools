/**
 * 本地存储工具函数
 * 用于统计和清理浏览器的 localStorage 数据
 */

/**
 * 本地存储信息接口
 */
export interface StorageInfo {
  /** 总条目数 */
  totalItems: number;
  /** 占用空间（字节） */
  totalSize: number;
  /** 详细条目信息 */
  items: Array<{
    key: string;
    size: number;
    value: string;
  }>;
}

/**
 * 获取本地存储信息
 * @returns 本地存储信息对象
 */
export const getLocalStorageInfo = (): StorageInfo => {
  const items: Array<{
    key: string;
    size: number;
    value: string;
  }> = [];
  
  let totalSize = 0;
  
  try {
    const storage = localStorage;
    const keys = Object.keys(storage);
    
    keys.forEach(key => {
      try {
        const value = storage.getItem(key) || '';
        // 计算大小（UTF-16 编码，每个字符占2字节）
        const size = (key.length + value.length) * 2;
        totalSize += size;
        
        items.push({
          key,
          size,
          value
        });
      } catch (error) {
        console.warn(`无法获取存储项 ${key}:`, error);
      }
    });
  } catch (error) {
    console.error('获取本地存储信息失败:', error);
  }
  
  return {
    totalItems: items.length,
    totalSize,
    items
  };
};

/**
 * 格式化字节数为人类可读的格式
 * @param bytes 字节数
 * @returns 格式化后的字符串
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * 清除所有本地存储
 * @returns 是否成功清除
 */
export const clearAllLocalStorage = (): boolean => {
  try {
    localStorage.clear();
    return true;
  } catch (error) {
    console.error('清除本地存储失败:', error);
    return false;
  }
};

/**
 * 根据键名清除指定的本地存储项
 * @param key 要清除的键名
 * @returns 是否成功清除
 */
export const clearLocalStorageItem = (key: string): boolean => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`清除本地存储项 ${key} 失败:`, error);
    return false;
  }
};

/**
 * 清除多个指定的本地存储项
 * @param keys 要清除的键名数组
 * @returns 成功清除的键名数组
 */
export const clearLocalStorageItems = (keys: string[]): string[] => {
  const clearedKeys: string[] = [];
  
  keys.forEach(key => {
    if (clearLocalStorageItem(key)) {
      clearedKeys.push(key);
    }
  });
  
  return clearedKeys;
};
