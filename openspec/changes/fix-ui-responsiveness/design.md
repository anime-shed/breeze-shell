# Design: UI Responsiveness Optimization

## Context

The Breeze Config UI has two categories of responsiveness issues:

1. **Performance Responsiveness**: Synchronous file I/O during React render causes UI freeze
2. **Responsive Layout**: Hardcoded fixed pixel dimensions prevent adaptive layouts

### Technical Background

**React Render Loop Constraint**: React components should have pure render functions. Side effects (I/O, network, timers) must be performed in `useEffect` hooks, not during render. When synchronous I/O occurs during render, JavaScript's single-threaded event loop blocks.

**Current Performance Issue (`PluginStore.tsx:55-66`)**:
```typescript
// PROBLEM: Inside .map() during render
plugins.map((plugin: any) => {
    // Line 57 - Sync I/O #1
    if (shell.fs.exists(shell.breeze.data_directory() + '/scripts/' + plugin.local_path)) {
        install_path = shell.breeze.data_directory() + '/scripts/' + plugin.local_path;
    }
    // Line 60 - Sync I/O #2
    if (shell.fs.exists(shell.breeze.data_directory() + '/scripts/' + plugin.local_path + '.disabled')) {
        install_path = shell.breeze.data_directory() + '/scripts/' + plugin.local_path + '.disabled';
    }
    // Line 64 - Sync I/O #3 (reads entire file!)
    const local_version_match = installed ? shell.fs.read(install_path).match(/\/\/ @version:\s*(.*)/) : null;
    // ...render JSX...
});
```

**Current Layout Issue (Hardcoded Dimensions)**:
```typescript
// constants.ts:21-23 - Fixed window dimensions
export const WINDOW_WIDTH = 800;
export const WINDOW_HEIGHT = 600;
export const SIDEBAR_WIDTH = 170;

// ConfigApp.tsx:142 - Fixed container
<flex horizontal width={WINDOW_WIDTH} height={WINDOW_HEIGHT} autoSize={false} ...>

// PluginStore.tsx:53 - Fixed content width
<flex gap={10} alignItems="stretch" width={570} height={500} autoSize={false}>

// PluginConfig.tsx:74 - Different fixed width
<flex gap={20} width={580} height={550} autoSize={false} alignItems="stretch">

// ContextMenuConfig.tsx:65 - Yet another width
<flex gap={20} alignItems="stretch" width={500} autoSize={false}>
```

## Goals

### Performance Goals
1. **Zero synchronous I/O during render** — All file system operations in `useEffect`
2. **Maintain data freshness** — Status updates after install/toggle/delete actions
3. **Minimal state structure** — Simple Map or object for status cache

### Responsive Layout Goals
1. **Flexible content area** — Use `flexGrow` instead of fixed pixel widths
2. **Consistent spacing** — Uniform padding/margins across pages
3. **Graceful text handling** — Ellipsis truncation for long text
4. **Optional resize support** — Adapt if window is resizable

## Non-Goals

1. Real-time file watching (unnecessary for config tool UX)
2. Complex breakpoint system (desktop-only app)
3. Complete CSS-in-JS refactor (incremental improvement)

---

## Section 1: Performance Solutions

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Component                          │
├─────────────────────────────────────────────────────────────┤
│  STATE:                                                      │
│    pluginStatuses: Map<string, PluginStatus>                │
│                                                              │
│  EFFECT (runs on mount + dependency changes):               │
│    for each plugin:                                          │
│      → shell.fs.exists() → shell.fs.read()                  │
│      → setPluginStatuses(...)                               │
│                                                              │
│  RENDER (pure, no I/O):                                     │
│    plugins.map(p => <PluginCard status={statuses[p.name]}/>)│
└─────────────────────────────────────────────────────────────┘
```

### State Shape

```typescript
// PluginStore
interface PluginStatus {
    installed: boolean;
    installPath: string | null;
    localVersion: string;
    hasUpdate: boolean;
}

const [pluginStatuses, setPluginStatuses] = useState<Record<string, PluginStatus>>({});

// PluginConfig  
const [enabledPlugins, setEnabledPlugins] = useState<Set<string>>(new Set());
```

### PluginStore.tsx Refactor

**Before (Lines 55-66 in render):**
```typescript
{plugins.map((plugin: any) => {
    let install_path = null;
    if (shell.fs.exists(...)) { install_path = ...; }
    if (shell.fs.exists(...)) { install_path = ...; }
    const installed = install_path !== null;
    const local_version_match = installed ? shell.fs.read(install_path).match(...) : null;
    // ...render...
})}
```

**After:**
```typescript
// NEW: State to cache plugin status
const [pluginStatuses, setPluginStatuses] = useState<Record<string, PluginStatus>>({});

