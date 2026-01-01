import * as shell from "mshell";
import { Button, Text } from "./components";
import { WINDOW_WIDTH, WINDOW_HEIGHT, SIDEBAR_WIDTH, BREAKPOINTS, RESPONSIVE_SPACING } from "./constants";
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
import { useState, useEffect, ReactNode } from "react";

interface AnimationSettings {
    duration?: number;
    easing?: string;
    type?: string;
    [key: string]: string | number | boolean | undefined;
}

interface ThemeSettings {
    animation?: AnimationSettings;
    acrylic?: boolean;
    use_dwm_if_available?: boolean;
    [key: string]: AnimationSettings | string | number | boolean | undefined;
}

interface ContextMenuSettings {
    theme?: ThemeSettings;
    vsync?: boolean;
    hotkeys?: boolean;
    show_settings_button?: boolean;
    ignore_owner_draw?: boolean;
    reverse_if_open_to_up?: boolean;
    [key: string]: ThemeSettings | string | number | boolean | undefined;
}

interface PluginInfo {
    name: string;
    enabled?: boolean;
    [key: string]: string | boolean | undefined;
}

interface UpdateInfo {
    version?: string;
    download_url?: string;
    release_notes?: string;
    [key: string]: string | undefined;
}

interface PluginIndexEntry {
    name: string;
    description?: string;
    version?: string;
    author?: string;
    [key: string]: string | undefined;
}

interface GlobalConfig {
    context_menu?: ContextMenuSettings;
    debug_console?: boolean;
    plugin_load_order?: PluginInfo[];
    language?: string;
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
        setCurrentPluginSource: (source: string) => void;
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

    // Task 1.1.1: Add loading state variables for async config loading
    const [isLoading, setIsLoading] = useState(true);
    const [configError, setConfigError] = useState<string | null>(null);

    // Task 3.3: Performance monitoring
    const metrics = usePerformanceMetrics();

    // Task 1.1.2: Create async config loading function with error handling
    const loadConfigAsync = async () => {
        try {
            setIsLoading(true);
            setConfigError(null);

            const parsed = await loadConfig();

            // Small minimum visible duration to prevent flashing
            await new Promise(resolve => setTimeout(resolve, 100));

            setConfig(parsed);
            setContextMenuConfig(parsed.context_menu || {});
            setDebugConsole(parsed.debug_console || false);
            setPluginLoadOrder(parsed.plugin_load_order || []);

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
        } finally {
            setIsLoading(false);
        }
    };

    // Task 1.1.3: Replace synchronous config loading with async pattern
    useEffect(() => {
        loadConfigAsync();
    }, []);

    // Task 2.1.1: Add window resize hook with DPI awareness
    const [windowSize, setWindowSize] = useState({ width: initialWidth, height: initialHeight });
    const [dpiScale, setDpiScale] = useState(1.0);

    // Task 2.4.2: Use responsive hook for breakpoint-aware styling
    const responsive = useResponsive(windowSize.width);

    useEffect(() => {
        const handleResize = () => {
            try {
                // Check if shell.window is available and has size methods
                if (shell && (shell as any).window && typeof (shell as any).window.getSize === 'function') {
                    const size = (shell as any).window.getSize();
                    setWindowSize({ width: size.width, height: size.height });
                } else {
                    // Fallback: use provided initial dimensions
                    setWindowSize({ width: initialWidth, height: initialHeight });
                }

                // Detect DPI scaling if available
                if (shell && (shell as any).window && typeof (shell as any).window.getDPIScale === 'function') {
                    const scale = (shell as any).window.getDPIScale();
                    setDpiScale(scale || 1.0);
                }
            } catch (error) {
                console.error('Error handling window resize:', error);
            }
        };

        // Initial size detection
        handleResize();

        // Set up resize listener if supported
        if (shell && (shell as any).window && typeof (shell as any).window.addEventListener === 'function') {
            (shell as any).window.addEventListener('resize', handleResize);

            // Cleanup function
            return () => {
                if (shell && (shell as any).window && typeof (shell as any).window.removeEventListener === 'function') {
                    (shell as any).window.removeEventListener('resize', handleResize);
                }
            };
        }

        // Return empty cleanup if not supported
        return () => { };
    }, [initialWidth, initialHeight]);

    // Task 1.3.5: Update callers to handle async functions
    const updateContextMenu = async (newConfig: ContextMenuSettings) => {
        setContextMenuConfig(newConfig);
        const newGlobal = { ...config, context_menu: newConfig };
        setConfig(newGlobal);
        await saveConfig(newGlobal);
    };

    const updateDebugConsole = async (value: boolean) => {
        setDebugConsole(value);
        const newGlobal = { ...config, debug_console: value };
        setConfig(newGlobal);
        await saveConfig(newGlobal);
    };

    const updatePluginLoadOrder = async (order: PluginInfo[]) => {
        setPluginLoadOrder(order);
        const newGlobal = { ...config, plugin_load_order: order };
        setConfig(newGlobal);
        await saveConfig(newGlobal);
    };

    const updateGlobalConfig = async (configPatch: Partial<GlobalConfig>) => {
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
        await saveConfig(newGlobal);
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
                    {isLoading && (
                        <flex
                            backgroundColor="rgba(0,0,0,0.8)"
                            alignItems="center"
                            justifyContent="center"
                            flexGrow={1}
                        >
                            <flex alignItems="center" gap={10}>
                                <Text fontSize={18}>Loading configuration...</Text>
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
                                            {activePage === 'context-menu' ? t("menu.context_menu") :
                                                activePage === 'update' ? t("update.title") :
                                                    activePage === 'plugin-store' ? t("plugins.store") :
                                                        activePage === 'plugin-config' ? t("plugins.config") : ""}
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
                                                        {page === 'context-menu' ? t("menu.context_menu") :
                                                            page === 'update' ? t("update.title") :
                                                                page === 'plugin-store' ? t("plugins.store") :
                                                                    page === 'plugin-config' ? t("plugins.config") : ""}
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