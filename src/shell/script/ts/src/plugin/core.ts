import * as shell from "mshell"
import { getNestedValue, setNestedValue } from "../utils/object"

export const config_directory_main = shell.breeze.data_directory() + '/config/';

export const config_dir_watch_callbacks = new Set<(path: string, type: number) => void>();

shell.fs.mkdir(config_directory_main)
shell.fs.watch(config_directory_main, (path: string, type: number) => {
    for (const callback of config_dir_watch_callbacks) {
        callback(path, type)
    }
})

globalThis.on_plugin_menu = {}

export const plugin = (import_meta, default_config = {}) => {
    const CONFIG_FILE = 'config.json'

    const { name, url } = import_meta
    const languages = {}

    const nameNoExt = name.endsWith('.js') ? name.slice(0, -3) : name

    let config = default_config

    const on_reload_callbacks = new Set<(config: any) => void>()

    const plugin = {
        i18n: {
            /**
             * Define translations for a language
             * @param lang Language code (e.g., "en-US", "zh-CN")
             * @param data Object mapping keys to translations
             */
            define: (lang: string, data: Record<string, string>) => {
                // Register with the unified i18n system
                shell.breeze.register_translations(lang, data);
                // Also keep local copy for backward compatibility
                languages[lang] = data;
            },
            /**
             * Get a translated string
             * @param key Translation key
             * @param params Optional interpolation parameters
             */
            t: (key: string, params?: Record<string, string>): string => {
                // Get the translation from the unified i18n system
                const translation = shell.breeze.get_translation(key);

                // If params provided, perform local interpolation
                if (params && Object.keys(params).length > 0) {
                    return translation.replace(/{(\w+)}/g, (match, k) => {
                        return params.hasOwnProperty(k) ? params[k] : match;
                    });
                }

                return translation;
            },
            /**
             * Check if current language is RTL
             */
            isRTL: (): boolean => {
                return shell.breeze.is_rtl();
            }
        },
        set_on_menu: (callback: (m: shell.menu_controller) => void) => {
            globalThis.on_plugin_menu[nameNoExt] = callback
        },
        config_directory: config_directory_main + nameNoExt + '/',
        config: {
            read_config() {
                if (shell.fs.exists(plugin.config_directory + CONFIG_FILE)) {
                    try {
                        config = JSON.parse(shell.fs.read(plugin.config_directory + CONFIG_FILE))
                    } catch (e) {
                        shell.println(`[${name}] 配置文件解析失败: ${e}`)
                    }
                }
            },
            write_config() {
                shell.fs.write(plugin.config_directory + CONFIG_FILE, JSON.stringify(config, null, 4))
            },
            get(key) {
                return getNestedValue(config, key) || getNestedValue(default_config, key) || null
            },
            set(key, value) {
                setNestedValue(config, key, value)
                plugin.config.write_config()
            },
            all() {
                return config
            },
            on_reload(callback) {
                const dispose = () => {
                    on_reload_callbacks.delete(callback)
                }
                on_reload_callbacks.add(callback)
                return dispose
            }
        },
        log(...args) {
            shell.println(`[${name}]`, ...args)
        }
    }

    shell.fs.mkdir(plugin.config_directory)
    plugin.config.read_config()
    config_dir_watch_callbacks.add((path, type) => {
        const relativePath = path.replace(config_directory_main, '');
        if (relativePath === `${nameNoExt}\\${CONFIG_FILE}`) {
            shell.println(`[${name}] 配置文件变更: ${path} ${type}`)
            plugin.config.read_config()
            for (const callback of on_reload_callbacks) {
                callback(config)
            }
        }
    })

    return plugin
}