import * as shell from "mshell";
import { showMenu } from "./utils";
import { Text, PluginItem } from "./components";
import { PluginLoadOrderContext } from "./contexts";
import { useTranslation, loadPlugins, togglePlugin, deletePlugin } from "./utils";
import { memo, useContext, useEffect, useState } from "react";

const PluginConfig = memo(() => {
    const { order, update } = useContext(PluginLoadOrderContext)!;
    const { t } = useTranslation();

    const [installedPlugins, setInstalledPlugins] = useState<string[]>([]);
    const [enabledPlugins, setEnabledPlugins] = useState<Set<string>>(new Set());

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        reloadPluginsList();
    }, []);

    const reloadPluginsList = async () => {
        setLoading(true);
        // Allow UI to render loading state
        await new Promise(r => setTimeout(r, 0));

        const plugins = loadPlugins();
        setInstalledPlugins(plugins);

        const enabled = new Set<string>();
        let count = 0;
        for (const name of plugins) {
            if (count++ % 50 === 0) await new Promise(r => setTimeout(r, 0));

            const path = shell.breeze.data_directory() + '/scripts/' + name + '.js';
            if (shell.fs.exists(path)) {
                enabled.add(name);
            }
        }
        setEnabledPlugins(enabled);
        setLoading(false);
    };

    const handleTogglePlugin = async (name: string) => {
        togglePlugin(name);
        await reloadPluginsList();
    };

    const handleDeletePlugin = async (name: string) => {
        deletePlugin(name);
        await reloadPluginsList();
    };

    const isPrioritized = (name: string) => {
        return order?.includes(name) || false;
    };

    const togglePrioritize = (name: string) => {
        const newOrder = [...(order || [])];
        if (newOrder.includes(name)) {
            const index = newOrder.indexOf(name);
            newOrder.splice(index, 1);
        } else {
            newOrder.unshift(name);
        }
        update(newOrder);
    };

    const showContextMenu = (pluginName: string) => {
        showMenu(menu => {
            menu.append_menu({
                name: isPrioritized(pluginName) ? t('menu.cancel_priority') : t('menu.set_priority'),
                action() {
                    togglePrioritize(pluginName);
                    menu.close();
                }
            });
            menu.append_menu({
                name: t("menu.delete"),
                action() {
                    handleDeletePlugin(pluginName);
                    menu.close();
                }
            });
            if (on_plugin_menu[pluginName]) {
                on_plugin_menu[pluginName](menu)
            }
        });
    };

    const prioritizedPlugins = installedPlugins.filter(name => isPrioritized(name));
    const regularPlugins = installedPlugins.filter(name => !isPrioritized(name));

    return (
        <flex gap={20} flexGrow={1} alignItems="stretch">
            <Text fontSize={24}>{t("plugins.config")}</Text>
            {loading && <Text>{t("common.loading")}</Text>}

            <flex enableScrolling={true} flexGrow={1} alignItems="stretch">
                {prioritizedPlugins.length > 0 && (
                    <flex gap={10} alignItems="stretch" paddingBottom={10} paddingTop={10}>
                        <Text fontSize={16}>{t("plugins.priority_load")}</Text>
                        {prioritizedPlugins.map(name => {
                            const isEnabled = enabledPlugins.has(name);
                            return (
                                <PluginItem
                                    key={name}
                                    name={name}
                                    isEnabled={isEnabled}
                                    isPrioritized={true}
                                    onToggle={() => handleTogglePlugin(name)}
                                    onMoreClick={showContextMenu}
                                />
                            );
                        })}

                        <flex height={1} autoSize={false} backgroundColor={shell.breeze.is_light_theme() ? '#E0E0E0' : '#505050'} />
                    </flex>
                )}
                <flex gap={10} alignItems="stretch">
                    {prioritizedPlugins.length === 0 && <Text fontSize={16}>{t("plugins.installed_plugins")}</Text>}
                    {regularPlugins.map(name => {
                        const isEnabled = enabledPlugins.has(name);
                        return (
                            <PluginItem
                                key={name}
                                name={name}
                                isEnabled={isEnabled}
                                isPrioritized={false}
                                onToggle={() => handleTogglePlugin(name)}
                                onMoreClick={showContextMenu}
                            />
                        );
                    })}
                </flex>
            </flex>

        </flex>
    );
});

export default PluginConfig;