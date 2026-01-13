import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { parseMarkdownToDictionary } from '../src/utils/dictionaryParser';
import { parseMarkdown } from '../src/utils/markdown';
import { JSDOM } from 'jsdom';

// 使用jsdom创建浏览器环境
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window as unknown as Window & typeof globalThis;
global.document = dom.window.document as unknown as Document;
global.DOMParser = dom.window.DOMParser as unknown as typeof DOMParser;

// 模拟 window.electronAPI
Object.defineProperty(window, 'electronAPI', {
    value: {
        readFile: jest.fn(),
    },
    writable: true,
});

// 模拟 parseMarkdown 函数
jest.mock('../src/utils/markdown', () => ({
    parseMarkdown: jest.fn(),
}));

const mockParseMarkdown = parseMarkdown as jest.MockedFunction<typeof parseMarkdown>;
const mockReadFile = (window as any).electronAPI.readFile as jest.MockedFunction<typeof (window as any).electronAPI.readFile>;

describe('dictionaryParser.ts 测试', () => {
    beforeEach(() => {
        // 重置所有模拟
        jest.clearAllMocks();
    });

    describe('parseMarkdownToDictionary', () => {
        const testFilePath = '/test/path/dictionary.md';
        const testFileName = 'dictionary.md';
        const testMarkdownContent = `# 第一章

## 词条1

这是词条1的定义内容。

## 词条2 别名2

这是词条2的定义内容。

# 第二章

## 词条3

这是词条3的定义内容。`;

        it('应该正确解析Markdown文件为词典', async () => {
            // 设置模拟返回值
            mockReadFile.mockResolvedValue(testMarkdownContent);
            mockParseMarkdown.mockResolvedValue({
                html: `
                    <h1>第一章</h1>
                    <h2>词条1</h2>
                    <p>这是词条1的定义内容。</p>
                    <h2>词条2 别名2</h2>
                    <p>这是词条2的定义内容。</p>
                    <h1>第二章</h1>
                    <h2>词条3</h2>
                    <p>这是词条3的定义内容。</p>
                `,
                outline: [],
            });

            const result = await parseMarkdownToDictionary(testFilePath);

            // 验证结果
            expect(result.id).toBe(testFilePath);
            expect(result.name).toBe(testFileName);
            expect(result.filePath).toBe(testFilePath);
            expect(result.enabled).toBe(true);
            expect(result.entries).toHaveLength(6); // 6个词条：第一章, 词条1, 词条2, 别名2, 第二章, 词条3

            // 验证每个词条
            expect(result.entries[0]).toEqual(expect.objectContaining({
                term: '第一章',
                catalog: [],
            }));

            expect(result.entries[1]).toEqual(expect.objectContaining({
                term: '词条1',
                catalog: ['第一章'],
            }));

            expect(result.entries[2]).toEqual(expect.objectContaining({
                term: '词条2',
                catalog: ['第一章'],
            }));

            expect(result.entries[3]).toEqual(expect.objectContaining({
                term: '别名2',
                catalog: ['第一章'],
            }));

            expect(result.entries[4]).toEqual(expect.objectContaining({
                term: '第二章',
                catalog: [],
            }));

            expect(result.entries[5]).toEqual(expect.objectContaining({
                term: '词条3',
                catalog: ['第二章'],
            }));

            // 验证调用次数
            expect(mockReadFile).toHaveBeenCalledTimes(1);
            expect(mockReadFile).toHaveBeenCalledWith(testFilePath);
            expect(mockParseMarkdown).toHaveBeenCalledTimes(1);
            expect(mockParseMarkdown).toHaveBeenCalledWith(testMarkdownContent, testFilePath);
        });

        it('应该正确处理包含多层级标题的Markdown文件', async () => {
            // 设置模拟返回值
            mockReadFile.mockResolvedValue(`# 一级标题

## 二级标题1

### 三级词条1

这是三级词条1的定义。

### 三级词条2

这是三级词条2的定义。

## 二级标题2

### 三级词条3

这是三级词条3的定义。`);
            mockParseMarkdown.mockResolvedValue({
                html: `
                    <h1>一级标题</h1>
                    <h2>二级标题1</h2>
                    <h3>三级词条1</h3>
                    <p>这是三级词条1的定义。</p>
                    <h3>三级词条2</h3>
                    <p>这是三级词条2的定义。</p>
                    <h2>二级标题2</h2>
                    <h3>三级词条3</h3>
                    <p>这是三级词条3的定义。</p>
                `,
                outline: [],
            });

            const result = await parseMarkdownToDictionary(testFilePath);

            // 验证结果
            expect(result.entries).toHaveLength(6);

            // 验证目录结构
            expect(result.entries[0].catalog).toEqual([]); // 一级标题
            expect(result.entries[1].catalog).toEqual(['一级标题']); // 二级标题1
            expect(result.entries[2].catalog).toEqual(['一级标题', '二级标题1']); // 三级词条1
            expect(result.entries[3].catalog).toEqual(['一级标题', '二级标题1']); // 三级词条2
            expect(result.entries[4].catalog).toEqual(['一级标题']); // 二级标题2
            expect(result.entries[5].catalog).toEqual(['一级标题', '二级标题2']); // 三级词条3
        });

        it('应该正确处理包含复杂定义内容的Markdown文件', async () => {
            // 设置模拟返回值
            mockReadFile.mockResolvedValue(`# 词条

## 复杂词条

这是一个包含**加粗**文本的定义。

这是第二段落。

- 这是列表项1
- 这是列表项2`);
            mockParseMarkdown.mockResolvedValue({
                html: `
                    <h1>词条</h1>
                    <h2>复杂词条</h2>
                    <p>这是一个包含<strong>加粗</strong>文本的定义。</p>
                    <p>这是第二段落。</p>
                    <ul>
                        <li>这是列表项1</li>
                        <li>这是列表项2</li>
                    </ul>
                `,
                outline: [],
            });

            const result = await parseMarkdownToDictionary(testFilePath);

            // 验证结果
            expect(result.entries).toHaveLength(2);
            expect(result.entries[0].term).toBe('词条'); // 一级标题
            expect(result.entries[1].term).toBe('复杂词条'); // 二级标题
            expect(result.entries[1].definition).toHaveLength(3); // p, p, ul
            expect(result.entries[1].definition[0].tagName).toBe('P');
            expect(result.entries[1].definition[1].tagName).toBe('P');
            expect(result.entries[1].definition[2].tagName).toBe('UL');
        });

        it('应该正确处理没有标题的Markdown文件', async () => {
            // 设置模拟返回值
            mockReadFile.mockResolvedValue(`这是一个没有标题的Markdown文件。`);
            mockParseMarkdown.mockResolvedValue({
                html: `
                    <p>这是一个没有标题的Markdown文件。</p>
                `,
                outline: [],
            });

            const result = await parseMarkdownToDictionary(testFilePath);

            // 验证结果
            expect(result.entries).toHaveLength(0);
        });

        it('应该正确处理只有一级标题的Markdown文件', async () => {
            // 设置模拟返回值
            mockReadFile.mockResolvedValue(`# 只有一级标题的文件`);
            mockParseMarkdown.mockResolvedValue({
                html: `
                    <h1>只有一级标题的文件</h1>
                `,
                outline: [],
            });

            const result = await parseMarkdownToDictionary(testFilePath);

            // 验证结果
            expect(result.entries).toHaveLength(1);
            expect(result.entries[0].term).toBe('只有一级标题的文件');
            expect(result.entries[0].catalog).toEqual([]);
        });

        it('应该在没有内容时将下级标题作为定义', async () => {
            // 设置模拟返回值
            mockReadFile.mockResolvedValue(`# 父标题

## 子标题1

这是子标题1的内容

## 子标题2

这是子标题2的内容`);
            mockParseMarkdown.mockResolvedValue({
                html: `
                    <h1>父标题</h1>
                    <h2>子标题1</h2>
                    <p>这是子标题1的内容</p>
                    <h2>子标题2</h2>
                    <p>这是子标题2的内容</p>
                `,
                outline: [],
            });

            const result = await parseMarkdownToDictionary(testFilePath);

            // 验证结果
            expect(result.entries).toHaveLength(3);
            
            // 父标题应该包含子标题1和子标题2作为定义
            expect(result.entries[0].term).toBe('父标题');
            expect(result.entries[0].definition).toHaveLength(1);
            expect(result.entries[0].definition[0].tagName).toBe('P');
            expect(result.entries[0].definition[0].textContent).toBe('子标题1、子标题2');
            
            // 子标题1应该有自己的内容
            expect(result.entries[1].term).toBe('子标题1');
            expect(result.entries[1].definition).toHaveLength(1);
            expect(result.entries[1].definition[0].tagName).toBe('P');
            expect(result.entries[1].definition[0].textContent).toBe('这是子标题1的内容');
            
            // 子标题2应该有自己的内容
            expect(result.entries[2].term).toBe('子标题2');
            expect(result.entries[2].definition).toHaveLength(1);
            expect(result.entries[2].definition[0].tagName).toBe('P');
            expect(result.entries[2].definition[0].textContent).toBe('这是子标题2的内容');
        });

        it('应该在读取文件失败时抛出错误', async () => {
            // 设置模拟返回值
            const testError = new Error('读取文件失败');
            mockReadFile.mockRejectedValue(testError);

            // 验证是否抛出错误
            await expect(parseMarkdownToDictionary(testFilePath)).rejects.toThrow(testError);
        });

        it('应该在解析Markdown失败时抛出错误', async () => {
            // 设置模拟返回值
            mockReadFile.mockResolvedValue('测试内容');
            const testError = new Error('解析Markdown失败');
            mockParseMarkdown.mockRejectedValue(testError);

            // 验证是否抛出错误
            await expect(parseMarkdownToDictionary(testFilePath)).rejects.toThrow(testError);
        });
    });

    describe('splitTerm（内部函数）', () => {
        it('应该正确分割包含中文和英文的词条', () => {
            // 由于 splitTerm 是内部函数，我们需要通过 parseMarkdownToDictionary 间接测试
            mockReadFile.mockResolvedValue(`# 词条

## 测试词条 Test Term

这是一个测试词条。`);
            mockParseMarkdown.mockResolvedValue({
                html: `
                    <h1>词条</h1>
                    <h2>测试词条 Test Term</h2>
                    <p>这是一个测试词条。</p>
                `,
                outline: [],
            });

            return parseMarkdownToDictionary('/test/path/test.md').then(result => {
                expect(result.entries).toHaveLength(4); // 词条, 测试词条, Test, Term
                expect(result.entries[0].term).toBe('词条'); // 一级标题
                expect(result.entries[1].term).toBe('测试词条'); // 二级标题分割后的第一个词条
                expect(result.entries[2].term).toBe('Test'); // 二级标题分割后的第二个词条
                expect(result.entries[3].term).toBe('Term'); // 二级标题分割后的第三个词条
            });
        });

        it('应该正确分割包含标点符号的词条', () => {
            // 由于 splitTerm 是内部函数，我们需要通过 parseMarkdownToDictionary 间接测试
            mockReadFile.mockResolvedValue(`# 词条

## 词条1,词条2;词条3-词条4

这是一个测试词条。`);
            mockParseMarkdown.mockResolvedValue({
                html: `
                    <h1>词条</h1>
                    <h2>词条1,词条2;词条3-词条4</h2>
                    <p>这是一个测试词条。</p>
                `,
                outline: [],
            });

            return parseMarkdownToDictionary('/test/path/test.md').then(result => {
                expect(result.entries).toHaveLength(5);
                expect(result.entries[0].term).toBe('词条'); // 一级标题
                expect(result.entries[1].term).toBe('词条1'); // 二级标题分割后的第一个词条
                expect(result.entries[2].term).toBe('词条2'); // 二级标题分割后的第二个词条
                expect(result.entries[3].term).toBe('词条3'); // 二级标题分割后的第三个词条
                expect(result.entries[4].term).toBe('词条4'); // 二级标题分割后的第四个词条
            });
        });

        it('应该正确分割包含数字的词条', () => {
            // 由于 splitTerm 是内部函数，我们需要通过 parseMarkdownToDictionary 间接测试
            mockReadFile.mockResolvedValue(`# 词条

## 词条123 测试456

这是一个测试词条。`);
            mockParseMarkdown.mockResolvedValue({
                html: `
                    <h1>词条</h1>
                    <h2>词条123 测试456</h2>
                    <p>这是一个测试词条。</p>
                `,
                outline: [],
            });

            return parseMarkdownToDictionary('/test/path/test.md').then(result => {
                expect(result.entries).toHaveLength(3);
                expect(result.entries[0].term).toBe('词条'); // 一级标题
                expect(result.entries[1].term).toBe('词条123'); // 二级标题分割后的第一个词条
                expect(result.entries[2].term).toBe('测试456'); // 二级标题分割后的第二个词条
            });
        });
    });

    describe('updateHeaderStack（内部函数）', () => {
        it('应该正确维护header层次栈', () => {
            // 由于 updateHeaderStack 是内部函数，我们需要通过 parseMarkdownToDictionary 间接测试
            mockReadFile.mockResolvedValue(`# 一级标题

## 二级标题1

### 三级标题1

#### 四级词条1

这是四级词条1的定义。

### 三级标题2

#### 四级词条2

这是四级词条2的定义。

## 二级标题2

### 三级词条3

这是三级词条3的定义。`);
            mockParseMarkdown.mockResolvedValue({
                html: `
                    <h1>一级标题</h1>
                    <h2>二级标题1</h2>
                    <h3>三级标题1</h3>
                    <h4>四级词条1</h4>
                    <p>这是四级词条1的定义。</p>
                    <h3>三级标题2</h3>
                    <h4>四级词条2</h4>
                    <p>这是四级词条2的定义。</p>
                    <h2>二级标题2</h2>
                    <h3>三级词条3</h3>
                    <p>这是三级词条3的定义。</p>
                `,
                outline: [],
            });

            return parseMarkdownToDictionary('/test/path/test.md').then(result => {
                expect(result.entries).toHaveLength(8);
                
                // 验证目录结构
                expect(result.entries[0].catalog).toEqual([]); // 一级标题
                expect(result.entries[1].catalog).toEqual(['一级标题']); // 二级标题1
                expect(result.entries[2].catalog).toEqual(['一级标题', '二级标题1']); // 三级标题1
                expect(result.entries[3].catalog).toEqual(['一级标题', '二级标题1', '三级标题1']); // 四级词条1
                expect(result.entries[4].catalog).toEqual(['一级标题', '二级标题1']); // 三级标题2
                expect(result.entries[5].catalog).toEqual(['一级标题', '二级标题1', '三级标题2']); // 四级词条2
                expect(result.entries[6].catalog).toEqual(['一级标题']); // 二级标题2
                expect(result.entries[7].catalog).toEqual(['一级标题', '二级标题2']); // 三级词条3
            });
        });
    });
});
