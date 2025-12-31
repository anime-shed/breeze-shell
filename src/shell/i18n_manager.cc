#include "i18n_manager.h"
#include "config.h"
#include "utils.h"
#include "logger.h"

#include <filesystem>
#include <fstream>
#include <iostream>
#include <regex>
#include <set>

#include "rfl/json.hpp"
#include "yyjson.h"
#include <cstring>

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
    // Check for and strip trailing null terminator if present
    size_t write_size = size;
    if (write_size > 0 && data[write_size - 1] == '\0') {
        write_size--;
    }

    // Always overwrite embedded locale files to ensure updates propagate correctly
    try {
        std::filesystem::create_directories(path.parent_path());
        std::ofstream f(path, std::ios::binary | std::ios::trunc);
        if (f) {
            f.write(reinterpret_cast<const char*>(data), write_size);
            dbgout("Extracted/updated locale: {} (size: {})", path.string(), write_size);
        }
    } catch (const std::exception& e) {
        std::cerr << "Failed to extract locale " << path << ": " << e.what() << std::endl;
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
    
    // Check if locale is loaded, if not try to load it
    bool loaded = true;
    if (translations_.find(lang) == translations_.end()) {
        loaded = load_locale(lang);
    }
    
    if (loaded) {
        current_lang_ = lang;
        
        // Update RTL status from metadata
        is_rtl_ = false; // Default to LTR
        auto lang_it = translations_.find(current_lang_);
        if (lang_it != translations_.end()) {
            auto meta_it = lang_it->second.find("$metadata.direction");
            if (meta_it != lang_it->second.end() && meta_it->second == "rtl") {
                is_rtl_ = true;
            }
        }
    } else {
        std::cerr << "Failed to load locale " << lang << ", keeping " << current_lang_ << std::endl;
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
    dbgout("Current language set to: {}", current_lang_);
    
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
    // Security validation: Validate language code format
    static const std::regex kLangRegex("^[A-Za-z]{2,3}(-[A-Za-z]{2,4})?$");
    if (!std::regex_match(lang, kLangRegex) || 
        lang.find("..") != std::string::npos || 
        lang.find('/') != std::string::npos || 
        lang.find('\\') != std::string::npos) {
        std::cerr << "Invalid language code or path traversal attempt: " << lang << std::endl;
        return false;
    }

    auto locales_dir = config::data_directory() / "locales";
    auto locale_path = locales_dir / (lang + ".json");
    
    if (!std::filesystem::exists(locale_path)) {
        dbgout("Locale file not found: {}", locale_path.string());
        return false;
    }

    // Path Traversal Protection: Verify resolved path is inside locales directory
    std::error_code ec;
    auto canonical_path = std::filesystem::canonical(locale_path, ec);
    if (ec) {
        std::cerr << "Failed to canonicalize path: " << locale_path << " - " << ec.message() << std::endl;
        return false;
    }

    auto canonical_base = std::filesystem::canonical(locales_dir, ec);
    if (ec) {
        std::cerr << "Failed to canonicalize base directory: " << locales_dir << std::endl;
        return false;
    }

    // Check if the file path starts with the base directory path
    if (canonical_path.string().find(canonical_base.string()) != 0) {
        std::cerr << "Security violation: Attempted to load locale outside allowed directory: " 
                  << canonical_path << std::endl;
        return false;
    }
    
    std::ifstream file(locale_path);
    if (!file) {
        std::cerr << "Failed to open locale file: " << locale_path << std::endl;
        return false;
    }
    
    std::string json_str((std::istreambuf_iterator<char>(file)),
                          std::istreambuf_iterator<char>());
    
    // Use yyjson for dynamic type handling (supports mixed-type JSON)
    yyjson_doc* doc = yyjson_read(json_str.c_str(), json_str.length(), 0);
    if (!doc) {
        std::cerr << "Failed to parse locale file: " << locale_path << std::endl;
        return false;
    }
    
    yyjson_val* root = yyjson_doc_get_root(doc);
    if (!yyjson_is_obj(root)) {
        std::cerr << "Locale root is not an object: " << locale_path << std::endl;
        yyjson_doc_free(doc);
        return false;
    }
    
    auto& lang_translations = translations_[lang];
    
    size_t idx, max;
    yyjson_val *key, *val;
    yyjson_obj_foreach(root, idx, max, key, val) {
        const char* key_str = yyjson_get_str(key);
        
        if (strcmp(key_str, "$metadata") == 0 && yyjson_is_obj(val)) {
            // Extract metadata with flattened keys (e.g., $metadata.direction)
            size_t m_idx, m_max;
            yyjson_val *m_key, *m_val;
            yyjson_obj_foreach(val, m_idx, m_max, m_key, m_val) {
                if (yyjson_is_str(m_val)) {
                    std::string flat_key = std::string("$metadata.") + yyjson_get_str(m_key);
                    lang_translations[flat_key] = yyjson_get_str(m_val);
                }
            }
        } else if (yyjson_is_str(val)) {
            // Regular translation key
            lang_translations[key_str] = yyjson_get_str(val);
            if (!std::string(key_str).starts_with("$metadata")) {
                core_keys_.insert(key_str);
            }
        } else {
            // Skip non-string values (arrays, numbers, nested objects)
            std::cerr << "Warning: Skipping non-string value for key: " << key_str << std::endl;
        }
    }
    
    dbgout("Loaded locale: {} ({} translations)", lang, lang_translations.size());
    // Ensure document is freed before returning
    yyjson_doc_free(doc);
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
                
                // Use yyjson for dynamic type handling
                yyjson_doc* doc = yyjson_read(json_str.c_str(), json_str.length(), 0);
                if (!doc) {
                    std::cerr << "Failed to parse plugin locale file: " << lang_file.path() << std::endl;
                    continue;
                }
                
                yyjson_val* root = yyjson_doc_get_root(doc);
                if (!yyjson_is_obj(root)) {
                    std::cerr << "Plugin locale root is not an object: " << lang_file.path() << std::endl;
                    yyjson_doc_free(doc);
                    continue;
                }
                
                size_t idx, max;
                yyjson_val *key, *val;
                yyjson_obj_foreach(root, idx, max, key, val) {
                    const char* key_str = yyjson_get_str(key);
                    
                    // Skip metadata keys
                    if (strcmp(key_str, "$metadata") == 0 || std::string(key_str).starts_with("$metadata")) {
                        continue;
                    }
                    
                    // Only process string values
                    if (!yyjson_is_str(val)) {
                        continue;
                    }
                    
                    // Warn if attempting to override core key
                    if (core_keys_.find(key_str) != core_keys_.end()) {
                        std::cerr << "Warning: Plugin " << plugin_name 
                                  << " attempted to override core key: " << key_str << std::endl;
                        continue;
                    }
                    
                    plugin_translations_[lang][key_str] = yyjson_get_str(val);
                }
                
                yyjson_doc_free(doc);
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "Error loading plugin locales: " << e.what() << std::endl;
    }
}

std::string i18n_manager::get_system_language() {
    ULONG num_langs = 0;
    ULONG buffer_size = 0;
    
    // First call to determine required buffer size
    if (GetUserPreferredUILanguages(MUI_LANGUAGE_NAME, &num_langs, nullptr, &buffer_size)) {
        std::vector<wchar_t> buffer(buffer_size);
        // Second call to retrieve languages
        if (GetUserPreferredUILanguages(MUI_LANGUAGE_NAME, &num_langs, buffer.data(), &buffer_size)) {
            // buffer contains null-separated strings; take the first one if available
            if (num_langs > 0 && buffer_size > 0) {
                return wstring_to_utf8(buffer.data());
            }
        }
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
