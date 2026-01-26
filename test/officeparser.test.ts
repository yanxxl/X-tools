import * as fs from 'fs';
import * as path from 'path';
import {OfficeParser} from "../src/office/OfficeParser";
import {astToText} from "../src/utils/office";

async function testOfficeParser() {
    console.log('测试 officeparser 库的能力...\n');

    // 获取 test/files 目录下的所有文件
    const testDir = path.join('test', 'files');
    const files = fs.readdirSync(testDir);

    for (const file of files) {
        const filePath = path.join(testDir, file);
        const ext = path.extname(file).toLowerCase();

        // 只测试Excel文档格式
        if (['.xlsx'].includes(ext)) {
            console.log(`正在解析文件: ${file}`);
            console.log('='.repeat(40));

            try {
                // 使用 OfficeParser 解析
                const contentAST = await OfficeParser.parseOffice(filePath, {extractAttachments: true, includeRawContent: true});

                console.log(`文件类型: ${contentAST.type || 'Unknown'}`);
                console.log(`元数据:`, contentAST.metadata ? JSON.stringify(contentAST.metadata, null, 2) : 'None');

                // 显示内容结构
                // if (Array.isArray(contentAST.content)) {
                //     console.log(`内容数组长度: ${contentAST.content.length}`);
                //     contentAST.content.forEach((item, index) => {
                //         console.log(`内容项 ${index + 1}:`, typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item));
                //     });
                // } else if (typeof contentAST.content === 'object') {
                //     console.log('内容对象:', JSON.stringify(contentAST.content, null, 2));
                // } else {
                //     console.log('内容 (字符串):', typeof contentAST.content === 'string' ? (contentAST.content as string) : contentAST.content);
                // }
                
                if (contentAST.attachments) {
                    console.log('附件')
                    contentAST.attachments.forEach((item, index) => {
                        if (typeof item === 'object' && item !== null) {
                            console.log(`附件 ${index + 1}:`);
                            console.log(`  名称: ${item.name}`);
                            console.log(`  类型: ${item.type}`);
                            console.log(`  MIME类型: ${item.mimeType}`);
                            console.log(`  扩展名: ${item.extension}`);
                            if (item.ocrText) {
                                console.log(`  OCR文本: ${item.ocrText}`);
                            }
                            if (item.altText) {
                                console.log(`  替代文本: ${item.altText}`);
                            }
                            if (item.chartData) {
                                console.log(`  图表数据: 存在`);
                            }
                        } else {
                            console.log(`附件 ${index + 1}:`, String(item));
                        }
                    })
                }

                console.log("内容 AST：")
                console.log(JSON.stringify(contentAST, null, 2));

                // 获取纯文本
                console.log(`纯文本内容:`);
                console.log(astToText(contentAST));

                console.log('');
            } catch (error) {
                console.error(`解析文件 ${file} 时出错:`, error);
                console.log('');
            }
        }
    }

    console.log('测试完成！');
}

// 运行测试
testOfficeParser().catch(console.error);

export {};