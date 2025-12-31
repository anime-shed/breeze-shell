import * as shell from "mshell";
import { WINDOW_WIDTH, WINDOW_HEIGHT, SIDEBAR_WIDTH } from "./constants";
import { loadConfig, saveConfig } from "./utils";
import {
    ContextMenuContext,
    DebugConsoleContext,
    PluginLoadOrderContext,
    UpdateDataContext,
    NotificationContext,
    PluginSourceContext,
    GlobalConfigContext
} from "./contexts";
import Sidebar from "./Sidebar";
import ContextMenuConfig from "./ContextMenuConfig";
import UpdatePage from "./UpdatePage";
import PluginStore from "./PluginStore";
import PluginConfig from "./PluginConfig";
import { useState, useEffect, ReactNode } from "react";

interface ContextMenuConfig {
    theme?: any;
    animation?: any;
    [key: string]: any;
}

interface GlobalConfig {
    context_menu?: ContextMenuConfig;
    debug_console?: boolean;
    plugin_load_order?: any[];
    language?: string;
    [key: string]: any;
}

interface ProviderValues {
    global: { config: GlobalConfig; update: (configPatch: Partial<GlobalConfig>) => void };
    contextMenu: { config: ContextMenuConfig; update: (newConfig: ContextMenuConfig) => void };
    debugConsole: { value: boolean; update: (value: boolean) => void };
    pluginLoadOrder: { order: any[]; update: (order: any[]) => void };
    updateData: { updateData: any; setUpdateData: (data: any) => void };
    notification: {
        errorMessage: string | null;
        setErrorMessage: (msg: string | null) => void;
        loadingMessage: string | null;
        setLoadingMessage: (msg: string | null) => void;
    };
    pluginSource: {
        currentPluginSource: string;
        setCurrentPluginSource: (source: string) => void;
        cachedPluginIndex: any;
        setCachedPluginIndex: (index: any) => void;
    };
}

const AppProviders = ({ children, values }: { children: ReactNode, values: ProviderValues }) => (
    <GlobalConfigContext.Provider value={values.global}>
        <ContextMenuContext.Provider value={values.contextMenu}>
            <DebugConsoleContext.Provider value={values.debugConsole}>
                <PluginLoadOrderContext.Provider value={values.pluginLoadOrder}>
                    <UpdateDataContext.Provider value={values.updateData}>
                        <NotificationContext.Provider value={values.notification}>
                            <PluginSourceContext.Provider value={values.pluginSource}>
                                {children}
                            </PluginSourceContext.Provider>
                        </NotificationContext.Provider>
                    </UpdateDataContext.Provider>
                </PluginLoadOrderContext.Provider>
            </DebugConsoleContext.Provider>
        </ContextMenuContext.Provider>
    </GlobalConfigContext.Provider>
);

export const ConfigApp = () => {
    const [activePage, setActivePage] = useState('context-menu');
    const [contextMenuConfig, setContextMenuConfig] = useState<any>({});
    const [debugConsole, setDebugConsole] = useState<boolean>(false);
    const [pluginLoadOrder, setPluginLoadOrder] = useState<any[]>([]);
    const [updateData, setUpdateData] = useState<any>(null);
    const [config, setConfig] = useState<any>({});
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
    const [currentPluginSource, setCurrentPluginSource] = useState<string>('Enlysure');
    const [cachedPluginIndex, setCachedPluginIndex] = useState<any>(null);

    useEffect(() => {
        const current_config_path = shell.breeze.data_directory() + '/config.json';
        const current_config = shell.fs.read(current_config_path);
        const parsed = JSON.parse(current_config);
        setConfig(parsed);
        setContextMenuConfig(parsed.context_menu || {});
        setDebugConsole(parsed.debug_console || false);
        setPluginLoadOrder(parsed.plugin_load_order || []);
    }, []);

    const updateContextMenu = (newConfig: any) => {
        setContextMenuConfig(newConfig);
        const newGlobal = { ...config, context_menu: newConfig };
        setConfig(newGlobal);
        saveConfig(newGlobal);
    };

    const updateDebugConsole = (value: boolean) => {
        setDebugConsole(value);
        const newGlobal = { ...config, debug_console: value };
        setConfig(newGlobal);
        saveConfig(newGlobal);
    };

    const updatePluginLoadOrder = (order: any[]) => {
        setPluginLoadOrder(order);
        const newGlobal = { ...config, plugin_load_order: order };
        setConfig(newGlobal);
        saveConfig(newGlobal);
    };

    const updateGlobalConfig = (configPatch: Partial<GlobalConfig>) => {
        const newGlobal = { ...config, ...configPatch };
        setConfig(newGlobal);
        if (Object.prototype.hasOwnProperty.call(configPatch, 'context_menu')) {
            setContextMenuConfig(configPatch.context_menu || {});
        }
        if (Object.prototype.hasOwnProperty.call(configPatch, 'debug_console')) {
            setDebugConsole(configPatch.debug_console || false);
        }
        if (Object.prototype.hasOwnProperty.call(configPatch, 'plugin_load_order')) {
            setPluginLoadOrder(configPatch.plugin_load_order || []);
        }
        saveConfig(newGlobal);
    };

    const providerValues = {
        global: { config, update: updateGlobalConfig },
        contextMenu: { config: contextMenuConfig, update: updateContextMenu },
        debugConsole: { value: debugConsole, update: updateDebugConsole },
        pluginLoadOrder: { order: pluginLoadOrder, update: updatePluginLoadOrder },
        updateData: { updateData, setUpdateData },
        notification: { errorMessage, setErrorMessage, loadingMessage, setLoadingMessage },
        pluginSource: { currentPluginSource, setCurrentPluginSource, cachedPluginIndex, setCachedPluginIndex }
    };

    return (
        <AppProviders values={providerValues}>
            <flex horizontal width={WINDOW_WIDTH} height={WINDOW_HEIGHT} autoSize={false} gap={10}>
                <Sidebar
                    activePage={activePage}
                    setActivePage={setActivePage}
                    sidebarWidth={SIDEBAR_WIDTH}
                    windowHeight={WINDOW_HEIGHT}
                />
                <flex padding={20}>
                    {activePage === 'context-menu' && <ContextMenuConfig />}
                    {activePage === 'update' && <UpdatePage />}
                    {activePage === 'plugin-store' && <PluginStore />}
                    {activePage === 'plugin-config' && <PluginConfig />}
                </flex>
            </flex>
        </AppProviders>
    );
};

export default ConfigApp;