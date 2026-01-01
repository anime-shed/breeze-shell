# Fix UI Responsiveness

## Why
Users have reported two categories of responsiveness issues in the Breeze Config UI:

### Category 1: Performance Responsiveness (Input Lag)
Investigation revealed that `PluginStore.tsx` and `PluginConfig.tsx` perform **synchronous file system operations** inside their render loops, blocking the main JavaScript thread and causing UI freeze.

**Root Cause Analysis:**
- **PluginStore.tsx (Lines 55-66)**: On every render, for each plugin:
  - Line 57: `shell.fs.exists()` — checks if plugin file exists
  - Line 60: `shell.fs.exists()` — checks if `.disabled` version exists  
  - Line 64: `shell.fs.read()` — reads entire plugin file to extract version string
  - With 50+ plugins → **150+ synchronous I/O calls per render** → ~300-500ms frame times

- **PluginConfig.tsx (Lines 82, 101)**: Similarly, `shell.fs.exists()` inside `.map()` render loops

- **ContextMenuConfig.tsx (Lines 117-136)**: Animation buttons missing `selected` prop (visual regression)

### Category 2: Responsive Layout (Screen Adaptation)
The current implementation uses **hardcoded fixed dimensions** with no responsive layout patterns:

| Component | Hardcoded Dimensions | Issue |
|-----------|---------------------|-------|
| `ConfigApp.tsx:142` | `width={WINDOW_WIDTH}` (800px), `height={WINDOW_HEIGHT}` (600px) | Fixed window size |
| `constants.ts:21-23` | WINDOW_WIDTH=800, WINDOW_HEIGHT=600, SIDEBAR_WIDTH=170 | No breakpoints |
| `PluginStore.tsx:53` | `width={570}` | Content doesn't fill available space |
| `PluginConfig.tsx:74` | `width={580}` | Inconsistent with other pages |
| `ContextMenuConfig.tsx:65` | `width={500}` | Narrower than sibling pages |

**Problems:**
- Content doesn't adapt when window is resized (if supported)
- Inconsistent content widths across pages (500px, 570px, 580px)
- No flex-based proportional sizing
- Plugin text truncation issues at smaller widths

## What Changes

### Performance Fixes
- **PluginStore.tsx**: Move all `shell.fs` calls from render loop into `useEffect`. Cache results in React state.
- **PluginConfig.tsx**: Move `shell.fs.exists` calls into `useEffect`. Cache enabled/disabled status.
- **ContextMenuConfig.tsx**: Add `selected={name === currentAnimationPreset}` to Animation buttons.

### Responsive Layout Improvements
- Replace fixed pixel widths with flexible/proportional layouts using `flexGrow`
- Ensure content area fills available space dynamically
- Standardize padding/margins for consistent spacing
- Add text truncation handling for small viewport scenarios

## Scope
- **Plugin Store** (`PluginStore.tsx`): Performance optimization + responsive layout
- **Plugin Config** (`PluginConfig.tsx`): Performance optimization + responsive layout
- **Theme Settings** (`ContextMenuConfig.tsx`): Animation highlight fix + responsive layout
- **Constants** (`constants.ts`): Review and potentially remove hardcoded content widths

## Impact

### Affected Capabilities
- **responsiveness**: Both performance (60fps, instant feedback) AND layout (adaptive UI)
- **theme**: Animation settings visual fixes

### Performance Improvement Estimates
| Metric | Before | After |
|--------|--------|-------|
| Frame time (50 plugins) | ~300-500ms | <16ms |
| Memory (status cache) | 0 | ~2KB |
| I/O operations per render | 150+ | 0 |

### Layout Improvement Targets
| Aspect | Before | After |
|--------|--------|-------|
| Content width consistency | 500-580px (varies) | Proportional (fills available) |
| Window resize behavior | Fixed/clipped | Adaptive content flow |
| Text overflow handling | Truncated arbitrarily | Controlled with ellipsis |

## Success Criteria
- [x] Plugin Store scrolls at 60fps with no stutter
- [x] Switching between tabs is instantaneous (<100ms perceived latency)
- [x] "Animation" selection in Theme settings is correctly highlighted
- [x] Plugin status (Installed/Update Available) remains accurate
- [x] No regression in plugin install/toggle/delete functionality
- [x] Content area fills available width proportionally
- [x] UI remains usable if window is resized (where supported)
- [x] Consistent visual spacing across all configuration pages
