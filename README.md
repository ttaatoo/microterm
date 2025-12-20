# µTerm (MicroTerm)

A micro terminal that lives in your macOS menubar. Lightweight, fast, always one click away. Built with Rust Tauri 2.0 and Next.js.

## Features

- 🎯 Menubar icon for quick access
- ⚡ Fast command execution
- 🎨 Beautiful terminal UI with dark theme
- 📜 Command history (up/down arrows)
- 🔄 Real-time command output

## Prerequisites

- **Rust** (latest stable version) - Install from [rustup.rs](https://rustup.rs/) or run:

  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```

  After installation, restart your terminal or run `source $HOME/.cargo/env`

- **Node.js 18+** and npm
- **macOS 10.13+**

## Development

1. Install dependencies:

```bash
npm install
```

**Note**: If you encounter `cargo: command not found` errors, make sure Rust is installed and in your PATH. You can verify by running `cargo --version`.

2. Run the development server:

```bash
npm run dev
```

3. In another terminal, run Tauri:

```bash
npm run tauri dev
```

## Building

To build the application:

```bash
npm run build
npm run tauri build
```

## Usage

1. Click the menubar icon to open the terminal
2. Type commands and press Enter to execute
3. Use Up/Down arrows to navigate command history
4. Click outside the window or click the icon again to close

## Project Structure

```
microterm/
├── src-tauri/          # Rust backend
│   ├── src/
│   │   ├── main.rs     # Application entry point
│   │   ├── lib.rs      # Tauri setup and tray
│   │   └── commands.rs # Command execution
│   └── Cargo.toml      # Rust dependencies
├── src/                # Next.js frontend
│   ├── app/            # Next.js App Router
│   ├── components/     # React components
│   ├── lib/            # Utilities
│   └── styles/         # CSS styles
└── package.json        # Node.js dependencies
```

## License

MIT
