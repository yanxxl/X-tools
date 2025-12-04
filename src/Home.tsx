import React, {useEffect} from 'react';
import {App, ConfigProvider, Drawer, Splitter} from "antd";
import {FileViewer} from './components/viewers/FileViewer';
import {ToolWindowsPane} from './components/windows/ToolWindowsPane';
import {AppProvider, useAppContext} from './contexts/AppContext';
import {Container} from "./components/common/Container";
import {Center} from "./components/common/Center";
import {GlobalSearch} from './components/common/GlobalSearch';
import {FileTree} from './components/common/FileTree';
import {TitleBar} from './components/common/TitleBar';

const AppContent: React.FC = () => {
    const {currentFolder, currentFile, titleBarVisible, searchPanelOpen, setSearchPanelOpen} = useAppContext();

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

    // 当文件夹改变时关闭搜索面板
    useEffect(() => {
        if (currentFolder) {
            setSearchPanelOpen(false);
        }
    }, [currentFolder]);

    // 同步红绿灯显示状态与标题栏显示状态
    useEffect(() => {
        if (window.electronAPI?.setWindowButtonVisibility) {
            if (searchPanelOpen) {
                setTimeout(() => {
                    window.electronAPI.setWindowButtonVisibility(false);
                }, 500)
            } else {
                window.electronAPI.setWindowButtonVisibility(titleBarVisible);
            }
        }
    }, [titleBarVisible, searchPanelOpen]);

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
    }, []);

    return (
        <>
            <TitleBar/>
            <Splitter style={{height: titleBarVisible ? 'calc(100vh - 40px)' : '100vh'}}>
                <Splitter.Panel defaultSize={320} min={'10%'} max={'45%'} collapsible>
                    <FileTree/>
                </Splitter.Panel>
                <Splitter.Panel style={{padding: 0}}>
                    <Container style={{position: 'relative'}}>
                        {currentFile ? (
                            <FileViewer
                            filePath={currentFile}
                            fileName={currentFile.split(/[\\/]/).pop() || ''}
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
                    <AppContent/>
                </AppProvider>
            </App>
        </ConfigProvider>
    );
};