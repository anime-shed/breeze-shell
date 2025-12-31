# Design: Auto-Deploy Embedded Locales

## Context
The application reads translations from `<data_directory>/locales/`. Currently, the build process does not copy the source `resources/locales/` files to this directory. Users running the application for the first time or from a fresh install see untranslated keys.

## Goals
- **Zero-Config**: The application should have working translations immediately after build/install/run without manual file copying.
- **User Customizable**: Users should still be able to edit the JSON files in their data directory to customize translations.

## Decisions

### Decision 1: Embed Default Locales
Use `xmake`'s `utils.bin2c` rule to convert `resources/locales/en-US.json` and `zh-CN.json` into C buffers (headers) that are compiled into `shell.dll`.

**Rationale**:
- robust against file loss.
- simplifying distribution (single binary vs binary + assets).

### Decision 2: Extract-if-Missing Strategy
In `i18n_manager::reload()` or constructor:
1. Check if `<data_directory>/locales/en-US.json` exists.
2. If NOT, write the embedded `en_US_json` buffer to that path.
3. Repeat for `zh-CN.json`.
4. Proceed to load locales from disk as usual.

**Rationale**:
- Preserves user edits (if file exists, we don't overwrite it).
- Ensures at least the default version exists.

## Alternatives Considered
- **Copy during build**: Requires build scripts to know the target `data_directory`, which is user-specific (`%USERPROFILE%`). This is hard to do reliably across different dev/prod environments.
- **Installer logic**: Puts burden on the installer; doesn't help local dev or "portable" usage.
