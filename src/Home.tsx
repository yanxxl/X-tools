import React, { useEffect, useState } from 'react';

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

// 工具函数
import { fullname } from './utils/fileCommonUtil';

// 常量定义
const WINDOW_SIZE_KEY = 'x-tools-window-size';

const AppContent: React.FC = () => {
    // 1. 上下文获取
    const {
        setCurrentFolder, 
        currentFile, 
        titleBarVisible, 
        searchPanelOpen, 
        setSearchPanelOpen,
        config,
        setConfig, 
        leftPanelVisible, 
        setLeftPanelVisible, 
        rightPanelVisible, 
        setRightPanelVisible
    } = useAppContext();

    // 2. 组件状态
    const [sizes, setSizes] = useState<number[]>([320, undefined, 320]);

    // 3. 辅助函数
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

    // 4. 事件处理函数
    /**
     * 处理关闭搜索面板事件
     */
    const handleCloseSearchPanel = (): void => {
        setSearchPanelOpen(false);
    };

    /**
     * 处理面板大小变化事件
     */
    const handleSplitterChange = (sizes: number[]) => {
        console.log('面板大小变化:', sizes);

        setSizes(sizes);

        // 当面板大小达到最小值时自动隐藏
        if (0 < sizes[0] && sizes[0] < 150) {
            setSizes([0, undefined, sizes[2]]);
            setLeftPanelVisible(false);
        } else {
            setLeftPanelVisible(true);
        }

        if (0 < sizes[2] && sizes[2] < 150) {
            setSizes([sizes[0], undefined, 0]);
            setRightPanelVisible(false);
        } else {
            setRightPanelVisible(true);
        }
    };

    // 5. 副作用
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

    // 面板可见性相关的副作用
    useEffect(() => {
        if (leftPanelVisible && sizes[0] === 0) setSizes([320, undefined, sizes[2]]);
        if (!leftPanelVisible && sizes[0] !== 0) setSizes([0, undefined, sizes[2]]);
        if (rightPanelVisible && sizes[2] === 0) setSizes([sizes[0], undefined, 320]);
        if (!rightPanelVisible && sizes[2] !== 0) setSizes([sizes[0], undefined, 0]);
    }, [leftPanelVisible, rightPanelVisible]);

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

    // 6. 渲染
    return (
        <>
            {/* 标题栏 */}
            <TitleBar />

            <Splitter style={{height: titleBarVisible ? 'calc(100vh - 40px)' : '100vh'}} onResize={handleSplitterChange}>
                <Splitter.Panel min={99} max={'45%'} size={sizes[0]}>
                    <FileTree/>
                </Splitter.Panel>
                <Splitter.Panel style={{padding: 0}} size={sizes[1]}>
                    <Container style={{position: 'relative'}}>
                        {currentFile ? (
                            <FileViewer
                                filePath={currentFile}
                                fileName={fullname(currentFile)}
                            />
                        ) : (
                            <Center style={{color: 'gray'}}>
                                请在左侧选择一个文件以预览内容
                            </Center>
                        )}
                    </Container>
                </Splitter.Panel>
                <Splitter.Panel min={99} max={'45%'} size={sizes[2]}>
                    <Container>
                        <ToolWindowsPane/>
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