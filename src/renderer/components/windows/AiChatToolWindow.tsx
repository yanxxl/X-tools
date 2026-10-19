// React hooks
import React, { useEffect, useRef, useState } from 'react';

// Ant Design components
import { Button, Card, Input, Modal, Select, Space, Tooltip, Typography, message } from 'antd';

// Ant Design icons
import {
    DeleteOutlined,
    MessageOutlined,
    PlusOutlined,
    ReloadOutlined,
    SettingOutlined,
} from '@ant-design/icons';

// Drag & Drop
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable, isSortable } from '@dnd-kit/react/sortable';

// Project components
import { ToolWindow } from './toolWindow';
import { storage, STORAGE_KEYS } from '../../utils/storage';

// =========================================================================
// AI Chat Provider Definitions
// =========================================================================
interface AiChatProvider {
    id: string;
    name: string;
    url: string;
}

const { Text } = Typography;

/**
 * 默认 providers 列表（作为重置基准）。
 * 用户配置（排序、增删）保存在 localStorage 中。
 */
const DEFAULT_PROVIDERS: AiChatProvider[] = [
    { id: 'deepseek', name: 'Deepseek', url: 'https://chat.deepseek.com/' },
    { id: 'zhipu', name: '智谱清言', url: 'https://chatglm.cn/' },
    { id: 'kimi', name: 'Kimi', url: 'https://kimi.moonshot.cn/' },
    { id: 'doubao', name: '豆包', url: 'https://www.doubao.com/chat/' },
    { id: 'yuanbao', name: '元宝', url: 'https://yuanbao.tencent.com/chat/' },
    { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/' },
    { id: 'claude', name: 'Claude', url: 'https://claude.ai/' },
    { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/' },
];

// 桌面 Chrome User-Agent，避免 AI 网站将 webview 环境判定为异常。
// 根据当前操作系统生成对应 UA，确保跨平台一致行为。
function getChromeUserAgent(): string {
    // userAgentData 优先（Chrome 90+），回退到 platform
    const nav = navigator as any;
    const plat = (nav.userAgentData?.platform ?? nav.platform).toLowerCase();
    if (plat.includes('win')) {
        return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
    }
    if (plat.includes('linux')) {
        return 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
    }
    return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
}

// 按 provider id 缓存 webview 元素，切换后复用保留会话
const cachedWebviews = new Map<string, any>();

// 加载 / 保存 providers 配置
function loadProviders(): AiChatProvider[] {
    return storage.get<AiChatProvider[]>(STORAGE_KEYS.AI_CHAT_CONFIG, DEFAULT_PROVIDERS);
}

function saveProviders(providers: AiChatProvider[]) {
    storage.set(STORAGE_KEYS.AI_CHAT_CONFIG, providers);
}

// =========================================================================
// Sortable Provider Item
// =========================================================================
interface SortableProviderItemProps {
    provider: AiChatProvider;
    index: number;
    onDelete: (id: string) => void;
}

const SortableProviderItem: React.FC<SortableProviderItemProps> = ({ provider, index, onDelete }) => {
    const { ref, handleRef, isDragSource } = useSortable({
        id: provider.id,
        index,
        type: 'provider',
        accept: 'provider',
    });

    return (
        <div
            ref={ref}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 4,
                background: isDragSource ? '#e6f4ff' : index % 2 === 0 ? '#fafafa' : '#fff',
                opacity: isDragSource ? 0.6 : 1,
                transition: 'background 0.2s',
            }}
        >
            {/* 拖拽手柄 */}
            <span
                ref={handleRef}
                style={{
                    cursor: 'grab',
                    userSelect: 'none',
                    color: '#bbb',
                    fontSize: 16,
                    lineHeight: 1,
                    padding: '0 2px',
                }}
            >
                ⠿
            </span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <Text strong>{provider.name}</Text>
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                    {provider.url}
                </Text>
            </span>
            <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => onDelete(provider.id)}
            />
        </div>
    );
};

