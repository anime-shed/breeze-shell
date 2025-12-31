# Capability: Core Language Support

## MODIFIED Requirements

### Requirement: Robust Locale Parsing
The i18n system SHALL parse locale files containing mixed value types (strings, objects, and other JSON types) without failing.

#### Scenario: Parse locale file with $metadata object
- **GIVEN** a locale file `en-US.json` contains:
  ```json
  {
    "$metadata": { "language": "en-US", "direction": "ltr" },
    "settings.title": "Breeze Settings"
  }
  ```
- **WHEN** the application loads the locale
- **THEN** the system SHALL extract `"settings.title": "Breeze Settings"` into the translation map
- **AND** SHALL extract metadata as flattened keys (`$metadata.direction: "ltr"`)
- **AND** SHALL NOT throw a parsing error

#### Scenario: Parse locale with only string values
- **GIVEN** a locale file contains no `$metadata` object, only string key-value pairs
- **WHEN** the application loads the locale
- **THEN** all string values SHALL be loaded into the translation map
- **AND** the load SHALL succeed

#### Scenario: Ignore non-string translation values
- **GIVEN** a locale file contains a key with a non-string value:
  ```json
  {
    "settings.title": "Settings",
    "debug.numbers": [1, 2, 3],
    "config.enabled": true
  }
  ```
- **WHEN** the application loads the locale
- **THEN** the system SHALL load `"settings.title": "Settings"`
- **AND** SHALL skip `"debug.numbers"` and `"config.enabled"`
- **AND** SHALL log a warning for each skipped key
- **AND** SHALL NOT fail the entire file load

#### Scenario: Handle malformed JSON gracefully
- **GIVEN** a locale file contains invalid JSON syntax
- **WHEN** the application attempts to load the file
- **THEN** the system SHALL return `false` from `load_locale()`
- **AND** SHALL log an error message
- **AND** SHALL NOT crash
- **AND** SHALL fallback to the default locale (en-US)

#### Scenario: Handle empty locale file
- **GIVEN** a locale file is empty or contains only `{}`
- **WHEN** the application loads the locale
- **THEN** the load SHALL succeed
- **AND** the translation map for that language SHALL be empty
- **AND** lookups SHALL fallback to en-US

---

### Requirement: Metadata Extraction
The i18n system SHALL extract and utilize metadata from locale files for configuration.

#### Scenario: Extract RTL direction from metadata
- **GIVEN** a locale file contains `$metadata.direction: "rtl"`
- **WHEN** the application loads the locale
- **THEN** `i18n_manager::is_rtl()` SHALL return `true`

#### Scenario: Default to LTR when direction is missing
- **GIVEN** a locale file has no `$metadata.direction` field
- **WHEN** the application loads the locale
- **THEN** `i18n_manager::is_rtl()` SHALL return `false`

#### Scenario: Extract language name for display
- **GIVEN** a locale file contains `$metadata.name: "English (United States)"`
- **WHEN** the settings UI queries available languages
- **THEN** the human-readable name SHALL be available for display

#### Scenario: Nested metadata values are flattened
- **GIVEN** a locale file contains:
  ```json
  { "$metadata": { "language": "en-US", "contributors": ["Alice", "Bob"] } }
  ```
- **WHEN** the application loads the locale
- **THEN** `$metadata.language` SHALL be stored as `"en-US"`
- **AND** `$metadata.contributors` (array) SHALL be skipped (only string metadata supported)

---

### Requirement: Plugin Locale Parsing
The i18n system SHALL parse plugin locale files using the same robust parsing strategy.

#### Scenario: Plugin locale with metadata is parsed correctly
- **GIVEN** a plugin locale file at `locales/plugins/myplugin/en-US.json` contains:
  ```json
  {
    "$metadata": { "version": "1.0" },
    "myplugin.hello": "Hello from plugin"
  }
  ```
- **WHEN** the application loads plugin locales
- **THEN** `"myplugin.hello": "Hello from plugin"` SHALL be added to plugin translations
- **AND** `$metadata` SHALL be skipped (not added to plugin translations)

#### Scenario: Plugin locale with invalid values continues loading
- **GIVEN** a plugin locale file contains non-string values
- **WHEN** the application loads plugin locales
- **THEN** valid string translations SHALL be loaded
- **AND** invalid values SHALL be skipped with a warning
- **AND** other plugins SHALL continue to load

---

