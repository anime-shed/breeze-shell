# core Specification

## Purpose
TBD - created by archiving change add-i18n-framework. Update Purpose after archive.
## Requirements
### Requirement: Unified Localization Support
The system SHALL support multiple languages through a unified JSON-based localization framework that is shared between the C++ backend, JavaScript/React frontend, and plugin scripting environment.

#### Scenario: Load system locale on startup
- **GIVEN** a locale file `en-US.json` exists in `<data_directory>/locales/`
- **AND** the Windows system language is set to English (United States)
- **AND** no language override is configured
- **WHEN** the application starts
- **THEN** the application SHALL load `en-US.json` as the active locale
- **AND** all UI text SHALL display in English

#### Scenario: Load Chinese locale on startup
- **GIVEN** locale files `en-US.json` and `zh-CN.json` exist in `<data_directory>/locales/`
- **AND** the Windows system language is set to Chinese (Simplified)
- **AND** no language override is configured
- **WHEN** the application starts
- **THEN** the application SHALL load `zh-CN.json` as the active locale
- **AND** all UI text SHALL display in Chinese

#### Scenario: Fallback to default locale for unsupported language
- **GIVEN** only `en-US.json` exists in `<data_directory>/locales/`
- **AND** the system language is set to French (fr-FR)
- **WHEN** the application starts
- **THEN** the application SHALL fallback to `en-US.json` as the active locale
- **AND** no error message SHALL be displayed to the user

#### Scenario: Fallback when locale file is missing
- **GIVEN** no locale files exist in `<data_directory>/locales/`
- **WHEN** the application starts
- **THEN** the application SHALL use hardcoded English defaults
- **AND** SHALL log a warning about missing locale files

---

### Requirement: User Language Override
Users SHALL be able to override the system language via a configuration setting.

#### Scenario: User overrides system language via config
- **GIVEN** the system language is English
- **AND** `config.json` contains `"language": "zh-CN"`
- **AND** `zh-CN.json` exists in `<data_directory>/locales/`
- **WHEN** the application starts
- **THEN** the application SHALL use `zh-CN.json` instead of `en-US.json`
- **AND** all UI text SHALL display in Chinese

#### Scenario: Invalid language override falls back to system language
- **GIVEN** `config.json` contains `"language": "invalid-LANG"`
- **AND** no `invalid-LANG.json` file exists
- **AND** the system language is English
- **WHEN** the application starts
- **THEN** the application SHALL fallback to `en-US.json`
- **AND** SHALL log a warning about the invalid language setting

---

### Requirement: Path-based String Retrieval
Localized strings SHALL be retrievable using dot-notated key paths.

#### Scenario: Retrieve translation by key
- **GIVEN** the active locale contains `"settings.title": "Breeze Settings"`
- **WHEN** calling `t("settings.title")` in React or `get_translation("settings.title")` in C++
- **THEN** the function SHALL return `"Breeze Settings"`

#### Scenario: Missing key returns key as fallback
- **GIVEN** the active locale does not contain the key `"nonexistent.key"`
- **WHEN** calling `t("nonexistent.key")`
- **THEN** the function SHALL return the string `"nonexistent.key"`
- **AND** SHALL NOT throw an error

#### Scenario: Empty string value is returned correctly
- **GIVEN** the active locale contains `"empty.value": ""`
- **WHEN** calling `t("empty.value")`
- **THEN** the function SHALL return an empty string `""`
- **AND** SHALL NOT return the key itself

---

### Requirement: String Interpolation
The system SHALL support dynamic value substitution in translation strings using placeholder syntax.

#### Scenario: Simple placeholder substitution
- **GIVEN** the active locale contains `"plugins.installSuccess": "Plugin installed successfully: {name}"`
- **WHEN** calling `t("plugins.installSuccess", { name: "MyPlugin" })`
- **THEN** the function SHALL return `"Plugin installed successfully: MyPlugin"`

#### Scenario: Multiple placeholders in single string
- **GIVEN** the active locale contains `"plugins.update": "Update ({from} -> {to})"`
- **WHEN** calling `t("plugins.update", { from: "1.0.0", to: "2.0.0" })`
- **THEN** the function SHALL return `"Update (1.0.0 -> 2.0.0)"`

#### Scenario: Missing placeholder value
- **GIVEN** the active locale contains `"greeting": "Hello, {name}!"`
- **WHEN** calling `t("greeting", {})` without providing the `name` parameter
- **THEN** the function SHALL return `"Hello, {name}!"` with the placeholder intact
- **AND** SHALL NOT throw an error

#### Scenario: Extra parameters are ignored
- **GIVEN** the active locale contains `"simple": "Hello World"`
- **WHEN** calling `t("simple", { unused: "value" })`
- **THEN** the function SHALL return `"Hello World"`
- **AND** SHALL ignore the unused parameter

---

### Requirement: Locale Caching
The system SHALL cache loaded locale data in memory to avoid repeated file I/O.

#### Scenario: Locale is cached after first load
- **GIVEN** the application has loaded `en-US.json` on startup
- **WHEN** `get_translation("settings.title")` is called multiple times
- **THEN** the locale file SHALL NOT be re-read from disk
- **AND** translations SHALL be served from the in-memory cache