// =========================================================================
// Configuration Modal Component
// =========================================================================
interface ConfigModalProps {
    open: boolean;
    providers: AiChatProvider[];
    onClose: () => void;
    onSave: (providers: AiChatProvider[]) => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ open, providers, onClose, onSave }) => {
    const [editList, setEditList] = useState<AiChatProvider[]>(providers);
    const [newName, setNewName] = useState('');
    const [newUrl, setNewUrl] = useState('');

    // 同步外部 providers 变化
    useEffect(() => {
        setEditList(providers);
    }, [providers, open]);

    // 所有操作立即保存，不再需要保存/取消按钮

    const handleDelete = (id: string) => {
        const next = editList.filter(p => p.id !== id);
        setEditList(next);
        onSave(next);
    };

    const handleAdd = () => {
        const name = newName.trim();
        const url = newUrl.trim();
        if (!name || !url) {
            message.warning('请输入名称和网址');
            return;
        }
        if (!url.startsWith('https://') && !url.startsWith('http://')) {
            message.warning('网址必须以 http:// 或 https:// 开头');
            return;
        }
        const id = `custom-${Date.now()}`;
        const newList = [...editList, { id, name, url }];
        setEditList(newList);
        onSave(newList);
        setNewName('');
        setNewUrl('');
    };

    const handleReset = () => {
        setEditList(DEFAULT_PROVIDERS);
        onSave(DEFAULT_PROVIDERS);
        message.success('已重置为默认列表');
    };

    return (
        <Modal
            title="AI Chat 配置"
            open={open}
            onCancel={onClose}
            width={480}
            footer={null}
        >
            <Space orientation="vertical" style={{ width: '100%' }}>
                {/* 可拖放排序的服务列表 */}
                <DragDropProvider
                    onDragEnd={(event) => {
                        if (event.canceled) return;
                        const { source } = event.operation;
                        if (isSortable(source)) {
                            const { initialIndex, index } = source;
                            if (initialIndex !== index) {
                                const newItems = [...editList];
                                const [removed] = newItems.splice(initialIndex, 1);
                                newItems.splice(index, 0, removed);
                                setEditList(newItems);
                                onSave(newItems);
                            }
                        }
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {editList.map((p, index) => (
                            <SortableProviderItem
                                key={p.id}
                                provider={p}
                                index={index}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                </DragDropProvider>

                {/* 新增表单 */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 0',
                        borderTop: '1px solid #f0f0f0',
                    }}
                >
                    <Input
                        size="small"
                        placeholder="名称"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        style={{ width: 120 }}
                    />
                    <Input
                        size="small"
                        placeholder="网址 (https://...)"
                        value={newUrl}
                        onChange={e => setNewUrl(e.target.value)}
                        style={{ flex: 1 }}
                    />
                    <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={handleAdd}
                    >
                        添加
                    </Button>
                </div>

                {/* 重置按钮 */}
                <Button size="small" onClick={handleReset}>
                    恢复默认列表
                </Button>
            </Space>
        </Modal>
    );
};

// =========================================================================
// Panel Component
// =========================================================================
const AiChatPanel: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [providers, setProviders] = useState<AiChatProvider[]>(loadProviders);
    const [configOpen, setConfigOpen] = useState(false);
    const [currentProviderId, setCurrentProviderId] = useState<string>(() => {
        const saved = storage.get<string>(STORAGE_KEYS.AI_CHAT_PROVIDER, '');
        // 若保存的 id 不在当前列表中，回退到第一个
        const list = loadProviders();
        return list.some(p => p.id === saved) ? saved : list[0]?.id ?? '';
    });

    const currentProvider = providers.find(p => p.id === currentProviderId) ?? providers[0];

    // 挂载 / 切换 provider — 从缓存取或创建 webview
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !currentProvider) return;

        let webview = cachedWebviews.get(currentProviderId);

        if (!webview) {
            webview = document.createElement('webview');
            webview.src = currentProvider.url;
            webview.setAttribute('partition', `persist:ai-${currentProvider.id}`);
            webview.setAttribute('useragent', getChromeUserAgent());
            webview.setAttribute('allowpopups', '');
            webview.style.width = '100%';
            webview.style.height = '100%';
            webview.style.border = 'none';

            webview.addEventListener('did-fail-load', (e: any) => {
                console.error('AI Chat 加载失败:', e?.errorDescription || e);
                message.error(`${currentProvider.name} 页面加载失败，请检查网络连接`);
            });

            cachedWebviews.set(currentProviderId, webview);
        }

        container.appendChild(webview);

        return () => {
            if (webview.parentNode) {
                webview.parentNode.removeChild(webview);
            }
        };
    }, [currentProviderId, currentProvider]);

    const handleReload = () => {
        const webview = cachedWebviews.get(currentProviderId);
        webview?.reload();
    };

    const handleProviderChange = (id: string) => {
        setCurrentProviderId(id);
        storage.set(STORAGE_KEYS.AI_CHAT_PROVIDER, id);
    };

    const handleSaveConfig = (newProviders: AiChatProvider[]) => {
        saveProviders(newProviders);
        setProviders(newProviders);

        // 若当前选中的 provider 被删了，自动切到第一个
        if (!newProviders.some(p => p.id === currentProviderId)) {
            const firstId = newProviders[0]?.id ?? '';
            setCurrentProviderId(firstId);
            storage.set(STORAGE_KEYS.AI_CHAT_PROVIDER, firstId);
        }
    };

    return (
        <>
            <Card
                styles={{
                    root: { margin: 0, overflow: 'hidden', borderRadius: 0, height: '100%', display: 'flex', flexDirection: 'column' },
                    body: { flex: 1, overflow: 'hidden', padding: 0 }
                }}
                size="small"
                title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <Select
                            size="small"
                            value={currentProviderId}
                            onChange={handleProviderChange}
                            style={{ minWidth: 100 }}
                            options={providers.map(p => ({ value: p.id, label: p.name }))}
                            popupMatchSelectWidth={false}
                        />
                        <Space size={0}>
                            <Tooltip title="刷新页面">
                                <Button
                                    type="text"
                                    icon={<ReloadOutlined />}
                                    onClick={handleReload}
                                    size="small"
                                />
                            </Tooltip>
                            <Tooltip title="配置服务">
                                <Button
                                    type="text"
                                    icon={<SettingOutlined />}
                                    onClick={() => setConfigOpen(true)}
                                    size="small"
                                />
                            </Tooltip>
                        </Space>
                    </div>
                }
            >
                <div ref={containerRef} style={{ width: '100%', height: '100%', margin: 2 }} />
            </Card>

            <ConfigModal
                open={configOpen}
                providers={providers}
                onClose={() => setConfigOpen(false)}
                onSave={handleSaveConfig}
            />
        </>
    );
};

// =========================================================================
// Tool Window Export
// =========================================================================
export const aiChatToolWindow = new ToolWindow({
    id: 'ai-chat-tool-window',
    name: 'AI Chat',
    description: '通用 AI 聊天工具，支持切换不同的在线 AI 对话服务',
    isVisible: false,
    view: <AiChatPanel />,
    icon: <MessageOutlined style={{ fontSize: 16 }} />,
    isResizable: true,
    defaultWidth: 500,
    defaultHeight: 600
});
