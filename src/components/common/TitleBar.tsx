import React, {useEffect, useState} from 'react';
import {Button, Dropdown, Flex, message} from "antd";
import {DeleteOutlined, DownOutlined, EyeInvisibleOutlined, FolderOpenOutlined, PlusOutlined, SearchOutlined, SyncOutlined} from '@ant-design/icons';
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
        searchPanelOpen,
        setSearchPanelOpen
    } = useAppContext();

    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<Config | null>(null);
    const [recentFolders, setRecentFolders] = useState<RecentFolder[]>([]);

    // 处理选择文件夹
    const handleSelectDirectory = async () => {
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
                setCurrentFolder(dirPath);
            }
        } catch (error) {
            console.error('选择文件夹失败:', error);
            message.error('选择文件夹失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    // 加载配置文件
    useEffect(() => {
        if (config == null) {
            if (window.electronAPI) {
                window.electronAPI.loadConfig().then(async (loadedConfig) => {
                    setConfig(loadedConfig);
                    // 如果有最近打开的文件夹，自动打开第一个
                    if (loadedConfig && loadedConfig.recentFolders && loadedConfig.recentFolders.length > 0) {
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
                                        onClick: handleSelectDirectory
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
                                                    width: '300px'
                                                }}>
                                                    <div style={{flex: 1, display: 'flex', alignItems: 'center'}}>
                                                        <span title={folder.path}>{truncateFolderName(folder.name || '')}</span>
                                                    </div>
                                                    <span style={{
                                                        fontSize: '12px',
                                                        color: '#999',
                                                        marginRight: '8px'
                                                    }}>{new Date(folder.timestamp).toLocaleString('zh-CN', {
                                                        month: '2-digit',
                                                        day: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        hour12: false
                                                    })}</span>
                                                    <DeleteOutlined
                                                        style={{
                                                            fontSize: '14px',
                                                            color: '#666',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.3s'
                                                        }}
                                                        title="从列表中删除"
                                                        onClick={(e: React.MouseEvent) => {
                                                            e.stopPropagation()
                                                            setConfig && setConfig(removeFolderPath(config, folder.path))
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
                                            ),
                                            onClick: () => {
                                                setConfig && setConfig(updateFolderPath(config, folder.path));
                                                setCurrentFolder(folder.path);
                                            }
                                        }))
                                    ] : []
                                ]
                            }}
                            placement="bottomLeft"
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