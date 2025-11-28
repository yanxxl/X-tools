import React, {useEffect, useState} from 'react';
import {Button, Empty, Space, Spin, Typography} from 'antd';
import {FileTextOutlined, ReloadOutlined} from '@ant-design/icons';
import {Center} from "../common/Center";
import PageSearch from "../common/PageSearch";
import TextToSpeech from "../common/TextToSpeech";
import {FontSizeAdjuster} from "../common/FontSizeAdjuster";

interface TextViewerProps {
    filePath: string;
    fileName: string;
}

export const TextViewer: React.FC<TextViewerProps> = ({filePath, fileName}) => {
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState('');
    const [error, setError] = useState<string | null>(null);

    const loadTextFile = async () => {
        try {
            setLoading(true);
            setError(null);

            if (window.electronAPI) {
                const fileContent = await window.electronAPI.readFile(filePath);
                setContent(fileContent);
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

    if (loading) {
        return (
            <Center>
                <Spin size="large"/>
                <div style={{marginTop: 16}}>正在加载文本文件...</div>
            </Center>
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
                <Space>
                    <FileTextOutlined/>
                    <Typography.Title level={5} style={{margin: 0}}>{fileName}</Typography.Title>
                </Space>

                <Space size="large">
                    <PageSearch cssSelector={'.markdown-source'}/>
                    <TextToSpeech cssSelector={'.markdown-source'}/>
                    <FontSizeAdjuster/>
                </Space>
            </div>

            <div style={{flex: 1, overflow: 'auto', padding: '32px', backgroundColor: 'white'}} className={'markdown-source'}>
                <pre>
                    {content}
                </pre>
            </div>
        </div>
    );
};