// NEW: Effect to load statuses (after mount/data change)
useEffect(() => {
    if (!updateData?.plugins) return;
    
    const statuses: Record<string, PluginStatus> = {};
    for (const plugin of updateData.plugins) {
        const basePath = shell.breeze.data_directory() + '/scripts/' + plugin.local_path;
        let installPath: string | null = null;
        
        if (shell.fs.exists(basePath)) {
            installPath = basePath;
        } else if (shell.fs.exists(basePath + '.disabled')) {
            installPath = basePath + '.disabled';
        }
        
        const installed = installPath !== null;
        let localVersion = t('plugins.not_installed');
        if (installed && installPath) {
            const content = shell.fs.read(installPath);
            const match = content.match(/\/\/ @version:\s*(.*)/);
            if (match) localVersion = match[1];
        }
        
        statuses[plugin.name] = {
            installed,
            installPath,
            localVersion,
            hasUpdate: installed && localVersion !== plugin.version
        };
    }
    setPluginStatuses(statuses);
}, [updateData?.plugins]);

// UPDATED: Render reads from cached state (O(1) lookup)
{plugins.map((plugin: any) => {
    const status = pluginStatuses[plugin.name] || { installed: false, localVersion: t('plugins.not_installed'), hasUpdate: false };
    // ...render using status.installed, status.hasUpdate, status.localVersion...
})}
```

---

## Section 2: Responsive Layout Solutions

### Current Layout Analysis

```
┌─────────────────────────────────────────────────────────────┐
│  WINDOW (800 x 600 fixed)                                    │
├───────────┬─────────────────────────────────────────────────┤
│ SIDEBAR   │  CONTENT AREA                                   │
│ (170px)   │  (varies per page: 500-580px + 20px padding)    │
│           │                                                  │
│           │  ┌─────────────────────┐                        │
│           │  │ PluginStore: 570px  │  ← Hardcoded          │
│           │  │ PluginConfig: 580px │  ← Inconsistent        │
│           │  │ MainConfig: 500px   │  ← Different           │
│           │  └─────────────────────┘                        │
└───────────┴─────────────────────────────────────────────────┘
```

### Proposed Layout Pattern

**Replace fixed widths with flex-based sizing:**

```typescript
// BEFORE: Fixed width
<flex gap={20} width={580} height={550} autoSize={false} alignItems="stretch">

// AFTER: Flexible width
<flex gap={20} flexGrow={1} alignItems="stretch">
```

**ConfigApp.tsx content area:**
```typescript
// BEFORE
<flex padding={20}>
    {activePage === 'plugin-store' && <PluginStore />}
</flex>

// AFTER
<flex padding={20} flexGrow={1}>
    {activePage === 'plugin-store' && <PluginStore />}
</flex>
```

**Individual page components:**
```typescript
// PluginStore.tsx - BEFORE
<flex gap={10} alignItems="stretch" width={570} height={500} autoSize={false}>

// PluginStore.tsx - AFTER  
<flex gap={10} alignItems="stretch" flexGrow={1}>
    <flex enableScrolling maxHeight={500} alignItems="stretch">
        {/* plugin list */}
    </flex>
</flex>
```

### Text Truncation Strategy

For long plugin names/descriptions:
```typescript
// Use maxWidth with explicit text truncation
<Text fontSize={18} maxWidth={-1}>{plugin.name}</Text>

// Or constrain parent container
<flex flexGrow={1} flexShrink={1}>
    <Text fontSize={18}>{plugin.name}</Text>
</flex>
```

---

## Risk Assessment

### Risk 1: Stale Data (Performance)
**Mitigation**: Re-check on user actions. Acceptable for config tool.
**Severity**: Low

### Risk 2: Layout Regression (Responsive)
**Mitigation**: Test each page after removing fixed widths. Use flexShrink to prevent overflow.
**Severity**: Medium

### Risk 3: Window Resize Not Supported
**Description**: Host environment may not support window resize.
**Mitigation**: Flexible layout still works at fixed size. Design for current window size first.
**Severity**: Low

---

## Alternatives Considered

### Alternative 1: CSS Media Queries
**Rejected**: This is a custom React renderer, not browser DOM. Standard CSS doesn't apply.

### Alternative 2: Virtualized Lists
**Rejected**: Adds complexity. Data loading pattern + flex layout solves core issues.

### Alternative 3: Complete Layout Rewrite
**Rejected**: Incremental improvement preferred. Replace fixed widths → flexGrow is minimal change.

## Open Questions

1. **Window resize capability**: Does the host environment support window resize events? If yes, layout will adapt automatically. If no, flexible layout still works at current fixed size.
