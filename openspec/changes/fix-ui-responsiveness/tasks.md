# Tasks

## Section 1: Performance Optimization

### 1.1 Refactor PluginStore.tsx <!-- id: 0 -->
- [x] Add `pluginStatuses` state declaration after line 15
  ```typescript
  const [pluginStatuses, setPluginStatuses] = useState<Record<string, {
      installed: boolean;
      installPath: string | null;
      localVersion: string;
      hasUpdate: boolean;
  }>>({});
  ```
- [x] Add `useEffect` to compute plugin statuses after line 21 (after existing `useEffect`)
  - Iterate over `updateData.plugins`
  - For each plugin: check `shell.fs.exists()` for `.js` and `.disabled` paths
  - Read file content to extract version if installed
  - Compute `hasUpdate` by comparing versions
  - Call `setPluginStatuses()` with computed map
- [x] Update render loop (lines 55-66) to read from `pluginStatuses[plugin.name]`
  - Replace inline `shell.fs.exists()` calls with `status.installed`
  - Replace inline `shell.fs.read()` call with `status.localVersion`
  - Replace inline version comparison with `status.hasUpdate`
- [x] Update `installPlugin` success callback (after line 31) to optimistically update state

### 1.2 Refactor PluginConfig.tsx <!-- id: 1 -->
- [x] Add `enabledPlugins` state declaration after line 12
  ```typescript
  const [enabledPlugins, setEnabledPlugins] = useState<Set<string>>(new Set());
  ```
- [x] Update `reloadPluginsList` function (lines 18-21) to also compute enabled status
  - After loading plugin list, iterate and check `shell.fs.exists()` for each
  - Populate `Set<string>` of enabled plugin names
  - Call `setEnabledPlugins()` with the computed set
- [x] Update render loop for prioritized plugins (line 82) to read from state
  - Replace: `const isEnabled = shell.fs.exists(...)`
  - With: `const isEnabled = enabledPlugins.has(name)`
- [x] Update render loop for regular plugins (line 101) to read from state

### 1.3 Fix Animation Button Highlighting <!-- id: 2 -->
- [x] In `ContextMenuConfig.tsx`, locate Animation button rendering (line 118-136)
- [x] Add `selected` prop to the `<Button>` component on line 118
  ```diff
  <Button
      key={name}
  +   selected={name === currentAnimationPreset}
      onClick={() => { /* ... */ }}
  >
  ```

---

## Section 2: Responsive Layout Improvements

### 2.1 Make Content Area Flexible <!-- id: 4 -->
- [x] In `ConfigApp.tsx`, update the content wrapper (around line 149)
  ```diff
  - <flex padding={20}>
  + <flex padding={20} flexGrow={1}>
  ```

### 2.2 Update PluginStore.tsx Layout <!-- id: 5 -->
- [x] Replace fixed width container (line 53)
  ```diff
  - <flex gap={10} alignItems="stretch" width={570} height={500} autoSize={false}>
  + <flex gap={10} alignItems="stretch" flexGrow={1}>
  ```
- [x] Ensure scrollable area still has `maxHeight={500}` or similar constraint

### 2.3 Update PluginConfig.tsx Layout <!-- id: 6 -->
- [x] Replace fixed width container (line 74)
  ```diff
  - <flex gap={20} width={580} height={550} autoSize={false} alignItems="stretch">
  + <flex gap={20} flexGrow={1} alignItems="stretch">
  ```

### 2.4 Update ContextMenuConfig.tsx Layout <!-- id: 7 -->
- [x] Replace fixed width container (line 65)
  ```diff
  - <flex gap={20} alignItems="stretch" width={500} autoSize={false}>
  + <flex gap={20} alignItems="stretch" flexGrow={1}>
  ```

### 2.5 Text Truncation Handling <!-- id: 8 -->
- [x] Review plugin name and description rendering in `PluginStore.tsx`
- [x] Ensure `<Text>` components have appropriate `maxWidth` or parent flex constraints
- [x] Add `flexShrink={1}` to text containers if needed to prevent overflow

---

## Section 3: Verification <!-- id: 3 -->

### 3.1 Performance Verification
- [x] Manual Test: Open Breeze Config → Plugin Store tab
  - [x] Scroll the plugin list up and down rapidly
  - [x] Confirm smooth 60fps scrolling with no stutter
  - [x] Install a plugin and confirm status updates immediately
- [x] Manual Test: Tab switching
  - [x] Switch between all tabs rapidly
  - [x] Confirm each switch is instantaneous (<100ms)
- [x] Code Review: Verify no `shell.fs.exists` or `shell.fs.read` calls remain inside `.map()` render loops

### 3.2 Animation Highlight Verification
- [x] Manual Test: Main Config → Animation section
  - [x] Select "Fast" animation preset
  - [x] Confirm "Fast" button shows blue border (selected state)
  - [x] Select "None" animation preset
  - [x] Confirm "None" button shows blue border, "Fast" loses border

### 3.3 Responsive Layout Verification
- [x] Manual Test: Visual consistency
  - [x] Navigate to each tab and compare content area widths
  - [x] Confirm all pages have consistent content width (no jarring width changes)
- [x] Manual Test: Content fills available space
  - [x] Observe that plugin lists and settings fill the right side of the window
  - [x] Confirm no excessive right-side margin/whitespace
- [x] Manual Test: Text overflow (if applicable)
  - [x] If any plugin has a very long name, confirm it doesn't break the layout
