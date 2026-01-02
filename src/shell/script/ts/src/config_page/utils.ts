import * as shell from "mshell";
import { } from "./constants";
import { t, currentLanguage, isRTL } from "../shared/i18n";
import { menu_controller } from "mshell";
import { useState, useEffect, } from "react";

export const useHoverActive = () => {
    const [isHovered, setIsHovered] = useState(false);
    const [isActive, setIsActive] = useState(false);

    const onMouseEnter = () => setIsHovered(true);
    const onMouseLeave = () => setIsHovered(false);
    const onMouseDown = () => setIsActive(true);
    const onMouseUp = () => setIsActive(false);

    return { isHovered, isActive, onMouseEnter, onMouseLeave, onMouseDown, onMouseUp };
};


export const showMenu = (callback: (ctl: menu_controller) => void) => {
    const menu = menu_controller.create_detached();
    callback(menu);
    menu.show_at_cursor();
}

// Utility functions for nested object manipulation
export const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((o, k) => o?.[k], obj);
};

export const setNestedValue = (obj: any, path: string, value: any) => {
    const keys = path.split('.');
    const last = keys.pop()!;
    const target = keys.reduce((o, k) => o[k] = o[k] || {}, obj);
    target[last] = value;
};

// Translation helper using unified i18n system
export const useTranslation = () => {
    const currentLang = currentLanguage();
    return { t, currentLang, isRTL };
};

// Theme preset utilities
export const getAllSubkeys = (presets: any) => {
    if (!presets) return [];
    const keys = new Set();
    for (const v of Object.values(presets)) {
        if (v)
            for (const key of Object.keys(v)) {
                keys.add(key);
            }
    }
    return [...keys];
};

export const applyPreset = (preset: any, origin: any, presets: any) => {
    const allSubkeys = getAllSubkeys(presets);
    const newPreset = preset ? { ...preset } : {};
    for (let key in origin) {
        if (allSubkeys.includes(key)) continue;
        newPreset[key] = origin[key];
    }
    return newPreset;
};

export const checkPresetMatch = (current: any, preset: any, ignoreKeys: string[] = []) => {
    if (!current) return false;
    if (!preset) return false;
    return Object.keys(preset).every(key => {
        if (ignoreKeys.includes(key)) return true;
        return JSON.stringify(current[key]) === JSON.stringify(preset[key]);
    });
};

export const getCurrentPreset = (current: any, presets: any, ignoreKeys: string[] = []) => {
    // If the object is empty or only contains ignored keys, it's default
    const allPresetKeys = getAllSubkeys(presets);
    const hasAnyPresetKey = current && Object.keys(current).some(k => allPresetKeys.includes(k) && !ignoreKeys.includes(k));

    if (!current || !hasAnyPresetKey) return "default";

    for (const [name, preset] of Object.entries(presets)) {
        if (preset && checkPresetMatch(current, preset, ignoreKeys)) {
            return name;
        }
    }
    return "custom";
};

// Config file operations

export const loadConfig = (): any => {
    try {
        const current_config_path = shell.breeze.data_directory() + '/config.json';
        const current_config = shell.fs.read(current_config_path);
        return JSON.parse(current_config);
    } catch (error) {
        console.error('Failed to load config:', error);
        // Return default config if file is missing or corrupted
        return {};
    }
};


export const saveConfig = (config: any): void => {
    try {
        const configPath = shell.breeze.data_directory() + '/config.json';
        const configJson = JSON.stringify(config, null, 4);
        shell.fs.write(configPath, configJson);
    } catch (error) {
        console.error('Failed to save config:', error);
        throw new Error(`Failed to save configuration: ${error}`);
    }
};

// Plugin utilities

export const loadPlugins = (): string[] => {
    try {
        const scriptsPath = shell.breeze.data_directory() + '/scripts';
        const files = shell.fs.readdir(scriptsPath);
        return files
            .map(v => v.split('/').pop())
            .filter(v => v.endsWith('.js') || v.endsWith('.disabled'))
            .map(v => v.replace('.js', '').replace('.disabled', ''));
    } catch (error) {
        console.error('Failed to load plugins:', error);
        return [];
    }
};

export const togglePlugin = (name: string) => {
    const path = shell.breeze.data_directory() + '/scripts/' + name;
    if (shell.fs.exists(path + '.js')) {
        shell.fs.rename(path + '.js', path + '.js.disabled');
    } else if (shell.fs.exists(path + '.js.disabled')) {
        shell.fs.rename(path + '.js.disabled', path + '.js');
    }
};

export const deletePlugin = (name: string) => {
    const path = shell.breeze.data_directory() + '/scripts/' + name;
    if (shell.fs.exists(path + '.js')) {
        shell.fs.remove(path + '.js');
    }
    if (shell.fs.exists(path + '.js.disabled')) {
        shell.fs.remove(path + '.js.disabled');
    }
};

export const isPluginInstalled = (plugin: any) => {
    if (shell.fs.exists(shell.breeze.data_directory() + '/scripts/' + plugin.local_path)) {
        return shell.breeze.data_directory() + '/scripts/' + plugin.local_path;
    }
    if (shell.fs.exists(shell.breeze.data_directory() + '/scripts/' + plugin.local_path + '.disabled')) {
        return shell.breeze.data_directory() + '/scripts/' + plugin.local_path + '.disabled';
    }
    return null;
};


