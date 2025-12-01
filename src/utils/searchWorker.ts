// searchWorker.ts - 用于后台执行搜索任务的Worker线程
import {parentPort, workerData} from 'worker_threads';
import {searchFilesContentProgressively} from './fileUtils';

// 直接使用workerData执行搜索，不需要等待message事件
const {dirPath, query, searchId, searchMode} = workerData;

// 立即执行搜索
(async () => {
    try {
        // 执行逐步搜索
        await searchFilesContentProgressively(dirPath, query, {
            onFileProcessed: (result) => {
                // 发送单个文件的搜索结果到主进程
                parentPort?.postMessage({
                    type: 'fileResult',
                    searchId,
                    data: result
                });
            },
            onProgress: (totalFiles, currentFile, totalLines) => {
                // 发送进度更新到主进程
                parentPort?.postMessage({
                    type: 'progress',
                    searchId,
                    data: {totalFiles, currentFile, totalLines}
                });
            }
        }, searchMode);
    } catch (error) {
        // 发送错误信息到主进程
        parentPort?.postMessage({
            type: 'error',
            searchId,
            data: error instanceof Error ? error.message : 'Unknown error'
        });
    }
})();