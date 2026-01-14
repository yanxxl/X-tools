import { Dictionary, DictionaryEntry, parseMarkdownToDictionary } from './dictionaryParser';
import { saveDictionariesToStorage, loadDictionariesFromStorage } from './storageUtils';

/**
 * 词典管理器接口
 */
export interface DictionaryManager {
    dictionaries: Map<string, Dictionary>;
    addDictionary: (filePath: string) => Promise<void>;
    removeDictionary: (dictionaryId: string) => void;
    toggleDictionaryEnabled: (dictionaryId: string) => void;
    moveDictionaryUp: (dictionaryId: string) => void;
    moveDictionaryDown: (dictionaryId: string) => void;
    search: (term: string) => DictionaryEntry[];
    getEnabledDictionaries: () => Dictionary[];
    loadFromStorage: (force?: boolean) => Promise<void>;
    saveToStorage: () => void;
    // 添加事件监听方法
    on: (event: 'change', callback: () => void) => void;
    off: (event: 'change', callback: () => void) => void;
}

/**
 * 创建词典管理器
 * @returns 词典管理器实例
 */
export function createDictionaryManager(): DictionaryManager {
    const dictionaries: Map<string, Dictionary> = new Map();
    const listeners: Map<string, Set<() => void>> = new Map();

    // 触发事件
    const emit = (event: string) => {
        const eventListeners = listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach(listener => listener());
        }
    };

    /**
     * 从本地存储加载词典
     * @param force 是否强制重新加载（默认：false）
     */
    const loadFromStorage = async (force = false): Promise<void> => {
        // 如果已经有词典数据且不强制刷新，直接返回，避免重复加载和解析
        if (dictionaries.size > 0 && !force) {
            return;
        }
        
        const savedDictionaries = loadDictionariesFromStorage();

        // 如果是强制刷新，先清空当前词典列表
        if (force) {
            dictionaries.clear();
        }

        // 重新加载所有词典
        for (const savedDict of savedDictionaries) {
            // 如果不是强制刷新且词典已存在，跳过
            if (!force && dictionaries.has(savedDict.filePath)) {
                continue;
            }
            
            try {
                const dictionary = await parseMarkdownToDictionary(savedDict.filePath);
                // 恢复保存的启用状态
                dictionary.enabled = savedDict.enabled;
                // 使用Map的插入顺序保持原始顺序
                dictionaries.set(savedDict.filePath, dictionary);
            } catch (error) {
                console.error(`加载词典失败: ${savedDict.filePath}`, error);
                // 创建一个带有错误信息的词典对象
                const errorDictionary: Dictionary = {
                    id: savedDict.filePath,
                    name: savedDict.name || savedDict.filePath.split('/').pop() || savedDict.filePath,
                    filePath: savedDict.filePath,
                    entries: [],
                    enabled: savedDict.enabled,
                    error: error instanceof Error ? error.message : '未知错误'
                };
                // 将带有错误信息的词典添加到列表中
                dictionaries.set(savedDict.filePath, errorDictionary);
            }
        }

        // 触发change事件
        emit('change');
    };

    /**
     * 保存词典到本地存储
     */
    const saveToStorage = (): void => {
        // 保存词典的基本信息（不包含entries，因为可能很大）
        const dictionariesToSave = Array.from(dictionaries.values()).map(dict => ({
            id: dict.id,
            name: dict.name,
            filePath: dict.filePath,
            enabled: dict.enabled
        }));

        saveDictionariesToStorage(dictionariesToSave);
    };

    /**
     * 添加词典
     * @param filePath 词典文件路径
     */
    const addDictionary = async (filePath: string): Promise<void> => {
        // 检查词典是否已存在
        if (dictionaries.has(filePath)) {
            return;
        }

        try {
            const dictionary = await parseMarkdownToDictionary(filePath);
            dictionaries.set(filePath, dictionary);
        } catch (error) {
            console.error(`添加词典失败: ${filePath}`, error);
            // 创建一个带有错误信息的词典对象
            const errorDictionary: Dictionary = {
                id: filePath,
                name: filePath.split('/').pop() || filePath,
                filePath,
                entries: [],
                enabled: true,
                error: error instanceof Error ? error.message : '未知错误'
            };
            // 将带有错误信息的词典添加到列表中
            dictionaries.set(filePath, errorDictionary);
        }

        // 保存到本地存储
        saveToStorage();

        // 触发change事件
        emit('change');
    };

    /**
     * 移除词典
     * @param dictionaryId 词典ID
     */
    const removeDictionary = (dictionaryId: string): void => {
        if (dictionaries.delete(dictionaryId)) {
            // 保存到本地存储
            saveToStorage();

            // 触发change事件
            emit('change');
        }
    };

    /**
     * 切换词典启用状态
     * @param dictionaryId 词典ID
     */
    const toggleDictionaryEnabled = (dictionaryId: string): void => {
        const dictionary = dictionaries.get(dictionaryId);
        if (dictionary) {
            dictionary.enabled = !dictionary.enabled;
            // 更新Map中的值
            dictionaries.set(dictionaryId, dictionary);

            // 保存到本地存储
            saveToStorage();

            // 触发change事件
            emit('change');
        }
    };

    /**
     * 将词典上移一位
     * @param dictionaryId 词典ID
     */
    const moveDictionaryUp = (dictionaryId: string): void => {
        const entries = Array.from(dictionaries.entries());
        const index = entries.findIndex(([id]) => id === dictionaryId);

        if (index > 0) {
            // 交换位置
            [entries[index], entries[index - 1]] = [entries[index - 1], entries[index]];

            // 创建新的Map，保持新的顺序
            dictionaries.clear();
            entries.forEach(([id, dictionary]) => {
                dictionaries.set(id, dictionary);
            });

            // 保存到本地存储
            saveToStorage();

            // 触发change事件
            emit('change');
        }
    };

    /**
     * 将词典下移一位
     * @param dictionaryId 词典ID
     */
    const moveDictionaryDown = (dictionaryId: string): void => {
        const entries = Array.from(dictionaries.entries());
        const index = entries.findIndex(([id]) => id === dictionaryId);

        if (index < entries.length - 1) {
            // 交换位置
            [entries[index], entries[index + 1]] = [entries[index + 1], entries[index]];

            // 创建新的Map，保持新的顺序
            dictionaries.clear();
            entries.forEach(([id, dictionary]) => {
                dictionaries.set(id, dictionary);
            });

            // 保存到本地存储
            saveToStorage();

            // 触发change事件
            emit('change');
        }
    };

    /**
     * 判断搜索词是否为英文（不包含中文）
     * @param term 搜索词
     * @returns 是否为英文
     */
    const isEnglishSearchTerm = (term: string): boolean => {
        // 如果不包含中文，就算英文
        return !/[\u4e00-\u9fa5]/.test(term);
    };

    /**
     * 搜索所有启用的词典
     * @param term 搜索词
     * @returns 匹配的词条数组
     */
    const search = (term: string): DictionaryEntry[] => {
        if (!term.trim()) {
            return [];
        }

        const enabledDictionaries = getEnabledDictionaries();
        const results: DictionaryEntry[] = [];

        const searchTerm = term.toLowerCase().trim();
        const isEnglish = isEnglishSearchTerm(term);

        // 首先查找完全匹配的词条（term或terms中的任何一个）
        enabledDictionaries.forEach(dictionary => {
            const exactMatches = dictionary.entries.filter(entry =>
                entry.term.toLowerCase() === searchTerm ||
                entry.terms.some(t => t.toLowerCase() === searchTerm)
            );
            results.push(...exactMatches);
        });

        // 如果没有完全匹配的结果，再查找包含搜索词的词条（term或terms中的任何一个）
        if (results.length === 0) {
            enabledDictionaries.forEach(dictionary => {
                const partialMatches = dictionary.entries.filter(entry =>
                    entry.term.toLowerCase().includes(searchTerm) ||
                    entry.terms.some(t => t.toLowerCase().includes(searchTerm))
                );
                results.push(...partialMatches);
            });
        }

        // 如果没有包含词的，根据语言类型应用不同的匹配规则
        if (results.length === 0) {
            enabledDictionaries.forEach(dictionary => {
                let matchingEntries;
                
                if (isEnglish) {
                    // 英文搜索：搜索词包含词条的全词匹配
                    matchingEntries = dictionary.entries.filter(entry => {
                        const entryTerm = entry.term.toLowerCase().trim();
                        const wordBoundary = new RegExp(`\\b${entryTerm}\\b`, 'i');
                        return wordBoundary.test(searchTerm) ||
                               entry.terms.some(t => {
                                   const term = t.toLowerCase().trim();
                                   const wordBoundary = new RegExp(`\\b${term}\\b`, 'i');
                                   return wordBoundary.test(searchTerm);
                               });
                    });
                } else {
                    // 中文搜索：搜索词包含词条的包含匹配
                    matchingEntries = dictionary.entries.filter(entry =>
                        searchTerm.includes(entry.term.toLowerCase().trim()) ||
                        entry.terms.some(t => searchTerm.includes(t.toLowerCase().trim()))
                    );
                }
                
                results.push(...matchingEntries);
            });
        }

        return results;
    };

    /**
     * 获取所有启用的词典
     * @returns 启用的词典数组
     */
    const getEnabledDictionaries = (): Dictionary[] => {
        return Array.from(dictionaries.values()).filter(dict => dict.enabled);
    };

    // 实现事件监听方法
    const on = (event: 'change', callback: () => void) => {
        if (!listeners.has(event)) {
            listeners.set(event, new Set());
        }
        listeners.get(event)?.add(callback);
    };

    const off = (event: 'change', callback: () => void) => {
        const eventListeners = listeners.get(event);
        if (eventListeners) {
            eventListeners.delete(callback);
        }
    };

    return {
        dictionaries,
        addDictionary,
        removeDictionary,
        toggleDictionaryEnabled,
        moveDictionaryUp,
        moveDictionaryDown,
        search,
        getEnabledDictionaries,
        loadFromStorage,
        saveToStorage,
        on,
        off
    };
}
