## Context

Breeze Shell currently has fragmented internationalization:
- **React Frontend** (`utils.ts`): Hardcoded translation objects with inline Chinese and English strings
- **C++ Backend**: Some user-facing strings but no unified localization mechanism
- **Plugin Scripts**: Custom `i18n` API per-plugin via `createPluginContext`

This change unifies all localization into a JSON-based framework shared across C++, React, and the scripting API.

### Stakeholders
- **End Users**: Benefit from consistent language support and additional language options
- **Plugin Developers**: Gain access to a unified translation API
- **Translators**: Can contribute translations via simple JSON files without code knowledge

## Goals

- **Unified Source of Truth**: All localized strings stored in `locales/*.json`
- **Dynamic Loading**: Locale files loaded at runtime, enabling language switching without restart
- **Backward Compatibility**: Existing hardcoded strings migrated without breaking changes
- **Extensibility**: Plugin developers can register custom translation keys

## Non-Goals

- **Full ICU Support**: Complex pluralization, gender, and formatting rules are out of scope for v1
- **Full RTL Rendering**: Right-to-left text layout transformations are deferred to v2 (but detection is supported)
- **Locale Auto-detection Override**: Users must manually configure language; auto-detection from Windows is already implemented
- **Hot-reload on File Change**: Live reloading of locale files when modified externally is deferred to v2

## Decisions

### Decision 1: JSON Locale File Format
Use flat-ish, dot-notated JSON files for translations.

**Structure:**
```json
{
  "settings.title": "Breeze Settings",
  "settings.theme": "Theme",
  "settings.animation": "Animation",
  "plugins.install": "Install",
  "plugins.installed": "Installed",
  "menu.new": "New",
  "menu.folder": "Folder"
}
```

**Rationale:**
- Simple to parse in both C++ (via `reflect-cpp` or raw JSON) and JavaScript
- Flat keys with dot notation avoid deep nesting complexity
- Compatible with popular translation management tools

**Alternatives Considered:**
- **Nested JSON**: More readable but harder to merge and query
- **YAML**: Better for humans but adds parsing dependency
- **gettext (.po files)**: Industry standard but overkill for this project

### Decision 2: Locale File Location
Store locale files in `<data_directory>/locales/`.

**Rationale:**
- Follows existing pattern of data files in user data directory
- Allows users to add custom/third-party translations
- Separates user-modifiable data from application binaries

### Decision 3: Language Selection Priority
1. User config override (`config.json` → `language` field)
2. Windows system language (via `GetUserDefaultUILanguage`)
3. Fallback to `en-US`

### Decision 4: React Integration Approach
Refactor `useTranslation` hook to:
1. Read locale JSON via `shell.fs.read` on mount
2. Cache the parsed translations in React state
3. Re-read on language change signal

**Rationale:**
- Minimal invasive change to existing codebase
- Leverages existing `shell.fs.read` API
- No new dependencies required

### Decision 5: String Interpolation Syntax
Use curly brace placeholders for dynamic values: `{variableName}`

**Example:**
```json
{
  "plugins.installSuccess": "Plugin installed successfully: {name}",
  "plugins.update": "Update ({from} -> {to})"
}
```

**API:**
```typescript
t("plugins.installSuccess", { name: "MyPlugin" })
// Returns: "Plugin installed successfully: MyPlugin"
```

**Rationale:**
- Simple regex-based replacement: `/{(\w+)}/g`
- No external dependencies required
- Compatible with most translation management tools
- Missing placeholders remain intact (graceful degradation)

**Alternatives Considered:**
- **ICU MessageFormat**: Too complex for current needs
- **printf-style (`%s`)**: Less readable and error-prone
- **Template literals**: Not JSON-safe

### Decision 6: Plugin Locale Registration
Plugins can register translations via:
1. JSON files in `<data_directory>/locales/plugins/<plugin-name>/<lang>.json`
2. Programmatic API: `shell.breeze.register_translations(lang, { key: value })`

