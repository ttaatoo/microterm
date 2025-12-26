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

## Release Workflow

**When releasing a new version, all the following steps must be executed in order:**

### 1. Update Version Number

Edit the `version` field in `src-tauri/tauri.conf.json`:

```json
{
  "version": "x.y.z"
}
```

### 2. Update CHANGELOG.md

Add the new version's changelog entry at the top of `CHANGELOG.md`, following the [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
## [x.y.z] - YYYY-MM-DD

### Added

- New features...

### Changed

- Changes...

### Fixed

- Fixes...
```

Also update the version comparison links at the bottom of the file.

### 3. Commit Version Update

```bash
git add src-tauri/tauri.conf.json CHANGELOG.md
git commit -m "chore: bump version to x.y.z"
git push origin main
```

### 4. Build DMG Installer

```bash
# Build macOS application (generates .app and .dmg)
bun run tauri build

# Rename DMG to ASCII filename (required for Homebrew compatibility)
cp "src-tauri/target/release/bundle/dmg/µTerm_<version>_aarch64.dmg" \
   "src-tauri/target/release/bundle/dmg/microterm_<version>_aarch64.dmg"
```

Build artifacts location:

- `src-tauri/target/release/bundle/dmg/µTerm_<version>_aarch64.dmg` - Original DMG (non-ASCII name)
- `src-tauri/target/release/bundle/dmg/microterm_<version>_aarch64.dmg` - Renamed DMG for release
- `src-tauri/target/release/bundle/macos/µTerm.app` - Application bundle

**⚠️ Important:** Always upload the renamed `microterm_<version>_aarch64.dmg` to GitHub Release (Homebrew requires ASCII-only URLs).

### 5. Create Git Tag

```bash
git tag -a v<version> -m "$(cat <<'EOF'
µTerm v<version> - <short description>

Features:
- Feature 1
- Feature 2

Changes:
- Change 1

Fixes:
- Fix 1
EOF
)"
git push origin v<version>
```

### 6. Create GitHub Release and Upload DMG

```bash
# Create release and upload DMG
gh release create v<version> \
  --title "µTerm v<version> - <title>" \
  --notes "$(cat <<'EOF'
## What's New

### ✨ Features
- **Feature title** - Feature description

### 🎨 UI/UX
- UI improvements

### 🔧 Technical
- Technical improvements

### 🐛 Bug Fixes
- Bug fix content

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" \
  "src-tauri/target/release/bundle/dmg/microterm_<version>_aarch64.dmg"
```

**⚠️ Important: Upload the renamed DMG (ASCII filename)!** Users need the DMG file to install the application.

### 7. Update Homebrew Tap

Update the Homebrew cask to allow users to install via `brew install --cask microterm`.

```bash
# Calculate SHA256 of the renamed DMG (use the ASCII filename)
shasum -a 256 src-tauri/target/release/bundle/dmg/microterm_<version>_aarch64.dmg
```

Edit `~/Github/homebrew-microterm/Casks/microterm.rb`:

```ruby
cask "microterm" do
  version "<version>"
  sha256 "<sha256_from_above>"
  # ... rest unchanged
end
```

Commit and push the update:

```bash
git -C ~/Github/homebrew-microterm add .
git -C ~/Github/homebrew-microterm commit -m "feat: bump to v<version>"
git -C ~/Github/homebrew-microterm push
```

**Homebrew tap repository:** https://github.com/ttaatoo/homebrew-microterm

### 8. Verify Release

```bash
# Confirm release assets are correct
gh release view v<version> --json assets --jq '.assets[].name'

# Test Homebrew installation (optional)
brew update
brew upgrade --cask microterm
```

Expected output: `microterm_<version>_aarch64.dmg`

### Release Checklist

Confirm all steps are completed before releasing:

- [ ] Update `tauri.conf.json` version number
- [ ] Update `CHANGELOG.md` (including comparison links at bottom)
- [ ] Commit and push version update
- [ ] Run `bun run tauri build` to build
- [ ] **Rename DMG to ASCII filename** (`microterm_<version>_aarch64.dmg`)
- [ ] Create git tag (with detailed release notes) and push
- [ ] Create GitHub release
- [ ] **Upload renamed DMG** (ASCII filename required for Homebrew)
- [ ] **Update Homebrew tap** (version + SHA256 in `homebrew-microterm`)
- [ ] Verify release assets are correct

### Updating an Existing Release Tag

If you need to update a published tag (e.g., after fixing CI issues):

```bash
# Delete local and remote tag
git tag -d v<version>
git push origin :refs/tags/v<version>

# Delete GitHub release
gh release delete v<version> --yes

# Recreate tag and release (follow steps 5-7 above)
```
