# Architecture Overview

macOS menubar terminal application built with **Tauri 2.0** (Rust backend) and **Vite + React 19** (frontend).

## Three-Layer Architecture

µTerm uses a three-layer architecture with clear separation of concerns:

### Layer 1: React (Frontend) - `src/`

**Responsibilities:**

- UI rendering and user interactions
- Terminal display via xterm.js
- State management (tabs, panes, settings)
- Keyboard event handling
- User preferences (opacity, font size, pinned state)
- Tab/pane layout management

**Key files:**

- `src/components/XTerminal.tsx` - Terminal UI component
- `src/components/TabBar.tsx` - Tab management UI
- `src/contexts/TabContext.tsx` - Tab state management
- `src/contexts/PaneContext.tsx` - Pane tree state management
- `src/lib/tauri/` - IPC layer to call Rust backend

**Does NOT handle:**

- Real terminal I/O (delegated to Rust PTY layer)
- Window positioning (delegated to Rust/Native layer)
- System-level events (delegated to Native layer)

### Layer 2: Rust (Backend) - `src-tauri/`

**Responsibilities:**

- PTY (pseudo-terminal) session management
- Shell process lifecycle (spawn, write, resize, close)
- Multi-screen window configuration persistence
- Window size calculations and constraints
- Command execution and streaming output
- Settings persistence to disk

**Key files:**

- `src-tauri/src/pty.rs` - PTY session management with `portable-pty`
- `src-tauri/src/screen_config.rs` - Multi-screen window size persistence
- `src-tauri/src/window_commands.rs` - Window sizing and positioning commands
- `src-tauri/src/settings.rs` - Settings persistence layer

**Communication:**

- Exposes `#[command]` functions callable via Tauri IPC
- Emits `pty-output` and `pty-exit` events to frontend
- Calls macOS native APIs via `objc2` bindings

**Does NOT handle:**

- UI rendering (delegated to React)
- Native window behavior (delegated to Native layer)

### Layer 3: macOS Native (via objc2) - `src-tauri/src/lib.rs`

**Responsibilities:**

- Native window behavior configuration
  - Floating panel level (`NSWindow.level`)
  - Window collection behavior (visible on all spaces)
  - Borderless window styling
- Global event monitoring
  - Mouse click detection (for auto-hide)
  - Cursor position detection (for multi-screen support)
- Screen coordinate system translation
  - NSScreen coordinate system → Tauri monitor mapping
- Tray icon behavior (`MouseButtonState::Up` for macOS convention)

**Key implementations:**

- `configure_panel_behavior()` - Sets native window properties via AppKit
- `detect_cursor_monitor()` - Uses `NSEvent::mouseLocation()` and `NSScreen` APIs
- Global click monitor - Uses `NSEvent.addGlobalMonitorForEvents`

**APIs used:**

- `objc2-app-kit` - NSWindow, NSScreen, NSEvent
- `objc2-foundation` - MainThreadMarker (ensures main thread execution)

**Why Native layer is needed:**

- Tauri's cross-platform APIs don't expose all macOS-specific behaviors
- Direct AppKit access for fine-grained window control
- Proper macOS menubar app conventions (floating, auto-hide, tray behavior)

**Window Rendering Optimization:**

- `apply_window_config()` uses `setFrame_display(frame, false)` to prevent double render
- Setting `display: false` defers redraw until `orderFrontRegardless()` is called
- This eliminates visual flash when showing window, especially noticeable on vertical screens
- Flow: Set frame silently → Show window → Single atomic render at correct size

## Frontend-Backend Communication

Tauri IPC connects React frontend and Rust backend via two patterns:

1. **Commands** (request-response): Frontend calls `invoke()` → Rust handles in `commands.rs` or `pty_commands.rs`
2. **Events** (streaming): Rust emits `pty-output`/`pty-exit` → Frontend listens via `listen()`

Frontend wrapper `src/lib/tauri.ts` provides typed functions with dynamic imports (checks `window.__TAURI__` for browser safety).

## Rust Backend (src-tauri/)

**pty.rs** - PTY session management (the real terminal):

- `PtyManager` - Manages PTY sessions with `portable-pty` crate
- Creates real shell sessions (reads `$SHELL`, defaults to zsh)
- Spawns reader thread per session, emits `pty-output` events to frontend
- Session lifecycle: `create_pty_session` → `write_to_pty` / `resize_pty` → `close_pty_session`

**lib.rs** - macOS window/tray behavior:

- Uses `objc2`/`objc2-app-kit` for native macOS APIs (not `cocoa`)
- `configure_panel_behavior` sets floating window level, space behavior
- Global click monitor hides window on outside click (unless pinned)
- `MouseButtonState::Up` for tray click (matches native macOS behavior)
- Pin state management: `set_window_pinned()` / `is_window_pinned()` prevents auto-hide

**commands.rs** - Legacy simple command execution (less used now that PTY exists)

## Tauri v2 Capabilities

Permissions in `src-tauri/capabilities/default.json`:

- `core:event:allow-listen/emit` - PTY output streaming
- `global-shortcut:*` - Keyboard shortcuts
- `autostart:*` - Launch at login

## Key Frontend Components

- `src/components/XTerminal.tsx` - Main terminal UI with xterm.js, PTY integration
- `src/lib/tauri.ts` - Typed IPC wrapper with dynamic imports
- `src/lib/settings.ts` - Persisted settings (opacity, font size, pinned) in localStorage
- `src/lib/constants.ts` - Centralized timing constants
- `src/lib/guards.ts` - Runtime type guards for event payloads
- `src/lib/pin.ts` - Pin state utilities for global shortcuts

## Custom Hooks (src/hooks/)

| Hook | Purpose |
|------|---------|
| `usePtySession` | PTY session lifecycle management (create, write, resize, close) |
| `usePinState` | Pin state management across components and Rust backend |
| `useDoubleEsc` | Double-ESC detection to hide window (vim-like behavior) |
| `useTerminalFocus` | Terminal focus management across window events |
| `useCwdPolling` | Poll current working directory for tab title updates |
| `useXTermSearch` | xterm.js search addon functionality |
| `useSettings` | React hook for settings with localStorage persistence |
| `useTabShortcuts` | Keyboard shortcuts for tab management |

## Styling

Uses **Vanilla Extract** for type-safe CSS-in-TypeScript:

- Component styles: `src/components/*.css.ts`
- Global styles: `src/styles/global.css.ts`
- Animations: `src/styles/animations.css.ts`
- xterm overrides: `src/styles/xterm-overrides.css`
