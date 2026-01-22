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
