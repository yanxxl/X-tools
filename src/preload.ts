// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import {contextBridge, ipcRenderer} from 'electron';

// 暴露文件系统相关功能给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 打开文件夹选择对话框
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  // 获取文件树结构
  getFileTree: (path: string) => ipcRenderer.invoke('fs:getFileTree', path),
});

// 定义全局类型
declare global {
  interface Window {
    electronAPI: {
      selectDirectory: () => Promise<string | null>;
      getFileTree: (path: string) => Promise<any>;
    };
  }
}
