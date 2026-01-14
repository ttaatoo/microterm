# Git Commit Convention

This project follows the [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) specification.

## Commit Message Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Type

| Type       | Description                                 | Semantic Version |
| ---------- | ------------------------------------------- | ---------------- |
| `feat`     | New feature                                 | MINOR            |
| `fix`      | Bug fix                                     | PATCH            |
| `docs`     | Documentation changes                       | -                |
| `style`    | Code formatting (no functional changes)     | -                |
| `refactor` | Code refactoring (neither feat nor fix)     | -                |
| `perf`     | Performance improvement                     | -                |
| `test`     | Add/modify tests                            | -                |
| `build`    | Build system or external dependency changes | -                |
| `ci`       | CI configuration changes                    | -                |
| `chore`    | Other changes not modifying src or test     | -                |

## Scope (Optional)

Describes the affected part of the codebase, for example:

- `feat(terminal): add command history navigation`
- `fix(tauri): resolve window positioning issue`

## BREAKING CHANGE

Breaking changes correspond to MAJOR in semantic versioning. Two ways to mark them:

**Option 1:** Add `!` after type/scope

```
feat(api)!: change command output format
```

**Option 2:** Declare in footer

```
feat: redesign terminal output

BREAKING CHANGE: output format changed from plain text to structured JSON
```

## Examples

```bash
# Simple commit
feat: add tab completion support

# With scope
fix(commands): handle empty input gracefully

# With body
feat(terminal): add command history

Implement up/down arrow navigation through previous commands.
History persists across sessions using localStorage.

# With footer
fix: resolve race condition in stream output

Reviewed-by: John
Refs: #42

# Breaking change
feat!: update minimum supported macOS version to 14.0

BREAKING CHANGE: drop support for macOS 13 and earlier
```

## Rules Summary

1. type and description are required
2. description uses imperative mood ("add" not "added")
3. description starts lowercase, no period at end
4. body and footer must be preceded by a blank line
5. BREAKING CHANGE must be uppercase
