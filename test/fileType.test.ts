import { describe, it, expect } from '@jest/globals';
import {
  DetectedFileType,
  getExtension,
  detectFileType,
  isTextFile,
  isImageFile,
  isVideoFile,
  isPdfFile,
  dirname,
  join,
  fullname,
  name,
  normalizePath,
  toFileUrl,
  formatFileSize,
  truncateText,
  truncateTextWithQuery,
  isHiddenFile,
  getFileTypeDisplayName
} from '../src/utils/fileCommonUtil';

describe('fileCommonUtil.ts 测试', () => {
  describe('文件类型检测', () => {
    describe('getExtension', () => {
      it('应该正确获取文件名的扩展名', () => {
        expect(getExtension('document.txt')).toBe('txt');
        expect(getExtension('image.jpg')).toBe('jpg');
        expect(getExtension('video.mp4')).toBe('mp4');
        expect(getExtension('file.with.many.dots.pdf')).toBe('pdf');
      });

      it('应该返回空字符串当没有扩展名时', () => {
        expect(getExtension('file_without_extension')).toBe('');
        expect(getExtension('.hidden_file')).toBe('');
      });

      it('应该正确处理路径', () => {
        expect(getExtension('/path/to/file.txt')).toBe('txt');
        expect(getExtension('C:\\Users\\file.pdf')).toBe('pdf');
      });
    });

    describe('detectFileType', () => {
      it('应该正确检测文本文件', () => {
        expect(detectFileType('document.txt')).toBe('text');
        expect(detectFileType('script.js')).toBe('text');
        expect(detectFileType('style.css')).toBe('text');
        expect(detectFileType('README.md')).toBe('text');
        expect(detectFileType('config.json')).toBe('text');
      });

      it('应该正确检测图片文件', () => {
        expect(detectFileType('image.jpg')).toBe('image');
        expect(detectFileType('photo.png')).toBe('image');
        expect(detectFileType('animation.gif')).toBe('image');
        expect(detectFileType('icon.svg')).toBe('image');
        expect(detectFileType('picture.webp')).toBe('image');
      });

      it('应该正确检测视频文件', () => {
        expect(detectFileType('video.mp4')).toBe('video');
        expect(detectFileType('movie.avi')).toBe('video');
        expect(detectFileType('clip.mkv')).toBe('video');
        expect(detectFileType('short.mov')).toBe('video');
      });

      it('应该正确检测PDF文件', () => {
        expect(detectFileType('document.pdf')).toBe('pdf');
        expect(detectFileType('report.PDF')).toBe('pdf');
      });

      it('应该将未知类型文件标记为other', () => {
        expect(detectFileType('file.unknown')).toBe('other');
        expect(detectFileType('file_without_extension')).toBe('other');
      });
    });

    describe('isTextFile, isImageFile, isVideoFile, isPdfFile', () => {
      it('isTextFile 应该正确识别文本文件', () => {
        expect(isTextFile('document.txt')).toBe(true);
        expect(isTextFile('image.jpg')).toBe(false);
        expect(isTextFile('video.mp4')).toBe(false);
        expect(isTextFile('document.pdf')).toBe(false);
      });

      it('isImageFile 应该正确识别图片文件', () => {
        expect(isImageFile('image.jpg')).toBe(true);
        expect(isImageFile('document.txt')).toBe(false);
        expect(isImageFile('video.mp4')).toBe(false);
        expect(isImageFile('document.pdf')).toBe(false);
      });

      it('isVideoFile 应该正确识别视频文件', () => {
        expect(isVideoFile('video.mp4')).toBe(true);
        expect(isVideoFile('document.txt')).toBe(false);
        expect(isVideoFile('image.jpg')).toBe(false);
        expect(isVideoFile('document.pdf')).toBe(false);
      });

      it('isPdfFile 应该正确识别PDF文件', () => {
        expect(isPdfFile('document.pdf')).toBe(true);
        expect(isPdfFile('document.txt')).toBe(false);
        expect(isPdfFile('image.jpg')).toBe(false);
        expect(isPdfFile('video.mp4')).toBe(false);
      });
    });
  });

  describe('路径处理', () => {
    describe('dirname', () => {
      it('应该正确获取目录名', () => {
        expect(dirname('/path/to/file.txt')).toBe('/path/to');
        expect(dirname('C:\\Users\\John\\file.txt')).toBe('C:/Users/John');
        expect(dirname('file.txt')).toBe('');
      });
    });

    describe('join', () => {
      it('应该正确拼接路径', () => {
        expect(join('/path', 'to', 'file.txt')).toBe('/path/to/file.txt');
        expect(join('C:', 'Users', 'John', 'file.txt')).toBe('C:/Users/John/file.txt');
        expect(join('path', '..', 'file.txt')).toBe('path/../file.txt');
      });
    });

    describe('fullname', () => {
      it('应该正确获取文件名', () => {
        expect(fullname('/path/to/file.txt')).toBe('file.txt');
        expect(fullname('C:\\Users\\John\\file.txt')).toBe('file.txt');
        expect(fullname('file.txt')).toBe('file.txt');
        expect(fullname('/')).toBe('');
      });
      
      it('应该正确处理文件夹路径', () => {
        expect(fullname('/path/to/folder/')).toBe('folder');
        expect(fullname('C:\\Users\\John\\Documents\\')).toBe('Documents');
        expect(fullname('/path/to/folder//')).toBe('folder');
        expect(fullname('C:\\Users\\John\\folder\\\\')).toBe('folder');
      });
    });

    describe('name', () => {
      it('应该正确获取不包含扩展名的文件名', () => {
        expect(name('/path/to/file.txt')).toBe('file');
        expect(name('C:\\Users\\John\\file.txt')).toBe('file');
        expect(name('file.txt')).toBe('file');
        expect(name('file_without_extension')).toBe('file_without_extension');
        expect(name('file.with.many.dots.txt')).toBe('file.with.many.dots');
      });
      
      it('应该正确处理文件夹路径', () => {
        expect(name('/path/to/folder/')).toBe('folder');
        expect(name('C:\\Users\\John\\Documents\\')).toBe('Documents');
        expect(name('/path/to/folder//')).toBe('folder');
        expect(name('C:\\Users\\John\\folder\\\\')).toBe('folder');
      });
    });

    describe('normalizePath', () => {
      it('应该正确规范化路径分隔符', () => {
        expect(normalizePath('C:\\Users\\John\\file.txt')).toBe('C:/Users/John/file.txt');
        expect(normalizePath('/path/to/file.txt')).toBe('/path/to/file.txt');
        expect(normalizePath('path\\to\\file.txt')).toBe('path/to/file.txt');
      });
    });

    describe('toFileUrl', () => {
      it('应该正确转换Unix路径到文件URL', () => {
        expect(toFileUrl('/Users/John/file.txt')).toBe('file:///Users/John/file.txt');
        expect(toFileUrl('/path with spaces/file.txt')).toBe('file:///path%20with%20spaces/file.txt');
      });

      it('应该正确转换Windows路径到文件URL', () => {
        expect(toFileUrl('C:/Users/John/file.txt')).toBe('file:///C:/Users/John/file.txt');
        expect(toFileUrl('C:\\Users\\John\\file.txt')).toBe('file:///C:/Users/John/file.txt');
        expect(toFileUrl('C:/path with spaces/file.txt')).toBe('file:///C:/path%20with%20spaces/file.txt');
      });
    });
  });

  describe('文件信息格式化', () => {
    describe('formatFileSize', () => {
      it('应该正确格式化文件大小', () => {
        expect(formatFileSize(0)).toBe('0 B');
        expect(formatFileSize(1023)).toBe('1023 B');
        expect(formatFileSize(1024)).toBe('1.00 KB');
        expect(formatFileSize(1024 * 1024)).toBe('1.00 MB');
        expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.00 GB');
        expect(formatFileSize(1024 * 1024 * 1024 * 1024)).toBe('1.00 TB');
      });

      it('应该正确格式化非整数大小', () => {
        expect(formatFileSize(1536)).toBe('1.50 KB');
        expect(formatFileSize(1024 * 1024 * 1.5)).toBe('1.50 MB');
      });
    });
  });

  describe('文本处理', () => {
    describe('truncateText', () => {
      it('应该在文本长度小于等于最大长度时返回原文', () => {
        expect(truncateText('short text', 20)).toBe('short text');
        expect(truncateText('exact length', 12)).toBe('exact length');
      });

      it('应该在文本长度超过最大长度时截断并添加省略号', () => {
        expect(truncateText('this is a long text that needs to be truncated', 20)).toBe('this is a long text ...');
      });
    });

    describe('truncateTextWithQuery', () => {
      it('应该在文本长度小于等于最大长度时返回原文', () => {
        expect(truncateTextWithQuery('short text', 20, 'text')).toBe('short text');
      });

      it('应该在文本长度超过最大长度且找到查询词时保留查询词', () => {
        const longText = 'this is a very long text that contains a specific query word somewhere in the middle';
        expect(truncateTextWithQuery(longText, 50, 'specific')).toContain('specific');
        expect(truncateTextWithQuery(longText, 50, 'specific')).toContain('...');
      });

      it('应该在文本长度超过最大长度但找不到查询词时正常截断', () => {
        const longText = 'this is a very long text that contains no matching query';
        // 当maxLength为30时，text.substring(0, 27)返回'this is a very long text th'，加上'...'共30个字符
        expect(truncateTextWithQuery(longText, 30, 'missing')).toBe('this is a very long text th...');
      });
    });
  });

  describe('文件操作辅助', () => {
    describe('isHiddenFile', () => {
      it('应该正确识别隐藏文件', () => {
        expect(isHiddenFile('.hidden')).toBe(true);
        expect(isHiddenFile('.gitignore')).toBe(true);
        expect(isHiddenFile('normal.txt')).toBe(false);
      });
    });

    describe('getFileTypeDisplayName', () => {
      it('应该正确获取文件类型的显示名称', () => {
        expect(getFileTypeDisplayName('text')).toBe('文本文件');
        expect(getFileTypeDisplayName('image')).toBe('图片文件');
        expect(getFileTypeDisplayName('video')).toBe('视频文件');
        expect(getFileTypeDisplayName('pdf')).toBe('PDF文件');
        expect(getFileTypeDisplayName('other')).toBe('其他文件');
      });
    });
  });
});
