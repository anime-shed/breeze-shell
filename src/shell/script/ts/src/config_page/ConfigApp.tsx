import * as shell from "mshell";
import { Button, Text } from "./components";
import { WINDOW_WIDTH, WINDOW_HEIGHT, SIDEBAR_WIDTH, RESPONSIVE_SPACING } from "./constants";
import { saveConfig, loadConfig, useResponsive, useTranslation, usePerformanceMetrics } from "./utils";
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
import { useState, useEffect, useCallback, ReactNode } from "react";

// Interface definitions with separated known/dynamic properties
interface AnimationSettingsCore {
    duration?: number;
    easing?: string;
    type?: string;
}

interface AnimationSettings extends AnimationSettingsCore {
    [key: string]: string | number | boolean | undefined;
}

interface ThemeSettingsCore {
    animation?: AnimationSettings;
    acrylic?: boolean;
    use_dwm_if_available?: boolean;
}

interface ThemeSettings extends ThemeSettingsCore {
    [key: string]: AnimationSettings | string | number | boolean | undefined;
}

interface ContextMenuSettingsCore {
    theme?: ThemeSettings;
    vsync?: boolean;
    hotkeys?: boolean;
    show_settings_button?: boolean;
    ignore_owner_draw?: boolean;
    reverse_if_open_to_up?: boolean;
}

interface ContextMenuSettings extends ContextMenuSettingsCore {
    [key: string]: ThemeSettings | string | number | boolean | undefined;
}

interface PluginInfoCore {
    name: string;
    enabled?: boolean;
}

interface PluginInfo extends PluginInfoCore {
    [key: string]: string | boolean | undefined;
}

interface UpdateInfoCore {
    version?: string;
    download_url?: string;
    release_notes?: string;
}

interface UpdateInfo extends UpdateInfoCore {
    [key: string]: string | undefined;
}

interface PluginIndexEntryCore {
    name: string;
    description?: string;
    version?: string;
    author?: string;
}

interface PluginIndexEntry extends PluginIndexEntryCore {
    [key: string]: string | undefined;
}

interface GlobalConfigCore {
    context_menu?: ContextMenuSettings;
    debug_console?: boolean;
    plugin_load_order?: PluginInfo[];
    language?: string;
    plugin_source?: string;
}

interface GlobalConfig extends GlobalConfigCore {
    [key: string]: ContextMenuSettings | PluginInfo[] | string | boolean | undefined;
}

