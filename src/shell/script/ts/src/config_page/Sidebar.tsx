import * as shell from "mshell";
import { showMenu } from "./utils";
import { memo, useEffect, useContext, useCallback, useRef } from "react";
import { Button, SidebarItem, Text, iconElement } from "./components";
import {
    ICON_BREEZE,
    ICON_CONTEXT_MENU,
    ICON_UPDATE,
    ICON_PLUGIN_STORE,
    ICON_PLUGIN_CONFIG,
    PLUGIN_SOURCES
} from "./constants";
import { UpdateDataContext, NotificationContext, PluginSourceContext } from "./contexts";
import { useTranslation } from "./utils";
import { get_async as fetchAsync } from "../utils/network";

const Sidebar = memo(({
    activePage,
    setActivePage,
    sidebarWidth
}: {
    activePage: string;
    setActivePage: (page: string) => void;
    sidebarWidth: number;
}) => {
    const { t } = useTranslation();
    const { setUpdateData } = useContext(UpdateDataContext)!;
    const { errorMessage, setErrorMessage, loadingMessage, setLoadingMessage } = useContext(NotificationContext)!;
    const { currentPluginSource, updatePluginSource, setCachedPluginIndex } = useContext(PluginSourceContext)!;

    useEffect(() => {
        if (errorMessage) {
            const timer = setTimeout(() => {
                setErrorMessage(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [errorMessage, setErrorMessage]);

    // Track last fetched source to prevent loops
    const lastFetchedSource = useRef<string | null>(null);

    const handleSourceChange = useCallback((sourceName: string) => {
        if (lastFetchedSource.current === sourceName) {
            return;
        }
        lastFetchedSource.current = sourceName;
        
        updatePluginSource(sourceName);
        setCachedPluginIndex(null);
        setLoadingMessage(t("source.switching"));
        const url = PLUGIN_SOURCES[sourceName] + 'plugins-index.json';
        let cancelled = false;
        const timeout = shell.infra.setTimeout(() => {
            cancelled = true;
            setErrorMessage(t("common.load_failed"));
            setLoadingMessage(null);
        }, 10000);
        fetchAsync(url).then((data: string) => {
            if (cancelled) return;
            try {
                const json = JSON.parse(data);
                setCachedPluginIndex(json);
                setUpdateData(json);
            } catch (e) {
                shell.println('Failed to parse update data:', e as any);
                setErrorMessage(t("common.load_failed"));
            }
        }).catch((e: any) => {
            if (cancelled) return;
            shell.println('Failed to fetch update data:', e);
            setErrorMessage(t("common.load_failed"));
        }).finally(() => {
            shell.infra.clearTimeout(timeout);
            setLoadingMessage(null);
        });
    }, [updatePluginSource, setCachedPluginIndex, setLoadingMessage, t, setUpdateData, setErrorMessage]);

    useEffect(() => {
        // Only trigger initial fetch if we haven't fetched this source yet
        if (currentPluginSource && lastFetchedSource.current !== currentPluginSource) {
            handleSourceChange(currentPluginSource);
        }
    }, [currentPluginSource, handleSourceChange]);

    return (
        <flex
            width={sidebarWidth}
            backgroundColor={shell.breeze.is_light_theme() ? '#f0f0f077' : '#40404077'}
            padding={10}
            gap={10}
            alignItems="stretch"
            autoSize={false}
        >
            <flex horizontal alignItems="center" gap={3} padding={10}>
                {iconElement(ICON_BREEZE, 24)}
            </flex>
            <SidebarItem onClick={() => setActivePage('context-menu')} icon={ICON_CONTEXT_MENU} isActive={activePage === 'context-menu'}>{t("sidebar.main_config")}</SidebarItem>
            <SidebarItem onClick={() => setActivePage('update')} icon={ICON_UPDATE} isActive={activePage === 'update'}>{t("sidebar.update")}</SidebarItem>
            <SidebarItem onClick={() => setActivePage('plugin-store')} icon={ICON_PLUGIN_STORE} isActive={activePage === 'plugin-store'}>{t("sidebar.plugin_store")}</SidebarItem>
            <SidebarItem onClick={() => setActivePage('plugin-config')} icon={ICON_PLUGIN_CONFIG} isActive={activePage === 'plugin-config'}>{t("sidebar.plugin_config")}</SidebarItem>
            <spacer />

            {/* 错误提示 */}
            {errorMessage && (
                <flex
                    backgroundColor="#FF4444AA"
                    padding={8}
                    borderRadius={6}
                    paddingBottom={5}
                >
                    <text
                        text={errorMessage}
                        fontSize={12}
                        color="#FFFFFFFF"
                    />
                </flex>
            )}

            {/* 加载提示 */}
            {loadingMessage && (
                <flex
                    backgroundColor="#0078D4AA"
                    padding={8}
                    borderRadius={6}
                    paddingBottom={5}
                >
                    <text
                        text={loadingMessage}
                        fontSize={12}
                        color="#FFFFFFFF"
                    />
                </flex>
            )}

            <Button onClick={() => {
                showMenu(menu => {
                    Object.keys(PLUGIN_SOURCES).forEach(sourceName => {
                        menu.append_menu({
                            name: sourceName,
                            action() {
                                handleSourceChange(sourceName);
                                menu.close();
                            },
                            icon_svg: sourceName === currentPluginSource ? `<svg viewBox="0 0 24 24"><path fill="${shell.breeze.is_light_theme() ? '#000000ff' : '#ffffffff'}" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>` : undefined
                        });
                    });
                });
            }}>
                <Text fontSize={12}>{`${t("sidebar.source")} - ${currentPluginSource}`}</Text>
            </Button>
        </flex>
    );
});

export default Sidebar;
