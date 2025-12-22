# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release preparation
- Open source documentation (LICENSE, CONTRIBUTING.md)
- GitHub Actions CI/CD workflow

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

[Unreleased]: https://github.com/ttaatoo/microterm/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ttaatoo/microterm/releases/tag/v0.1.0
