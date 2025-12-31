# Change: Fix Translation Deployment

## Why
Although the i18n framework is implemented, the locale files (`en-US.json`, `zh-CN.json`) residing in `resources/locales` are not deployed to the user's data directory where the application expects them. This results in the application launching with missing translations ("still not translated").

## What Changes
- **MODIFIED**: `xmake.lua` to embed the default locale files into the binary using `utils.bin2c`.
- **MODIFIED**: `src/shell/i18n_manager.cc` to include the embedded locale data.
- **MODIFIED**: `src/shell/i18n_manager.cc` to check for the existence of locale files in `<data_directory>/locales/` on startup.
- **ADDED**: Logic to write the embedded default locales to disk if they are missing at runtime.

## Impact

### Affected Capabilities
- **core**: ensures translations are available out-of-the-box.

### Affected Code
| File | Change Type | Description |
|------|-------------|-------------|
| `xmake.lua` | Modified | Add `utils.bin2c` rules for `resources/locales/*.json` |
| `src/shell/i18n_manager.cc` | Modified | Add auto-extraction logic |
| `.github/workflows/xmake.yml` | Modified | Remove redundant locale copy step |

### Breaking Changes
- None.

### Design Documentation
See `design.md`.
