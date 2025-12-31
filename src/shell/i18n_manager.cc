#include "i18n_manager.h"
#include "config.h"
#include "utils.h"

#include <filesystem>
#include <fstream>
#include <iostream>
#include <regex>
#include <set>

#include "rfl/json.hpp"

#include "windows.h"

namespace mb_shell {


namespace {
const unsigned char g_en_US_json[] = {
#include "en-US.json.h"
};
const unsigned char g_zh_CN_json[] = {
#include "zh-CN.json.h"
};

void ensure_file(const std::filesystem::path& path, const unsigned char* data, size_t size) {
    if (!std::filesystem::exists(path)) {
        try {
            std::filesystem::create_directories(path.parent_path());
            std::ofstream f(path, std::ios::binary);
            if (f) {
                f.write(reinterpret_cast<const char*>(data), size);
                std::cout << "Extracted default locale: " << path << std::endl;
            }
        } catch (const std::exception& e) {
            std::cerr << "Failed to extract locale " << path << ": " << e.what() << std::endl;
        }
    }
}
}

i18n_manager& i18n_manager::instance() {
    static i18n_manager instance;
    return instance;
}

i18n_manager::i18n_manager() : current_lang_("en-US"), is_rtl_(false) {
    auto locales_dir = config::data_directory() / "locales";
    ensure_file(locales_dir / "en-US.json", g_en_US_json, sizeof(g_en_US_json));
    ensure_file(locales_dir / "zh-CN.json", g_zh_CN_json, sizeof(g_zh_CN_json));
    reload();
}

std::string i18n_manager::get(const std::string& key) {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    
    // Try current language first
    auto lang_it = translations_.find(current_lang_);
    if (lang_it != translations_.end()) {
        auto key_it = lang_it->second.find(key);
        if (key_it != lang_it->second.end()) {
            return key_it->second;
        }
    }
    
    // Try plugin translations
    auto plugin_lang_it = plugin_translations_.find(current_lang_);
    if (plugin_lang_it != plugin_translations_.end()) {
        auto key_it = plugin_lang_it->second.find(key);
        if (key_it != plugin_lang_it->second.end()) {
            return key_it->second;
        }
    }
    
    // Fallback to en-US if not current language
    if (current_lang_ != "en-US") {
        auto fallback_it = translations_.find("en-US");
        if (fallback_it != translations_.end()) {
            auto key_it = fallback_it->second.find(key);
            if (key_it != fallback_it->second.end()) {
                return key_it->second;
            }
        }
    }
    
    // Return key itself as last resort
    return key;
}

std::string i18n_manager::get(const std::string& key, 
                               const std::map<std::string, std::string>& params) {
    std::string result = get(key);
    return interpolate(result, params);
}

void i18n_manager::set_language(const std::string& lang) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    
    if (lang == current_lang_) {
        return;
    }
    
    current_lang_ = lang;
    
    // Check if locale is loaded, if not try to load it
    if (translations_.find(lang) == translations_.end()) {
        load_locale(lang);
    }
    
    // Update RTL status from metadata
    is_rtl_ = false; // Default to LTR
    auto lang_it = translations_.find(current_lang_);
    if (lang_it != translations_.end()) {
        auto meta_it = lang_it->second.find("$metadata.direction");
        if (meta_it != lang_it->second.end() && meta_it->second == "rtl") {
            is_rtl_ = true;
        }
    }
}

std::string i18n_manager::current_language() const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    return current_lang_;
}

bool i18n_manager::is_rtl() const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    return is_rtl_;
}

void i18n_manager::register_translations(const std::string& lang,
                                          const std::map<std::string, std::string>& translations) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    
    for (const auto& [key, value] : translations) {
        // Check if this is a core key - warn but don't override
        if (core_keys_.find(key) != core_keys_.end()) {
            std::cerr << "Warning: Plugin attempted to override core translation key: " 
                      << key << std::endl;
            continue;
        }
        
        plugin_translations_[lang][key] = value;
    }
}

void i18n_manager::reload() {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    
    translations_.clear();
    plugin_translations_.clear();
    core_keys_.clear();
    
    // Determine language priority: config > system > en-US
    std::string target_lang;
    
    // Check if config has language override
    if (config::current && config::current->language) {
        target_lang = *config::current->language;
    } else {
        target_lang = get_system_language();
    }
    
    // Always load en-US as fallback
    load_locale("en-US");
    
    // Load target language if different
    if (target_lang != "en-US") {
        if (!load_locale(target_lang)) {
            // Fallback to en-US if target language fails
            target_lang = "en-US";
        }
    }
    
    current_lang_ = target_lang;
    
    // Load plugin locales
    load_plugin_locales();
    
    // Update RTL status
    is_rtl_ = false;
    auto lang_it = translations_.find(current_lang_);
    if (lang_it != translations_.end()) {
        auto meta_it = lang_it->second.find("$metadata.direction");
        if (meta_it != lang_it->second.end() && meta_it->second == "rtl") {
            is_rtl_ = true;
        }
    }
}

