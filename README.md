# µTerm (MicroTerm)

[![CI](https://github.com/ttaatoo/microterm/actions/workflows/ci.yml/badge.svg)](https://github.com/ttaatoo/microterm/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue?logo=tauri)](https://tauri.app)
[![Platform](https://img.shields.io/badge/platform-macOS_only-lightgrey?logo=apple)](https://www.apple.com/macos/)

A micro terminal that lives in your macOS menubar. Lightweight, fast, always one click away.

> **Note:** This application is **macOS only**. It uses native macOS APIs (NSPanel, NSEvent, menubar/tray) that are not available on other platforms.

Built with **Rust**, **Tauri 2.0**, and **Vite + React**.

<p align="center">
  <img src="docs/screenshot.png" alt="µTerm Screenshot" width="760">
</p>

## Features

- 🎯 **Menubar Access** - Always one click away from your terminal
- ⚡ **Lightning Fast** - Native Rust backend with minimal memory footprint
- 🖥️ **Full PTY Support** - Real terminal emulation with xterm.js
- 📑 **Multi-Tab Support** - Open multiple terminal sessions with keyboard shortcuts
- 🖥️ **Multi-Monitor** - Window appears on the screen where your cursor is
- 📂 **Smart Tab Titles** - Tabs show current working directory (like Warp)
- 🎨 **Beautiful UI** - One Dark Pro theme with adjustable transparency
- ⚙️ **Customizable** - Adjust opacity, font size, and window size
- 🔗 **Clickable Links** - URLs are automatically detected and clickable
- 🪟 **Smart Window** - Click outside to dismiss, resizable, works across all spaces
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

## Usage

1. **Open** - Click the menubar icon or press `⌘⇧T` (configurable)
2. **Type** - Enter commands and press Enter to execute
3. **Navigate** - Use Up/Down arrows to browse command history
4. **Settings** - Click the gear icon (⚙) to adjust opacity, font size, and shortcuts
5. **Resize** - Drag the bottom corners to resize the window
6. **Close** - Click outside the window, press `ESC` twice, or click the icon again

### Keyboard Shortcuts

| Shortcut  | Action                                        |
| --------- | --------------------------------------------- |
| `⌘⇧T`     | Toggle terminal window (global, configurable) |
| `⌘T`      | New tab                                       |
| `⌘W`      | Close current tab                             |
| `⌘1-9`    | Switch to tab 1-9                             |
| `⌘[`      | Previous tab                                  |
| `⌘]`      | Next tab                                      |
| `ESC ESC` | Hide window (double-tap)                      |

## Tech Stack

| Component  | Technology            |
| ---------- | --------------------- |
| Backend    | Rust + Tauri 2.0      |
| Frontend   | Vite + React 18       |
| Terminal   | xterm.js 5.5          |
| PTY        | portable-pty          |
| macOS APIs | objc2 + objc2-app-kit |
| Testing    | Vitest                |
| Runtime    | Bun                   |

## Project Structure

```
microterm/
├── src/                    # Vite + React frontend
│   ├── components/        # React components
│   │   ├── XTerminal.tsx  # Terminal UI with xterm.js
│   │   ├── TabBar.tsx     # Tab bar with multi-tab support
│   │   ├── SettingsPanel.tsx  # Settings overlay
│   │   ├── ResizeHandle.tsx   # Window resize control
│   │   └── ErrorBoundary.tsx  # Error handling
│   ├── contexts/          # React contexts
│   │   └── TabContext.tsx # Tab state management
│   ├── hooks/             # Custom hooks
│   │   └── useTabShortcuts.ts # Keyboard shortcuts
│   ├── lib/               # Utilities & settings
│   └── styles/            # CSS styles
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── lib.rs         # Window & tray behavior, multi-monitor
│   │   ├── commands.rs    # Shell command execution
│   │   ├── pty.rs         # PTY session management, CWD tracking
│   │   └── pty_commands.rs
│   └── capabilities/      # Tauri permissions
├── .github/workflows/     # CI/CD
└── docs/                  # Documentation
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a PR.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Tauri](https://tauri.app) - For the amazing framework
- [xterm.js](https://xtermjs.org) - For the terminal emulator
- [One Dark Pro](https://github.com/Binaryify/OneDark-Pro) - For the color theme inspiration
