# Repository Guidelines

## Project Layout
- `src/`: Vite + React frontend (TypeScript) with components, hooks, contexts, lib, and styles.
- `src-tauri/`: Rust backend (commands, PTY manager) plus Tauri config and macOS metadata (`Info.plist`).
- `docs/`: Screenshot assets shown in the README (`screenshot.svg` as source, `screenshot.png` as exported Retina image).
- `tmp/`: Internal checklists (production readiness, release workflow) – update when processes change.
- Root config highlights: `package.json`, `bun.lock`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `src-tauri/tauri.conf.json`.

## Local Development & Build
- Install dependencies with `bun install`.
- Dev mode: `bun run tauri dev` (starts Vite + Tauri shell).
- Frontend only: `bun run dev`; production bundle: `bun run build`.
- Desktop build: `bun run tauri build`; artifacts land under `src-tauri/target/release/bundle/`.
- Rust-only changes: `cd src-tauri && cargo build`.

## Testing & Quality
- Unit/tests: `bun run test` (watch) or `bun run test:run`; coverage via `bun run test:coverage`.
- Rust backend: `cd src-tauri && cargo test`.
- Lint TypeScript/React with `bun run lint`; format Rust using `cargo fmt`.
- Keep snapshot assets updated: regenerate `docs/screenshot.png` from the SVG (`rsvg-convert -w 1520 -h 1240 docs/screenshot.svg -o docs/screenshot.png`).

## Coding Standards
- TypeScript: follow ESLint + TypeScript settings; prefer functional React components and hooks.
- Rust: avoid `unwrap()` in production paths (see `tmp/02-PRODUCTION_CHECKLIST.md` blockers); use error propagation with `?` where practical.
- Shared strings/settings live in `src/lib/settings.ts`; update corresponding types when adding fields.

## Release & Distribution
- Tags (`v*`) trigger the CI release workflow (see `.github/workflows/release.yml`).
- Review `tmp/01-release-workflow.md` for the end-to-end tagging + notarization checklist.
- Update bundle identifiers and signing info in `src-tauri/tauri.conf.json` before shipping production builds.

## Commit & PR Practice
- Use Conventional Commits (`feat:`, `fix:`, `docs:`, `build:`…); keep messages in imperative mood.
- Branch names: `feat/<topic>`, `fix/<issue>`, `chore/<task>` or similar.
- PRs should: describe user-facing changes, note testing (`bun run test:run`, `cargo test`, etc.), mention asset updates, and attach screenshots when UI changes affect docs.
