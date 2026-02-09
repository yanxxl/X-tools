import React, {useEffect, useRef, useState} from 'react';
import {Button, Empty, Skeleton, Space} from 'antd';
import {FileTextOutlined, ReloadOutlined} from '@ant-design/icons';
import {Center} from "../common/Center";
import PageSearch from "../common/PageSearch";
import Speaker from "../common/Speaker";
import {FontSizeAdjuster} from "../common/FontSizeAdjuster";
import {isOfficeParserSupported} from "../../utils/fileCommonUtil";
import { EditableFilePath } from '../common/EditableFilePath';
import { useAppContext } from '../../contexts/AppContext';

interface TextViewerProps {
    filePath: string;
    fileName: string;
}

export const TextViewer: React.FC<TextViewerProps> = ({filePath, fileName}) => {
    const { setCurrentFile } = useAppContext();
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState('');
    const [error, setError] = useState<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const loadTextFile = async () => {
        try {
            setLoading(true);
            setError(null);

            if (window.electronAPI) {
                // 如果是 officeparser 支持的文件格式，使用专门的 API 读取文本内容
                if (isOfficeParserSupported(fileName)) {
                    const fileContent = await window.electronAPI.parseOfficeText(filePath);
                    setContent(fileContent);
                } else {
                    // 普通文本文件使用常规读取方式
                    const fileContent = await window.electronAPI.readFile(filePath);
                    setContent(fileContent);
                }
            } else {
                // 浏览器环境下的模拟
                const response = await fetch(filePath);
                if (response.ok) {
                    const fileContent = await response.text();
                    setContent(fileContent);
                } else {
                    throw new Error(`无法加载文件: ${response.statusText}`);
                }
            }
        } catch (err) {
            console.error('加载文本文件失败:', err);
            setError(err instanceof Error ? err.message : '加载文件失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTextFile();
    }, [filePath]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const scrollTop = container.scrollTop;
            const scrollKey = `textviewer-scroll-${filePath}`;
            // console.log('保存滚动位置:', scrollKey, scrollTop);
            localStorage.setItem(scrollKey, scrollTop.toString());
        };

        container.addEventListener('scroll', handleScroll);

        return () => {
            container.removeEventListener('scroll', handleScroll);
        };
    }, [filePath, loading]);

    useEffect(() => {
        if (!loading && scrollContainerRef.current) {
            const scrollKey = `textviewer-scroll-${filePath}`;
            const savedScrollTop = localStorage.getItem(scrollKey);
            // console.log('读取滚动位置:', scrollKey, savedScrollTop);
            if (savedScrollTop) {
                setTimeout(() => {
                    if (scrollContainerRef.current) {
                        // console.log('恢复滚动位置:', savedScrollTop);
                        scrollContainerRef.current.scrollTop = parseInt(savedScrollTop, 10);
                    }
                }, 500);
            }
        }
    }, [loading, filePath]);

    if (loading) {
        return (
            <div style={{padding: 24}}>
                <Skeleton active paragraph={{rows: 3}}/>
            </div>
        );
    }

    if (error) {
        return (
            <Center>
                <Empty
                    description={error}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                    <Button
                        type="primary"
                        icon={<ReloadOutlined/>}
                        onClick={loadTextFile}
                    >
                        重新加载
                    </Button>
                </Empty>
            </Center>
        );
    }

    return (
        <div style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
            <div style={{
                padding: '8px 16px',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fafafa'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8,flex: '1',marginRight: 16 }}>
                    <FileTextOutlined />
                    <EditableFilePath path={filePath} onRename={setCurrentFile} />
                </div>

                <Space size="large">
                    <PageSearch cssSelector={'.text-content'}/>
                    <Speaker cssSelector={'.text-content'}/>
                    <FontSizeAdjuster/>
                </Space>
            </div>

            <div style={{flex: 1, overflow: 'auto', padding: '32px', backgroundColor: 'white'}} className={'text-content'} ref={scrollContainerRef}>
                {/* 将文本内容按行分割并转换为HTML段落 */}
                {content.split('\n').map((line, index) => (
                    <div
                        key={index}
                        id={`line-${index}`}
                    >
                        {line || '\u00A0' /* 用不间断空格显示空行 */}
                    </div>
                ))}
            </div>
        </div>
    );
};