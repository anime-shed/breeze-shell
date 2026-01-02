// Export all components and utilities from the config module
export { ConfigApp as default } from './ConfigApp';

// Export individual components
export { default as Sidebar } from './Sidebar';
export { default as ContextMenuConfig } from './ContextMenuConfig';
export { default as UpdatePage } from './UpdatePage';
export { default as PluginStore } from './PluginStore';
export { default as PluginConfig } from './PluginConfig';

// Export UI components
export {
    Button,
    Text,
    TextButton,
    Toggle,
    SidebarItem,
    PluginCheckbox,
    PluginMoreButton,
    PluginItem,
    SimpleMarkdownRender,
    iconElement
} from './components';

// Export contexts
export {
    ContextMenuContext,
    DebugConsoleContext,
    PluginLoadOrderContext,
    UpdateDataContext,
    NotificationContext
} from './contexts';

// Export utilities
export {
    getNestedValue,
    setNestedValue,
    useTranslation,
    getAllSubkeys,
    applyPreset,
    checkPresetMatch,
    getCurrentPreset,
    loadConfig,
    saveConfig,
    saveConfigDebounced,
    loadPlugins as reloadPlugins,
    togglePlugin,
    deletePlugin,
    isPluginInstalled,
    getPluginVersion
} from './utils';

// Export constants
export {
    PLUGIN_SOURCES,
    ICON_CONTEXT_MENU,
    ICON_UPDATE,
    ICON_PLUGIN_STORE,
    ICON_PLUGIN_CONFIG,
    ICON_MORE_VERT,
    ICON_BREEZE,
    theme_presets,
    animation_presets,
    WINDOW_WIDTH,
    WINDOW_HEIGHT,
    SIDEBAR_WIDTH
} from './constants';

import * as shell from "mshell";
import React from "react";
import { createRenderer } from "../react/renderer";
import ConfigApp from './ConfigApp';

const DEFAULT_WINDOW_WIDTH = 800;
const DEFAULT_WINDOW_HEIGHT = 600;

let existingConfigWindow: shell.breeze_ui.window | null = null;
export const showConfigPage = () => {
    shell.breeze.set_can_reload_js(false);
    const win = shell.breeze_ui.window.create_ex("Breeze Config", DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT, () => {
        shell.breeze.set_can_reload_js(true)
        if (existingConfigWindow === win)
            existingConfigWindow = null;
    });
    if (existingConfigWindow)
        existingConfigWindow.close();
    existingConfigWindow = win;

    const widget = shell.breeze_ui.widgets_factory.create_flex_layout_widget();
    const renderer = createRenderer(widget);

    const onResize = (w: number, h: number) => {
        try {
            renderer.render(React.createElement(ConfigApp, { initialWidth: w, initialHeight: h }));
        } catch (error) {
            shell.println(`[ConfigPage] Render error: ${error}`);
        }
    };

    // Initial render
    onResize(DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT);
    win.set_root_widget(widget);

    interface WindowWithResize extends shell.breeze_ui.window {
        set_resize_callback?: (callback: (w: number, h: number) => void) => void;
    }
    const winWithResize = win as WindowWithResize;
    // Listen for resize events if supported
    if (winWithResize.set_resize_callback) {
        winWithResize.set_resize_callback(onResize);
    }
}