export const getPluginVersion = (installPath: string): string => {
    try {
        const content = shell.fs.read(installPath);
        const local_version_match = content.match(/\/\/ @version:\s*(.*)/);
        return local_version_match ? local_version_match[1] : t('plugins.not_installed');
    } catch (error) {
        console.error('Failed to get plugin version:', error);
        return t('plugins.not_installed');
    }
};


export const useTextTruncation = (text: string, maxWidth: number) => {
    const [truncatedText, setTruncatedText] = useState(text);

    useEffect(() => {
        // Simple text truncation with ellipsis
        if (text.length <= 10 || maxWidth <= 0) {
            setTruncatedText(text);
            return;
        }

        // Truncate at word boundaries when possible
        const ellipsis = '...';
        const maxChars = Math.max(10, Math.floor(maxWidth / 8)); // Rough estimate

        if (text.length <= maxChars) {
            setTruncatedText(text);
        } else {
            // Try to truncate at word boundary
            const truncated = text.substring(0, maxChars);
            const lastSpaceIndex = truncated.lastIndexOf(' ');
            if (lastSpaceIndex === -1) {
                setTruncatedText(truncated + ellipsis);
            } else if (lastSpaceIndex > maxChars * 0.8) {
                setTruncatedText(truncated + ellipsis);
            } else {
                setTruncatedText(truncated.substring(0, lastSpaceIndex) + ellipsis);
            }
        }
    }, [text, maxWidth]);

    return truncatedText;
};


export const useResponsive = (width: number) => {
    const getBreakpoint = (width: number): string => {
        if (width >= 1200) return 'xl';
        if (width >= 992) return 'lg';
        if (width >= 768) return 'md';
        if (width >= 576) return 'sm';
        return 'xs';
    };

    const [breakpoint, setBreakpoint] = useState(() => getBreakpoint(width));

    useEffect(() => {
        const newBreakpoint = getBreakpoint(width);
        setBreakpoint(prev => prev !== newBreakpoint ? newBreakpoint : prev);
    }, [width]);

    return {
        breakpoint,
        isMobile: width < 768,
        isTablet: width >= 768 && width < 992,
        isDesktop: width >= 992,
        isWidescreen: width >= 1200
    };
};


export const usePerformanceMetrics = () => {
    const [fps, setFps] = useState(60);
    const [memoryUsage, setMemoryUsage] = useState(0);
    const [frameDrops, setFrameDrops] = useState(0);
    const [slowFrames, setSlowFrames] = useState(0);

    useEffect(() => {
        let frameCount = 0;
        let lastTime = Date.now();
        let rafId: number | null = null;
        let cancelled = false;

        const measurePerformance = () => {
            if (cancelled) {
                return; // Bail out immediately if cancelled
            }

            const now = Date.now();
            const delta = now - lastTime;
            const currentFps = Math.round(1000 / delta);

            frameCount++;

            // Update FPS every 10 frames
            if (frameCount % 10 === 0) {
                setFps(currentFps);

                // Detect performance issues
                if (currentFps < 55) {
                    setFrameDrops(prev => prev + 1);
                    setSlowFrames(prev => prev + 1);
                }
            }

            lastTime = now;

            // Continue measuring if not cancelled
            if (!cancelled && typeof requestAnimationFrame !== 'undefined') {
                rafId = requestAnimationFrame(measurePerformance);
            }
        };

        // Start performance monitoring
        rafId = requestAnimationFrame(measurePerformance);

        return () => {
            // Cleanup function - cancel the RAF loop
            cancelled = true;
            if (rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
                cancelAnimationFrame(rafId);
            }
        };
    }, []); // Only run once

    useEffect(() => {
        // Monitor memory usage (simplified for this environment)
        const checkMemory = () => {
            try {
                if (shell && (shell as any).performance && (shell as any).performance.memory) {
                    const memory = (shell as any).performance.memory();
                    const usedMB = memory.usedJSHeapSize / (1024 * 1024);
                    setMemoryUsage(Math.round(usedMB));
                }
            } catch (error) {
                console.error('Memory monitoring error:', error);
            }
        };

        // Check memory every 5 seconds
        const interval = setInterval(checkMemory, 5000);

        return () => {
            clearInterval(interval);
        };
    }, []);

    return {
        fps,
        memoryUsage,
        frameDrops,
        slowFrames,
        isPerformanceIssue: fps < 55 || frameDrops > 10,

        
        ...(typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost' ? {
            showPerformanceWarning: true
        } : {})
    };
};


export const reportPerformanceIssue = (type: 'low-fps' | 'high-memory' | 'frame-drops', details: string) => {
    console.warn(`[Performance Issue] ${type}: ${details}`);

    if (typeof shell !== 'undefined' && (shell as any).notify) {
        (shell as any).notify({
            title: 'Performance Warning',
            message: `${type}: ${details}`,
            type: 'warning'
        });
    }
};

export const optimizePerformance = () => {
    // Automatic optimizations based on current performance
    return {
        reduceAnimations: false, // Can be set to true if needed
        disableShadows: false,
        lowerQualityRendering: false
    };
};