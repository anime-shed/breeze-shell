# Change: Fix i18n Locale File Parsing

## Why

The current i18n implementation in `i18n_manager.cc` fails to parse locale files due to a type mismatch issue:

### Root Cause Analysis

| Location | Issue |
|----------|-------|
| `src/shell/i18n_manager.cc:208` | `rfl::json::read<std::map<std::string, std::string>>(json_str)` |
| `src/shell/i18n_manager.cc:259` | Same issue in `load_plugin_locales()` |

**Problem**: The `reflect-cpp` library (`rfl::json::read`) expects a homogeneous map where all values are strings. However, locale files contain:

```json
{
  "$metadata": {           // ← Object type, NOT a string!
    "language": "en-US",
    "name": "English (United States)",
    "direction": "ltr"
  },
  "settings.title": "Breeze Settings",  // ← String type ✓
  "plugins.install": "Install"          // ← String type ✓
}
```

When `reflect-cpp` encounters the `$metadata` object, the entire parse fails with a type error, resulting in **zero translations being loaded**. The UI shows raw translation keys (e.g., `"settings.title"`) instead of actual text.

### Current Behavior
```
Failed to parse locale file C:\...\locales\en-US.json: Expected string but found object
```

### Expected Behavior
- Parse string values into translation map
- Parse `$metadata` object for RTL detection and language info
- Gracefully ignore any unexpected value types

## What Changes

- **MODIFIED**: `xmake.lua` - Add `yyjson` package dependency to `shell` target
- **MODIFIED**: `src/shell/i18n_manager.cc`
  - Replace `rfl::json::read` with `yyjson` C API for dynamic type handling
  - Rewrite `load_locale()` function (lines 191-225)
  - Rewrite `load_plugin_locales()` function (lines 227-287)
  - Remove unused `#include "rfl/json.hpp"` if no longer needed elsewhere
- **UNCHANGED**: `src/shell/i18n_manager.h` - No API changes needed

### Code Review Fixes (Frontend)
- **MODIFIED**: `src/shell/script/ts/test_i18n.js` - Fix interpolation regex to match C++ (`[\w.-]+`)
- **MODIFIED**: `src/shell/script/ts/src/config_page/ContextMenuConfig.tsx` - Return preset keys, not translated strings
- **MODIFIED**: `src/shell/script/ts/src/shared/i18n.ts` - Simplify params check (optional)
- **MODIFIED**: `src/shell/script/binding_types.d.ts` - Consider widening param types (optional)

### Semantic Key Migration
- **MODIFIED**: `src/shell/script/ts/src/menu/configMenu.ts` - Replace Chinese string keys with semantic keys
- **MODIFIED**: `src/shell/script/ts/src/config_page/utils.ts` - Replace hardcoded `"默认"`/`"自定义"` with `t()` calls

## Impact

### Affected Capabilities
- **core**: Enables translations to actually load and display correctly

### Affected Code
| File | Change Type | Lines Affected | Description |
|------|-------------|----------------|-------------|
| `xmake.lua` | Modified | TBD | Add `add_packages("yyjson")` to shell target |
| `src/shell/i18n_manager.cc` | Modified | 11, 191-225, 227-287 | Replace reflect-cpp with yyjson parser |
| `src/shell/script/ts/test_i18n.js` | Modified | 4-8, 41+ | Fix regex, add placeholder test cases |
| `src/shell/script/ts/src/config_page/ContextMenuConfig.tsx` | Modified | 51-58 | Return preset keys, not translations |
| `src/shell/script/ts/src/shared/i18n.ts` | Modified | 9-17 | Simplify params check (optional) |
| `src/shell/script/binding_types.d.ts` | Modified | 1082-1128 | Widen param types (optional) |
| `src/shell/script/ts/src/menu/configMenu.ts` | Modified | 32-35, 540-545 | Migrate Chinese keys to semantic keys |
| `src/shell/script/ts/src/config_page/utils.ts` | Modified | 73-81 | Replace hardcoded Chinese preset names |

### Breaking Changes
- **None** - Internal implementation change only
- Public API (`get()`, `set_language()`, etc.) remains unchanged
- Locale file format remains unchanged

### Dependencies
- **yyjson**: Already available in xmake project (used by other components)
  - Fast C-based JSON parser with dynamic type inspection
  - Functions: `yyjson_read`, `yyjson_is_str`, `yyjson_is_obj`, `yyjson_obj_foreach`

### Design Documentation
See `design.md` for architectural decisions and alternatives considered.
