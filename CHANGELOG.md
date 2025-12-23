# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
