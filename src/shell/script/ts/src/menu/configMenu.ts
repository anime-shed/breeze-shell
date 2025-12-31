import * as shell from "mshell"
import { PLUGIN_SOURCES } from "../plugin/constants"
import { get_async } from "../utils/network"
import { splitIntoLines } from "../utils/string"
import { getNestedValue, setNestedValue } from "../utils/object"
import { config_dir_watch_callbacks } from "../plugin/core"
import { languages, ICON_EMPTY, ICON_CHECKED, ICON_CHANGE, ICON_REPAIR } from "./constants"
import { t, currentLanguage } from "../shared/i18n"

let cached_plugin_index: any = null

// remove possibly existing shell_old.dll if able to
if (shell.fs.exists(shell.breeze.data_directory() + '/shell_old.dll')) {
    try {
        shell.fs.remove(shell.breeze.data_directory() + '/shell_old.dll')
    } catch (e) {
        shell.println('Failed to remove old shell.dll: ', e)
    }
}

let current_source = 'Enlysure'

export const makeBreezeConfigMenu = (mainMenu) => {
    const currentLang = currentLanguage()

    const fg_color = shell.breeze.is_light_theme() ? 'black' : 'white'
    const ICON_CHECKED_COLORED = ICON_CHECKED.replaceAll('currentColor', fg_color)
    const ICON_CHANGE_COLORED = ICON_CHANGE.replaceAll('currentColor', fg_color)
    const ICON_REPAIR_COLORED = ICON_REPAIR.replaceAll('currentColor', fg_color)

    return {
        name: t("menu.manage"),
        submenu(sub) {
            sub.append_menu({
                name: t("menu.pluginMarket"),
                submenu(sub) {
                    const updatePlugins = async (page) => {
                        for (const m of sub.get_items().slice(1))
                            m.remove()

                        sub.append_menu({
                            name: t('status.loading')
                        })

                        if (!cached_plugin_index) {
                            cached_plugin_index = await get_async(PLUGIN_SOURCES[current_source] + 'plugins-index.json')
                        }
                        const data = JSON.parse(cached_plugin_index)

                        for (const m of sub.get_items().slice(1))
                            m.remove()

                        const current_version = shell.breeze.version();
                        const remote_version = data.shell.version;

                        const exist_old_file = shell.fs.exists(shell.breeze.data_directory() + '/shell_old.dll')

                        const upd = sub.append_menu({
                            name: exist_old_file ?
                                t('status.updatePending') :
                                (current_version === remote_version ?
                                    (current_version + ' (latest)') :
                                    `${current_version} -> ${remote_version}`),
                            icon_svg: current_version === remote_version ? ICON_CHECKED_COLORED : ICON_CHANGE_COLORED,
                            action() {
                                if (current_version === remote_version) return
                                const shellPath = shell.breeze.data_directory() + '/shell.dll'
                                const shellOldPath = shell.breeze.data_directory() + '/shell_old.dll'
                                const url = PLUGIN_SOURCES[current_source] + data.shell.path

                                upd.set_data({
                                    name: t('status.updating'),
                                    icon_svg: ICON_REPAIR_COLORED,
                                    disabled: true
                                })

                                const downloadNewShell = () => {
                                    shell.network.download_async(url, shellPath, () => {
                                        upd.set_data({
                                            name: t('status.updatePending'),
                                            icon_svg: ICON_CHECKED_COLORED,
                                            disabled: true
                                        })
                                    }, e => {
                                        upd.set_data({
                                            name: t('status.updateFailed') + ': ' + e,
                                            icon_svg: ICON_REPAIR_COLORED,
                                            disabled: false
                                        })
                                    })
                                }

                                try {
                                    if (shell.fs.exists(shellPath)) {
                                        if (shell.fs.exists(shellOldPath)) {
                                            try {
                                                shell.fs.remove(shellOldPath)
                                                shell.fs.rename(shellPath, shellOldPath)
                                                downloadNewShell()
                                            } catch (e) {
                                                upd.set_data({
                                                    name: t('status.updateFailed') + ': ' + t('error.cannotMoveFile'),
                                                    icon_svg: ICON_REPAIR_COLORED,
                                                    disabled: false
                                                })
                                            }
                                        } else {
                                            shell.fs.rename(shellPath, shellOldPath)
                                            downloadNewShell()
                                        }
                                    } else {
                                        downloadNewShell()
                                    }
                                } catch (e) {
                                    upd.set_data({
                                        name: t('status.updateFailed') + ': ' + e,
                                        icon_svg: ICON_REPAIR_COLORED,
                                        disabled: false
                                    })
                                }
                            },
                            submenu(sub) {
                                for (const line of splitIntoLines(data.shell.changelog, 40)) {
                                    sub.append_menu({
                                        name: line
                                    })
                                }
                            }
                        })

                        sub.append_menu({
                            type: 'spacer'
                        })

                        const plugins_page = data.plugins.slice((page - 1) * 10, page * 10)
                        for (const plugin of plugins_page) {
                            let install_path = null;
                            if (shell.fs.exists(shell.breeze.data_directory() + '/scripts/' + plugin.local_path)) {
                                install_path = shell.breeze.data_directory() + '/scripts/' + plugin.local_path
                            }

                            if (shell.fs.exists(shell.breeze.data_directory() + '/scripts/' + plugin.local_path + '.disabled')) {
                                install_path = shell.breeze.data_directory() + '/scripts/' + plugin.local_path + '.disabled'
                            }
                            const installed = install_path !== null

                            const local_version_match = installed ? shell.fs.read(install_path).match(/\/\/ @version:\s*(.*)/) : null
                            const local_version = local_version_match ? local_version_match[1] : t('plugins.not_installed')
                            const have_update = installed && local_version !== plugin.version

                            const disabled = installed && !have_update

                            let preview_sub = null
                            const m = sub.append_menu({
                                name: plugin.name + (have_update ? ` (${local_version} -> ${plugin.version})` : ''),
                                action() {
                                    if (disabled) return
                                    if (preview_sub) {
                                        preview_sub.close()
                                    }
                                    m.set_data({
                                        name: plugin.name,
                                        icon_svg: ICON_CHANGE_COLORED,
                                        disabled: true
                                    })
                                    const path = shell.breeze.data_directory() + '/scripts/' + plugin.local_path
                                    const url = PLUGIN_SOURCES[current_source] + plugin.path
                                    get_async(url).then(data => {
                                        shell.fs.write(path, data as string)
                                        m.set_data({
                                            name: plugin.name,
                                            icon_svg: ICON_CHECKED_COLORED,
                                            action() { },
                                            disabled: true
                                        })

                                        shell.println(t('status.pluginInstalled') + ': ' + plugin.name)

                                        reload_local()
                                    }).catch(e => {
                                        m.set_data({
                                            name: plugin.name,
                                            icon_svg: ICON_REPAIR_COLORED,
                                            submenu(sub) {
                                                sub.append_menu({
                                                    name: e
                                                })
                                                sub.append_menu({
                                                    name: url,
                                                    action() {
                                                        shell.clipboard.set_text(url)
                                                        mainMenu.close()
                                                    }
                                                })
                                            },
                                            disabled: false
                                        })

                                        shell.println(e)
                                        shell.println(e.stack)
                                    })
                                },
                                submenu(sub) {
                                    preview_sub = sub
                                    sub.append_menu({
                                        name: t('plugin.version') + ': ' + plugin.version
                                    })
                                    sub.append_menu({
                                        name: t('plugin.author') + ': ' + plugin.author
                                    })

                                    for (const line of splitIntoLines(plugin.description, 40)) {
                                        sub.append_menu({
                                            name: line
                                        })
                                    }
                                },
                                disabled: disabled,
                                icon_svg: disabled ? ICON_CHECKED_COLORED : ICON_EMPTY,
                            })
                        }

                    }
                    const source = sub.append_menu({
                        name: t('plugin.currentSource') + ': ' + current_source,
                        submenu(sub) {
                            for (const key in PLUGIN_SOURCES) {
                                sub.append_menu({
                                    name: key,
                                    action() {
                                        current_source = key
                                        cached_plugin_index = null
                                        source.set_data({
                                            name: t('plugin.currentSource') + ': ' + key
                                        })
                                        updatePlugins(1)
                                    },
                                    disabled: false
                                })
                            }
                        }
                    })

                    updatePlugins(1)
                }
            })
            sub.append_menu({
                name: t("menu.settings"),
                submenu(sub) {
                    const current_config_path = shell.breeze.data_directory() + '/config.json'
                    const current_config = shell.fs.read(current_config_path)
                    let config = JSON.parse(current_config);
                    if (!config.plugin_load_order) {
                        config.plugin_load_order = [];
                    }

                    const write_config = () => {
                        shell.fs.write(current_config_path, JSON.stringify(config, null, 4))
                    }

                    sub.append_menu({
                        name: t("settings.priority_load_plugins"),
                        submenu(sub) {
                            const plugins = shell.fs.readdir(shell.breeze.data_directory() + '/scripts')
                                .map(v => v.split('/').pop())
                                .filter(v => v.endsWith('.js'))
                                .map(v => v.replace('.js', ''));

                            const isInLoadOrder = {};
                            config.plugin_load_order.forEach(name => {
                                isInLoadOrder[name] = true;
                            });

                            for (const plugin of plugins) {
                                let isPrioritized = isInLoadOrder[plugin] === true;

                                const btn = sub.append_menu({
                                    name: plugin,
                                    icon_svg: isPrioritized ? ICON_CHECKED_COLORED : ICON_EMPTY,
                                    action() {
                                        if (isPrioritized) {
                                            config.plugin_load_order = config.plugin_load_order.filter(name => name !== plugin);
                                            isInLoadOrder[plugin] = false;
                                            btn.set_data({
                                                icon_svg: ICON_EMPTY
                                            });
                                        } else {
                                            config.plugin_load_order.unshift(plugin);
                                            isInLoadOrder[plugin] = true;
                                            btn.set_data({
                                                icon_svg: ICON_CHECKED_COLORED
                                            });
                                        }

                                        isPrioritized = !isPrioritized
                                        write_config();
                                    }
                                });
                            }
                        }
                    });

                    const createBoolToggle = (sub, label, configPath, defaultValue = false) => {
                        let currentValue = getNestedValue(config, configPath) ?? defaultValue;

                        const toggle = sub.append_menu({
                            name: label,
                            icon_svg: currentValue ? ICON_CHECKED_COLORED : ICON_EMPTY,
                            action() {
                                currentValue = !currentValue;
                                setNestedValue(config, configPath, currentValue);
                                write_config();
                                toggle.set_data({
                                    icon_svg: currentValue ? ICON_CHECKED_COLORED : ICON_EMPTY,
                                    disabled: false
                                });
                            }
                        });
                        return toggle;
                    };

                    sub.append_spacer()

                    const theme_presets = {
                        "default": null, // "默认"
                        "compact": { // "紧凑"
                            radius: 4.0,
                            item_height: 20.0,
                            item_gap: 2.0,
                            item_radius: 3.0,
                            margin: 4.0,
                            padding: 4.0,
                            text_padding: 6.0,
                            icon_padding: 3.0,
                            right_icon_padding: 16.0,
                            multibutton_line_gap: -4.0
                        },
                        "relaxed": { // "宽松"
                            radius: 6.0,
                            item_height: 24.0,
                            item_gap: 4.0,
                            item_radius: 8.0,
                            margin: 6.0,
                            padding: 6.0,
                            text_padding: 8.0,
                            icon_padding: 4.0,
                            right_icon_padding: 20.0,
                            multibutton_line_gap: -6.0
                        },
                        "rounded": { // "圆角"
                            radius: 12.0,
                            item_radius: 12.0
                        },
                        "square": { // "方角"
                            radius: 0.0,
                            item_radius: 0.0
                        }
                    };

                    const anim_none = {
                        easing: "mutation",
                    }
                    const animation_presets = {
                        "default": null, // "默认"
                        "fast": { // "快速"
                            "item": {
                                "opacity": {
                                    "delay_scale": 0
                                },
                                "width": anim_none,
                                "x": anim_none,
                            },
                            "submenu_bg": {
                                "opacity": {
                                    "delay_scale": 0,
                                    "duration": 100
                                }
                            },
                            "main_bg": {
                                "opacity": anim_none,
                            }
                        },
                        "none": { // "无"
                            "item": {
                                "opacity": anim_none,
                                "width": anim_none,
                                "x": anim_none,
                                "y": anim_none
                            },
                            "submenu_bg": {
                                "opacity": anim_none,
                                "x": anim_none,
                                "y": anim_none,
                                "w": anim_none,
                                "h": anim_none
                            },
                            "main_bg": {
                                "opacity": anim_none,
                                "x": anim_none,
                                "y": anim_none,
                                "w": anim_none,
                                "h": anim_none
                            }
                        }
                    };

                    const getAllSubkeys = (presets) => {
                        if (!presets) return []
                        const keys = new Set();

                        for (const v of Object.values(presets)) {
                            if (v)
                                for (const key of Object.keys(v)) {
                                    keys.add(key);
                                }
                        }

                        return [...keys]
                    }

                    const applyPreset = (preset, origin, presets) => {
                        const allSubkeys = getAllSubkeys(presets);
                        const newPreset = preset;
                        for (let key in origin) {
                            if (allSubkeys.includes(key)) continue;
                            newPreset[key] = origin[key];
                        }
                        return newPreset;
                    }

                    const checkPresetMatch = (current, preset) => {
                        if (!current) return false;
                        if (!preset) return false;
                        return Object.keys(preset).every(key => JSON.stringify(current[key]) === JSON.stringify(preset[key]))

                    };

                    const getCurrentPreset = (current, presets) => {
                        if (!current) return "default";
                        for (const [name, preset] of Object.entries(presets)) {
                            if (preset && checkPresetMatch(current, preset)) {
                                return name;
                            }
                        }
                        return "custom";
                    };

                    const updateIconStatus = (sub, current, presets, translationPrefix) => {
                        try {
                            const currentPreset = getCurrentPreset(current, presets);
                            for (const _item of sub.get_items()) {
                                const item = _item.data();
                                // Match translated name
                                if (item.name === t(translationPrefix + currentPreset)) {
                                    _item.set_data({
                                        icon_svg: ICON_CHECKED_COLORED,
                                        disabled: true
                                    });
                                } else {
                                    _item.set_data({
                                        icon_svg: ICON_EMPTY,
                                        disabled: false
                                    });
                                }
                            }

                            const lastItem = sub.get_items().pop()
                            const customName = t("theme.custom");
                            if (lastItem.data().name === customName && currentPreset !== "custom") {
                                lastItem.remove()
                            } else if (currentPreset === "custom") {
                                sub.append_menu({
                                    name: customName,
                                    disabled: true,
                                    icon_svg: ICON_CHECKED_COLORED,
                                });
                            }
                        } catch (e) {
                            shell.println(e, e.stack)
                        }
                    }

                    sub.append_menu({
                        name: t("settings.theme"),
                        submenu(sub) {
                            const currentTheme = config.context_menu?.theme;

                            for (const [name, preset] of Object.entries(theme_presets)) {
                                sub.append_menu({
                                    name: t("theme." + name),
                                    action() {
                                        try {
                                            if (!preset) {
                                                delete config.context_menu.theme;
                                            } else {
                                                config.context_menu.theme = applyPreset(preset, config.context_menu.theme, theme_presets);
                                            }
                                            write_config();
                                            updateIconStatus(sub, config.context_menu.theme, theme_presets, "theme.");
                                        } catch (e) {
                                            shell.println(e, e.stack)
                                        }
                                    }
                                });
                            }

                            updateIconStatus(sub, currentTheme, theme_presets, "theme.");
                        }
                    });

                    sub.append_menu({
                        name: t("settings.animation"),
                        submenu(sub) {
                            const currentAnimation = config.context_menu?.theme?.animation;

                            for (const [name, preset] of Object.entries(animation_presets)) {
                                sub.append_menu({
                                    name: t("animation." + name),
                                    action() {
                                        if (!preset) {
                                            if (config.context_menu?.theme) {
                                                delete config.context_menu.theme.animation;
                                            }
                                        } else {
                                            if (!config.context_menu) config.context_menu = {};
                                            if (!config.context_menu.theme) config.context_menu.theme = {};
                                            config.context_menu.theme.animation = preset;
                                        }

                                        updateIconStatus(sub, config.context_menu.theme?.animation, animation_presets, "animation.");
                                        write_config();
                                    }
                                });
                            }

                            updateIconStatus(sub, currentAnimation, animation_presets, "animation.");
                        }
                    });

                    sub.append_spacer()

                    createBoolToggle(sub, t("settings.debugConsole"), "debug_console", false);
                    createBoolToggle(sub, t("settings.vsync"), "context_menu.vsync", true);
                    createBoolToggle(sub, t("settings.ignoreOwnerDraw"), "context_menu.ignore_owner_draw", true);
                    createBoolToggle(sub, t("settings.reverseIfOpenUp"), "context_menu.reverse_if_open_to_up", true);
                    createBoolToggle(sub, t("settings.useWin11RoundedCorners"), "context_menu.theme.use_dwm_if_available", true);
                    createBoolToggle(sub, t("settings.acrylicEffect"), "context_menu.theme.acrylic", true);
                }
            })

            sub.append_spacer()


            const reload_local = () => {
                const installed = shell.fs.readdir(shell.breeze.data_directory() + '/scripts')
                    .map(v => v.split('/').pop())
                    .filter(v => v.endsWith('.js') || v.endsWith('.disabled'))

                for (const m of sub.get_items().slice(3))
                    m.remove()

                for (const plugin of installed) {
                    let disabled = plugin.endsWith('.disabled')
                    let name = plugin.replace('.js', '').replace('.disabled', '')
                    const m = sub.append_menu({
                        name,
                        icon_svg: disabled ? ICON_EMPTY : ICON_CHECKED_COLORED,
                        action() {
                            if (disabled) {
                                shell.fs.rename(shell.breeze.data_directory() + '/scripts/' + name + '.js.disabled', shell.breeze.data_directory() + '/scripts/' + name + '.js')
                                m.set_data({
                                    name,
                                    icon_svg: ICON_CHECKED_COLORED
                                })
                            } else {
                                shell.fs.rename(shell.breeze.data_directory() + '/scripts/' + name + '.js', shell.breeze.data_directory() + '/scripts/' + name + '.js.disabled')
                                m.set_data({
                                    name,
                                    icon_svg: ICON_EMPTY
                                })
                            }

                            disabled = !disabled
                        },
                        submenu(sub) {
                            sub.append_menu({
                                name: t('action.delete'),
                                action() {
                                    shell.fs.remove(shell.breeze.data_directory() + '/scripts/' + plugin)
                                    m.remove()
                                    sub.close()
                                }
                            })

                            if (on_plugin_menu[name]) {
                                on_plugin_menu[name](sub)
                            }
                        }
                    })
                }
            }

            reload_local()
        }
    }
}