import React, {useEffect, useState} from 'react';
import {Button, Dropdown, Flex, message, Modal} from "antd";
import {DeleteOutlined, DownOutlined, EyeInvisibleOutlined, FolderOpenOutlined, PlusOutlined, SearchOutlined, SyncOutlined, CopyOutlined} from '@ant-design/icons';
import {useAppContext} from '../../contexts/AppContext';
import {truncateFolderName} from '../../utils/uiUtils';
import {Config, removeFolderPath, updateFolderPath} from "../../utils/config";
import {RecentFolder} from '../../types';

// 浏览器兼容的basename函数
function basename(path: string): string {
    // 处理不同平台的路径分隔符
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || '';
}

export const TitleBar: React.FC = () => {
    const [isMac, setIsMac] = useState(false);

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
    const {
        currentFolder,
        currentFile,
        setCurrentFolder,
        titleBarVisible,
        setTitleBarVisible,
        setSearchPanelOpen
    } = useAppContext();

    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<Config | null>(null);
    const [recentFolders, setRecentFolders] = useState<RecentFolder[]>([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // 显示文件夹打开方式选择对话框
    const showFolderChoiceDialog = (onChoice: (openInNewWindow: boolean | null) => void) => {
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

    // 处理选择文件夹
    const handleSelectDirectory = async (openInNewWindow = false) => {
        if (!window.electronAPI) {
            message.warning('此功能需要在 Electron 应用中使用');
            return;
        }

        try {
            setLoading(true);

            // 调用Electron API选择文件夹
            const dirPath = await window.electronAPI.selectDirectory();

            if (dirPath && config) {
                setConfig(updateFolderPath(config, dirPath));
                
                if (openInNewWindow) {
                    // 在新窗口中打开
                    const result = await window.electronAPI.createNewWindow(dirPath);
                    if (result.success) {
                        message.success('已在新窗口中打开文件夹');
                    } else {
                        message.error('创建新窗口失败: ' + result.error);
                    }
                } else {
                    // 在当前窗口中打开
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

    // 处理最近文件夹点击
    const handleRecentFolderClick = async (folderPath: string, openInNewWindow = false) => {
        if (config) {
            setConfig(updateFolderPath(config, folderPath));
            
            if (openInNewWindow) {
                // 在新窗口中打开
                const result = await window.electronAPI.createNewWindow(folderPath);
                if (result.success) {
                    message.success('已在新窗口中打开文件夹');
                } else {
                    message.error('创建新窗口失败: ' + result.error);
                }
            } else {
                // 在当前窗口中打开
                setCurrentFolder(folderPath);
            }
        }
    };

    // 加载配置文件
    useEffect(() => {
        if (config == null) {
            if (window.electronAPI) {
                window.electronAPI.loadConfig().then(async (loadedConfig) => {
                    setConfig(loadedConfig);
                    // 如果有最近打开的文件夹，自动打开第一个,除非当前文件夹不为空
                    if (!currentFolder && loadedConfig && loadedConfig.recentFolders && loadedConfig.recentFolders.length > 0) {
                        const firstFolder = loadedConfig.recentFolders[0];
                        setCurrentFolder(firstFolder.path);
                    }
                });
            } else {
                // 浏览器环境下的默认配置
                setConfig({
                    recentFolders: []
                });
            }
        } else {
            setRecentFolders(config.recentFolders || []);
            if (window.electronAPI) {
                window.electronAPI.saveConfig(config);
            }
        }
    }, [config]);

    return (
        <>
            {/*顶部透明区域 - 用于捕捉鼠标靠近顶部的事件，当标题栏隐藏时显示*/}
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

            {/*标题栏 - 条件渲染*/}
            {titleBarVisible && (
                <Flex
                    className={'top-bar'}
                    style={{height: 40, position: 'relative', zIndex: 100}}
                    align={'center'}
                >
                    {isMac && <div style={{flex: '0 0 72px'}}></div>}
                    <div style={{paddingRight: 16}}>
                        <Dropdown
                            menu={{
                                items: [
                                    {
                                        key: 'new',
                                        icon: <PlusOutlined/>,
                                        label: '选择新文件夹',
                                            onClick: () => {
                                                // 关闭下拉菜单
                                                setDropdownOpen(false);
                                                // 显示选择对话框
                                                setTimeout(() => {
                                                    showFolderChoiceDialog((openInNewWindow) => {
                                                        if (openInNewWindow !== null) {
                                                            handleSelectDirectory(openInNewWindow);
                                                        }
                                                    });
                                                }, 100);
                                            }
                                    },
                                    ...recentFolders.length > 0 ? [
                                        {
                                            type: 'divider' as const
                                        },
                                        ...recentFolders.map((folder) => ({
                                            key: folder.path,
                                            icon: <FolderOpenOutlined/>,
                                            label: (
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    width: '350px'
                                                }}>
                                                    <div style={{flex: 1, display: 'flex', alignItems: 'center'}}>
                                                        <span title={folder.path} style={{cursor: 'pointer'}}>{truncateFolderName(folder.name || '')}</span>
                                                    </div>
                                                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
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
                                                                setConfig && setConfig(removeFolderPath(config, folder.path));
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
                                {currentFolder ? truncateFolderName(basename(currentFolder)) : '选择文件夹'} <DownOutlined/>
                            </Button>
                        </Dropdown>
                    </div>
                    <div style={{flex: '1 3 auto', minWidth: 0}}>
                        <div className="one-line text-center">
                            {currentFile ? basename(currentFile) : ''}
                        </div>
                    </div>
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
                            icon={<SearchOutlined/>}
                            title="打开搜索"
                            onClick={() => setSearchPanelOpen(true)}
                            style={{padding: 0, width: 24, height: 24, borderRadius: 4}}
                        />
                        <Button
                            type="text"
                            icon={<SyncOutlined/>}
                            title="重新加载界面"
                            onClick={() => {
                                // 重新加载界面
                                window.location.reload();
                            }}
                            style={{padding: 0, width: 24, height: 24, borderRadius: 4}}
                        />
                        <Button
                            type="text"
                            icon={<EyeInvisibleOutlined/>}
                            title="隐藏标题栏"
                            onClick={() => {
                                // 点击按钮直接隐藏标题栏
                                setTitleBarVisible(false);
                            }}
                            style={{padding: 0, width: 24, height: 24, borderRadius: 4}}
                        />
                        {/* Windows 窗口控制按钮 */}
                        {!isMac && (
                            <div style={{display: 'flex', gap: 0, marginLeft: 8, marginRight: -16}}>
                                <Button
                                    type="text"
                                    title="最小化"
                                    onClick={() => {
                                        if (window.electronAPI?.minimizeWindow) {
                                            window.electronAPI.minimizeWindow();
                                        }
                                    }}
                                    style={{padding: 0, width: 36, height: 36, borderRadius: 0}}
                                >
                                    <span style={{fontSize: '16px', lineHeight: '1'}}>−</span>
                                </Button>
                                <Button
                                    type="text"
                                    title="最大化/还原"
                                    onClick={() => {
                                        if (window.electronAPI?.toggleMaximizeWindow) {
                                            window.electronAPI.toggleMaximizeWindow();
                                        }
                                    }}
                                    style={{padding: 0, width: 36, height: 36, borderRadius: 0}}
                                >
                                    <span style={{fontSize: '16px', lineHeight: '1'}}>□</span>
                                </Button>
                                <Button
                                    type="text"
                                    title="关闭"
                                    onClick={() => {
                                        if (window.electronAPI?.closeWindow) {
                                            window.electronAPI.closeWindow();
                                        }
                                    }}
                                    style={{padding: 0, width: 36, height: 36, borderRadius: 0, color: '#000000'}}
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
                                    <span style={{fontSize: '16px', lineHeight: '1'}}>×</span>
                                </Button>
                            </div>
                        )}
                    </div>
                </Flex>
            )}
        </>
    );
};