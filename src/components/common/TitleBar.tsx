// React核心导入
import React, { useEffect, useState } from 'react';

// 第三方库导入
import { Button, Divider, Dropdown, Flex, message, Modal, Tooltip } from "antd";
import { ArrowLeftOutlined, ArrowRightOutlined, BorderOutlined, CloseOutlined, DownOutlined, FolderOpenOutlined, MinusOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, RetweetOutlined } from '@ant-design/icons';

// 应用内部导入
import { useAppContext } from '../../contexts/AppContext';
import { truncateFolderName } from '../../utils/uiUtils';
import { removeFolderPath, updateFolderPath } from '../../utils/config';
import { RecentFolder } from '../../types';
import { CloseButton } from './CloseButton';
import { basename, detectFileType } from '../../utils/fileCommonUtil';

export const TitleBar: React.FC = () => {
    // 1. 获取应用上下文
    const {
        currentFolder,
        currentFile,
        canGoBack,
        canGoForward,
        goBack,
        goForward,
        titleBarVisible,
        setTitleBarVisible,
        setSearchPanelOpen,
        leftPanelVisible,
        setLeftPanelVisible,
        rightPanelVisible,
        setRightPanelVisible,
        loopPlay,
        setLoopPlay,
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
        try {
            setLoading(true);
            // 调用Electron API选择文件夹
            const dirPath = await window.electronAPI.selectDirectory();
            if (dirPath) {
                await openFolder(dirPath, openInNewWindow);
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
    const openFolder = async (dirPath: string, openInNewWindow = false): Promise<void> => {
        // 更新 config 中的 recentFolders
        window.electronAPI.loadConfig().then((config) => {
            if (config) {
                const updatedConfig = updateFolderPath(config, dirPath);
                window.electronAPI.saveConfig(updatedConfig);
                // 更新本地状态
                setRecentFolders(updatedConfig.recentFolders || []);
            }
        });

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
            window.electronAPI.setCurrentWindowFolder(dirPath);
            window.location.reload();
        }
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

        window.electronAPI.loadConfig().then((config) => {
            console.log('config', config);
            setRecentFolders(config?.recentFolders || []);
        });
    }, []);

    // 监听键盘事件，支持 Alt+Left 和 Alt+Right 快捷键
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // 检查是否按下了 Alt 键和方向键
            if (e.altKey) {
                if (e.key === 'ArrowLeft' && canGoBack) {
                    e.preventDefault();
                    goBack();
                } else if (e.key === 'ArrowRight' && canGoForward) {
                    e.preventDefault();
                    goForward();
                }
            }
        };

        // 添加全局键盘事件监听器
        document.addEventListener('keydown', handleKeyDown);

        // 清理函数
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [canGoBack, canGoForward, goBack, goForward]);

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
                                                        <CloseButton
                                                            title="删除记录"
                                                            onClick={(e: React.MouseEvent) => {
                                                                e.stopPropagation();
                                                                // 直接通过 electronAPI 移除文件夹路径
                                                                window.electronAPI.loadConfig().then((config) => {
                                                                    if (config) {
                                                                        const updatedConfig = removeFolderPath(config, folder.path);
                                                                        window.electronAPI.saveConfig(updatedConfig);
                                                                        // 更新本地状态
                                                                        setRecentFolders(updatedConfig.recentFolders || []);
                                                                    }
                                                                });
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
                                                            openFolder(folder.path, openInNewWindow);
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
                    <div style={{ flex: '1 3 auto', minWidth: 0, display: 'flex', gap: 8 }}>
                        <div className="one-line text-center" style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8
                        }}>
                            {/* 历史文件导航按钮 */}
                            <Tooltip title="后退 (Alt+Left)">
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<ArrowLeftOutlined />}
                                    onClick={goBack}
                                    disabled={!canGoBack}
                                    style={{ padding: 0, width: 20, height: 20, borderRadius: 2 }}
                                />
                            </Tooltip>
                            <Tooltip title="前进 (Alt+Right)">
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<ArrowRightOutlined />}
                                    onClick={goForward}
                                    disabled={!canGoForward}
                                    style={{ padding: 0, width: 20, height: 20, borderRadius: 2 }}
                                />
                            </Tooltip>
                            <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                                {currentFile ? basename(currentFile) : ''}
                                {/* 循环播放按钮 - 仅在当前文件是支持的媒体文件时显示 */}
                                {currentFile && (detectFileType(currentFile) === 'video' || detectFileType(currentFile) === 'audio') && (
                                    <Tooltip title={loopPlay ? "循环播放中" : "循环播放"}>
                                        <Button
                                            ghost
                                            type={loopPlay ? "primary" : "text"}
                                            size="small"
                                            icon={<RetweetOutlined />}
                                            onClick={() => setLoopPlay(!loopPlay)}
                                            style={{
                                                marginLeft: 8,
                                            }}
                                        />
                                    </Tooltip>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 右侧区域 - 功能按钮和窗口控制 */}
                    <div style={{
                        flex: '0 0 auto',
                        paddingLeft: 16,
                        paddingRight: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12
                    }}>
                        <Tooltip title="打开搜索">
                            <Button
                                type="text"
                                icon={<SearchOutlined />}
                                onClick={() => setSearchPanelOpen(true)}
                                style={{ padding: 0, width: 24, height: 24, borderRadius: 4 }}
                            />
                        </Tooltip>
                        <Tooltip title="刷新，重新加载页面">
                            <Button
                                type="text"
                                icon={<ReloadOutlined />}
                                onClick={() => window.location.reload()}
                                style={{ padding: 0, width: 24, height: 24, borderRadius: 4 }}
                            />
                        </Tooltip>
                        <Divider vertical />
                        <Tooltip title="隐藏/显示左边栏">
                            <span
                                className="span-icon"
                                style={{ borderLeft: '4px solid gray' }}
                                onClick={() => setLeftPanelVisible(!leftPanelVisible)}
                            />
                        </Tooltip>
                        <Tooltip title="隐藏/显示标题栏">
                            <span
                                className="span-icon"
                                style={{ borderTop: '4px solid gray' }}
                                onClick={() => setTitleBarVisible(!titleBarVisible)}
                            />
                        </Tooltip>
                        <Tooltip title="隐藏/显示右边栏" placement="left">
                            <span
                                className="span-icon"
                                style={{ borderRight: '4px solid gray' }}
                                onClick={() => setRightPanelVisible(!rightPanelVisible)}
                            />
                        </Tooltip>

                        {/* Windows 窗口控制按钮 */}
                        {!isMac && (
                            <div style={{ display: 'flex', gap: 0, marginLeft: 8, marginRight: -14 }}>
                                {/* 最小化按钮 */}
                                <Tooltip title="最小化">
                                    <Button
                                        type="text"
                                        onClick={handleMinimizeWindow}
                                        style={{ padding: 0, width: 36, height: 36, borderRadius: 0 }}
                                    >
                                        <MinusOutlined />
                                    </Button>
                                </Tooltip>

                                {/* 最大化/还原按钮 */}
                                <Tooltip title="最大化/还原">
                                    <Button
                                        type="text"
                                        onClick={handleToggleMaximizeWindow}
                                        style={{ padding: 0, width: 36, height: 36, borderRadius: 0 }}
                                    >
                                        <BorderOutlined />
                                    </Button>
                                </Tooltip>

                                {/* 关闭按钮 */}
                                <Tooltip title="关闭" placement="left">
                                    <Button
                                        type="text"
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
                                        <CloseOutlined />
                                    </Button>
                                </Tooltip>
                            </div>
                        )}
                    </div>
                </Flex>
            )}
        </>
    );
};