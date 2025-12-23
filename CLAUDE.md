# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Install dependencies
npm install

# Development - single command (recommended)
npm run tauri dev     # Starts both Next.js dev server and Tauri

# Production build
npm run build         # Build Next.js frontend (outputs to ./out/)
npm run tauri build   # Build final macOS application

# Tests
npm run test          # Watch mode (Vitest)
npm run test:run      # Single run
npm run test:coverage # With coverage report

# Run a single test file
npm run test:run src/lib/settings.test.ts

# Rust tests
cd src-tauri && cargo test

# Lint
npm run lint
```

## Architecture Overview

macOS menubar terminal application built with **Tauri 2.0** (Rust backend) and **Next.js 14** (React frontend).

### Frontend-Backend Communication

Tauri IPC connects React frontend and Rust backend via two patterns:

1. **Commands** (request-response): Frontend calls `invoke()` → Rust handles in `commands.rs` or `pty_commands.rs`
2. **Events** (streaming): Rust emits `pty-output`/`pty-exit` → Frontend listens via `listen()`

Frontend wrapper `src/lib/tauri.ts` provides typed functions with dynamic imports (checks `window.__TAURI__` for SSR safety).

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
- `src/lib/tauri.ts` - Typed IPC wrapper with SSR-safe dynamic imports
- `src/lib/settings.ts` - Persisted settings (opacity, font size) in localStorage

### Next.js Configuration

- **Dev**: `devUrl: http://localhost:3000` in tauri.conf.json
- **Prod**: Static export to `./out/`, loaded via `frontendDist: ../out`

## Troubleshooting

**If Next.js dev server has cache issues:**

```bash
rm -rf .next out node_modules/.cache
npm run tauri dev
```

**If port 3000 is in use:** Kill other processes or update `devUrl` in `src-tauri/tauri.conf.json`.

## Screenshot Maintenance

**Every UI change requires updating both `docs/screenshot.svg` and `docs/screenshot.png`.**

### File Specifications

| File | Format | Dimensions | Purpose |
|------|--------|------------|---------|
| `docs/screenshot.svg` | Vector SVG | 760×620 viewBox | Source file, editable |
| `docs/screenshot.png` | Raster PNG | 1520×1240 (2x Retina) | README display |

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

本项目遵循 [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) 规范。

### Commit Message 格式

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Type 类型

| Type | 说明 | 语义化版本 |
|------|------|-----------|
| `feat` | 新功能 | MINOR |
| `fix` | Bug 修复 | PATCH |
| `docs` | 文档变更 | - |
| `style` | 代码格式（不影响功能） | - |
| `refactor` | 重构（非 feat/fix） | - |
| `perf` | 性能优化 | - |
| `test` | 添加/修改测试 | - |
| `build` | 构建系统或外部依赖变更 | - |
| `ci` | CI 配置变更 | - |
| `chore` | 其他不修改 src 或 test 的变更 | - |

### Scope（可选）

描述代码库中受影响的部分，例如：
- `feat(terminal): add command history navigation`
- `fix(tauri): resolve window positioning issue`

### BREAKING CHANGE

破坏性变更对应语义化版本的 MAJOR，两种标记方式：

**方式一：** 在 type/scope 后加 `!`
```
feat(api)!: change command output format
```

**方式二：** 在 footer 中声明
```
feat: redesign terminal output

BREAKING CHANGE: output format changed from plain text to structured JSON
```

### 示例

```bash
# 简单提交
feat: add tab completion support

# 带 scope
fix(commands): handle empty input gracefully

# 带 body
feat(terminal): add command history

Implement up/down arrow navigation through previous commands.
History persists across sessions using localStorage.

# 带 footer
fix: resolve race condition in stream output

Reviewed-by: John
Refs: #42

# Breaking change
feat!: update minimum supported macOS version to 14.0

BREAKING CHANGE: drop support for macOS 13 and earlier
```

### 规则总结

1. type 和 description 为必填项
2. description 使用祈使语气（"add" 而非 "added"）
3. description 首字母小写，结尾不加句号
4. body 和 footer 前需空一行
5. BREAKING CHANGE 必须大写

## Release 流程

**每次发布新版本时，必须按顺序执行以下所有步骤：**

### 1. 更新版本号

编辑 `src-tauri/tauri.conf.json` 中的 `version` 字段：

```json
{
  "version": "x.y.z"
}
```

### 2. 更新 CHANGELOG.md

在 `CHANGELOG.md` 顶部添加新版本的变更记录，遵循 [Keep a Changelog](https://keepachangelog.com/) 格式：

```markdown
## [x.y.z] - YYYY-MM-DD

### Added
- 新功能...

### Changed
- 变更...

### Fixed
- 修复...
```

同时更新文件底部的版本对比链接。

### 3. 提交版本更新

```bash
git add src-tauri/tauri.conf.json CHANGELOG.md
git commit -m "chore: bump version to x.y.z"
git push origin main
```

### 4. 构建 DMG 安装包

```bash
# 构建 macOS 应用（生成 .app 和 .dmg）
npm run tauri build
```

构建产物位置：
- `src-tauri/target/release/bundle/dmg/µTerm_<version>_aarch64.dmg` - DMG 安装包
- `src-tauri/target/release/bundle/macos/µTerm.app` - 应用程序

### 5. 创建 Git Tag

```bash
git tag -a v<version> -m "$(cat <<'EOF'
µTerm v<version> - <简短描述>

Features:
- 功能1
- 功能2

Changes:
- 变更1

Fixes:
- 修复1
EOF
)"
git push origin v<version>
```

### 6. 创建 GitHub Release 并上传 DMG

```bash
# 创建 release 并上传 DMG
gh release create v<version> \
  --title "µTerm v<version> - <标题>" \
  --notes "$(cat <<'EOF'
## What's New

### ✨ Features
- **功能标题** - 功能描述

### 🎨 UI/UX
- 界面改进

### 🔧 Technical
- 技术改进

### 🐛 Bug Fixes
- 修复内容

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" \
  "src-tauri/target/release/bundle/dmg/µTerm_<version>_aarch64.dmg"
```

**⚠️ 重要：必须上传 DMG 安装包！** 用户需要 DMG 文件来安装应用。

### 7. 验证 Release

```bash
# 确认 release assets 正确
gh release view v<version> --json assets --jq '.assets[].name'
```

应该看到：`µTerm_<version>_aarch64.dmg`

### Release Checklist

发布前确认所有步骤完成：

- [ ] 更新 `tauri.conf.json` 版本号
- [ ] 更新 `CHANGELOG.md`（包括底部对比链接）
- [ ] 提交并推送版本更新
- [ ] 运行 `npm run tauri build` 构建
- [ ] 创建 git tag（带详细 release notes）并 push
- [ ] 创建 GitHub release
- [ ] **上传 DMG 安装包到 release**
- [ ] 验证 release assets 正确

### 更新已有 Release 的 Tag

如果需要更新已发布的 tag（例如修复 CI 问题后）：

```bash
# 删除本地和远程 tag
git tag -d v<version>
git push origin :refs/tags/v<version>

# 删除 GitHub release
gh release delete v<version> --yes

# 重新创建 tag 和 release（按上述步骤 5-7）
```
