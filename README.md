# µTerm (microterm) - Lightweight macOS Menubar Terminal

[![CI](https://github.com/ttaatoo/microterm/actions/workflows/ci.yml/badge.svg)](https://github.com/ttaatoo/microterm/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue?logo=tauri)](https://tauri.app)
[![Platform](https://img.shields.io/badge/platform-macOS-lightgrey?logo=apple)](https://www.apple.com/macos/)
[![Rust](https://img.shields.io/badge/Rust-1.92+-orange?logo=rust)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)

**µTerm (microterm)** is a lightweight, fast terminal emulator for macOS that lives in your menubar. Built with Rust and Tauri for native performance, featuring multi-tab support, global shortcuts, and a minimal footprint. Always one click away from your terminal.

> **Note:** This application is **macOS only**. It uses native macOS APIs (NSPanel, NSEvent, menubar/tray) that are not available on other platforms.

Built with **Rust**, **Tauri 2.0**, and **Vite + React**.

<p align="center">
  <img src="docs/screenshot.png" alt="µTerm (microterm) macOS menubar terminal with multi-tab support, customizable opacity, and pin window feature showing zsh shell interface" width="760">
</p>

## Features

- 🎯 **Menubar Access** - Always one click away from your terminal
- ⚡ **Lightning Fast** - Native Rust backend with minimal memory footprint
- 📑 **Multi-Tab Support** - Open multiple terminal sessions with keyboard shortcuts
- 🖥️ **Multi-Monitor** - Window appears on the screen where your cursor is
- 📂 **Smart Tab Titles** - Tabs show current working directory
- 📌 **Pin Window** - Keep terminal visible even when losing focus
- ⌨️ **Global Shortcut** - Configurable hotkey to toggle terminal (default: ⌘⇧T)

## Installation

### Homebrew (Recommended)

```bash
brew tap ttaatoo/microterm
brew install --cask microterm
```

### Download

Download the latest `.dmg` from the [Releases](https://github.com/ttaatoo/microterm/releases) page.

### Build from Source

#### Prerequisites

- **Rust** (1.92+) - Install from [rustup.rs](https://rustup.rs/)
- **Bun** (latest) - Install from [bun.sh](https://bun.sh/)
- **macOS 10.13+**

#### Steps

```bash
# Clone the repository
git clone https://github.com/ttaatoo/microterm.git
cd microterm

# Install dependencies
bun install

# Build the application
bun run build
bun run tauri build
```

The built application will be in `src-tauri/target/release/bundle/`.

## Development

### Quick Start

```bash
make help            # Show all available commands
make dev             # Start development server
make test-coverage   # Run tests with coverage
```

### Manual Commands

```bash
# Install dependencies
bun install

# Run in development mode (starts both Vite and Tauri)
bun run tauri dev

# Run tests
bun run test         # Watch mode
bun run test:run     # Single run

# Lint
bun run lint
```

See [DEV_GUIDE.md](DEV_GUIDE.md) for detailed development documentation, including test coverage and troubleshooting.

## Usage

1. **Open** - Click the menubar icon or press `⌘F4` (configurable)
2. **Type** - Enter commands and press Enter to execute
3. **Navigate** - Use Up/Down arrows to browse command history
4. **Pin Window** - Click the pin button (📌) in the tab bar or press `⌘`` (configurable) to pin/unpin the window. When pinned, the window stays visible even when clicking outside or losing focus
5. **Settings** - Click the gear icon (⚙) to adjust opacity, font size, and shortcuts
6. **Resize** - Drag the bottom corners to resize the window
7. **Close** - Click outside the window, press `ESC` twice, or click the icon again (won't close if pinned)

### Keyboard Shortcuts

| Shortcut  | Action                                         |
| --------- | ---------------------------------------------- |
| `⌘F4`     | Toggle terminal window (global, configurable)  |
| `⌘``      | Toggle pin state (global, configurable)        |
| `⌘T`      | New tab                                        |
| `⌘W`      | Close current tab (or unpin if last tab)       |
| `⌘1-9`    | Switch to tab 1-9                              |
| `⌘[`      | Previous tab                                   |
| `⌘]`      | Next tab                                       |
| `ESC ESC` | Hide window (double-tap, disabled when pinned) |

## Use Cases

µTerm is perfect for:

- **Quick Commands** - Run terminal commands without switching windows
- **Development Workflow** - Keep terminal accessible while coding
- **System Administration** - Monitor system status and run maintenance tasks
- **Power Users** - Fast access to shell with keyboard shortcuts
- **Minimal Setup** - No configuration needed, works out of the box

## Tech Stack

| Component  | Technology            |
| ---------- | --------------------- |
| Backend    | Rust + Tauri 2.0      |
| Frontend   | Vite + React 19       |
| Terminal   | xterm.js 5.5          |
| PTY        | portable-pty          |
| macOS APIs | objc2 + objc2-app-kit |
| Testing    | Vitest                |
| Runtime    | Bun                   |

## Project Structure

```
microterm/
├── src/                       # Vite + React frontend
│   ├── components/            # React components (XTerminal, TabBar, SettingsPanel, etc.)
│   ├── contexts/              # React contexts (TabContext)
│   ├── features/terminal/     # Terminal view & styles
│   ├── hooks/                 # Custom hooks (useTabShortcuts, usePtySession, etc.)
│   ├── lib/                   # Utilities (tauri IPC, settings, pin state)
│   └── styles/                # Global styles
├── src-tauri/                 # Rust backend
│   ├── src/
│   │   ├── lib.rs             # Window & tray behavior, multi-monitor
│   │   ├── pty.rs             # PTY session management
│   │   └── pty_commands.rs    # PTY Tauri commands
│   └── capabilities/          # Tauri permissions
└── .github/workflows/         # CI/CD
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a PR.

For development setup, testing, and build commands, see [DEV_GUIDE.md](DEV_GUIDE.md).

## FAQ

### Why macOS only?

µTerm uses native macOS APIs (NSPanel, NSEvent, menubar/tray) that are not available on other platforms. These APIs provide the unique menubar integration and window behavior that make µTerm special.

### Can I customize the appearance?

Yes! Use the settings panel (⚙) to adjust opacity, font size, and keyboard shortcuts. More customization options may be added in future releases.

### How do I report bugs?

Please open an issue on GitHub with:

- µTerm version
- macOS version
- Steps to reproduce
- Expected vs actual behavior
- Any relevant logs or screenshots

### Is µTerm free and open source?

Yes! µTerm is open source under the MIT License. You can use, modify, and distribute it freely.

### How does µTerm compare to other terminals?

µTerm focuses on quick access from the menubar with minimal resource usage. Unlike traditional terminals, it's designed to be always accessible without taking up screen space when not in use.

### Can I contribute?

Absolutely! We welcome contributions. Please read our [Contributing Guide](CONTRIBUTING.md) to get started.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Tauri](https://tauri.app) - For the amazing framework
- [xterm.js](https://xtermjs.org) - For the terminal emulator
- [One Dark Pro](https://github.com/Binaryify/OneDark-Pro) - For the color theme inspiration
