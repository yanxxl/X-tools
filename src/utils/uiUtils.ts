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