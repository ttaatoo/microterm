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

## Vite Configuration

- **Dev**: `devUrl: http://localhost:3000` in tauri.conf.json
- **Prod**: Static build to `./dist/`, loaded via `frontendDist: ../dist`
- **Path alias**: `@` maps to `./src` for clean imports