bool i18n_manager::load_locale(const std::string& lang) {
    auto locale_path = config::data_directory() / "locales" / (lang + ".json");
    
    if (!std::filesystem::exists(locale_path)) {
        std::cerr << "Locale file not found: " << locale_path << std::endl;
        return false;
    }
    
    std::ifstream file(locale_path);
    if (!file) {
        std::cerr << "Failed to open locale file: " << locale_path << std::endl;
        return false;
    }
    
    std::string json_str((std::istreambuf_iterator<char>(file)),
                          std::istreambuf_iterator<char>());
    
    auto result = rfl::json::read<std::map<std::string, std::string>>(json_str);
    if (!result) {
        std::cerr << "Failed to parse locale file " << locale_path << ": " << result.error().what() << std::endl;
        return false;
    }

    auto& lang_translations = translations_[lang];
    for (const auto& [key, value] : result.value()) {
        lang_translations[key] = value;
        
        // Track core keys (not plugin keys)
        if (!key.starts_with("$metadata")) {
            core_keys_.insert(key);
        }
    }
    
    return true;
}

void i18n_manager::load_plugin_locales() {
    auto plugins_locale_dir = config::data_directory() / "locales" / "plugins";
    
    if (!std::filesystem::exists(plugins_locale_dir)) {
        return;
    }
    
    try {
        for (const auto& plugin_entry : std::filesystem::directory_iterator(plugins_locale_dir)) {
            if (!plugin_entry.is_directory()) {
                continue;
            }
            
            std::string plugin_name = plugin_entry.path().filename().string();
            
            // Load all language files for this plugin
            for (const auto& lang_file : std::filesystem::directory_iterator(plugin_entry.path())) {
                if (!lang_file.is_regular_file() || 
                    lang_file.path().extension() != ".json") {
                    continue;
                }
                
                std::string lang = lang_file.path().stem().string();
                
                std::ifstream file(lang_file.path());
                if (!file) {
                    continue;
                }
                
                std::string json_str((std::istreambuf_iterator<char>(file)),
                                      std::istreambuf_iterator<char>());
                
                auto result = rfl::json::read<std::map<std::string, std::string>>(json_str);
                
                if (!result) {
                    std::cerr << "Failed to parse plugin locale file " << lang_file.path() 
                              << ": " << result.error().what() << std::endl;
                    continue;
                }
                
                for (const auto& [key, value] : result.value()) {
                    // Skip metadata keys
                    if (key.starts_with("$metadata")) {
                        continue;
                    }
                    
                    // Warn if attempting to override core key
                    if (core_keys_.find(key) != core_keys_.end()) {
                        std::cerr << "Warning: Plugin " << plugin_name 
                                  << " attempted to override core key: " << key << std::endl;
                        continue;
                    }
                    
                    plugin_translations_[lang][key] = value;
                }
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "Error loading plugin locales: " << e.what() << std::endl;
    }
}

std::string i18n_manager::get_system_language() {
    wchar_t buffer[256];
    ULONG num_langs = 256;
    
    if (GetUserPreferredUILanguages(MUI_LANGUAGE_NAME, &num_langs, buffer, &num_langs)) {
        return wstring_to_utf8(buffer);
    }
    
    return "en-US";
}

std::string i18n_manager::interpolate(const std::string& str,
                                       const std::map<std::string, std::string>& params) {
    if (params.empty()) {
        return str;
    }
    
    std::string result = str;
    // Support alphanumeric, dots, and hyphens in placeholders (e.g., {user.name}, {my-key})
    std::regex placeholder_regex(R"(\{([\w.-]+)\})");
    
    std::smatch match;
    std::string::const_iterator search_start(result.cbegin());
    std::string output;
    
    while (std::regex_search(search_start, result.cend(), match, placeholder_regex)) {
        // Append text before the match
        output.append(search_start, match[0].first);
        
        std::string placeholder_name = match[1].str();
        auto param_it = params.find(placeholder_name);
        
        if (param_it != params.end()) {
            // Replace with parameter value
            output.append(param_it->second);
        } else {
            // Keep placeholder intact if not found
            output.append(match[0].str());
        }
        
        search_start = match.suffix().first;
    }
    
    // Append remaining text
    output.append(search_start, result.cend());
    
    return output;
}

std::vector<std::string> i18n_manager::available_languages() const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    
    std::vector<std::string> languages;
    
    auto locales_dir = config::data_directory() / "locales";
    if (!std::filesystem::exists(locales_dir)) {
        return languages;
    }
    
    for (const auto& entry : std::filesystem::directory_iterator(locales_dir)) {
        if (entry.is_regular_file() && entry.path().extension() == ".json") {
            languages.push_back(entry.path().stem().string());
        }
    }
    
    return languages;
}

} // namespace mb_shell
