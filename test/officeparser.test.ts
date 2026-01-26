import * as fs from 'fs';
import * as path from 'path';
import {OfficeParser} from "../src/office/OfficeParser";
import {astToText, astToJson, defaultToText} from "../src/utils/office";

async function testOfficeParser() {
    console.log('测试 officeparser 库的能力...\n');

    // 创建结果文件
    const resultFile = path.join('test', 'result.txt');
    let resultContent = '';

    // 获取 test/files 目录下的所有文件
    const testDir = path.join('test', 'files');
    const files = fs.readdirSync(testDir);

    for (const file of files) {
        const filePath = path.join(testDir, file);
        const ext = path.extname(file).toLowerCase();

        // 只测试Excel文档格式
        if (['.docx', '.xlsx', '.pptx', '.pdf'].includes(ext)) {
            console.log(`正在解析文件: ${file}`);
            console.log('='.repeat(40));

            // 写入结果文件
            resultContent += `正在解析文件: ${file}\n`;
            resultContent += '='.repeat(40) + '\n\n';

            try {
                // 使用 OfficeParser 解析
                const contentAST = await OfficeParser.parseOffice(filePath, {extractAttachments: true, includeRawContent: true});               

                // 获取纯文本
                console.log(`纯文本内容:`);
                const textContent = astToText(contentAST);
                console.log(textContent);
                
                resultContent += `纯文本内容--------------------:\n${textContent}\n\n`;

                // 获取默认文本内容
                console.log(`默认文本内容:`);
                const defaultTextContent = defaultToText(contentAST);
                console.log(defaultTextContent);
                
                resultContent += `默认文本内容----------------------:\n${defaultTextContent}\n\n`;

                // // 获取JSON内容
                // console.log(`JSON内容:`);
                // const jsonContent = JSON.stringify(astToJson(contentAST), null, 2);
                // console.log(jsonContent);
                
                // resultContent += `JSON内容----------------------:\n${jsonContent}\n\n`;

                // // 获取AST内容
                // console.log(`AST内容:`);
                // const astContent = JSON.stringify(contentAST, null, 2);
                // console.log(astContent);
                
                // resultContent += `AST内容----------------------:\n${astContent}\n\n`;

                resultContent += '='.repeat(40) + '\n\n';
            } catch (error) {
                console.error(`解析文件 ${file} 时出错:`, error);
                resultContent += `解析文件 ${file} 时出错: ${error}\n\n`;
                resultContent += '='.repeat(40) + '\n\n';
            }
        }
    }

    // 写入结果文件
    fs.writeFileSync(resultFile, resultContent, 'utf8');
    console.log(`\n解析结果已保存到: ${resultFile}`);
    console.log('测试完成！');
}

// 运行测试
testOfficeParser().catch(console.error);

export {};