import React, { useEffect } from 'react';

// 第三方库
import { App, ConfigProvider, Drawer, Splitter } from "antd";

// 上下文
import { AppProvider, useAppContext } from './contexts/AppContext';

// 通用组件
import { Container } from "./components/common/Container";
import { Center } from "./components/common/Center";
import { GlobalSearch } from './components/common/GlobalSearch';
import { FileTree } from './components/common/FileTree';
import { TitleBar } from './components/common/TitleBar';

// 视图组件
import { FileViewer } from './components/viewers/FileViewer';
import { ToolWindowsPane } from './components/windows/ToolWindowsPane';
import { fullname } from './utils/fileCommonUtil';

// 常量定义
const WINDOW_SIZE_KEY = 'x-tools-window-size';

const AppContent: React.FC = () => {
    const { currentFile, titleBarVisible, searchPanelOpen, config, setSearchPanelOpen, setCurrentFolder, setConfig } = useAppContext();

    /**
     * 保存窗口大小到local storage
     * @param width - 窗口宽度
     * @param height - 窗口高度
     */
    const saveWindowSize = (width: number, height: number): void => {
        try {
            const windowSize = { width, height };
            localStorage.setItem(WINDOW_SIZE_KEY, JSON.stringify(windowSize));
        } catch (error) {
            console.error('保存窗口大小失败:', error);
        }
    };

    /**
     * 从local storage读取窗口大小
     * @returns 保存的窗口大小对象 {width, height}，如果没有保存则返回null
     */
    const getWindowSize = (): { width: number; height: number } | null => {
        try {
            const savedSize = localStorage.getItem(WINDOW_SIZE_KEY);
            return savedSize ? JSON.parse(savedSize) : null;
        } catch (error) {
            console.error('读取窗口大小失败:', error);
            return null;
        }
    };

    /**
     * 处理关闭搜索面板事件
     */
    const handleCloseSearchPanel = (): void => {
        setSearchPanelOpen(false);
    };

    // 窗口大小相关的副作用
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

        /**
         * 处理窗口大小变化事件
         */
        const handleResize = (): void => {
            if (window.innerWidth && window.innerHeight) {
                saveWindowSize(window.innerWidth, window.innerHeight);
            }
        };

        window.addEventListener('resize', handleResize);

        // 组件挂载时如果搜索面板打开，立即关闭
        if (searchPanelOpen) {
            setSearchPanelOpen(false);
        }

        // 加载配置文件
        window.electronAPI.loadConfig().then(async (loadedConfig) => {
            setConfig(loadedConfig);
        });

        // 组件卸载时移除监听器
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // 配置相关的副作用
    useEffect(() => {
        if (config) {
            try {
                window.electronAPI.getCurrentWindowFolder().then((folderPath) => {
                    if (folderPath) {
                        console.log('当前窗口文件夹:', folderPath);
                        setCurrentFolder(folderPath);
                    } else {
                        console.log('当前窗口没有文件夹');
                        if (config.recentFolders.length > 0) {
                            console.log('设置最近文件夹:', config.recentFolders[0].path);
                            setCurrentFolder(config.recentFolders[0].path);
                        } else {
                            console.log('没有最近文件夹');
                        }
                    }
                });
            } catch (error) {
                console.error('获取当前窗口文件夹失败:', error);
            }
        }
    }, [config]);

    // 窗口按钮显示状态相关的副作用
    useEffect(() => {
        if (window.electronAPI?.setWindowButtonVisibility) {
            if (searchPanelOpen) {
                setTimeout(() => {
                    window.electronAPI.setWindowButtonVisibility(false);
                }, 500);
            } else {
                window.electronAPI.setWindowButtonVisibility(titleBarVisible);
            }
        }
    }, [titleBarVisible, searchPanelOpen]);

    return (
        <>
            {/* 标题栏 */}
            <TitleBar />

            {/* 主分割器布局 */}
            <Splitter style={{ height: titleBarVisible ? 'calc(100vh - 40px)' : '100vh' }}>
                {/* 左侧文件树面板 */}
                <Splitter.Panel
                    defaultSize={320}
                    min={'10%'}
                    max={'45%'}
                    collapsible
                >
                    <FileTree />
                </Splitter.Panel>

                {/* 中间文件预览面板 */}
                <Splitter.Panel style={{ padding: 0 }}>
                    <Container style={{ position: 'relative' }}>
                        {currentFile ? (
                            <FileViewer
                                filePath={currentFile}
                                fileName={fullname(currentFile)}
                            />
                        ) : (
                            <Center style={{ color: 'gray' }}>
                                请在左侧选择一个文件以预览内容
                            </Center>
                        )}
                    </Container>
                </Splitter.Panel>

                {/* 右侧工具窗口面板 */}
                <Splitter.Panel
                    defaultSize={320}
                    min={'10%'}
                    max={'45%'}
                    collapsible
                >
                    <Container>
                        <ToolWindowsPane />
                    </Container>
                </Splitter.Panel>
            </Splitter>

            {/* 全局搜索抽屉 */}
            <Drawer
                title="搜索"
                placement="left"
                width="75%"
                open={searchPanelOpen}
                closable={false}
                maskClosable={true}
                onClose={handleCloseSearchPanel}
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
                <div style={{ height: '100%' }}>
                    <GlobalSearch
                        onClose={handleCloseSearchPanel}
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
                token: {
                    // Seed Token，影响范围大
                    // colorPrimary: '#00b96b',
                    // borderRadius: 2,

                    // 派生变量，影响范围小
                    // colorBgContainer: 'transparent',
                },
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
                    <AppContent />
                </AppProvider>
            </App>
        </ConfigProvider>
    );
};