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

# Lint
npm run lint
```

## Architecture Overview

macOS menubar terminal application built with **Tauri 2.0** (Rust backend) and **Next.js 14** (React frontend).

### Frontend-Backend Communication

Tauri IPC system connects React frontend and Rust backend:

- **Tauri Commands**: `src-tauri/src/commands.rs` → invoked via `@tauri-apps/api/core`
- **Event Streaming**: Real-time output uses Tauri events (`command-stdout`, `command-stderr`, `command-complete`)
- **Frontend Wrapper**: `src/lib/tauri.ts` provides typed wrappers with dynamic imports for Tauri API

### Rust Backend (src-tauri/)

**commands.rs** - Three main commands:

- `execute_command` - Synchronous execution, returns full output
- `execute_command_stream` - Async streaming with real-time output via events
- `complete_command` - Tab completion by scanning PATH

**lib.rs** - Window and tray behavior:

- Uses native macOS APIs (`cocoa`, `objc`, `block` crates) for panel behavior
- `MouseButtonState::Up` for tray click (critical: matches native macOS behavior)
- Global click monitor (`NSEvent addGlobalMonitorForEventsMatchingMask`) to hide window on outside click
- Window level set to floating (`NSFloatingWindowLevel`)

### Tauri v2 Capabilities

Permissions defined in `src-tauri/capabilities/default.json`:

- `core:event:allow-listen` and `core:event:allow-emit` required for frontend event handling
- `shell:allow-open` and `shell:allow-execute` for command execution

### Next.js Configuration

- **Development**: Standard Next.js dev server (no static export)
- **Production**: Static export mode, outputs to `./out/` directory
- Tauri loads from `devUrl: http://localhost:3000` in dev, `frontendDist: ../out` in production

### Key Frontend Components

- `src/components/Terminal.tsx` - Terminal UI with command history, streaming output, tab completion
- `src/lib/tauri.ts` - Typed IPC wrapper (checks `window.__TAURI__` before importing Tauri APIs)

## Troubleshooting

**If Next.js dev server has cache issues:**

```bash
rm -rf .next out node_modules/.cache
npm run tauri dev
```

**If port 3000 is in use:** Next.js auto-selects next available port, but Tauri expects 3000. Kill other processes or update `devUrl` in `tauri.conf.json`.

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
