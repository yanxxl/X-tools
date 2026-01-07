// React核心导入
import React, { useEffect, useState } from 'react';

// 第三方库导入
import {Button, Divider, Dropdown, Flex, message, Modal} from "antd";
import {
    CopyOutlined,
    DeleteOutlined,
    DownOutlined,
    EyeInvisibleOutlined,
    FolderOpenOutlined,
    PlusOutlined,
    SearchOutlined,
    SyncOutlined
} from '@ant-design/icons';

// 应用内部导入
import { useAppContext } from '../../contexts/AppContext';
import { truncateFolderName } from '../../utils/uiUtils';
import { removeFolderPath } from '../../utils/config';
import { RecentFolder } from '../../types';

/**
 * 浏览器兼容的basename函数
 * 由于浏览器环境中没有Node.js的path.basename，我们实现一个兼容版本
 * @param path 文件或文件夹路径
 * @returns 路径的最后一部分（文件名或文件夹名）
 */
export function basename(path: string): string {
    // 处理不同平台的路径分隔符（/ 和 \）
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || '';
}

export const TitleBar: React.FC = () => {
    // 1. 获取应用上下文
    const {
        currentFolder,
        currentFile,
        setCurrentFolder,
        titleBarVisible,
        setTitleBarVisible,
        setSearchPanelOpen,
        leftPanelVisible,
        setLeftPanelVisible,
        rightPanelVisible,
        setRightPanelVisible,
        config,
        setConfig,
    } = useAppContext();

    // 2. 平台相关状态
    const [isMac, setIsMac] = useState(false);

    // 3. UI状态
    const [loading, setLoading] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [recentFolders, setRecentFolders] = useState<RecentFolder[]>([]);

    // 4. 函数定义
    /**
     * 显示文件夹打开方式选择对话框
     * @param onChoice 选择回调函数，参数为是否在新窗口打开（null表示取消）
     */
    const showFolderChoiceDialog = (onChoice: (openInNewWindow: boolean | null) => void): void => {
        const modal = Modal.confirm({
            title: '选择打开方式',
            content: '请选择文件夹的打开方式：',
            icon: <FolderOpenOutlined />,
            maskClosable: true,
            footer: (
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '30px 0 0 0'
                }}>
                    <Button
                        onClick={() => {
                            modal.destroy();
                            onChoice(null);
                        }}
                    >
                        取消
                    </Button>
                    <div style={{
                        display: 'flex',
                        gap: '12px'
                    }}>
                        <Button
                            onClick={() => {
                                modal.destroy();
                                onChoice(true);
                            }}
                        >
                            新窗口
                        </Button>
                        <Button
                            type="primary"
                            onClick={() => {
                                modal.destroy();
                                onChoice(false);
                            }}
                        >
                            当前窗口
                        </Button>
                    </div>
                </div>
            ),
        });
    };

    /**
     * 处理选择文件夹操作
     * @param openInNewWindow 是否在新窗口中打开文件夹
     */
    const handleSelectDirectory = async (openInNewWindow = false): Promise<void> => {
        if (!window.electronAPI) {
            message.warning('此功能需要在 Electron 应用中使用');
            return;
        }

        try {
            setLoading(true);

            // 调用Electron API选择文件夹
            const dirPath = await window.electronAPI.selectDirectory();

            if (dirPath) {
                if (openInNewWindow) {
                    // 在新窗口中打开文件夹
                    const result = await window.electronAPI.createNewWindow(dirPath);
                    if (result.success) {
                        message.success('已在新窗口中打开文件夹');
                    } else {
                        message.error(`创建新窗口失败: ${result.error}`);
                    }
                } else {
                    // 在当前窗口中打开文件夹
                    setCurrentFolder(dirPath);
                }
            }
        } catch (error) {
            console.error('选择文件夹失败:', error);
            message.error('选择文件夹失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    /**
     * 处理最近文件夹点击事件
     * @param folderPath 最近文件夹的路径
     * @param openInNewWindow 是否在新窗口中打开
     */
    const handleRecentFolderClick = async (folderPath: string, openInNewWindow = false): Promise<void> => {
        if (openInNewWindow) {
            // 在新窗口中打开文件夹
            if (!window.electronAPI) {
                message.warning('此功能需要在 Electron 应用中使用');
                return;
            }

            const result = await window.electronAPI.createNewWindow(folderPath);
            if (result.success) {
                message.success('已在新窗口中打开文件夹');
            } else {
                message.error(`创建新窗口失败: ${result.error}`);
            }
        } else {
            // 在当前窗口中打开文件夹
            setCurrentFolder(folderPath);
        }
    };

    /**
     * 处理重新加载界面操作
     */
    const handleReload = (): void => {
        window.location.reload();
    };

    /**
     * 处理隐藏标题栏操作
     */
    const handleHideTitleBar = (): void => {
        setTitleBarVisible(false);
    };

    /**
     * 处理最小化窗口操作
     */
    const handleMinimizeWindow = (): void => {
        if (window.electronAPI?.minimizeWindow) {
            window.electronAPI.minimizeWindow();
        }
    };

    /**
     * 处理最大化/还原窗口操作
     */
    const handleToggleMaximizeWindow = (): void => {
        if (window.electronAPI?.toggleMaximizeWindow) {
            window.electronAPI.toggleMaximizeWindow();
        }
    };

    /**
     * 处理关闭窗口操作
     */
    const handleCloseWindow = (): void => {
        if (window.electronAPI?.closeWindow) {
            window.electronAPI.closeWindow();
        }
    };

    /**
     * 处理打开搜索面板操作
     */
    const handleOpenSearchPanel = (): void => {
        setSearchPanelOpen(true);
    };

    // 5. 副作用定义
    // 初始化时获取平台信息
    useEffect(() => {
        const getPlatformInfo = async () => {
            if (window.electronAPI) {
                const isMacPlatform = await window.electronAPI.getIsMac();
                setIsMac(isMacPlatform);
            }
        };

        getPlatformInfo();
    }, []);

    // 监听配置变化，更新最近文件夹列表
    useEffect(() => {
        setRecentFolders(config?.recentFolders || []);
    }, [config]);



    return (
        <>
            {/* 顶部透明区域 - 用于捕捉鼠标靠近顶部的事件，当标题栏隐藏时显示 */}
            {!titleBarVisible && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 8,
                        backgroundColor: 'transparent',
                        zIndex: 200,
                        cursor: 'default'
                    }}
                    onMouseEnter={() => {
                        // 鼠标进入顶部区域时显示标题栏
                        setTitleBarVisible(true);
                    }}
                />
            )}

            {/* 标题栏 - 条件渲染 */}
            {titleBarVisible && (
                <Flex
                    className={'top-bar'}
                    style={{ height: 40, position: 'relative', zIndex: 100, borderBottom: '1px solid #e5e5e5' }}
                    align={'center'}
                >
                    {/* Mac平台左侧保留区域 */}
                    {isMac && <div style={{ flex: '0 0 72px' }}></div>}

                    {/* 左侧区域 - 文件夹选择下拉菜单 */}
                    <div style={{ paddingRight: 16 }}>
                        <Dropdown
                            menu={{
                                items: [
                                    {
                                        key: 'new',
                                        icon: <PlusOutlined />,
                                        label: '选择新文件夹',
                                        onClick: () => {
                                            // 关闭下拉菜单
                                            setDropdownOpen(false);
                                            // 显示选择对话框
                                            setTimeout(() => {
                                                if (recentFolders.length === 0) {
                                                    // 当没有文件夹列表时，直接在当前窗口打开
                                                    handleSelectDirectory(false);
                                                } else {
                                                    // 当有文件夹列表时，显示选择对话框
                                                    showFolderChoiceDialog((openInNewWindow) => {
                                                        if (openInNewWindow !== null) {
                                                            handleSelectDirectory(openInNewWindow);
                                                        }
                                                    });
                                                }
                                            }, 100);
                                        }
                                    },
                                    ...recentFolders.length > 0 ? [
                                        {
                                            type: 'divider' as const
                                        },
                                        ...recentFolders.map((folder) => ({
                                            key: folder.path,
                                            icon: <FolderOpenOutlined />,
                                            label: (
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    width: '350px'
                                                }}>
                                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                                                        <span title={folder.path} style={{ cursor: 'pointer' }}>{truncateFolderName(folder.name || '')}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{
                                                            fontSize: '12px',
                                                            color: '#999'
                                                        }}>{new Date(folder.timestamp).toLocaleString('zh-CN', {
                                                            month: '2-digit',
                                                            day: '2-digit',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            hour12: false
                                                        })}</span>
                                                        <CopyOutlined
                                                            style={{
                                                                fontSize: '14px',
                                                                color: '#666',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.3s'
                                                            }}
                                                            title="在新窗口中打开"
                                                            onClick={(e: React.MouseEvent) => {
                                                                e.stopPropagation();
                                                                setDropdownOpen(false);
                                                                setTimeout(() => {
                                                                    handleRecentFolderClick(folder.path, true);
                                                                }, 100);
                                                            }}
                                                            onMouseEnter={(e: React.MouseEvent<HTMLElement>) => {
                                                                const target = e.currentTarget;
                                                                target.style.color = '#1890ff';
                                                            }}
                                                            onMouseLeave={(e: React.MouseEvent<HTMLElement>) => {
                                                                const target = e.currentTarget;
                                                                target.style.color = '#666';
                                                            }}
                                                        />
                                                        <DeleteOutlined
                                                            style={{
                                                                fontSize: '14px',
                                                                color: '#666',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.3s'
                                                            }}
                                                            title="从列表中删除"
                                                            onClick={(e: React.MouseEvent) => {
                                                                e.stopPropagation();
                                                                if (config) {
                                                                    setConfig(removeFolderPath(config, folder.path));
                                                                }
                                                            }}
                                                            onMouseEnter={(e: React.MouseEvent<HTMLElement>) => {
                                                                const target = e.currentTarget;
                                                                target.style.transform = 'scale(1.6)';
                                                                target.style.color = '#ff4d4f';
                                                            }}
                                                            onMouseLeave={(e: React.MouseEvent<HTMLElement>) => {
                                                                const target = e.currentTarget;
                                                                target.style.transform = 'scale(1)';
                                                                target.style.color = '#666';
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            ),
                                            onClick: () => {
                                                // 关闭下拉菜单
                                                setDropdownOpen(false);
                                                // 显示选择对话框
                                                setTimeout(() => {
                                                    showFolderChoiceDialog((openInNewWindow) => {
                                                        if (openInNewWindow !== null) {
                                                            handleRecentFolderClick(folder.path, openInNewWindow);
                                                        }
                                                    });
                                                }, 100);
                                            }
                                        }))
                                    ] : []
                                ]
                            }}
                            placement="bottomLeft"
                            open={dropdownOpen}
                            onOpenChange={setDropdownOpen}
                        >
                            <Button
                                type="link"
                                loading={loading}
                            >
                                {currentFolder ? truncateFolderName(basename(currentFolder)) : '选择文件夹'} <DownOutlined />
                            </Button>
                        </Dropdown>
                    </div>

                    {/* 中间区域 - 当前文件名显示 */}
                    <div style={{ flex: '1 3 auto', minWidth: 0 }}>
                        <div className="one-line text-center">
                            {currentFile ? basename(currentFile) : ''}
                        </div>
                    </div>

                    {/* 右侧区域 - 功能按钮和窗口控制 */}
                    <div style={{
                        flex: '0 0 auto',
                        paddingLeft: 16,
                        paddingRight: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                    }}>
                        <Button
                            type="text"
                            icon={<SearchOutlined />}
                            title="打开搜索"
                            onClick={() => setSearchPanelOpen(true)}
                            style={{ padding: 0, width: 24, height: 24, borderRadius: 4 }}
                        />
                        <Divider vertical />
                        <span
                            className="span-icon"
                            style={{ borderLeft: '4px solid gray' }}
                            title="隐藏/显示左边栏"
                            onClick={() => setLeftPanelVisible(!leftPanelVisible)}
                        />
                        <span
                            className="span-icon"
                            style={{ borderTop: '4px solid gray' }}
                            title="隐藏/显示标题栏"
                            onClick={() => setTitleBarVisible(!titleBarVisible)}
                        />
                        <span
                            className="span-icon"
                            style={{ borderRight: '4px solid gray' }}
                            title="隐藏/显示右边栏"
                            onClick={() => setRightPanelVisible(!rightPanelVisible)}
                        />

                        {/* Windows 窗口控制按钮 */}
                        {!isMac && (
                            <div style={{ display: 'flex', gap: 0, marginLeft: 8, marginRight: -14 }}>
                                {/* 最小化按钮 */}
                                <Button
                                    type="text"
                                    title="最小化"
                                    onClick={handleMinimizeWindow}
                                    style={{ padding: 0, width: 36, height: 36, borderRadius: 0 }}
                                >
                                    <span style={{ fontSize: '16px', lineHeight: '1' }}>−</span>
                                </Button>

                                {/* 最大化/还原按钮 */}
                                <Button
                                    type="text"
                                    title="最大化/还原"
                                    onClick={handleToggleMaximizeWindow}
                                    style={{ padding: 0, width: 36, height: 36, borderRadius: 0 }}
                                >
                                    <span style={{ fontSize: '16px', lineHeight: '1' }}>□</span>
                                </Button>

                                {/* 关闭按钮 */}
                                <Button
                                    type="text"
                                    title="关闭"
                                    onClick={handleCloseWindow}
                                    style={{ padding: 0, width: 36, height: 36, borderRadius: 0, color: '#000000' }}
                                    onMouseEnter={(e) => {
                                        const target = e.currentTarget;
                                        target.style.backgroundColor = '#ff4d4f';
                                        target.style.color = '#ffffff';
                                    }}
                                    onMouseLeave={(e) => {
                                        const target = e.currentTarget;
                                        target.style.backgroundColor = 'transparent';
                                        target.style.color = '#000000';
                                    }}
                                >
                                    <span style={{ fontSize: '16px', lineHeight: '1' }}>×</span>
                                </Button>
                            </div>
                        )}
                    </div>
                </Flex>
            )}
        </>
    );
};