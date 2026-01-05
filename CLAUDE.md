# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Install dependencies
bun install

# Development - single command (recommended)
bun run tauri dev     # Starts both Vite dev server and Tauri

# Production build
bun run build         # Build Vite frontend (outputs to ./dist/)
bun run tauri build   # Build final macOS application

# Tests
bun run test          # Watch mode (Vitest)
bun run test:run      # Single run
bun run test:coverage # With coverage report

# Run a single test file
bun run test:run src/lib/settings.test.ts

# Rust tests
cd src-tauri && cargo test

# Lint
bun run lint
```

## Architecture Overview

macOS menubar terminal application built with **Tauri 2.0** (Rust backend) and **Vite + React 19** (frontend).

### Frontend-Backend Communication

Tauri IPC connects React frontend and Rust backend via two patterns:

1. **Commands** (request-response): Frontend calls `invoke()` → Rust handles in `commands.rs` or `pty_commands.rs`
2. **Events** (streaming): Rust emits `pty-output`/`pty-exit` → Frontend listens via `listen()`

Frontend wrapper `src/lib/tauri.ts` provides typed functions with dynamic imports (checks `window.__TAURI__` for browser safety).

### Rust Backend (src-tauri/)

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

### Tauri v2 Capabilities

Permissions in `src-tauri/capabilities/default.json`:

- `core:event:allow-listen/emit` - PTY output streaming
- `global-shortcut:*` - Keyboard shortcuts
- `autostart:*` - Launch at login

### Key Frontend Components

- `src/components/XTerminal.tsx` - Main terminal UI with xterm.js, PTY integration
- `src/lib/tauri.ts` - Typed IPC wrapper with dynamic imports
- `src/lib/settings.ts` - Persisted settings (opacity, font size, pinned) in localStorage
- `src/lib/constants.ts` - Centralized timing constants
- `src/lib/guards.ts` - Runtime type guards for event payloads
- `src/lib/pin.ts` - Pin state utilities for global shortcuts

### Custom Hooks (src/hooks/)

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

### Styling

Uses **Vanilla Extract** for type-safe CSS-in-TypeScript:

- Component styles: `src/components/*.css.ts`
- Global styles: `src/styles/global.css.ts`
- Animations: `src/styles/animations.css.ts`
- xterm overrides: `src/styles/xterm-overrides.css`

### Vite Configuration

- **Dev**: `devUrl: http://localhost:3000` in tauri.conf.json
- **Prod**: Static build to `./dist/`, loaded via `frontendDist: ../dist`
- **Path alias**: `@` maps to `./src` for clean imports

## Troubleshooting

**If Vite dev server has cache issues:**

```bash
rm -rf dist node_modules/.vite
bun run tauri dev
```

**If port 3000 is in use:** Kill other processes or update `devUrl` in `src-tauri/tauri.conf.json`.

## Screenshot Maintenance

**Every UI change requires updating both `docs/screenshot.svg` and `docs/screenshot.png`.**

### File Specifications

| File                  | Format     | Dimensions            | Purpose               |
| --------------------- | ---------- | --------------------- | --------------------- |
| `docs/screenshot.svg` | Vector SVG | 760×620 viewBox       | Source file, editable |
| `docs/screenshot.png` | Raster PNG | 1520×1240 (2x Retina) | README display        |

### Update Workflow

1. **Edit the SVG** - Modify `docs/screenshot.svg` to reflect UI changes
2. **Regenerate PNG** - Run conversion command:
   ```bash
   rsvg-convert -w 1520 -h 1240 docs/screenshot.svg -o docs/screenshot.png
   ```

### SVG Layout Reference

The SVG mockup includes:

- **macOS Menubar** (y=0-24)

  - App name at x=32 should be `µTerm` (not Finder or other apps)
  - µTerm tray icon at x=562

- **Terminal Window** (translated to x=30, y=44)
  - **Tab Bar** (y=0-40): tabs-container on left, "+" button and settings icon on right
    - "+" button: `translate(628, 6)` - right side, before settings
    - Settings gear: `translate(664, 11)` - rightmost
  - **Terminal Content** (y=56+): shell prompts, command output

### Important Notes

- Always verify menubar shows "µTerm" as the active app
- Tab bar layout: scrollable tabs (left), "+" button (right), settings (rightmost)
- PNG uses 2x scale for Retina display quality

## Git Commit Convention

This project follows the [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) specification.

### Commit Message Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Type

| Type       | Description                                 | Semantic Version |
| ---------- | ------------------------------------------- | ---------------- |
| `feat`     | New feature                                 | MINOR            |
| `fix`      | Bug fix                                     | PATCH            |
| `docs`     | Documentation changes                       | -                |
| `style`    | Code formatting (no functional changes)     | -                |
| `refactor` | Code refactoring (neither feat nor fix)     | -                |
| `perf`     | Performance improvement                     | -                |
| `test`     | Add/modify tests                            | -                |
| `build`    | Build system or external dependency changes | -                |
| `ci`       | CI configuration changes                    | -                |
| `chore`    | Other changes not modifying src or test     | -                |

### Scope (Optional)

Describes the affected part of the codebase, for example:

- `feat(terminal): add command history navigation`
- `fix(tauri): resolve window positioning issue`

### BREAKING CHANGE

Breaking changes correspond to MAJOR in semantic versioning. Two ways to mark them:

**Option 1:** Add `!` after type/scope

```
feat(api)!: change command output format
```

**Option 2:** Declare in footer

```
feat: redesign terminal output

BREAKING CHANGE: output format changed from plain text to structured JSON
```

### Examples

```bash
# Simple commit
feat: add tab completion support

# With scope
fix(commands): handle empty input gracefully

# With body
feat(terminal): add command history

Implement up/down arrow navigation through previous commands.
History persists across sessions using localStorage.

# With footer
fix: resolve race condition in stream output

Reviewed-by: John
Refs: #42

# Breaking change
feat!: update minimum supported macOS version to 14.0

BREAKING CHANGE: drop support for macOS 13 and earlier
```

### Rules Summary

1. type and description are required
2. description uses imperative mood ("add" not "added")
3. description starts lowercase, no period at end
4. body and footer must be preceded by a blank line
5. BREAKING CHANGE must be uppercase

## Release Workflow (Automated)

See [docs/RELEASE_AUTOMATION.md](docs/RELEASE_AUTOMATION.md) for full documentation.

### Quick Reference

```bash
# Normal release - just push to main
git commit -m "feat: new feature"
git push origin main
# → Release Please creates PR → Merge PR → Auto build & publish
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| Pre-commit | `.husky/pre-commit` | Lint & format check before commit |
| Release Please | `.github/workflows/release-please.yml` | Create release PR |
| Build on Tag | `.github/workflows/build-on-tag.yml` | Build DMG on tag push |
| Config | `release-please-config.json` | Release Please settings |

### Version Bumping

| Commit Type | Version Bump |
|-------------|--------------|
| `feat:` | MINOR (0.x.0) |
| `fix:` | PATCH (0.0.x) |
| `feat!:` | MAJOR (x.0.0) |

### Homebrew Auto-Update

Set `TAP_GITHUB_TOKEN` secret for automatic Homebrew tap updates.
Otherwise, manual update is required after release.
