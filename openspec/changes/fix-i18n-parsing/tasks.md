# Implementation Tasks

## 1. Build System Configuration
> **Goal**: Ensure yyjson is explicitly linked to the shell target

- [x] **1.1** Update `xmake.lua`
  - Locate the `shell` target definition
  - Add `add_packages("yyjson")` if not already present
  - Verify yyjson is in `add_requires()` at the top of the file

**Validation**: `xmake` completes without package resolution errors

---

## 2. C++ Implementation
> **Goal**: Replace reflect-cpp with yyjson for locale parsing

### 2.1 Update Includes
- [x] **2.1.1** Modify `src/shell/i18n_manager.cc` includes
  - Add: `#include "yyjson.h"`
  - Keep or remove `#include "rfl/json.hpp"` depending on other usages
  - Add: `#include <cstring>` if not present (for `strcmp`)

### 2.2 Rewrite load_locale()
- [x] **2.2.1** Rewrite lines 191-225 in `src/shell/i18n_manager.cc`
  - Replace `rfl::json::read<std::map<std::string, std::string>>` with yyjson
  - Implementation steps:
    1. Call `yyjson_read(json_str.c_str(), json_str.length(), 0)`
    2. Validate document and root object
    3. Iterate with `yyjson_obj_foreach(root, idx, max, key, val)`
    4. Handle `$metadata` key specially - flatten nested keys
    5. Add string values to `translations_[lang]`
    6. Skip and warn for non-string values
    7. Call `yyjson_doc_free(doc)` before returning

### 2.3 Rewrite load_plugin_locales()
- [x] **2.3.1** Rewrite lines 227-287 in `src/shell/i18n_manager.cc`
  - Apply same yyjson parsing pattern as `load_locale()`
  - Maintain plugin namespace protection logic (core_keys_ check)
  - Skip `$metadata` keys from plugin translations

### 2.4 Memory Safety
- [x] **2.4.1** Ensure `yyjson_doc_free(doc)` is called on all code paths
  - Add `yyjson_doc_free(doc)` before every `return` statement
  - Consider using a scope guard or RAII wrapper for cleaner code

**Validation**: No memory leaks reported by AddressSanitizer (if enabled)

---

## 3. Testing & Verification
> **Goal**: Verify translations load correctly

### 3.1 Build Verification
- [x] **3.1.1** Clean build
  - Run: `xmake clean`
  - Run: `xmake -v` (verbose to catch any linking errors)
  - Expected: Build succeeds with no errors

### 3.2 Runtime Verification
- [x] **3.2.1** Start application
  - Run: `xmake run inject` (or appropriate command)
  - Right-click in File Explorer to show context menu
  
- [x] **4.9** Fix locale file update mechanism in `i18n_manager.cc`
- [x] **5. Verification**
  - [x] **5.1** Validate fix with logs and runtime checks
  - [x] **5.2** Verify interpolation of semantic keys
- [x] **3.2.2** Verify UI displays translated text
  - Expected: Settings menu shows "Breeze Settings" or "Breeze 设置"
  - NOT: Raw keys like "settings.title"

- [x] **3.2.3** Console output check
  - Check for: `Failed to parse locale file` errors (should NOT appear)
  - Check for: `Warning: Skipping non-string value` (may appear for debug)

### 3.3 Language Switching
- [x] **3.3.1** Test en-US locale
  - Set `"language": "en-US"` in config.json
  - Restart application
  - Verify English text displays

- [x] **3.3.2** Test zh-CN locale
  - Set `"language": "zh-CN"` in config.json
  - Restart application
  - Verify Chinese text displays

### 3.4 Edge Cases
- [x] **3.4.1** Test malformed locale file
  - Temporarily corrupt a locale JSON file
  - Verify application falls back gracefully to en-US
  - Verify no crash occurs

- [x] **3.4.2** Test missing locale file
  - Remove a non-default locale file
  - Verify fallback to en-US works

---

## 4. Code Review Fixes (TypeScript/Frontend)
> **Goal**: Address code review findings for consistency between C++ and TypeScript implementations

### 4.1 Fix Interpolation Regex Mismatch
- [x] **4.1.1** Update `src/shell/script/ts/test_i18n.js` (lines 4-8)
  - **Issue**: JS regex only matches `\w` (alphanumeric + underscore)
  - **C++ supports**: dots and hyphens in placeholders (e.g., `{user.name}`, `{my-key}`)
  - **Fix**: Update regex to `/{([\w.-]+)}/g` to match C++ pattern `\{([\w.-]+)\}`
  - Keep replacement logic unchanged (lookup params, fallback to original if missing)

### 4.2 Fix getCurrentPreset Return Value
- [x] **4.2.1** Update `src/shell/script/ts/src/config_page/ContextMenuConfig.tsx` (lines 51-58)
  - **Issue**: `getCurrentPreset` returns translated strings (`t("theme.default")`, `t("theme.custom")`)
  - **Problem**: Won't match preset keys (Chinese names) used elsewhere for comparison
  - **Fix**: Return original preset key names (e.g., `"default"`, `"custom"`)
  - Move translation to UI layer: use `t(\`theme.${name}\`) || name` when rendering