### Requirement: Backward Compatibility
The parsing changes SHALL maintain backward compatibility with existing functionality.

#### Scenario: Existing translation lookups work unchanged
- **GIVEN** translations are loaded successfully
- **WHEN** code calls `i18n_manager::get("settings.title")`
- **THEN** the return value SHALL be the translated string
- **AND** the API signature SHALL be unchanged

#### Scenario: Existing interpolation works unchanged
- **GIVEN** `"greeting": "Hello, {name}"` is in the locale
- **WHEN** code calls `i18n_manager::get("greeting", {{"name", "World"}})`
- **THEN** the return value SHALL be `"Hello, World"`

#### Scenario: Missing key fallback behavior unchanged
- **GIVEN** key `"nonexistent.key"` is not in any locale
- **WHEN** code calls `i18n_manager::get("nonexistent.key")`
- **THEN** the return value SHALL be `"nonexistent.key"`

---

### Requirement: Performance
The parsing changes SHALL not degrade performance.

#### Scenario: Locale loading is fast
- **GIVEN** a locale file with 100+ translation keys
- **WHEN** the application loads the locale
- **THEN** the load SHALL complete in under 50ms on typical hardware

#### Scenario: Memory is properly freed
- **GIVEN** the application loads and unloads locales multiple times
- **WHEN** monitoring memory usage
- **THEN** there SHALL be no memory leaks from JSON parsing

---

### Requirement: TypeScript/C++ Consistency
The TypeScript i18n implementation SHALL maintain consistency with the C++ implementation.

#### Scenario: Interpolation regex supports dots and hyphens
- **GIVEN** a translation string `"Welcome, {user.name}!"` with dot-notated placeholder
- **WHEN** calling `t("greeting", { "user.name": "John" })` in TypeScript
- **THEN** the result SHALL be `"Welcome, John!"`
- **AND** the placeholder SHALL be matched by regex `/{([\w.-]+)}/g`

#### Scenario: Interpolation regex supports hyphenated placeholders
- **GIVEN** a translation string `"Status: {my-status}"` with hyphenated placeholder
- **WHEN** calling `t("status", { "my-status": "Active" })` in TypeScript
- **THEN** the result SHALL be `"Status: Active"`

#### Scenario: Preset functions return keys not translated strings
- **GIVEN** `getCurrentPreset()` is called in the settings UI
- **WHEN** comparing presets for selection state
- **THEN** the function SHALL return untranslated key strings (e.g., `"default"`, `"custom"`)
- **AND** translation SHALL occur at the UI render layer using `t(\`theme.${key}\`)`

#### Scenario: Empty params are handled gracefully
- **GIVEN** `t("key", {})` is called with empty params object
- **WHEN** the C++ `get_translation_with_params` is invoked
- **THEN** the function SHALL return the translation without error
- **AND** any placeholders SHALL remain intact

---

### Requirement: Semantic Translation Keys
All translation calls SHALL use semantic key identifiers, not hardcoded language strings.

#### Scenario: Menu items use semantic keys
- **GIVEN** a context menu item for "Manage Breeze Shell"
- **WHEN** the menu is rendered
- **THEN** the code SHALL call `t("menu.manage")` or similar semantic key
- **AND** SHALL NOT pass Chinese/English text directly to `t()` (e.g., NOT `t("管理 Breeze Shell")`)

#### Scenario: Settings labels use semantic keys
- **GIVEN** settings options like "Debug Console", "VSync", "Acrylic Effect"
- **WHEN** the settings UI is rendered
- **THEN** the code SHALL call semantic keys like `t("settings.debugConsole")`, `t("settings.vsync")`
- **AND** SHALL NOT use Chinese strings as keys (e.g., NOT `t("调试控制台")`)

#### Scenario: Preset names use semantic keys
- **GIVEN** theme presets named "Default", "Compact", "Custom"
- **WHEN** displaying preset names in the UI
- **THEN** the code SHALL call `t("theme.default")`, `t("theme.compact")`, `t("theme.custom")`
- **AND** utility functions like `getCurrentPreset()` SHALL NOT return hardcoded Chinese like `"默认"` or `"自定义"`

#### Scenario: Locale files use consistent key format
- **GIVEN** locale files `en-US.json` and `zh-CN.json`
- **WHEN** keys are defined
- **THEN** all keys SHALL follow dot-notation semantic format (e.g., `"settings.title"`, `"menu.manage"`)
- **AND** values SHALL contain the translated text in the target language
