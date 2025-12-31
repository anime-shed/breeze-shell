# Project Context

## Purpose
Breeze Shell is a high-performance, fluent, and extensible alternative context menu for Windows 10 and 11. It aims to bring modern animations and a polished user interface back to the Windows shell while providing a powerful JavaScript-based scripting API for extensibility.

## Tech Stack
- **Primary Languages**: C++ (C++2b), TypeScript/JavaScript.
- **Frontend (Config UI)**: React.
- **Build System**: [xmake](https://xmake.io).
- **UI Framework**: `breeze_ui` (custom animation-friendly UI library).
- **Scripting Engine**: QuickJS (quickjs-ng via quickjspp).
- **Rendering**: NanoVG / ThorVG.
- **Persistence/Serialization**: [reflect-cpp](https://github.com/getml/reflect-cpp).
- **Utilities**: 
    - [blook](https://github.com/std-microblock/blook) for Windows API hooking.
    - [wintoast](https://github.com/mohabouje/WinToast) for desktop notifications.
    - [cpptrace](https://github.com/jeremy-rifkin/cpptrace) for stack trace generation.
    - [yalantinglibs](https://github.com/alibaba/yalantinglibs) for modern C++ async/coroutine support.

## Project Conventions

### Code Style
- **C++**: 
    - **Formatter**: Follows `.clang-format` (4 spaces indent, -4 access modifier offset).
    - **Naming**: `snake_case` for files, folders, variables, functions, and structs. 
    - **Namespace**: Logic resides in the `mb_shell` namespace.
    - **Standards**: Modern C++2b features are leveraged and encouraged.
    - **Encoding**: UTF-8 is enforced for all source files.
- **TypeScript**: 
    - Standard React/TypeScript conventions.
    - Interacts with the C++ host via the `mshell` native module.

### Architecture Patterns
- **Modular Shell**: Core logic in `shell` shared library, integrated into Windows processes.
- **Host Process**: The `inject` target produces `breeze.exe`, which handles starting the shell and injecting logic.
- **Scripting Layer**: Exposes C++ functionality to QuickJS for plugin support (defined in `src/shell/script/binding_types.d.ts`).
- **Configuration**: Native C++ structs mapped directly to JSON via `reflect-cpp`.
- **UI Components**: Component-based UI using the custom `breeze_ui` library.

### Testing Strategy
- **UI Tests**: Manual and automated tests located in `src/ui_test`.
- **Sanitizers**: AddressSanitizer (ASan) is integrated via xmake options (`xmake f --asan=y`) and has dedicated tests in `src/asan`.

### Git Workflow
- **Versioning**: Semantic versioning (e.g., `0.1.32`).
- **Commits**: Descriptive commit messages.

## Domain Context
- **Windows Shell Hooking**: Deep integration with Windows Explorer via `blook` to override or extend native context menus.
- **Win32 API**: Heavy reliance on Windows-specific APIs (`user32`, `shell32`, `oleacc`, `comctl32`, etc.).
- **Fluid UI & Animations**: Core focus on high-refresh-rate animations and modern visual effects like "acrylic".

## Important Constraints
- **Platform**: Windows 10/11 only.
- **Compiler**: Requires a toolchain supporting C++2b (e.g., Clang-cl or MSVC 2019+).
- **Performance**: High emphasis on low latency and low memory footprint (~2MiB).

## External Dependencies
- **QuickJS**: Embedded lightweight JS engine for plugin support.
- **GLFW/GLAD**: For windowing and OpenGL management.
- **FreeType**: Text and glyph rendering.
- **NanoVG/ThorVG**: Vector graphics engines for the UI layer.
