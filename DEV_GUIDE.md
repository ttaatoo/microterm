# Development Guide

Build and development commands for µTerm.

## Quick Start with Makefile

µTerm includes a Makefile for common commands:

```bash
make help             # Show all available commands
make dev              # Start development server
make test-coverage    # Run tests with coverage report
make coverage-open    # Open coverage report in browser
make check            # Run lint + all tests
```

See `make help` for the complete list.

## Build Commands

```bash
# Install dependencies
bun install

# Development - single command (recommended)
bun run tauri dev     # Starts both Vite dev server and Tauri

# Production build
bun run build         # Build Vite frontend (outputs to ./dist/)
bun run tauri build   # Build final macOS application
```

## Testing

### Using Makefile (Recommended)

```bash
# Frontend tests
make test              # Watch mode (default)
make test-frontend     # Run once

# Backend tests
make test-backend      # Run Rust tests

# All tests
make test-all          # Run frontend + backend tests

# Coverage
make test-coverage     # Run with coverage report
make coverage-open     # Open HTML coverage report

# Run all checks (lint + all tests)
make check
```

### Direct Commands

```bash
# Frontend tests (Vitest)
bun run test          # Watch mode
bun run test:run      # Single run
bun run test:coverage # With coverage report

# Run a single test file
bun run test:run src/lib/settings.test.ts

# Backend tests (Rust)
cd src-tauri && cargo test

# Lint
bun run lint
```

### Test Coverage

Coverage reports are generated in the `coverage/` directory:

- **Text report**: Shown in console output
- **HTML report**: `coverage/index.html` (open with `make coverage-open` or `open coverage/index.html`)

**Coverage targets** (configured in `vitest.config.ts`):

- `src/lib/**/*.ts` - Utilities and helpers
- `src/components/**/*.tsx` - React components
- `src/hooks/**/*.ts` - Custom hooks
- `src/contexts/**/*.tsx` - Context providers

## Troubleshooting

**If Vite dev server has cache issues:**

```bash
rm -rf dist node_modules/.vite
bun run tauri dev
```

**If port 3000 is in use:** Kill other processes or update `devUrl` in `src-tauri/tauri.conf.json`.

### Global Shortcut Issues

**Problem: Global shortcut (Cmd+F4) doesn't work on MacBook built-in display but works on external monitors**

This is a known limitation of macOS's `RegisterEventHotKey` API (used by Tauri's global-shortcut plugin). The system may intercept or deny keyboard events differently depending on which display is active.

**Diagnostic steps:**

1. **Check console logs** - Open Console.app and filter for "microterm" or check the terminal where you ran `bun run tauri dev`. Look for:
   - `[Shortcut] Successfully registered global shortcut: CommandOrControl+F4`
   - `[Shortcut] Global shortcut triggered: CommandOrControl+F4`

2. **Verify shortcut registration:**
   - Open Settings in µTerm
   - Check if the shortcut is displayed correctly
   - Try changing the shortcut temporarily and changing it back

3. **Check system permissions:**
   - System Settings → Privacy & Security → Input Monitoring
   - Ensure µTerm is listed and enabled
   - If not listed, add it manually

4. **Check for system shortcut conflicts:**
   - System Settings → Keyboard → Keyboard Shortcuts
   - Look for conflicts with Cmd+F4 or F4 alone
   - macOS may reserve F4 for Mission Control or other functions

**Possible solutions:**

1. **Try a different shortcut combination:**
   - Avoid F-keys (F1-F12) as they may conflict with system functions
   - Try `Cmd+Shift+T` or `Cmd+Option+T` instead
   - Use a modifier key combination that's less likely to conflict

2. **Grant Input Monitoring permission:**
   - System Settings → Privacy & Security → Input Monitoring
   - Add µTerm if not present
   - Restart the app after granting permission

3. **Check display configuration:**
   - System Settings → Displays
   - Try setting the external monitor as the primary display temporarily
   - Check if the issue persists

4. **Restart the app:**
   - Sometimes the shortcut registration needs to be refreshed
   - Quit and relaunch µTerm

**Note:** This is a macOS system limitation, not a bug in µTerm. The global-shortcut plugin works at the application level and may not receive events in all display contexts. If the issue persists, consider using a different shortcut combination or using the menubar icon to toggle the window.

## Vite Configuration

- **Dev**: `devUrl: http://localhost:3000` in tauri.conf.json
- **Prod**: Static build to `./dist/`, loaded via `frontendDist: ../dist`
- **Path alias**: `@` maps to `./src` for clean imports
