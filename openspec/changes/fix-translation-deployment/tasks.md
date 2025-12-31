# Implementation Tasks

## 1. Build System Updates
> **Goal**: Embed locale files into the binary

- [x] **1.1** Update `xmake.lua`
  - Add `add_rules("utils.bin2c", {extensions = {".json"}})` to `shell` target
  - Add `add_files("resources/locales/en-US.json", "resources/locales/zh-CN.json")`

## 2. C++ Implementation
> **Goal**: Auto-extract locales at runtime

- [x] **2.1** Update `src/shell/i18n_manager.cc` includes
  - Include generated headers (likely `#include "resources/locales/en_US_json.h"`)
  
- [x] **2.2** Implement `ensure_locales_exist()`
  - Check file existence using `std::filesystem`
  - Write embedded data to disk if missing

- [x] **2.3** Call `ensure_locales_exist()` in `i18n_manager` constructor or `reload()`

## 3. CI Cleanup
> **Goal**: Remove redundant build steps

- [x] **3.1** Remove `Copy Assets` step from `.github/workflows/xmake.yml`

## 4. Validation
> **Goal**: Verify fix

- [x] **3.1** Clean check
  - Delete `~/.breeze-shell/locales`
  - Run app
  - Verify `locales` folder is recreated and populated
  - Verify app UI shows translations
