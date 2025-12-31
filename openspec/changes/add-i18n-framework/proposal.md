# Change: Add Unified I18n Framework

## Why
Currently, the project's internationalization is fragmented:
- The React frontend has **hardcoded translation objects** in `utils.ts` (lines 40-77) with inline Chinese and English strings
- The C++ backend has no unified localization mechanism for user-facing strings
- Plugin scripts use a per-plugin `i18n` API via `createPluginContext` (`core.ts:35`)

Adding a unified JSON-based i18n framework will:
1. Provide a single source of truth for all localized strings
2. Enable support for additional languages beyond Chinese and English
3. Allow community contributions to translations without code changes
4. Simplify plugin development with a consistent translation API

## What Changes
- **ADDED**: A new `<data_directory>/locales/` directory to store language-specific JSON files (`en-US.json`, `zh-CN.json`, etc.)
- **ADDED**: An `i18n_manager` class in C++ to load, cache, and query localized strings
- **ADDED**: A `language` configuration field in `config.json` to override system language
- **ADDED**: A `shell.breeze.get_translation(key)` method exposed to JavaScript plugins
- **MODIFIED**: The `useTranslation` hook in React to dynamically load locale JSON files via `shell.fs.read`
- **MODIFIED**: `binding_types.d.ts` to include the new i18n API type definitions

## Impact

### Affected Capabilities
- **core** (new): Unified localization support for the entire application

### Affected Code
| File | Change Type | Description |
|------|-------------|-------------|
| `src/shell/config.h` | Modified | Add `std::optional<std::string> language` field |
| `src/shell/config.cc` | Modified | Load/save language preference |
| `src/shell/i18n_manager.h` | New | i18n manager class declaration |
| `src/shell/i18n_manager.cc` | New | i18n manager implementation |
| `src/shell/script/binding_types.hpp` | Modified | Add `get_translation` binding |
| `src/shell/script/binding_types.cc` | Modified | Implement `get_translation` |
| `src/shell/script/binding_types.d.ts` | Modified | Add TypeScript types for i18n API |
| `src/shell/script/ts/src/config_page/utils.ts` | Modified | Refactor `useTranslation` to use JSON files |
| `src/shell/script/ts/src/menu/configMenu.ts` | Modified | Use new translation API |
| `src/shell/script/ts/src/plugin/core.ts` | Modified | Update plugin i18n to use unified system |
| `<data_directory>/locales/en-US.json` | New | English translations |
| `<data_directory>/locales/zh-CN.json` | New | Chinese translations |

### Breaking Changes
- **None expected for external API**
- **Internal change**: The `useTranslation` return type remains `{ t: (key: string) => string, currentLang: string }`, so existing code is compatible
- **Migration required**: Hardcoded translation keys will be changed to dot-notated paths (e.g., `"Breeze 设置"` → `t("settings.title")`)

### Design Documentation
See `design.md` for architectural decisions, file format specification, and migration plan.
