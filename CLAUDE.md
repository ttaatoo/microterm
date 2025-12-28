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

macOS menubar terminal application built with **Tauri 2.0** (Rust backend) and **Vite + React** (frontend).

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
- Global click monitor hides window on outside click
- `MouseButtonState::Up` for tray click (matches native macOS behavior)

**commands.rs** - Legacy simple command execution (less used now that PTY exists)

### Tauri v2 Capabilities

Permissions in `src-tauri/capabilities/default.json`:

- `core:event:allow-listen/emit` - PTY output streaming
- `global-shortcut:*` - Keyboard shortcuts
- `autostart:*` - Launch at login

### Key Frontend Components

- `src/components/XTerminal.tsx` - Main terminal UI with xterm.js, PTY integration, double-ESC to hide
- `src/lib/tauri.ts` - Typed IPC wrapper with dynamic imports
- `src/lib/settings.ts` - Persisted settings (opacity, font size) in localStorage

### Vite Configuration

- **Dev**: `devUrl: http://localhost:3000` in tauri.conf.json
- **Prod**: Static build to `./dist/`, loaded via `frontendDist: ../dist`

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

This project uses [Release Please](https://github.com/googleapis/release-please) for automated versioning and releases.

### How It Works

1. **Write Conventional Commits** - Use `feat:`, `fix:`, etc. in your commit messages
2. **Merge to main** - Release Please analyzes commits and creates/updates a Release PR
3. **Merge Release PR** - Triggers automatic build and GitHub Release creation

### Automatic Version Bumping

Release Please determines version bumps based on commit types:

| Commit Type | Version Bump | Example |
|-------------|--------------|---------|
| `feat:` | MINOR (0.x.0) | `feat: add tab completion` |
| `fix:` | PATCH (0.0.x) | `fix: resolve crash on startup` |
| `feat!:` or `BREAKING CHANGE:` | MAJOR (x.0.0) | `feat!: redesign settings API` |

### Files Updated Automatically

Release Please updates these files when a release is created:

- `package.json` - npm version
- `src-tauri/tauri.conf.json` - Tauri app version
- `src-tauri/Cargo.toml` - Rust crate version
- `CHANGELOG.md` - Generated from commit messages

### Release PR

When you push commits to `main`, Release Please will:

1. Create or update a PR titled `chore: release x.y.z`
2. The PR contains version bumps and CHANGELOG updates
3. Merge when ready to release

### Build and Publish

After merging the Release PR:

1. Release Please creates the git tag and GitHub Release
2. GitHub Actions builds the Tauri app on macOS
3. Uploads DMG installer (both original and ASCII-renamed for Homebrew)

### Automatic Recovery

The workflow includes automatic recovery for stuck release PRs:

- **Problem**: Sometimes Release Please merges a PR but doesn't update the label from `autorelease: pending` to `autorelease: tagged`
- **Solution**: The `fix-stuck-releases` job runs on every push and automatically fixes any stuck PRs by checking if the corresponding tag exists

### Manual Steps After Release

The only manual step remaining is updating the Homebrew tap:

```bash
# Get SHA256 from the release assets
curl -sL "https://github.com/ttaatoo/microterm/releases/download/v<version>/microterm_<version>_aarch64.dmg" | shasum -a 256

# Update homebrew-microterm/Casks/microterm.rb with new version and SHA256
git -C ~/Github/homebrew-microterm commit -am "feat: bump to v<version>"
git -C ~/Github/homebrew-microterm push
```

**Homebrew tap repository:** https://github.com/ttaatoo/homebrew-microterm

### GitHub Actions Permissions (Required Setup)

For Release Please to create PRs automatically, enable this permission in GitHub:

1. Go to **Settings** → **Actions** → **General**
2. Scroll to **Workflow permissions**
3. Check **Allow GitHub Actions to create and approve pull requests**
4. Click **Save**

URL: `https://github.com/ttaatoo/microterm/settings/actions`

### Configuration Files

- `release-please-config.json` - Release Please configuration
- `.release-please-manifest.json` - Current version tracking
- `.github/workflows/release-please.yml` - GitHub Actions workflow

### Verify Release

```bash
# Check release assets
gh release view v<version> --json assets --jq '.assets[].name'

# Expected output includes:
# - µTerm_<version>_aarch64.dmg (original)
# - microterm_<version>_aarch64.dmg (ASCII for Homebrew)
```

### Manual Release (Emergency)

If you need to manually trigger a release:

```bash
# Build locally
bun run tauri build

# Create release manually
gh release create v<version> \
  --title "µTerm v<version>" \
  --generate-notes \
  "src-tauri/target/release/bundle/dmg/µTerm_<version>_aarch64.dmg"
```
