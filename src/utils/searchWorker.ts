// searchWorker.ts - 用于后台执行搜索任务的Worker线程
import {parentPort, workerData} from 'worker_threads';
import {searchFilesContent} from './fileUtils';

// 直接使用workerData执行搜索，不需要等待message事件
const {dirPath, query} = workerData;

// 立即执行搜索
(async () => {
    try {
        // 执行搜索，传递进度回调
        const results = await searchFilesContent(dirPath, query, (totalFiles, currentFile, totalLines) => {
            // 发送进度更新到主进程
            parentPort?.postMessage({
                type: 'progress',
                data: {totalFiles, currentFile, totalLines}
            });
        });

        // 发送搜索结果到主进程
        parentPort?.postMessage({
            type: 'result',
            data: results
        });
    } catch (error) {
        // 发送错误信息到主进程
        parentPort?.postMessage({
            type: 'error',
            data: error instanceof Error ? error.message : 'Unknown error'
        });
    }
})();
