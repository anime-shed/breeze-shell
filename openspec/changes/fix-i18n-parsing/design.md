# Design: Robust Locale Parsing with yyjson

## Context

### The Problem
The `i18n_manager` class is responsible for loading locale JSON files and providing translations to both C++ code and JavaScript plugins. The current implementation uses `reflect-cpp` (rfl) for JSON parsing:

```cpp
// Current problematic code (i18n_manager.cc:208)
auto result = rfl::json::read<std::map<std::string, std::string>>(json_str);
```

This approach assumes all JSON values are strings, but locale files have a mixed structure:

```json
{
  "$metadata": {
    "language": "en-US",
    "name": "English (United States)",
    "version": "1.0.0",
    "direction": "ltr"
  },
  "settings.title": "Breeze Settings",
  "plugins.install": "Install"
}
```

When `reflect-cpp` encounters the `$metadata` object, it throws a type error, causing:
1. The entire locale file to fail loading
2. All translations to be unavailable
3. UI showing raw keys instead of translated text

### Affected Functions
| Function | Line | Issue |
|----------|------|-------|
| `load_locale()` | 208 | Core locale parsing fails |
| `load_plugin_locales()` | 259 | Plugin locale parsing fails |

## Goals

1. **Parse mixed-type JSON** - Handle both string values and nested objects
2. **Extract translations** - Load all `"key": "string"` pairs into the map
3. **Extract metadata** - Parse `$metadata` object for RTL detection (`direction: "rtl"`)
4. **Graceful degradation** - Skip unsupported types without failing the entire file
5. **Backward compatibility** - No changes to the public `i18n_manager` API

## Non-Goals

- Changing the locale file format
- Adding new public API methods
- Modifying the header file (`i18n_manager.h`)

## Decisions

### Decision 1: Use yyjson for Parsing
Replace `reflect-cpp` with `yyjson` for locale file parsing.

**Rationale**:
| Criterion | reflect-cpp | yyjson |
|-----------|-------------|--------|
| Mixed-type support | ❌ Requires variant types | ✅ Dynamic type inspection |
| Already in project | ✅ Yes | ✅ Yes (`add_requires`) |
| Performance | Good | Excellent (fastest JSON parser) |
| API complexity | High for mixed types | Low (C API) |

**yyjson Key Functions**:
- `yyjson_read(str, len, 0)` - Parse JSON string
- `yyjson_doc_get_root(doc)` - Get root object
- `yyjson_obj_foreach(obj, idx, max, key, val)` - Iterate object
- `yyjson_is_str(val)` / `yyjson_is_obj(val)` - Type checking
- `yyjson_get_str(val)` - Extract string value
- `yyjson_doc_free(doc)` - Free document

### Decision 2: Two-Pass Parsing Strategy

```
1. Parse JSON document with yyjson_read()
2. Get root object
3. For each key-value pair:
   ├── If key == "$metadata" AND value is object:
   │   └── Extract "$metadata.direction" for RTL detection
   ├── Else if value is string:
   │   └── Add to translations_ map
   └── Else (number, array, nested object):
       └── Log warning, skip (don't fail)
4. Free yyjson document
```

### Decision 3: Metadata Flattening
Store metadata with flattened keys for consistent lookup:

```cpp
// Before (object): "$metadata": { "direction": "rtl" }
// After (flattened): "$metadata.direction" -> "rtl"
```

This allows the existing RTL detection code (line 184) to work unchanged:
```cpp
auto meta_it = lang_it->second.find("$metadata.direction");
```

## Proposed Implementation

### load_locale() Rewrite

```cpp
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
    
    // Use yyjson instead of reflect-cpp
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
            // Extract metadata with flattened keys
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
    
    yyjson_doc_free(doc);
    return true;
}
```

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| yyjson API is C-based, not C++ | Low - Mixed style code | Use RAII wrapper or careful `yyjson_doc_free` |
| Memory leak if early return | Medium | Ensure `yyjson_doc_free` on all paths |
| Breaking existing metadata extraction | Medium | Keep flattened key format (`$metadata.direction`) |
| Performance regression | Very Low | yyjson is faster than reflect-cpp |

## Alternatives Considered

### 1. Strict Structs with reflect-cpp
Define a variant type for values:
```cpp
using LocaleValue = std::variant<std::string, MetadataObject>;
auto result = rfl::json::read<std::map<std::string, LocaleValue>>(json_str);
```

**Rejected**: reflect-cpp variant support is complex and requires custom parsing logic anyway.

### 2. Remove Metadata from Locale Files
Store metadata in a separate `locale-meta.json` file.

**Rejected**: Breaks the single-file locale distribution model. Users and translators expect one file per language.

### 3. Pre-processing with Regex
Strip `$metadata` before parsing:
```cpp
std::regex_replace(json_str, std::regex(R"(\"\$metadata\"\s*:\s*\{[^}]*\},?)"), "");
```

**Rejected**: Fragile (nested braces break it), slow, and loses the metadata we need for RTL.

### 4. nlohmann/json
Use nlohmann/json which supports dynamic types.

**Rejected**: Not currently in the project dependencies. yyjson is already available and faster.

## Open Questions

1. **Should we log warnings for skipped keys?**
   - Recommendation: Yes, for debugging during development
   - Could be controlled by a debug flag in future

2. **Should we validate locale file structure more strictly?**
   - Recommendation: No, for v1. Be lenient to support community-contributed locales.
