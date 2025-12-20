# Contributing to µTerm

Thank you for your interest in contributing to µTerm! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- **Rust** (latest stable) - Install from [rustup.rs](https://rustup.rs/)
- **Node.js 18+** and npm
- **macOS 10.13+** (for development and testing)

### Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/menubar-terminal.git
   cd menubar-terminal
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Run in development mode:
   ```bash
   npm run tauri dev
   ```

## Project Structure

```
menubar-terminal/
├── src/                 # Next.js frontend (TypeScript/React)
│   ├── app/            # Next.js App Router pages
│   ├── components/     # React components
│   ├── lib/            # Utility functions
│   └── styles/         # CSS styles
├── src-tauri/          # Rust backend
│   ├── src/            # Rust source files
│   └── capabilities/   # Tauri permissions
```

## Code Style

### TypeScript/React

- Use functional components with hooks
- Follow the existing code patterns
- Run `npm run lint` before committing

### Rust

- Follow standard Rust conventions
- Use `cargo fmt` to format code
- Use `cargo clippy` to catch common issues

## Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(terminal): add tab completion for file paths
fix(pty): resolve memory leak in session cleanup
docs: update installation instructions
```

## Pull Request Process

1. Create a new branch for your feature/fix:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. Make your changes and commit them following the commit message guidelines

3. Push to your fork:
   ```bash
   git push origin feat/your-feature-name
   ```

4. Open a Pull Request against the `main` branch

5. Ensure your PR:
   - Has a clear title and description
   - Includes relevant tests (if applicable)
   - Passes all CI checks
   - Is linked to any related issues

## Reporting Issues

When reporting issues, please include:

- µTerm version
- macOS version
- Steps to reproduce
- Expected behavior
- Actual behavior
- Any relevant logs or screenshots

## Feature Requests

We welcome feature requests! Please:

1. Check existing issues to avoid duplicates
2. Provide a clear use case
3. Explain why this feature would be valuable

## Code of Conduct

Please be respectful and constructive in all interactions. We're all here to build something great together.

## License

By contributing to µTerm, you agree that your contributions will be licensed under the MIT License.