### 4.3 Add Extended Placeholder Test Cases
- [x] **4.3.1** Update `src/shell/script/ts/test_i18n.js` (after line 41)
  - Add test case for dot placeholders:
    ```javascript
    {
        name: "Placeholder with dot",
        template: "Hello {user.name}!",
        params: { "user.name": "John Doe" },
        expected: "Hello John Doe!"
    }
    ```
  - Add test case for hyphen placeholders:
    ```javascript
    {
        name: "Placeholder with hyphen", 
        template: "Status: {my-status}",
        params: { "my-status": "Active" },
        expected: "Status: Active"
    }
    ```

### 4.4 Simplify Params Check (Optional)
- [x] **4.4.1** Update `src/shell/script/ts/src/shared/i18n.ts` (lines 9-17)
  - **Current**: `if (params && Object.keys(params).length > 0)`
  - **Simplified**: `if (params)` (if C++ handles empty objects gracefully)
  - **Note**: Only apply if C++ `get_translation_with_params` handles empty params correctly

### 4.5 Consider Widening Parameter Types (Optional)
- [x] **4.5.1** Update `src/shell/script/binding_types.d.ts` (lines 1082-1128)
  - **Current**: `params: Record<string, string>`
  - **Consider**: `params: Record<string, string | number | boolean>`
  - Allows more natural usage: `breeze.get_translation_with_params("items.count", { count: 42 })`
  - **Note**: Requires C++ side to support type coercion

### 4.6 Migrate configMenu.ts to Semantic Translation Keys
- [x] **4.6.1** Update `src/shell/script/ts/src/menu/configMenu.ts` (lines 32-35, 540-545)
  - **Issue**: Uses Chinese strings as translation keys (e.g., `t("管理 Breeze Shell")`)
  - **Problem**: Inconsistent with semantic key approach in locale files
  - **Mappings to apply**:
    | Current (Chinese key) | New (Semantic key) |
    |-----------------------|--------------------|
    | `t("管理 Breeze Shell")` | `t("menu.manage")` |
    | `t("插件市场 / 更新本体")` | `t("menu.pluginMarket")` |
    | `t("调试控制台")` | `t("settings.debugConsole")` |
    | `t("垂直同步")` | `t("settings.vsync")` |
    | `t("忽略自绘菜单")` | `t("settings.ignoreOwnerDraw")` |
    | `t("向上展开时反向排列")` | `t("settings.reverseIfOpenUp")` |
    | `t("尝试使用 Windows 11 圆角")` | `t("settings.useWin11RoundedCorners")` |
    | `t("亚克力背景效果")` | `t("settings.acrylicEffect")` |
  - Search for all `t()` calls passing Chinese strings and replace with semantic keys

### 4.7 Migrate utils.ts getCurrentPreset to Use Translation Keys
- [x] **4.7.1** Update `src/shell/script/ts/src/config_page/utils.ts` (lines 73-81)
  - **Issue**: Returns hardcoded Chinese strings `"默认"` and `"自定义"`
  - **Fix**: Replace with translation calls:
    ```typescript
    // Before
    if (!current) return "默认";
    // ...
    return "自定义";
    
    // After
    if (!current) return t("theme.default");
    // ...
    return t("theme.custom");
    ```
  - **Note**: Keys `theme.default` and `theme.custom` already exist in `en-US.json` (lines 57, 62)

### 4.8 Audit All Chinese String Keys in Frontend
- [x] **4.8.1** Full codebase search for Chinese `t()` calls
  - Run: `grep -r "t(\"[\u4e00-\u9fff]" src/shell/script/ts/`
  - Document all occurrences for migration
  - **Files likely affected**:
    - `configMenu.ts` - Menu labels
    - `utils.ts` - Preset names
    - `Sidebar.tsx` - Source switching messages
    - `PluginStore.tsx` - Plugin status messages
    - `UpdatePage.tsx` - Update status messages

**Validation**: 
- Test interpolation with `{user.name}` and `{my-key}` placeholders
- Verify preset comparison works in settings UI
- Verify all menu items display correct translations after key migration

---

## Dependencies Graph

```
1.1 ─→ 2.1.1 ─→ 2.2.1 ─→ 2.3.1 ─→ 2.4.1
                                    │
                                    ├─→ 3.1.1 ─→ 3.2.1 ─→ 3.2.2 ─→ 3.2.3
                                    │               │
                                    │               └─→ 3.3.1 ─→ 3.3.2
                                    │               │
                                    │               └─→ 3.4.1 ─→ 3.4.2
                                    │
                                    └─→ 4.1.1 ─→ 4.2.1 ─→ 4.3.1 ─→ 4.4.1 ─→ 4.5.1
                                                                          │
                                                                          └─→ 4.6.1 ─→ 4.7.1 ─→ 4.8.1
```

**Critical Path**: 1.1 → 2.x → 3.1.1 → 3.2.x (minimum for verification)
**Parallelizable**: Section 4.x can be done independently after build succeeds