**Namespace Protection:**
- Plugin keys SHOULD be prefixed with `<plugin-name>.`
- Core translation keys take precedence over plugin keys to prevent hijacking

### Decision 7: RTL Detection (Future-Ready)
Locale files MAY include direction metadata:
```json
{
  "$metadata": {
    "language": "ar-SA",
    "name": "العربية",
    "direction": "rtl"
  }
}
```

- v1 exposes `isRTL()` based on metadata but does not apply layout transformations
- This allows future RTL support without breaking changes

### Decision 8: RTL Considerations for v2
While full RTL support is deferred to v2, we document the following requirements for future implementation:

1.  **Layout Mirroring**:
    *   Flex layouts must use logical properties (start/end) where possible, or programmatically reverse children based on `isRTL()`.
    *   Margins and paddings must be flipped (e.g., `marginLeft` becomes `marginRight`).
    *   Icon alignment must be reversed (e.g., arrows pointing right should point left in RTL contexts, unless they refer to timeline direction).

2.  **Text Alignment**:
    *   Default text alignment should follow standard RTL rules (right-aligned for paragraphs).
    *   Bidi algorithm support should be verified for mixed content (English words inside Arabic text).

3.  **Component Adaptation**:
    *   **Sidebar**: Should move to the right side of the screen? (Subject to UX decision; most OS features mirror).
    *   **Context Menu**: Submenus should open to the left.
    *   **Controls**: Sliders, progress bars, and toggles should operate in reverse direction or mirror appearance.

4.  **Implementation Strategy**:
    *   Create a `useRTL` hook that provides flipped style constants.
    *   Update `BreezeStyle` or equivalent theme utility to auto-flip spacing values.
    *   Audit all valid `direction: rtl` CSS (or internal layout engine equivalent) usage.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Large JSON files slow down startup | Lazy load only on first access; cache aggressively |
| Missing translation keys cause UI issues | Fallback to key string itself (e.g., `t("missing.key")` returns `"missing.key"`) |
| Concurrent file access from multiple processes | Read-only access; writes only via config UI |
| Plugin translations conflict with core | Namespace plugin keys with plugin ID prefix |

## Migration Plan

### Phase 1: Foundation
1. Create `locales/` directory structure
2. Extract all hardcoded strings from `utils.ts` into `zh-CN.json` and `en-US.json`
3. Extract C++ menu strings into same JSON files

### Phase 2: C++ Integration
1. Implement `i18n_manager` class to load/cache JSON
2. Add `breeze.get_translation(key)` to QuickJS bindings
3. Update `config.h` with optional `language` field

### Phase 3: Frontend Migration
1. Refactor `useTranslation` to load JSON dynamically
2. Update all React components to use new key format
3. Test language switching in settings UI

### Phase 4: Plugin API
1. Expose `shell.breeze.get_translation()` in `binding_types.d.ts`
2. Document plugin translation registration

## Open Questions

1. ~~**Should we support interpolation?**~~ ✅ **RESOLVED**
   - **Decision**: Yes, using `{placeholder}` syntax (Decision 5)
   
2. ~~**How do plugins register custom keys?**~~ ✅ **RESOLVED**
   - **Decision**: Via JSON files in `locales/plugins/<plugin-name>/` or programmatic API (Decision 6)

3. ~~**Hot-reload on locale file change?**~~ ⏳ **DEFERRED to v2**
   - Requires file watcher integration; added to Non-Goals

4. **Should we support nested JSON keys?** 🤔 **OPEN**
   - Current decision: Flat keys only for simplicity
   - May revisit if community requests nested structure support

5. **How to handle pluralization?** 🤔 **OPEN**
   - ICU MessageFormat is overkill; simple count-based suffix may suffice
   - Example: `items.count.zero`, `items.count.one`, `items.count.other`
   - Deferred to v2 unless strong demand
