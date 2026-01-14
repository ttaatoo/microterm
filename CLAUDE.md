# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

µTerm is a macOS menubar terminal application built with **Tauri 2.0** (Rust) and **React 19**.

```bash
# Development
bun install
bun run tauri dev

# Tests
bun run test          # Frontend tests
cd src-tauri && cargo test  # Rust tests
```

## Documentation Structure

This project uses a modular documentation structure. Detailed guides are located where they're most relevant:

| Topic | File | When to Read |
|-------|------|--------------|
| **Development** | DEV_GUIDE.md | Build commands, testing, troubleshooting |
| **Architecture** | src-tauri/ARCHITECTURE.md | Understanding codebase structure, IPC, Rust backend |
| **Refactoring** | docs/REFACTORING_SUMMARY.md | Recent code organization improvements |
| **Screenshots** | docs/SCREENSHOTS.md | Updating UI screenshots for README |
| **Git Workflow** | docs/GIT_WORKFLOW.md | Commit conventions, branch naming |
| **Release** | docs/RELEASE.md | Automated release process |

## Core Project Info

**Technology Stack:**
- Frontend: React 19, TypeScript, Vite, Vanilla Extract (CSS-in-TS)
- Backend: Rust, Tauri 2.0, portable-pty
- Terminal: xterm.js with custom addons
- Package Manager: bun
- Testing: Vitest (frontend), cargo test (backend)

**Key Directories:**
- `src/` - React frontend (TypeScript)
- `src-tauri/` - Rust backend
- `src/components/` - React components with `.css.ts` styles
- `src/hooks/` - Custom React hooks
- `src/lib/` - Organized utilities by domain (see structure below)
- `docs/` - Project documentation

**src/lib/ Structure** (newly reorganized):
```
src/lib/
├── pty/              # PTY session management
│   ├── session.ts    # PtySession class
│   └── usePtySession.ts  # React hook wrapper
├── tauri/            # Tauri IPC by concern
│   ├── preload.ts    # API caching/preloading
│   ├── pty.ts        # PTY commands
│   ├── commands.ts   # Command execution
│   ├── shortcuts.ts  # Global shortcuts
│   └── shell.ts      # Shell utilities
├── terminal/         # Terminal utilities
│   ├── theme.ts      # Theme caching
│   ├── dataBuffer.ts # Output buffering
│   ├── addons.ts     # xterm.js addons
│   └── key-handlers.ts  # Key bindings
├── guards.ts         # Type guards (consolidated)
├── constants.ts      # App constants
├── settings.ts       # Settings persistence
├── ptyUtils.ts       # PTY utilities
├── paneTree.ts       # Pane tree management
└── pin.ts            # Pin state utilities
```

**Important Files:**
- `src/lib/tauri/` - Modular Tauri IPC layer (split from monolithic file)
- `src/lib/pty/` - Unified PTY session management (consolidates duplicates)
- `src-tauri/src/pty.rs` - Rust PTY backend (core functionality)
- `src-tauri/src/lib.rs` - macOS window/tray behavior
- `src-tauri/capabilities/default.json` - Tauri v2 permissions

## Design System

**Colors:**
- **Primary Accent**: `#a855f7` (purple-500) - Used for active states, focus indicators
  - Active tab indicator (3px bottom bar)
  - Active pane indicator (6px top-left corner square)
  - Pin button when pinned
  - Selection highlights

**Transitions:**
- Standard: `0.15s ease` - Used for most UI state changes

## Development Principles

1. **Prefer editing over creating** - Update existing files instead of creating new ones
2. **Type safety** - Use TypeScript strictly, avoid `any`
3. **Test coverage** - New features require tests
4. **Conventional commits** - See docs/GIT_WORKFLOW.md
5. **No hardcoded secrets** - Use environment variables

## Common Tasks

**Adding a new feature:**
1. Read src-tauri/ARCHITECTURE.md to understand structure
2. Implement with tests
3. Update screenshots if UI changed (see docs/SCREENSHOTS.md)
4. Commit following docs/GIT_WORKFLOW.md

**Debugging build issues:**
1. Check DEV_GUIDE.md troubleshooting section
2. Clear cache: `rm -rf dist node_modules/.vite`

**Understanding IPC communication:**
1. Read "Frontend-Backend Communication" in src-tauri/ARCHITECTURE.md
2. Check `src/lib/tauri.ts` for available commands

## External Documentation

- **Tauri v2**: https://v2.tauri.app/
- **xterm.js**: https://xtermjs.org/
- **Vanilla Extract**: https://vanilla-extract.style/
- **Release Automation**: docs/RELEASE_AUTOMATION.md
