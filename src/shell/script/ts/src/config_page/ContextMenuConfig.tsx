import * as shell from "mshell";
import { Button, Text, Toggle } from "./components";
import { ContextMenuContext, DebugConsoleContext, GlobalConfigContext } from "./contexts";
import { useTranslation, getNestedValue, setNestedValue, applyPreset, getCurrentPreset } from "./utils";
import { theme_presets, animation_presets } from "./constants";
import { memo, useContext, useEffect, useState } from "react";
const ContextMenuConfig = memo(() => {
    const { config, update } = useContext(ContextMenuContext)!;
    const { value: debugConsole, update: updateDebugConsole } = useContext(DebugConsoleContext)!;
    const { config: globalConfig, update: updateGlobal } = useContext(GlobalConfigContext)!;
    const { t } = useTranslation();

    // Language state
    const [languages, setLanguages] = useState<string[]>([]);
    useEffect(() => {
        setLanguages(shell.breeze.available_languages());
    }, []);
    const currentLang = globalConfig?.language || shell.breeze.user_language();

    const currentTheme = config?.theme;
    const currentAnimation = config?.theme?.animation;



    const currentThemePreset = getCurrentPreset(currentTheme, theme_presets, ['animation']);
    const currentAnimationPreset = getCurrentPreset(currentAnimation, animation_presets);

    return (
        <flex gap={20} alignItems="stretch" flexGrow={1}>
            <Text fontSize={24}>{t("settings.title")}</Text>

            <flex gap={10}>
                <Text fontSize={18}>{t("settings.language") || "Language"}</Text>
                <flex horizontal gap={10}>
                    {languages.map(lang => (
                        <Button
                            key={lang}
                            selected={lang === currentLang}
                            onClick={() => {
                                shell.breeze.set_language(lang);
                                updateGlobal({ ...globalConfig, language: lang });
                            }}
                        >
                            <Text fontSize={14}>{t("language." + lang) || lang}</Text>
                        </Button>
                    ))}
                </flex>
            </flex>

            <flex />
            <flex gap={10}>
                <Text fontSize={18}>{t("settings.theme")}</Text>
                <flex horizontal gap={10}>
                    {Object.keys(theme_presets).map(name => (
                        <Button
                            key={name}
                            selected={name === currentThemePreset}
                            onClick={() => {
                                try {
                                    const newTheme = applyPreset(theme_presets[name], config?.theme, theme_presets);
                                    update({ ...config, theme: newTheme });
                                } catch (e) {
                                    shell.println(e);
                                }
                            }}
                        >
                            <Text fontSize={14}>{t(`theme.${name}`) || name}</Text>
                        </Button>
                    ))}
                </flex>
            </flex>

            <flex gap={10}>
                <Text fontSize={18}>{t("settings.animation")}</Text>
                <flex horizontal gap={10}>
                    {Object.keys(animation_presets).map(name => (
                        <Button
                            key={name}
                            selected={name === currentAnimationPreset}
                            onClick={() => {
                                try {
                                    const newAnimation = applyPreset(animation_presets[name], config?.theme?.animation, animation_presets);
                                    update({ ...config, theme: { ...config.theme, animation: Object.keys(newAnimation).length ? newAnimation : undefined } });
                                } catch (e) {
                                    shell.println(e);
                                }
                            }}
                        >
                            <Text fontSize={14}>{t(`animation.${name}`) || name}</Text>
                        </Button>
                    ))}
                </flex>
            </flex>

            <flex gap={10} alignItems="stretch" justifyContent="center">
                <Text fontSize={18}>{t("settings.misc")}</Text>
                <Toggle label={t("settings.debug_console")} value={debugConsole} onChange={updateDebugConsole} />
                <Toggle label={t("settings.vsync")} value={getNestedValue(config, "vsync") ?? true} onChange={(v) => {
                    const newConfig = { ...config };
                    setNestedValue(newConfig, "vsync", v);
                    update(newConfig);
                }} />
                <Toggle label={t("settings.ignore_owner_draw")} value={getNestedValue(config, "ignore_owner_draw") ?? true} onChange={(v) => {
                    const newConfig = { ...config };
                    setNestedValue(newConfig, "ignore_owner_draw", v);
                    update(newConfig);
                }} />
                <Toggle label={t("settings.reverse_if_open_to_up")} value={getNestedValue(config, "reverse_if_open_to_up") ?? true} onChange={(v) => {
                    const newConfig = { ...config };
                    setNestedValue(newConfig, "reverse_if_open_to_up", v);
                    update(newConfig);
                }} />
                <Toggle label={t("settings.use_dwm_round_corners")} value={getNestedValue(config, "theme.use_dwm_if_available") ?? true} onChange={(v) => {
                    const newConfig = { ...config };
                    setNestedValue(newConfig, "theme.use_dwm_if_available", v);
                    update(newConfig);
                }} />
                <Toggle label={t("settings.acrylic_background")} value={getNestedValue(config, "theme.acrylic") ?? true} onChange={(v) => {
                    const newConfig = { ...config };
                    setNestedValue(newConfig, "theme.acrylic", v);
                    update(newConfig);
                }} />
                <Toggle label={t("settings.keyboard_hotkeys")} value={getNestedValue(config, "hotkeys") ?? true} onChange={(v) => {
                    const newConfig = { ...config };
                    setNestedValue(newConfig, "hotkeys", v);
                    update(newConfig);
                }} />
                <Toggle label={t("settings.show_settings_button")} value={getNestedValue(config, "show_settings_button") ?? true} onChange={(v) => {
                    const newConfig = { ...config };
                    setNestedValue(newConfig, "show_settings_button", v);
                    update(newConfig);
                }} />
            </flex>
        </flex>
    );
});

export default ContextMenuConfig;