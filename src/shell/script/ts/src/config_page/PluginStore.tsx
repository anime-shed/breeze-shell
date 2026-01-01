import * as shell from "mshell";
import { Button, Text } from "./components";
import { UpdateDataContext, NotificationContext, PluginSourceContext } from "./contexts";
import { useTranslation } from "./utils";
import { PLUGIN_SOURCES } from "./constants";
import { memo, useContext, useEffect, useState } from "react";

type PluginStatus = {
    installed: boolean;
    installPath: string | null;
    localVersion: string;
    hasUpdate: boolean;
};

type PluginDefinition = {
    name: string;
    description: string;
    local_path: string;
    path: string;
    version: string;
};

const PluginStore = memo(() => {
    const { updateData } = useContext(UpdateDataContext)!;
    const { setErrorMessage } = useContext(NotificationContext)!;
    const { currentPluginSource } = useContext(PluginSourceContext)!;
    const { t } = useTranslation();

    const [plugins, setPlugins] = useState<PluginDefinition[]>([]);
    const [installingPlugins, setInstallingPlugins] = useState<Set<string>>(new Set());
    const [pluginStatuses, setPluginStatuses] = useState<Record<string, PluginStatus>>({});
    const [loadingStatuses, setLoadingStatuses] = useState(false);

    useEffect(() => {
        if (updateData) {
            setPlugins(updateData.plugins);
        }
    }, [updateData]);

    useEffect(() => {
        if (!updateData?.plugins) return;

        const loadPluginStatuses = async () => {
            setLoadingStatuses(true);
            const statuses: Record<string, PluginStatus> = {};

            try {
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

                        statuses[plugin.name] = {
                            installed,
                            installPath,
                            localVersion,
                            hasUpdate: installed && localVersion !== plugin.version
                        };
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
                setPluginStatuses(statuses);
                setLoadingStatuses(false);
            }
        };

        // Run async without blocking
        loadPluginStatuses();
    }, [updateData?.plugins, t]);

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

    return (
        <flex gap={20} flexGrow={1} alignItems="stretch">
            <Text fontSize={24}>{t("plugins.store")}</Text>
            {loadingStatuses && <Text>{t("plugins.loading_statuses")}</Text>}
            <flex gap={10} alignItems="stretch" flexGrow={1}>
                <flex enableScrolling={true} flexGrow={1} alignItems="stretch">
                    {plugins.map((plugin: any) => {
                        const status = pluginStatuses[plugin.name] || {
                            installed: false,
                            localVersion: '0.0.0',
                            hasUpdate: false
                        };
                        const { installed, localVersion: local_version, hasUpdate: have_update } = status;

                        return (
                            <flex key={plugin.name} horizontal alignItems="center">
                                <flex autoSize={false} width={4} height={20} borderRadius={2} backgroundColor={
                                    installed ? (have_update ? '#FFA500' : '#2979FF') : (shell.breeze.is_light_theme() ? '#C0C0C0aa' : '#505050aa')
                                } />
                                <flex gap={10} padding={10} borderRadius={8}
                                    flexGrow={1} horizontal>
                                    <flex gap={10} alignItems="stretch" flexGrow={1}>
                                        <Text fontSize={18}>{plugin.name}</Text>
                                        <Text>{plugin.description}</Text>
                                    </flex>
                                    <flex gap={10} alignItems="center" flexShrink={0}>
                                        <Button onClick={() => installPlugin(plugin)}>
                                            <Text>{installingPlugins.has(plugin.name) ? t("plugins.installing") : (installed ? (have_update ? t("plugins.update", { from: local_version, to: plugin.version }) : t('plugins.installed')) : t('plugins.install'))}</Text>
                                        </Button>
                                    </flex>
                                </flex>
                            </flex>
                        );
                    })}
                </flex>
            </flex>
        </flex>
    );
});

export default PluginStore;