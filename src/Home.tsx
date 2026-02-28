import React, { useEffect, useState } from 'react';

// 第三方库
import { App, ConfigProvider, Drawer, Splitter } from "antd";
import zhCN from 'antd/locale/zh_CN';

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
import { basename } from './utils/fileCommonUtil';

// 通用组件
import { WindowSizeManager } from './components/common/WindowSizeManager';

const AppContent: React.FC = () => {
    // 1. 上下文获取
    const {
        currentFile, 
        titleBarVisible, 
        searchPanelOpen, 
        setSearchPanelOpen,
        leftPanelVisible, 
        setLeftPanelVisible, 
        rightPanelVisible, 
        setRightPanelVisible
    } = useAppContext();

    // 2. 组件状态
    const [sizes, setSizes] = useState<number[]>([320, undefined, 320]);
    const [drawerWidth, setDrawerWidth] = useState<number|string>('75%');



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
    // 组件挂载时如果搜索面板打开，立即关闭
    useEffect(() => {
        if (searchPanelOpen) {
            setSearchPanelOpen(false);
        }
    }, []);

    // 面板可见性相关的副作用
    useEffect(() => {
        if (leftPanelVisible && sizes[0] === 0) setSizes([320, undefined, sizes[2]]);
        if (!leftPanelVisible && sizes[0] !== 0) setSizes([0, undefined, sizes[2]]);
        if (rightPanelVisible && sizes[2] === 0) setSizes([sizes[0], undefined, 320]);
        if (!rightPanelVisible && sizes[2] !== 0) setSizes([sizes[0], undefined, 0]);
        if (!leftPanelVisible && !rightPanelVisible) setSizes([0, undefined, 0]);
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
            {/* 窗口大小管理 */}
            <WindowSizeManager />
            {/* 标题栏 */}
            <TitleBar />

            <Splitter style={{height: titleBarVisible ? 'calc(100vh - 40px)' : '100vh'}} onResize={handleSplitterChange}>
                <Splitter.Panel 
                    min={99} 
                    max={'45%'} 
                    size={sizes[0]}
                    style={{ display: leftPanelVisible ? 'block' : 'none' }}
                >
                    <FileTree/>
                </Splitter.Panel>
                <Splitter.Panel style={{padding: 0}} size={sizes[1]}>
                    <Container style={{position: 'relative'}}>
                        {currentFile ? (
                            <FileViewer
                                filePath={currentFile}
                                fileName={basename(currentFile)}
                            />
                        ) : (
                            <Center style={{color: 'gray'}}>
                                请在左侧选择一个文件以预览内容
                            </Center>
                        )}
                    </Container>
                </Splitter.Panel>
                <Splitter.Panel 
                    min={99} 
                    max={'45%'} 
                    size={sizes[2]}
                    style={{ display: rightPanelVisible ? 'block' : 'none' }}
                >
                    <Container>
                        <ToolWindowsPane/>
                    </Container>
                </Splitter.Panel>
            </Splitter>

            {/* 全局搜索抽屉 */}
            <Drawer
                className="no-drag"
                title="搜索"
                placement="left"
                size={drawerWidth}
                open={searchPanelOpen} 
                closable={{ placement: 'end' }}
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
                resizable={{onResize: (newSize) => setDrawerWidth(newSize)}}
            >
                <div style={{ height: '100%' }}>
                    <GlobalSearch/>
                </div>
            </Drawer>
        </>
    );
};

export const Home: React.FC = () => {
    return (
        <ConfigProvider
            locale={zhCN}
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