import {defineConfig} from 'vite';
import {resolve} from 'path';

// https://vitejs.dev/config
export default defineConfig({
    resolve: {
        alias: {
            // 该包的 browser 条件入口依赖 document，主进程/线程池中解析 Markdown 会直接崩溃，
            // 这里强制使用它的 Node 实现
            'decode-named-character-reference': resolve(__dirname, 'node_modules/decode-named-character-reference/index.js'),
        },
    },
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'src/main.ts'),
                preload: resolve(__dirname, 'src/preload.ts'),
                poolWorker: resolve(__dirname, 'src/utils/poolWorker.ts'),
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'chunks/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash].[ext]',
            },
        },
    },
});
