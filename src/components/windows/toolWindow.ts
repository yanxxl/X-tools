import { ReactNode } from 'react';

/**
 * 工具窗口类
 * 用于管理应用中的各种工具窗口面板
 */
export class ToolWindow {
    private _id: string;
    private _name: string;
    private _description: string;
    private _isVisible: boolean;
    private _view: ReactNode;
    private _icon?: ReactNode;
    private _shortcut?: string;
    private _isResizable?: boolean;
    private _defaultWidth?: number;
    private _defaultHeight?: number;

    constructor(options: ToolWindowOptions) {
        this._id = options.id;
        this._name = options.name;
        this._description = options.description;
        this._isVisible = options.isVisible ?? false;
        this._view = options.view;
        this._icon = options.icon;
        this._shortcut = options.shortcut;
        this._isResizable = options.isResizable ?? true;
        this._defaultWidth = options.defaultWidth;
        this._defaultHeight = options.defaultHeight;
    }

    // Getters and Setters
    get id(): string {
        return this._id;
    }

    get name(): string {
        return this._name;
    }

    set name(value: string) {
        this._name = value;
    }

    get description(): string {
        return this._description;
    }

    set description(value: string) {
        this._description = value;
    }

    get isVisible(): boolean {
        return this._isVisible;
    }

    set isVisible(value: boolean) {
        this._isVisible = value;
    }

    get view(): ReactNode {
        return this._view;
    }

    set view(value: ReactNode) {
        this._view = value;
    }

    get icon(): ReactNode | undefined {
        return this._icon;
    }

    set icon(value: ReactNode | undefined) {
        this._icon = value;
    }

    get shortcut(): string | undefined {
        return this._shortcut;
    }

    set shortcut(value: string | undefined) {
        this._shortcut = value;
    }

    get isResizable(): boolean {
        return this._isResizable ?? true;
    }

    set isResizable(value: boolean) {
        this._isResizable = value;
    }

    get defaultWidth(): number | undefined {
        return this._defaultWidth;
    }

    set defaultWidth(value: number | undefined) {
        this._defaultWidth = value;
    }

    get defaultHeight(): number | undefined {
        return this._defaultHeight;
    }

    set defaultHeight(value: number | undefined) {
        this._defaultHeight = value;
    }

    // Methods
    /**
     * 显示工具窗口
     */
    show(): void {
        this._isVisible = true;
    }

    /**
     * 隐藏工具窗口
     */
    hide(): void {
        this._isVisible = false;
    }

    /**
     * 切换工具窗口可见性
     */
    toggle(): void {
        this._isVisible = !this._isVisible;
    }

    /**
     * 克隆工具窗口
     */
    clone(): ToolWindow {
        return new ToolWindow({
            id: `${this._id}_clone`,
            name: `${this._name} (Copy)`,
            description: this._description,
            isVisible: this._isVisible,
            view: this._view,
            icon: this._icon,
            shortcut: this._shortcut,
            isResizable: this._isResizable,
            defaultWidth: this._defaultWidth,
            defaultHeight: this._defaultHeight
        });
    }

    /**
     * 转换为JSON对象
     */
    toJSON(): Omit<ToolWindowOptions, 'view'> & { isVisible: boolean } {
        return {
            id: this._id,
            name: this._name,
            description: this._description,
            isVisible: this._isVisible,
            icon: this._icon,
            shortcut: this._shortcut,
            isResizable: this._isResizable,
            defaultWidth: this._defaultWidth,
            defaultHeight: this._defaultHeight
        };
    }

    /**
     * 从JSON对象创建ToolWindow实例
     */
    static fromJSON(data: Omit<ToolWindowOptions, 'view'> & { isVisible: boolean }, view: ReactNode): ToolWindow {
        return new ToolWindow({
            ...data,
            view
        });
    }
}

/**
 * 工具窗口配置选项接口
 */
export interface ToolWindowOptions {
    /** 工具窗口唯一标识符 */
    id: string;
    /** 工具窗口名称 */
    name: string;
    /** 工具窗口描述 */
    description: string;
    /** 是否可见，默认为false */
    isVisible?: boolean;
    /** React组件视图 */
    view: ReactNode;
    /** 图标 React 组件 */
    icon?: ReactNode;
    /** 快捷键 */
    shortcut?: string;
    /** 是否可调整大小，默认为true */
    isResizable?: boolean;
    /** 默认宽度 */
    defaultWidth?: number;
    /** 默认高度 */
    defaultHeight?: number;
}

/**
 * 工具窗口管理器接口
 */
export interface ToolWindowManager {
    /** 注册工具窗口 */
    register(toolWindow: ToolWindow): void;
    /** 注销工具窗口 */
    unregister(id: string): void;
    /** 获取工具窗口 */
    get(id: string): ToolWindow | undefined;
    /** 获取所有工具窗口 */
    getAll(): ToolWindow[];
    /** 显示工具窗口 */
    show(id: string): boolean;
    /** 隐藏工具窗口 */
    hide(id: string): boolean;
    /** 切换工具窗口可见性 */
    toggle(id: string): boolean;
    /** 获取可见的工具窗口 */
    getVisible(): ToolWindow[];
}