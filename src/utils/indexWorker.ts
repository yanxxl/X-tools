import { isTextFile } from "./fileCommonUtil";

// 这是一个简单的 Web Worker，启动后打印 Hello world
console.log('Hello world from web worker!',isTextFile('test.txt'));

// Web Worker 的消息处理
self.onmessage = function(event) {
    console.log('Worker received message:', event.data);
    
    // 回复消息
    self.postMessage({
        type: 'response',
        message: 'Hello from worker!',
        received: event.data
    });
};

// 告诉主线程 worker 已就绪
self.postMessage({ type: 'ready', message: 'Worker is ready!' });