interface ProviderValues {
    global: { config: GlobalConfig; update: (configPatch: Partial<GlobalConfig>) => void };
    contextMenu: { config: ContextMenuSettings; update: (newConfig: ContextMenuSettings) => void };
    debugConsole: { value: boolean; update: (value: boolean) => void };
    pluginLoadOrder: { order: PluginInfo[]; update: (order: PluginInfo[]) => void };
    updateData: { updateData: UpdateInfo | null; setUpdateData: (data: UpdateInfo | null) => void };
    notification: {
        errorMessage: string | null;
        setErrorMessage: (msg: string | null) => void;
        loadingMessage: string | null;
        setLoadingMessage: (msg: string | null) => void;
    };
    pluginSource: {
        currentPluginSource: string;
        updatePluginSource: (source: string) => void;
        cachedPluginIndex: Record<string, PluginIndexEntry[]> | null;
        setCachedPluginIndex: (index: Record<string, PluginIndexEntry[]> | null) => void;
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

const DEFAULT_CONFIG: GlobalConfig = {
    context_menu: {},
    debug_console: false,
    plugin_load_order: []
};

const PAGE_TITLE_KEYS: Record<string, string> = {
    'context-menu': 'menu.context_menu',
    'update': 'update.title',
    'plugin-store': 'plugins.store',
    'plugin-config': 'plugins.config'
};

// Window API definitions
interface ShellWindow {
    getSize?: () => { width: number; height: number };
    getDPIScale?: () => number;
    addEventListener?: (event: string, handler: () => void) => void;
    removeEventListener?: (event: string, handler: () => void) => void;
}

interface ShellWithWindow {
    window?: ShellWindow;
}

const getShellWindow = (): ShellWindow | undefined => {
    return (shell as unknown as ShellWithWindow).window;
};

export const ConfigApp = ({ initialWidth = WINDOW_WIDTH, initialHeight = WINDOW_HEIGHT }: { initialWidth?: number, initialHeight?: number }) => {
    const { t } = useTranslation();
    const [activePage, setActivePage] = useState('context-menu');
    const [contextMenuConfig, setContextMenuConfig] = useState<ContextMenuSettings>({});
    const [debugConsole, setDebugConsole] = useState<boolean>(false);
    const [pluginLoadOrder, setPluginLoadOrder] = useState<PluginInfo[]>([]);
    const [updateData, setUpdateData] = useState<UpdateInfo | null>(null);
    const [config, setConfig] = useState<GlobalConfig>({});
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
    const [currentPluginSource, setCurrentPluginSource] = useState<string>('Enlysure');
    const [cachedPluginIndex, setCachedPluginIndex] = useState<Record<string, PluginIndexEntry[]> | null>(null);


    const [isLoading, setIsLoading] = useState(true);
    const [configError, setConfigError] = useState<string | null>(null);


    const metrics = usePerformanceMetrics();


    const loadConfigWithErrorHandling = () => {
        try {
            setIsLoading(true);
            setConfigError(null);

            const parsed = loadConfig();

            setConfig(parsed);
            setContextMenuConfig(parsed.context_menu || {});
            setDebugConsole(parsed.debug_console || false);
            setPluginLoadOrder(parsed.plugin_load_order || []);
            if (parsed.plugin_source) {
                setCurrentPluginSource(parsed.plugin_source);
            }

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error && error.stack ? `\nStack: ${error.stack}` : '';
            shell.println(`[ConfigApp] Failed to load config: ${errorMsg}${errorStack}`);

            setConfigError(errorMsg);
            setErrorMessage('Failed to load configuration. Using defaults.');
            setConfig(DEFAULT_CONFIG);
            setContextMenuConfig(DEFAULT_CONFIG.context_menu || {});
            setDebugConsole(DEFAULT_CONFIG.debug_console || false);
            setPluginLoadOrder(DEFAULT_CONFIG.plugin_load_order || []);
            if (DEFAULT_CONFIG.plugin_source) {
                setCurrentPluginSource(DEFAULT_CONFIG.plugin_source);
            }
        } finally {
            setIsLoading(false);
        }
    };


    useEffect(() => {
        loadConfigWithErrorHandling();
    }, []);


    const [windowSize, setWindowSize] = useState({ width: initialWidth, height: initialHeight });
    const [dpiScale, setDpiScale] = useState(1.0);


    const responsive = useResponsive(windowSize.width);

    const handleResize = useCallback(() => {
        try {
            const shellWindow = getShellWindow();
            // Check if shell.window is available and has size methods
            if (shellWindow && typeof shellWindow.getSize === 'function') {
                const size = shellWindow.getSize();
                setWindowSize({ width: size.width, height: size.height });
            } else {
                // Fallback: use provided initial dimensions
                setWindowSize({ width: initialWidth, height: initialHeight });
            }

            // Detect DPI scaling if available
            if (shellWindow && typeof shellWindow.getDPIScale === 'function') {
                const scale = shellWindow.getDPIScale();
                setDpiScale(scale || 1.0);
            }
        } catch (error) {
            console.error('Error handling window resize:', error);
        }
    }, [initialWidth, initialHeight]);

    useEffect(() => {
        // Initial size detection
        handleResize();

        const shellWindow = getShellWindow();
        // Set up resize listener if supported
        if (shellWindow && typeof shellWindow.addEventListener === 'function') {
            shellWindow.addEventListener('resize', handleResize);

            // Cleanup function
            return () => {
                if (typeof shellWindow.removeEventListener === 'function') {
                    shellWindow.removeEventListener('resize', handleResize);
                }
            };
        }

        // Return empty cleanup if not supported
        return () => { };
    }, [handleResize]);

    const updateContextMenu = (newConfig: ContextMenuSettings) => {
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

    const updatePluginLoadOrder = (order: PluginInfo[]) => {
        setPluginLoadOrder(order);
        const newGlobal = { ...config, plugin_load_order: order };
        setConfig(newGlobal);
        saveConfig(newGlobal);
    };

    const updateGlobalConfig = (configPatch: Partial<GlobalConfig>) => {
        const newGlobal = { ...config, ...configPatch };
        setConfig(newGlobal);
        if ('context_menu' in configPatch) {
            setContextMenuConfig(configPatch.context_menu || {});
        }
        if ('debug_console' in configPatch) {
            setDebugConsole(configPatch.debug_console || false);
        }
        if ('plugin_load_order' in configPatch) {
            setPluginLoadOrder(configPatch.plugin_load_order || []);
        }
        saveConfig(newGlobal);
    };

    const updatePluginSource = (source: string) => {
        setCurrentPluginSource(source);
        const newGlobal = { ...config, plugin_source: source };
        setConfig(newGlobal);
        saveConfig(newGlobal);
    };

    const providerValues = {
        global: { config, update: updateGlobalConfig },
        contextMenu: { config: contextMenuConfig, update: updateContextMenu },
        debugConsole: { value: debugConsole, update: updateDebugConsole },
        pluginLoadOrder: { order: pluginLoadOrder, update: updatePluginLoadOrder },
        updateData: { updateData, setUpdateData },
        notification: { errorMessage, setErrorMessage, loadingMessage, setLoadingMessage },
        pluginSource: { currentPluginSource, updatePluginSource, cachedPluginIndex, setCachedPluginIndex }
    };

    return (
        <AppProviders values={providerValues}>
            {/* Task 2.1.3: Apply minimum window size constraints */}
            <flex
                horizontal
                flexGrow={1}
                autoSize={false}
                width={Math.max(windowSize.width, 600)}
                height={Math.max(windowSize.height, 400)}
                gap={10}
                alignItems="stretch"
                backgroundColor={shell.breeze.is_light_theme() ? '#f5f5f5' : '#202020'}
            >
                {!responsive.isMobile && !isLoading && (
                    <Sidebar
                        activePage={activePage}
                        setActivePage={setActivePage}
                        sidebarWidth={Math.round(SIDEBAR_WIDTH * dpiScale)}
                    />
                )}

                <flex
                    padding={Math.round(20 * dpiScale)}
                    flexGrow={1}
                    enableScrolling={true}
                    gap={Math.round(20 * dpiScale)}
                    alignItems="stretch"
                >
                    {/* Task 1.1.4: Add loading spinner/error display */}
                    {(isLoading || configError) && (
                        <flex
                            backgroundColor="rgba(0,0,0,0.8)"
                            alignItems="center"
                            justifyContent="center"
                            flexGrow={1}
                        >
                            <flex alignItems="center" gap={10}>
                                {isLoading ? (
                                    <Text fontSize={18}>Loading configuration...</Text>
                                ) : null}
                                {configError && (
                                    <Text fontSize={14}>{configError}</Text>
                                )}
                            </flex>
                        </flex>
                    )}

                    {!isLoading && metrics.showPerformanceWarning && (
                        <flex horizontal justifyContent="end">
                            <flex backgroundColor="rgba(255,100,100,0.1)" padding={5} borderRadius={4}>
                                <Text fontSize={10}>{`FPS: ${metrics.fps} | Mem: ${metrics.memoryUsage}MB`}</Text>
                            </flex>
                        </flex>
                    )}

                    {!isLoading && (
                        <>
                            {/* Task 2.4.3: Add conditional rendering for mobile vs desktop */}
                            {responsive.isMobile ? (
                                // Mobile layout: simplified navigation
                                <flex gap={RESPONSIVE_SPACING.xs} flexGrow={1} alignItems="stretch">
                                    <flex padding={RESPONSIVE_SPACING.xs} gap={RESPONSIVE_SPACING.xs}>
                                        <Text fontSize={responsive.isMobile ? 20 : 24}>
                                            {PAGE_TITLE_KEYS[activePage] ? t(PAGE_TITLE_KEYS[activePage]) : ""}
                                        </Text>
                                        <flex gap={RESPONSIVE_SPACING.xs} horizontal>
                                            {['context-menu', 'update', 'plugin-store', 'plugin-config'].map((page) => (
                                                <Button
                                                    key={page}
                                                    onClick={() => setActivePage(page)}
                                                    selected={activePage === page}
                                                    responsive={true}
                                                    scale={0.9}
                                                >
                                                    <Text fontSize={14}>
                                                        {PAGE_TITLE_KEYS[page] ? t(PAGE_TITLE_KEYS[page]) : ""}
                                                    </Text>
                                                </Button>
                                            ))}
                                        </flex>
                                    </flex>
                                    <flex flexGrow={1} alignItems="stretch" padding={RESPONSIVE_SPACING.xs}>
                                        {activePage === 'context-menu' && <ContextMenuConfig />}
                                        {activePage === 'update' && <UpdatePage />}
                                        {activePage === 'plugin-store' && <PluginStore />}
                                        {activePage === 'plugin-config' && <PluginConfig />}
                                    </flex>
                                </flex>
                            ) : (
                                // Desktop layout: content only (Sidebar handled above)
                                <>
                                    {activePage === 'context-menu' && <ContextMenuConfig />}
                                    {activePage === 'update' && <UpdatePage />}
                                    {activePage === 'plugin-store' && <PluginStore />}
                                    {activePage === 'plugin-config' && <PluginConfig />}
                                </>
                            )}
                        </>
                    )}
                </flex>
            </flex>
        </AppProviders>
    );
};

export default ConfigApp;