import { ToolWindow, ToolWindowManager } from '../types/toolWindow';

/**
 * 工具窗口管理器实现
 */
export class DefaultToolWindowManager implements ToolWindowManager {
    private windows: Map<string, ToolWindow> = new Map();

    /**
     * 注册工具窗口
     */
    register(toolWindow: ToolWindow): void {
        if (this.windows.has(toolWindow.id)) {
            console.warn(`ToolWindow with id '${toolWindow.id}' already exists. Overwriting.`);
        }
        this.windows.set(toolWindow.id, toolWindow);
    }

    /**
     * 注销工具窗口
     */
    unregister(id: string): void {
        if (!this.windows.has(id)) {
            console.warn(`ToolWindow with id '${id}' not found.`);
            return;
        }
        this.windows.delete(id);
    }

    /**
     * 获取工具窗口
     */
    get(id: string): ToolWindow | undefined {
        return this.windows.get(id);
    }

    /**
     * 获取所有工具窗口
     */
    getAll(): ToolWindow[] {
        return Array.from(this.windows.values());
    }

    /**
     * 显示工具窗口
     */
    show(id: string): boolean {
        const window = this.windows.get(id);
        if (window) {
            window.show();
            return true;
        }
        return false;
    }

    /**
     * 隐藏工具窗口
     */
    hide(id: string): boolean {
        const window = this.windows.get(id);
        if (window) {
            window.hide();
            return true;
        }
        return false;
    }

    /**
     * 切换工具窗口可见性
     */
    toggle(id: string): boolean {
        const window = this.windows.get(id);
        if (window) {
            window.toggle();
            return true;
        }
        return false;
    }

    /**
     * 获取可见的工具窗口
     */
    getVisible(): ToolWindow[] {
        return this.getAll().filter(window => window.isVisible);
    }

    /**
     * 清空所有工具窗口
     */
    clear(): void {
        this.windows.clear();
    }

    /**
     * 获取工具窗口数量
     */
    count(): number {
        return this.windows.size;
    }

    /**
     * 检查工具窗口是否存在
     */
    has(id: string): boolean {
        return this.windows.has(id);
    }
}

/**
 * 创建全局工具窗口管理器实例
 */
export const toolWindowManager = new DefaultToolWindowManager();