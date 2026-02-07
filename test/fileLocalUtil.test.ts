import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { getFileInfo } from '../src/utils/fileLocalUtil';

describe('fileLocalUtil.ts 测试', () => {
  describe('getFileInfo 函数', () => {
    const testDir = path.join(__dirname, 'files');
    
    it('应该正确获取文件的基本信息', () => {
      const filePath = path.join(testDir, '示例.txt');
      const fileInfo = getFileInfo(filePath);
      
      // 现在 isText 属性是布尔值
      expect(fileInfo).toEqual({
        path: filePath,
        name: '示例.txt',
        ext: 'txt',
        isDirectory: false,
        childrenCount: 0,
        isText: expect.any(Boolean),
        size: expect.any(Number),
        atimeMs: expect.any(Number),
        mtimeMs: expect.any(Number),
        ctimeMs: expect.any(Number),
        birthtimeMs: expect.any(Number),
      });
      
      // 验证具体属性
      expect(fileInfo.name).toBe('示例.txt');
      expect(fileInfo.ext).toBe('txt');
      expect(fileInfo.isDirectory).toBe(false);
      expect(fileInfo.childrenCount).toBe(0);
      expect(fileInfo.size).toBeGreaterThan(0);
      
      // 现在可以验证 isText 的具体值
      expect(typeof fileInfo.isText).toBe('boolean');
    });

    it('应该正确获取目录的基本信息', () => {
      const dirInfo = getFileInfo(testDir);
      
      expect(dirInfo).toEqual({
        path: testDir,
        name: 'files',
        ext: '',
        isDirectory: true,
        childrenCount: expect.any(Number),
        isText: false,
        size: expect.any(Number),
        atimeMs: expect.any(Number),
        mtimeMs: expect.any(Number),
        ctimeMs: expect.any(Number),
        birthtimeMs: expect.any(Number),
      });
      
      // 验证目录特定属性
      expect(dirInfo.isDirectory).toBe(true);
      expect(dirInfo.ext).toBe('');
      expect(dirInfo.childrenCount).toBeGreaterThanOrEqual(0);
      
      // 对于目录，isText 应该始终为 false
      expect(dirInfo.isText).toBe(false);
    });

    it('应该正确处理不同文件类型的扩展名', () => {
      const testFiles = [
        { file: '示例.docx', expectedExt: 'docx' },
        { file: '示例.pdf', expectedExt: 'pdf' },
        { file: '示例.xlsx', expectedExt: 'xlsx' },
        { file: '示例.pptx', expectedExt: 'pptx' },
        { file: '示例.odt', expectedExt: 'odt' },
      ];
      
      testFiles.forEach(({ file, expectedExt }) => {
        const filePath = path.join(testDir, file);
        if (fs.existsSync(filePath)) {
          const fileInfo = getFileInfo(filePath);
          expect(fileInfo.ext).toBe(expectedExt);
          expect(fileInfo.isDirectory).toBe(false);
        }
      });
    });

    it('应该处理不存在的文件路径', () => {
      const nonExistentPath = path.join(testDir, 'nonexistent.txt');
      
      expect(() => {
        getFileInfo(nonExistentPath);
      }).toThrow();
    });

    it('应该正确处理包含多个点的文件名', () => {
      const complexFileName = 'file.with.many.dots.txt';
      const complexFilePath = path.join(testDir, complexFileName);
      
      // 确保测试文件存在
      if (!fs.existsSync(complexFilePath)) {
        fs.writeFileSync(complexFilePath, 'test content');
      }
      
      // 等待文件写入完成
      const fileInfo = getFileInfo(complexFilePath);
      expect(fileInfo.name).toBe(complexFileName);
      expect(fileInfo.ext).toBe('txt');
      expect(fileInfo.isDirectory).toBe(false);
      
      // 清理测试文件
      if (fs.existsSync(complexFilePath)) {
        fs.unlinkSync(complexFilePath);
      }
    });

    it('应该正确计算目录的子文件数量', () => {
      const dirInfo = getFileInfo(testDir);
      
      // 验证childrenCount与实际文件数量一致
      const actualFiles = fs.readdirSync(testDir).filter(file => !file.startsWith('.'));
      expect(dirInfo.childrenCount).toBe(actualFiles.length);
    });

    it('应该正确处理隐藏文件', () => {
      const hiddenFilePath = path.join(testDir, '.hidden.txt');
      
      // 确保隐藏文件存在
      if (!fs.existsSync(hiddenFilePath)) {
        fs.writeFileSync(hiddenFilePath, 'hidden content');
      }
      
      const fileInfo = getFileInfo(hiddenFilePath);
      expect(fileInfo.name).toBe('.hidden.txt');
      expect(fileInfo.ext).toBe('txt');
      expect(fileInfo.isDirectory).toBe(false);
      
      // 清理测试文件
      if (fs.existsSync(hiddenFilePath)) {
        fs.unlinkSync(hiddenFilePath);
      }
    });

    it('应该正确处理空目录', () => {
      const emptyDirPath = path.join(testDir, 'empty_test_dir');
      
      // 创建空目录
      if (!fs.existsSync(emptyDirPath)) {
        fs.mkdirSync(emptyDirPath);
      }
      
      const dirInfo = getFileInfo(emptyDirPath);
      expect(dirInfo.isDirectory).toBe(true);
      expect(dirInfo.childrenCount).toBe(0);
      
      // 清理测试目录
      if (fs.existsSync(emptyDirPath)) {
        fs.rmdirSync(emptyDirPath);
      }
    });

    it('应该正确处理时间戳属性', () => {
      const filePath = path.join(testDir, '示例.txt');
      const fileInfo = getFileInfo(filePath);
      
      // 验证时间戳是合理的（大于0且在合理范围内）
      expect(fileInfo.atimeMs).toBeGreaterThan(0);
      expect(fileInfo.mtimeMs).toBeGreaterThan(0);
      expect(fileInfo.ctimeMs).toBeGreaterThan(0);
      expect(fileInfo.birthtimeMs).toBeGreaterThan(0);
      
      // 验证时间戳的顺序（通常birthtime <= ctime <= mtime）
      expect(fileInfo.birthtimeMs).toBeLessThanOrEqual(fileInfo.ctimeMs);
      expect(fileInfo.ctimeMs).toBeLessThanOrEqual(fileInfo.mtimeMs);
    });

    it('应该正确处理文本文件的 isText 属性', () => {
      const textFilePath = path.join(testDir, '示例.txt');
      const fileInfo = getFileInfo(textFilePath);
      
      // 对于文本文件，isText 应该为 true
      expect(fileInfo.isText).toBe(true);
      
      // 验证其他属性
      expect(fileInfo.ext).toBe('txt');
      expect(fileInfo.isDirectory).toBe(false);
    });

    it('应该正确处理二进制文件的 isText 属性', () => {
      const binaryFilePath = path.join(testDir, 'P91004-113648.jpg');
      if (fs.existsSync(binaryFilePath)) {
        const fileInfo = getFileInfo(binaryFilePath);
        
        // 对于二进制文件，isText 应该为 false
        expect(fileInfo.isText).toBe(false);
        expect(fileInfo.ext).toBe('jpg');
        expect(fileInfo.isDirectory).toBe(false);
      }
    });
  });
});