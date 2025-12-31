#pragma once

#include <filesystem>
#include <map>
#include <shared_mutex>
#include <optional>
#include <set>
#include <string>
#include <vector>

namespace mb_shell {

/**
 * @brief Internationalization manager for loading and querying translations.
 * 
 * This class provides a singleton interface for managing locale files and
 * retrieving translated strings. It supports:
 * - Loading JSON locale files from <data_directory>/locales/
 * - Language selection priority: user config > system language > en-US
 * - String interpolation with {placeholder} syntax
 * - Plugin namespace protection for custom translations
 * - RTL direction detection for right-to-left languages
 */
class i18n_manager {
public:
    /**
     * @brief Get the singleton instance.
     */
    static i18n_manager& instance();

    /**
     * @brief Get a translated string for the given key.
     * @param key The translation key (e.g., "settings.title")
     * @return The translated string, or the key itself if not found
     */
    std::string get(const std::string& key);

    /**
     * @brief Get a translated string with placeholder substitution.
     * @param key The translation key
     * @param params Map of placeholder names to values (e.g., {"name": "MyPlugin"})
     * @return The translated string with placeholders replaced
     */
    std::string get(const std::string& key, const std::map<std::string, std::string>& params);

    /**
     * @brief Set the current language.
     * @param lang Language code (e.g., "en-US", "zh-CN")
     */
    void set_language(const std::string& lang);

    /**
     * @brief Get the current language code.
     * @return Current language code (e.g., "en-US")
     */
    std::string current_language() const;

    /**
     * @brief Check if the current language is RTL (right-to-left).
     * @return true if RTL, false otherwise
     */
    bool is_rtl() const;

    /**
     * @brief Register translations from a plugin.
     * @param lang Language code
     * @param translations Map of keys to translated strings
     * @note Plugin keys should be prefixed with the plugin name (e.g., "myplugin.hello")
     * @note Core keys cannot be overridden by plugins
     */
    void register_translations(const std::string& lang, 
                               const std::map<std::string, std::string>& translations);

    /**
     * @brief Reload locale files from disk.
     */
    void reload();

    /**
     * @brief Get all available language codes.
     * @return Vector of language codes found in locales directory
     */
    std::vector<std::string> available_languages() const;

private:
    i18n_manager();
    ~i18n_manager() = default;

    // Non-copyable
    i18n_manager(const i18n_manager&) = delete;
    i18n_manager& operator=(const i18n_manager&) = delete;
    i18n_manager(i18n_manager&&) = delete;
    i18n_manager& operator=(i18n_manager&&) = delete;

    /**
     * @brief Load a locale file from disk.
     * @param lang Language code
     * @return true if successful
     */
    bool load_locale(const std::string& lang);

    /**
     * @brief Load plugin locale files from plugins directory.
     */
    void load_plugin_locales();

    /**
     * @brief Get the system's preferred UI language.
     * @return System language code or "en-US" as fallback
     */
    static std::string get_system_language();

    /**
     * @brief Perform placeholder substitution on a string.
     * @param str The string containing {placeholder} patterns
     * @param params Map of placeholder names to values
     * @return String with placeholders replaced
     * @note The current implementation only supports alphanumeric placeholders (regex: \\{(\\w+)\\}).
     *       Placeholders with dots or hyphens are not supported.
     */
    static std::string interpolate(const std::string& str, 
                                   const std::map<std::string, std::string>& params);

    std::string current_lang_;
    bool is_rtl_;
    
    // Core translations: lang -> (key -> value)
    std::map<std::string, std::map<std::string, std::string>> translations_;
    
    // Plugin translations: lang -> (key -> value), stored separately for namespace protection
    std::map<std::string, std::map<std::string, std::string>> plugin_translations_;
    
    // Set of core keys (cannot be overridden by plugins)
    std::set<std::string> core_keys_;
    
    mutable std::shared_mutex mutex_;
};

} // namespace mb_shell
