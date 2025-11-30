import React, {useEffect, useState} from 'react';
import {App, Button, ConfigProvider, Drawer, Dropdown, Flex, message, Splitter} from "antd";
import {DeleteOutlined, DownOutlined, EyeInvisibleOutlined, FolderOpenOutlined, PlusOutlined, SearchOutlined, SyncOutlined} from '@ant-design/icons';
import {RecentFolder} from './types';
import {FileViewer} from './components/viewers/FileViewer';
import {ToolWindowsPane} from './components/windows/ToolWindowsPane';
import {AppProvider, useAppContext} from './contexts/AppContext';
import {truncateFolderName} from './utils/uiUtils';
import {Config, removeFolderPath, updateFolderPath} from "./utils/config";
import {Container} from "./components/common/Container";
import {Center} from "./components/common/Center";
import {GlobalSearch} from './components/common/GlobalSearch';
import {FileTree} from './components/common/FileTree';

const AppContent: React.FC = () => {
    const {currentFolder, setCurrentFolder, currentFile, setCurrentFile} = useAppContext();

    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<Config | null>(null);
    const [recentFolders, setRecentFolders] = useState<RecentFolder[]>([]);
    const [titleBarVisible, setTitleBarVisible] = useState(true);
    const [searchPanelOpen, setSearchPanelOpen] = useState(false); // 控制搜索面板显示状态

    // 窗口大小相关的状态和功能
    const WINDOW_SIZE_KEY = 'x-tools-window-size';

    // 保存窗口大小到local storage
    const saveWindowSize = (width: number, height: number) => {
        try {
            const windowSize = {width, height};
            localStorage.setItem(WINDOW_SIZE_KEY, JSON.stringify(windowSize));
        } catch (error) {
            console.error('保存窗口大小失败:', error);
        }
    };

    // 从local storage读取窗口大小
    const getWindowSize = () => {
        try {
            const savedSize = localStorage.getItem(WINDOW_SIZE_KEY);
            return savedSize ? JSON.parse(savedSize) : null;
        } catch (error) {
            console.error('读取窗口大小失败:', error);
            return null;
        }
    };

    // 加载配置文件
    useEffect(() => {
        setLoading(true);
        if (config == null) {
            if (window.electronAPI) {
                window.electronAPI.loadConfig().then(async (loadedConfig) => {
                    setConfig(loadedConfig);
                })
            } else {
                // 浏览器环境下的默认配置
                setConfig({
                    recentFolders: []
                });
            }
        } else {
            setRecentFolders(config.recentFolders || []);
            // 修复：只有在recentFolders有内容时才设置currentFolder
            if (config.recentFolders && config.recentFolders.length > 0) {
                setCurrentFolder(config.recentFolders[0].path);
            }
            if (window.electronAPI) {
                window.electronAPI.saveConfig(config);
            }
        }
        setLoading(false);
    }, [config]);

    useEffect(() => {
        if (currentFolder) {
            setLoading(true);
            // 关闭搜索面板
            setSearchPanelOpen(false);
        }
    }, [currentFolder]);

    // 同步红绿灯显示状态与标题栏显示状态
    useEffect(() => {
        if (window.electronAPI?.setWindowButtonVisibility) {
            window.electronAPI.setWindowButtonVisibility(titleBarVisible);
        }
    }, [titleBarVisible]);

    // 监听窗口大小变化并保存
    useEffect(() => {
        // 组件挂载时恢复窗口大小
        const savedSize = getWindowSize();
        if (savedSize && window.resizeTo) {
            try {
                window.resizeTo(savedSize.width, savedSize.height);
            } catch (error) {
                console.error('恢复窗口大小失败:', error);
            }
        }

        // 监听窗口大小变化事件
        const handleResize = () => {
            if (window.innerWidth && window.innerHeight) {
                saveWindowSize(window.innerWidth, window.innerHeight);
            }
        };

        window.addEventListener('resize', handleResize);

        // 组件卸载时移除监听器
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []); // 只在组件挂载和卸载时执行

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
                setConfig(updateFolderPath(config, dirPath))
            }
        } catch (error) {
            console.error('选择文件夹失败:', error);
            message.error('选择文件夹失败，请重试');
        } finally {
            setLoading(false);
        }
    };

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
                    <div style={{flex: '0 0 72px'}}></div>
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
                                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '300px'}}>
                                                    <div style={{flex: 1, display: 'flex', alignItems: 'center'}}>
                                                        <span title={folder.path}>{truncateFolderName(folder.name || '')}</span>
                                                    </div>
                                                    <span style={{fontSize: '12px', color: '#999', marginRight: '8px'}}>{new Date(folder.timestamp).toLocaleString('zh-CN', {
                                                        month: '2-digit',
                                                        day: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        hour12: false
                                                    })}</span>
                                                    <DeleteOutlined
                                                        style={{fontSize: '14px', color: '#666', cursor: 'pointer', transition: 'all 0.3s'}}
                                                        title="从列表中删除"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setConfig(removeFolderPath(config, folder.path))
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.transform = 'scale(1.6)';
                                                            e.currentTarget.style.color = '#ff4d4f';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.transform = 'scale(1)';
                                                            e.currentTarget.style.color = '#666';
                                                        }}
                                                    />
                                                </div>
                                            ),
                                            onClick: () => setConfig(updateFolderPath(config, folder.path))
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
                                {currentFolder ? truncateFolderName(currentFolder.split('/').pop() || '') : '选择文件夹'} <DownOutlined/>
                            </Button>
                        </Dropdown>
                    </div>
                    <div style={{flex: '1 3 auto', minWidth: 0}}>
                        <div className="one-line text-center">
                            {currentFile ? currentFile.split('/').pop() : ''}
                        </div>
                    </div>
                    <div style={{flex: '0 0 auto', paddingLeft: 16, paddingRight: 16, display: 'flex', alignItems: 'center', gap: 8}}>
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
                    </div>
                </Flex>
            )}
            <Splitter style={{height: titleBarVisible ? 'calc(100vh - 40px)' : '100vh'}}>
                <Splitter.Panel defaultSize={320} min={'10%'} max={'45%'} collapsible>
                    <Container style={{backgroundColor: "white"}}>
                        <FileTree/>
                    </Container>
                </Splitter.Panel>
                {/*panel 默认有个 padding 0 1，中间去掉，避免边缘一条白线。*/}
                <Splitter.Panel style={{padding: 0}}>
                    <Container style={{position: 'relative'}}>
                        {/* 正常显示文件内容 */}
                        {currentFile ? (
                            <FileViewer
                                filePath={currentFile}
                                fileName={currentFile.split('/').pop() || ''}
                            />
                        ) : (
                            <Center style={{color: 'gray'}}>
                                请在左侧选择一个文件以预览内容
                            </Center>
                        )}
                    </Container>
                </Splitter.Panel>
                <Splitter.Panel defaultSize={320} min={'10%'} max={'45%'} collapsible>
                    <Container>
                        <ToolWindowsPane/>
                    </Container>
                </Splitter.Panel>
            </Splitter>

            {/* 搜索抽屉 */}
            <Drawer
                title="搜索"
                placement="left"
                width="75%"
                open={searchPanelOpen}
                closable={false}
                maskClosable={true}
                onClose={() => setSearchPanelOpen(false)}
                styles={{
                    header: {
                        height: '40px',
                    },
                    title: {
                        paddingLeft: '72px',
                        textAlign: 'center',
                    }
                }}
            >
                <div style={{height: '100%'}}>
                    <GlobalSearch
                        onClose={() => setSearchPanelOpen(false)}
                    />
                </div>
            </Drawer>
        </>
    );
};

export const Home: React.FC = () => {
    return (
        <ConfigProvider
            theme={{
                components: {
                    Splitter: {
                        splitBarDraggableSize: 0,
                        splitBarSize: 4,
                    },
                },
            }}
        >
            <App>
                <AppProvider>
                    <AppContent/>
                </AppProvider>
            </App>
        </ConfigProvider>
    );
};