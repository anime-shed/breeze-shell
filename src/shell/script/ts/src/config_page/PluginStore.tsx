import * as shell from "mshell";
import { Button, Text } from "./components";
import { UpdateDataContext, NotificationContext, PluginSourceContext } from "./contexts";
import { useTranslation, useTextTruncation } from "./utils";
import { useVirtualScroll } from "./useVirtualScroll";
import { PLUGIN_SOURCES } from "./constants";
import { memo, useContext, useEffect, useState, useRef, useCallback } from "react";

type PluginStatus = {
    installed: boolean;
    installPath: string | null;
    localVersion: string;
    hasUpdate: boolean;
};

type PluginDefinition = {
    name: string;
};

// Task 3.1.3: Virtual scrolling item component
const PluginVirtualItem = memo(({
    plugin,
    index,
    itemHeight,
    onClick
}: {
    plugin: any;
    index: number;
    itemHeight: number;
    onClick: (plugin: any, index: number) => void;
}) => {
    const { t } = useTranslation();
    const status = plugin;
    // Call hook at top level - this is correct
    const truncatedName = useTextTruncation(plugin.name, 300);

    return (
        <flex
            height={itemHeight}
            alignItems="stretch"
            gap={10}
            padding={12}
            backgroundColor={index % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent'}
            onClick={() => onClick(plugin, index)}
        >
            <flex gap={10} alignItems="stretch">
                <Text fontSize={18} maxWidth={300}>
                    {truncatedName}
                </Text>
                <Text>{plugin.description}</Text>
            </flex>
            <flex gap={10} alignItems="center" flexShrink={0}>
                <Button onClick={() => onClick(plugin, index)}>
                    <Text>{
                        status.installed ?
                            (status.hasUpdate ? t("plugins.update", { from: status.localVersion, to: plugin.version }) : t('plugins.installed')) :
                            t('plugins.install')
                    }</Text>
                </Button>
            </flex>
        </flex>
    );
});

// New component for traditional rendering (non-virtual scroll)
const PluginListItem = memo(({
    plugin,
    installingPlugins,
    onInstall
}: {
    plugin: any;
    installingPlugins: Set<string>;
    onInstall: (plugin: any) => void;
}) => {
    const { t } = useTranslation();
    const { installed, localVersion: local_version, hasUpdate: have_update } = plugin;
    // Call hook at top level - this is correct
    const truncatedName = useTextTruncation(plugin.name, 300);

    return (
        <flex key={plugin.name} horizontal alignItems="center">
            <flex autoSize={false} width={4} height={20} borderRadius={2} backgroundColor={
                installed ? (have_update ? '#FFA500' : '#2979FF') : (shell.breeze.is_light_theme() ? '#C0C0C0aa' : '#505050aa')
            } />
            <flex gap={10} padding={10} borderRadius={8}
                flexGrow={1} horizontal>
                <flex gap={10} alignItems="stretch" flexGrow={1}>
                    <Text fontSize={18} maxWidth={300}>{truncatedName}</Text>
                    <Text>{plugin.description}</Text>
                </flex>
                <flex gap={10} alignItems="center" flexShrink={0}>
                    <Button onClick={() => onInstall(plugin)}>
                        <Text>{installingPlugins.has(plugin.name) ? t("plugins.installing") : (installed ? (have_update ? t("plugins.update", { from: local_version, to: plugin.version }) : t('plugins.installed')) : t('plugins.install'))}</Text>
                    </Button>
                </flex>
            </flex>
        </flex>
    );
});

// Task 3.2.1: Add bounded plugin status cache with size limits
const CACHE_SIZE_LIMIT = 100; // Maximum cached plugins
const MAX_CACHE_AGE = 300000; // 5 minutes in milliseconds

const PluginStore = memo(() => {
    const { updateData } = useContext(UpdateDataContext)!;
    const { setErrorMessage } = useContext(NotificationContext)!;
    const { currentPluginSource } = useContext(PluginSourceContext)!;
    const { t } = useTranslation();

    const [, _setPlugins] = useState<PluginDefinition[]>([]);
    const [installingPlugins, setInstallingPlugins] = useState<Set<string>>(new Set());
    const [pluginStatuses, setPluginStatuses] = useState<Record<string, PluginStatus>>({});
    const [loadingStatuses, setLoadingStatuses] = useState(false);

    // Task 3.1.3: Add containerRef for virtual scrolling
    // const containerRef = useRef<any>(null); // Removed ref usage
    const cacheTimestamps = useRef<Map<string, number>>(new Map());

    // Task 3.2.2: Add cache cleanup with size limits
    const cleanupCache = () => {
        const now = Date.now();
        const timestamps = cacheTimestamps.current;

        setPluginStatuses(prevStatuses => {
            const newStatuses = { ...prevStatuses };
            const keysToDelete: string[] = [];
            // Remove old entries
            for (const [key, timestamp] of timestamps) {
                if (now - timestamp > MAX_CACHE_AGE) {
                    keysToDelete.push(key);
                    // Clear cached status for old plugin
                    if (newStatuses[key]) {
                        delete newStatuses[key];
                    }
                }
            }
            keysToDelete.forEach(key => timestamps.delete(key));

            // If cache size exceeds limit, remove oldest entries until within limit
            const currentCacheSize = Object.keys(newStatuses).length;
            if (currentCacheSize > CACHE_SIZE_LIMIT) {
                const sortedKeys = Array.from(timestamps.entries())
                    .sort(([, timeA], [, timeB]) => timeA - timeB)
                    .map(([key]) => key);

                const keysToRemove: string[] = [];
                for (let i = 0; i < currentCacheSize - CACHE_SIZE_LIMIT; i++) {
                    const keyToRemove = sortedKeys[i];
                    if (keyToRemove) {
                        keysToRemove.push(keyToRemove);
                    }
                }
                keysToRemove.forEach(key => {
                    delete newStatuses[key];
                    timestamps.delete(key);
                });
            }
            return newStatuses;
        });
    };

    const loadPluginStatuses = useCallback(async () => {
        cleanupCache(); // Periodic cleanup
        const statuses: Record<string, PluginStatus> = {};

        // Safety check for updateData
        if (!updateData?.plugins) return;

        try {
            setLoadingStatuses(true);
            // Chunk processing to avoid blocking UI
            let processedCount = 0;
            for (const plugin of updateData.plugins) {
                if (processedCount++ % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }

                try {
                    const basePath = shell.breeze.data_directory() + '/scripts/' + plugin.local_path;
                    let installPath: string | null = null;

                    // Check if plugin exists (enabled or disabled)
                    try {
                        if (shell.fs.exists(basePath)) {
                            installPath = basePath;
                        } else if (shell.fs.exists(basePath + '.disabled')) {
                            installPath = basePath + '.disabled';
                        }
                    } catch (error) {
                        shell.println(`[PluginStore] Failed to check existence for ${plugin.name}: ${error}`);
                    }

                    const installed = installPath !== null;
                    let localVersion = '0.0.0';

                    if (installed && installPath) {
                        try {
                            const content = shell.fs.read(installPath);
                            const match = content.match(/\/\/ @version:\s*(.*)/);
                            if (match && match[1]) {
                                localVersion = match[1].trim();
                            } else {
                                // Set default version if regex doesn't match
                                localVersion = '0.0.0';
                                shell.println(`[PluginStore] Warning: No version found for ${plugin.name}, defaulting to 0.0.0`);
                            }
                        } catch (error) {
                            shell.println(`[PluginStore] Failed to read version for ${plugin.name}: ${error}`);
                            localVersion = '0.0.0';
                        }
                    }

                    // Task 3.2.3: Add cache statistics and management
                    const pluginStatus = {
                        installed,
                        installPath,
                        localVersion,
                        hasUpdate: installed && localVersion !== plugin.version
                    };

                    // Update cache timestamp
                    cacheTimestamps.current.set(plugin.name, Date.now());
                    statuses[plugin.name] = pluginStatus;
                } catch (error) {
                    // Per-plugin error handling - set safe defaults
                    shell.println(`[PluginStore] Error processing plugin ${plugin.name}: ${error}`);
                    statuses[plugin.name] = {
                        installed: false,
                        installPath: null,
                        localVersion: '0.0.0',
                        hasUpdate: false
                    };
                }
            }
        } catch (error) {
            shell.println(`[PluginStore] Critical error loading plugin statuses: ${error}`);
            setErrorMessage(t('plugins.load_status_failed'));
        } finally {
            setPluginStatuses(prev => ({ ...prev, ...statuses }));
            setLoadingStatuses(false);
        }
    }, [updateData?.plugins, t, setErrorMessage, setLoadingStatuses, setPluginStatuses, cacheTimestamps]);

    useEffect(() => {
        loadPluginStatuses();
    }, [updateData?.plugins, t, loadPluginStatuses]);

    // Task 3.2.4: Add cache cleanup on unmount
    useEffect(() => {
        const timestampsRef = cacheTimestamps.current;
        // Cleanup on unmount
        return () => {
            cleanupCache();
            timestampsRef.clear();
        };
    }, []);

    const installPlugin = (plugin: any) => {
        if (installingPlugins.has(plugin.name)) return;

        setInstallingPlugins(prev => new Set(prev).add(plugin.name));
        const path = shell.breeze.data_directory() + '/scripts/' + plugin.local_path;
        const url = PLUGIN_SOURCES[currentPluginSource] + plugin.path;
        shell.network.get_async(url, (data: string) => {
            shell.fs.write(path, data);
            shell.println(t('plugins.install_success', { name: plugin.name }));
            setInstallingPlugins(prev => {
                const newSet = new Set(prev);
                newSet.delete(plugin.name);
                return newSet;
            });
            setPluginStatuses(prev => ({
                ...prev,
                [plugin.name]: { installed: true, installPath: path, localVersion: plugin.version, hasUpdate: false }
            }));
        }, (e: any) => {
            shell.println(e);
            setErrorMessage(t('plugins.install_failed', { name: plugin.name }));
            setInstallingPlugins(prev => {
                const newSet = new Set(prev);
                newSet.delete(plugin.name);
                return newSet;
            });
        });
    };

    // Task 3.1.2: Add virtual scrolling for >50 plugins
    const pluginsWithStatus = (updateData?.plugins || []).map((plugin: any) => {
        const status = pluginStatuses[plugin.name] || {
            installed: false,
            localVersion: '0.0.0',
            hasUpdate: false
        };

        return {
            ...plugin,
            ...status
        };
    });

    const shouldUseVirtualScroll = pluginsWithStatus.length > 50;
    const itemHeight = 60; // Standard plugin item height
    const containerHeight = 500; // Viewport height

    const { visibleItems, paddingTop, paddingBottom, scrollProps } = useVirtualScroll(
        pluginsWithStatus,
        itemHeight,
        containerHeight
    );

    const handlePluginClick = (plugin: any, _index: number) => {
        installPlugin(plugin);
    };

    return (
        <flex gap={20} flexGrow={1} alignItems="stretch">
            <Text fontSize={24}>{t("plugins.store")}</Text>
            {loadingStatuses && <Text>{t("plugins.loading_statuses")}</Text>}
            <flex gap={10} alignItems="stretch" flexGrow={1}>
                {shouldUseVirtualScroll ? (
                    // Task 3.1.3: Virtual scrolling implementation
                    <flex
                        enableScrolling={true}
                        height={containerHeight}
                        {...scrollProps}
                        flexGrow={1}
                        alignItems="stretch"
                    >
                        <flex height={paddingTop} />
                        {visibleItems.map((item, index) => (
                            <PluginVirtualItem
                                key={item.id}
                                plugin={item.data}
                                index={index}
                                itemHeight={itemHeight}
                                onClick={() => handlePluginClick(item.data, index)}
                            />
                        ))}
                        <flex height={paddingBottom} />
                    </flex>
                ) : (
                    // Traditional rendering for smaller lists
                    <flex enableScrolling={true} flexGrow={1} alignItems="stretch">
                        {pluginsWithStatus.map((plugin: any) => (
                            <PluginListItem
                                key={plugin.name}
                                plugin={plugin}
                                installingPlugins={installingPlugins}
                                onInstall={installPlugin}
                            />
                        ))}
                    </flex>
                )}
            </flex>
        </flex>
    );
});

export default PluginStore;