#### Scenario: Cache is invalidated on language change
- **GIVEN** the current cached locale is `en-US`
- **WHEN** the user changes the language setting to `zh-CN`
- **THEN** the system SHALL load `zh-CN.json` from disk
- **AND** SHALL replace the cache with the new locale data

---

### Requirement: Scriptable Localization API
The localization framework SHALL be accessible via the JavaScript plugin API in the QuickJS environment.

#### Scenario: Plugin retrieves translation
- **GIVEN** the active locale is `en-US`
- **AND** `en-US.json` contains `"menu.settings": "Settings"`
- **WHEN** a plugin script calls `shell.breeze.get_translation("menu.settings")`
- **THEN** the function SHALL return `"Settings"`

#### Scenario: Plugin handles missing translation
- **GIVEN** a plugin calls `shell.breeze.get_translation("custom.missing.key")`
- **AND** the key does not exist in any locale file
- **WHEN** the function executes
- **THEN** it SHALL return `"custom.missing.key"`
- **AND** SHALL NOT throw an exception

#### Scenario: Plugin uses interpolation
- **GIVEN** the active locale contains `"plugins.installSuccess": "Plugin installed: {name}"`
- **WHEN** a plugin calls `shell.breeze.get_translation("plugins.installSuccess", { name: "TestPlugin" })`
- **THEN** the function SHALL return `"Plugin installed: TestPlugin"`

---

### Requirement: Plugin Locale Registration
Plugins SHALL be able to register their own translation keys without modifying core locale files.

#### Scenario: Plugin registers custom translations
- **GIVEN** a plugin calls `shell.breeze.register_translations("zh-CN", { "myplugin.title": "我的插件" })`
- **AND** the active locale is `zh-CN`
- **WHEN** calling `t("myplugin.title")`
- **THEN** the function SHALL return `"我的插件"`

#### Scenario: Plugin translations do not override core translations
- **GIVEN** the core locale contains `"settings.title": "Breeze Settings"`
- **AND** a plugin attempts to register `{ "settings.title": "Hacked Title" }`
- **WHEN** calling `t("settings.title")`
- **THEN** the function SHALL return `"Breeze Settings"` (the core value)
- **AND** the plugin override SHALL be ignored

#### Scenario: Plugin translations from JSON file
- **GIVEN** a plugin has a file at `<data_directory>/locales/plugins/myplugin/en-US.json`
- **AND** this file contains `{ "myplugin.hello": "Hello from plugin" }`
- **WHEN** the plugin is loaded
- **THEN** the translations SHALL be merged into the active locale namespace
- **AND** `t("myplugin.hello")` SHALL return `"Hello from plugin"`

---

### Requirement: Locale File Format
Locale files SHALL use a flat JSON format with dot-notated keys.

#### Scenario: Valid locale file structure
- **GIVEN** a locale file with the following structure:
  ```json
  {
    "settings.title": "Breeze Settings",
    "settings.theme": "Theme",
    "plugins.install": "Install"
  }
  ```
- **WHEN** the application loads this file
- **THEN** all keys SHALL be accessible via their full path
- **AND** no nested traversal SHALL be required

#### Scenario: Malformed JSON file is handled gracefully
- **GIVEN** a locale file contains invalid JSON syntax
- **WHEN** the application attempts to load the file
- **THEN** the application SHALL fallback to the default locale
- **AND** SHALL log an error message with the parse failure details
- **AND** SHALL NOT crash

#### Scenario: Locale file with metadata
- **GIVEN** a locale file contains a `$metadata` object with language info
- **WHEN** the application loads this file
- **THEN** the metadata SHALL be accessible for display purposes
- **AND** translation keys starting with `$` SHALL be ignored during key lookup

---

### Requirement: RTL Language Support (Future)
The system SHALL be designed to support right-to-left (RTL) languages in future versions.

> **Note**: Full RTL rendering is out of scope for v1. This requirement documents the architectural considerations.

#### Scenario: RTL locale is detected
- **GIVEN** a locale file with `$metadata.direction: "rtl"` (e.g., `ar-SA.json`)
- **WHEN** the application loads this locale
- **THEN** the system SHALL expose an `isRTL()` property returning `true`
- **AND** SHALL NOT automatically apply RTL layout transformations in v1

#### Scenario: LTR locale is default
- **GIVEN** a locale file without explicit direction metadata
- **WHEN** the application loads this locale
- **THEN** `isRTL()` SHALL return `false`
- **AND** the system SHALL use left-to-right text rendering

---

### Requirement: Language Metadata
Locale files SHALL support metadata for language display and configuration.

#### Scenario: Display available languages
- **GIVEN** locale files exist for `en-US`, `zh-CN`, and `ja-JP`
- **AND** each file has `$metadata.name` set to their native names
- **WHEN** the settings UI displays language options
- **THEN** it SHALL show `"English (United States)"`, `"简体中文"`, and `"日本語"`
- **AND** SHALL NOT show the locale codes directly

