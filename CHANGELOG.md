# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0](https://github.com/ttaatoo/microterm/compare/v1.2.5...v1.3.0) (2026-01-05)


### Features

* **tabs:** add tooltip on tab hover ([7304db8](https://github.com/ttaatoo/microterm/commit/7304db88eceb60a8529890487253535261a5f951))
* **window:** add pin window feature to keep terminal visible ([7397a31](https://github.com/ttaatoo/microterm/commit/7397a3158dcf9f4b47ad7c8ab9df149b9d2dcfe6))


### Code Refactoring

* **pin:** improve pin state handling with type-safe parsing ([2a3868e](https://github.com/ttaatoo/microterm/commit/2a3868e06ebef9cd73f380edb232dde2da1c5468))
* **styles:** migrate CSS to vanilla-extract ([4bce32f](https://github.com/ttaatoo/microterm/commit/4bce32faab1d0bf9392042e5236af7af823a0158))
* **terminal:** extract XTerminal logic to custom hooks ([1a4efef](https://github.com/ttaatoo/microterm/commit/1a4efefff2288e7c5f61c6791c536ad06a6f4f9c))


### Documentation

* simplify README features and update project structure ([8b779f5](https://github.com/ttaatoo/microterm/commit/8b779f5e294c874c772d2c001cd4cf443a4cc38d))

## [1.2.5](https://github.com/ttaatoo/microterm/compare/v1.2.4...v1.2.5) (2026-01-05)


### Bug Fixes

* **terminal:** apply padding via xterm internal structure ([80de58e](https://github.com/ttaatoo/microterm/commit/80de58e65206c54e6f9de3a2626316ebfdef2b8f))

## [1.2.4](https://github.com/ttaatoo/microterm/compare/v1.2.3...v1.2.4) (2026-01-05)


### Performance

* optimize frontend and backend performance ([d947f8c](https://github.com/ttaatoo/microterm/commit/d947f8c926241524bc30bdf1adec7ce776872625))


### Documentation

* add AGENTS.md for Codex agent instructions ([2a619ea](https://github.com/ttaatoo/microterm/commit/2a619ea62f84fb38dab7ed843793bd94ee631464))

## [1.2.3](https://github.com/ttaatoo/microterm/compare/v1.2.2...v1.2.3) (2025-12-30)


### Bug Fixes

* **release:** add 'v' prefix to release PR title pattern ([7c7af28](https://github.com/ttaatoo/microterm/commit/7c7af2836a650c4d8eb9e4b78170219be6f1f0e5))
* update copyright year to 2025 ([#8](https://github.com/ttaatoo/microterm/issues/8)) ([0905f59](https://github.com/ttaatoo/microterm/commit/0905f5990cba8c76b76dea6ce4e28a97e83ca05b))

## [1.2.2](https://github.com/ttaatoo/microterm/compare/v1.2.1...v1.2.2) (2025-12-29)


### Bug Fixes

* enable cmd+click to open URLs in system browser ([#5](https://github.com/ttaatoo/microterm/issues/5)) ([5c14b30](https://github.com/ttaatoo/microterm/commit/5c14b3005fc506844148e3a87d02e57a6b0b3b0d))

## [1.2.1](https://github.com/ttaatoo/microterm/compare/v1.2.0...v1.2.1) (2025-12-28)


### Bug Fixes

* **pty:** include Homebrew paths in PTY environment ([ee4660b](https://github.com/ttaatoo/microterm/commit/ee4660bfe59535fffe0fbb414dff5caccea6a7d8))

## [1.2.0](https://github.com/ttaatoo/microterm/compare/v1.1.0...v1.2.0) (2025-12-27)


### Features

* code quality improvements and Vite migration ([#2](https://github.com/ttaatoo/microterm/issues/2)) ([28277ad](https://github.com/ttaatoo/microterm/commit/28277ad143dcade478453fe31ef1309cbbd8c9de))
* initial homebrew cask for µTerm v1.1.0 ([9fb0cd3](https://github.com/ttaatoo/microterm/commit/9fb0cd380e8bb7c939ae2fa6df74c72bcb622532))


### Documentation

* add GitHub Actions permissions setup for Release Please ([55aae1d](https://github.com/ttaatoo/microterm/commit/55aae1d2294dc09170e919a80ff99399964f3a0e))
* **claude:** add homebrew tap update to release workflow ([3d78454](https://github.com/ttaatoo/microterm/commit/3d784549dbec8543077d9eb9d9e5df4e0e6ebe8e))
* **readme:** add homebrew installation and format shortcuts table ([974341b](https://github.com/ttaatoo/microterm/commit/974341b510df97dd5e26d5e6bd0e39eb4897fe47))
* translate CLAUDE.md to English ([fc39a43](https://github.com/ttaatoo/microterm/commit/fc39a43c02a761d746edcba40b6c897345371a4d))
* update release workflow with complete steps ([dbdfba3](https://github.com/ttaatoo/microterm/commit/dbdfba38e31d9d2c604bca209628445594443cc5))
* update screenshot ([096fa9e](https://github.com/ttaatoo/microterm/commit/096fa9e27042cbb7044ceaf56071cf1ea11d2b70))

## [Unreleased]

## [1.1.0] - 2025-12-23

### Added
- Multi-tab support with keyboard shortcuts
  - `⌘T` to create new tab
  - `⌘W` to close current tab
  - `⌘1-9` to switch to specific tab
  - `⌘[` / `⌘]` to navigate between tabs
- Multi-monitor support - window appears on screen where cursor is located
- Smart tab titles - displays current working directory (like Warp)
- Scrollable tab bar with mouse wheel horizontal scroll
- Double-ESC to hide window (vim-compatible)

### Changed
- Redesigned settings panel with pure black theme
- Updated UI to use neutral monochrome color scheme
- Container background now matches terminal for consistent resize appearance

### Fixed
- Color mismatch during window resize

## [1.0.1] - 2024-12-22

### Fixed
- Release build process improvements
- Frontend build step in CI/CD workflow

## [1.0.0] - 2024-12-22

### Added
- First stable release
- Global shortcut support (⌘⇧T to toggle window)
- Launch at login option
- Customizable opacity and font size
- First-time user onboarding
- Toast notifications for user feedback

### Changed
- Renamed project from menubar-terminal to microterm

## [0.1.0] - 2024-12-20

### Added
- Menubar icon for quick terminal access
- Full PTY support with xterm.js
- One Dark Pro Vivid theme
- Real-time command output streaming
- Command history navigation (up/down arrows)
- Tab completion for commands
- Click-outside-to-close behavior
- Window resize support
- macOS menubar panel behavior
- Multi-session PTY management

### Technical
- Built with Tauri 2.0 and Next.js 14
- Rust backend with native macOS APIs
- TypeScript frontend with React 18
- xterm.js terminal emulator

[Unreleased]: https://github.com/ttaatoo/microterm/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/ttaatoo/microterm/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/ttaatoo/microterm/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/ttaatoo/microterm/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/ttaatoo/microterm/releases/tag/v0.1.0
