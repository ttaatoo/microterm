# Automated Release Workflow Guide

This document provides a complete guide for setting up an automated release workflow using GitHub Actions, Release Please, and Git hooks. This workflow automatically handles version bumping, changelog generation, release creation, and artifact building.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
- [Configuration Files](#configuration-files)
- [Git Workflow](#git-workflow)
- [Release Process](#release-process)
- [Troubleshooting](#troubleshooting)

## Overview

The automated release workflow provides:

- ✅ **Automatic version bumping** based on Conventional Commits
- ✅ **Changelog generation** from commit messages
- ✅ **Release PR creation** for review before release
- ✅ **Automatic tag creation** when PR is merged
- ✅ **GitHub Release creation** with changelog
- ✅ **Artifact building** on tag push
- ✅ **Pre-commit hooks** for code quality
- ✅ **Optional Homebrew tap updates**

## Architecture

```
Developer commits with Conventional Commits
        ↓
Pre-commit hooks (lint + format check)
        ↓
Push to main branch
        ↓
Release Please workflow analyzes commits
        ↓
Creates/updates Release PR (chore: release vX.Y.Z)
        ↓
Review and merge Release PR
        ↓
Release Please creates tag + GitHub Release
        ↓
Build on Tag workflow triggers
        ↓
Build artifacts (DMG, App, etc.)
        ↓
Upload assets to GitHub Release
        ↓
[Optional] Update Homebrew tap
```

## Prerequisites

1. **GitHub Repository** with Actions enabled
2. **Node.js/Bun** for frontend tooling
3. **Husky** for Git hooks (optional but recommended)
4. **Release Please** GitHub Action
5. **GitHub CLI** (`gh`) for automation scripts

## Setup Instructions

### Step 1: Install Dependencies

```bash
# Install Husky for Git hooks
npm install --save-dev husky
# or
bun add -d husky

# Initialize Husky
npx husky init
# or
bunx husky init
```

### Step 2: Create Pre-commit Hook

Create `.husky/pre-commit`:

```bash
#!/bin/sh

# Frontend lint (adjust command to your project)
npm run lint
# or
bun run lint

# Backend format check (if using Rust)
cargo fmt --manifest-path src-tauri/Cargo.toml --check

# Add other checks as needed:
# - Type checking: tsc --noEmit
# - Tests: npm test
# - Build: npm run build
```

Make it executable:

```bash
chmod +x .husky/pre-commit
```

### Step 3: Configure Release Please

Create `release-please-config.json` in project root:

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "node",
  "packages": {
    ".": {
      "changelog-path": "CHANGELOG.md",
      "include-component-in-tag": false,
      "extra-files": [
        {
          "type": "json",
          "path": "package.json",
          "jsonpath": "$.version"
        }
      ]
    }
  },
  "changelog-sections": [
    { "type": "feat", "section": "Features" },
    { "type": "fix", "section": "Bug Fixes" },
    { "type": "perf", "section": "Performance" },
    { "type": "refactor", "section": "Code Refactoring" },
    { "type": "docs", "section": "Documentation" },
    { "type": "chore", "section": "Miscellaneous", "hidden": true },
    { "type": "style", "section": "Styles", "hidden": true },
    { "type": "test", "section": "Tests", "hidden": true },
    { "type": "ci", "section": "CI/CD", "hidden": true },
    { "type": "build", "section": "Build", "hidden": true }
  ],
  "separate-pull-requests": false
}
```

**For multi-package projects (monorepo):**

```json
{
  "release-type": "node",
  "packages": {
    "packages/core": {
      "changelog-path": "packages/core/CHANGELOG.md",
      "release-type": "node"
    },
    "packages/ui": {
      "changelog-path": "packages/ui/CHANGELOG.md",
      "release-type": "node"
    }
  }
}
```

**For Rust projects (Tauri, etc.):**

```json
{
  "release-type": "rust",
  "packages": {
    ".": {
      "changelog-path": "CHANGELOG.md",
      "extra-files": [
        {
          "type": "json",
          "path": "src-tauri/tauri.conf.json",
          "jsonpath": "$.version"
        },
        {
          "type": "toml",
          "path": "src-tauri/Cargo.toml",
          "jsonpath": "$.package.version"
        }
      ]
    }
  }
}
```

### Step 4: Create Release Please Manifest

Create `.release-please-manifest.json`:

```json
{
  ".": "1.0.0"
}
```

Set the initial version to your current project version.

### Step 5: Create GitHub Actions Workflows

#### Release Please Workflow

Create `.github/workflows/release-please.yml`:

```yaml
name: Release Please

on:
  push:
    branches:
      - main

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    outputs:
      release_created: ${{ steps.release.outputs.release_created }}
      tag_name: ${{ steps.release.outputs.tag_name }}
      version: ${{ steps.release.outputs.version }}
    steps:
      - uses: googleapis/release-please-action@v4
        id: release
        with:
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json

  # Automatic recovery: fix stuck release PRs
  fix-stuck-releases:
    runs-on: ubuntu-latest
    if: ${{ always() }}
    needs: release-please
    steps:
      - name: Fix stuck release PR labels
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # Find merged release PRs with "autorelease: pending" label
          STUCK_PRS=$(gh pr list \
            --repo ${{ github.repository }} \
            --state merged \
            --label "autorelease: pending" \
            --json number,title \
            --jq '.[].number')

          for PR_NUM in $STUCK_PRS; do
            echo "Checking PR #$PR_NUM..."

            # Get the version from PR title (format: "chore: release vX.Y.Z")
            PR_TITLE=$(gh pr view $PR_NUM --repo ${{ github.repository }} --json title --jq '.title')
            VERSION=$(echo "$PR_TITLE" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)

            if [ -n "$VERSION" ]; then
              TAG="v$VERSION"

              # Check if tag exists
              if git ls-remote --tags origin "$TAG" | grep -q "$TAG"; then
                echo "Tag $TAG exists, updating label for PR #$PR_NUM"

                # Ensure "autorelease: tagged" label exists
                gh label create "autorelease: tagged" \
                  --repo ${{ github.repository }} \
                  --description "Release PR that has been tagged" \
                  --color "0e8a16" 2>/dev/null || true

                # Update labels
                gh pr edit $PR_NUM \
                  --repo ${{ github.repository }} \
                  --remove-label "autorelease: pending" \
                  --add-label "autorelease: tagged"

                echo "Fixed PR #$PR_NUM"
              fi
            fi
          done
```

#### Build on Tag Workflow

Create `.github/workflows/build-on-tag.yml`:

```yaml
name: Build on Tag

on:
  push:
    tags:
      - "v*"

permissions:
  contents: write

jobs:
  build:
    runs-on: macos-latest # or ubuntu-latest, windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Get version from tag
        id: version
        run: echo "version=${GITHUB_REF#refs/tags/v}" >> $GITHUB_OUTPUT

      - name: Setup Node.js/Bun
        uses: oven-sh/setup-bun@v2
        # or
        # uses: actions/setup-node@v4
        # with:
        #   node-version: '20'
        with:
          bun-version: latest

      - name: Setup Rust (if needed)
        uses: dtolnay/rust-toolchain@stable

      - name: Cache dependencies
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri # adjust path as needed

      - name: Install dependencies
        run: bun install --frozen-lockfile
        # or: npm ci

      - name: Build frontend
        run: bun run build
        # or: npm run build

      - name: Build application
        run: |
          # Adjust build command for your project
          bunx tauri build --bundles dmg
          # or
          # npm run build:app
          # or
          # cargo build --release

      - name: Upload assets to GitHub Release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          VERSION="${{ steps.version.outputs.version }}"
          TAG="v${VERSION}"

          # Wait for release to be created
          for i in {1..10}; do
            if gh release view "$TAG" &>/dev/null; then
              echo "Release $TAG found"
              break
            fi
            echo "Waiting for release $TAG... (attempt $i/10)"
            sleep 3
          done

          # Upload artifacts (adjust paths as needed)
          ARTIFACTS=(
            "dist/app.dmg"
            "dist/app.app"
            "dist/app.zip"
          )

          for ARTIFACT in "${ARTIFACTS[@]}"; do
            if [ -f "$ARTIFACT" ]; then
              gh release upload "$TAG" "$ARTIFACT" --clobber
              echo "Uploaded: $ARTIFACT"
            fi
          done

      - name: Calculate SHA256 (for Homebrew)
        id: sha
        run: |
          VERSION="${{ steps.version.outputs.version }}"
          ARTIFACT="dist/app.dmg"  # adjust path
          SHA=$(shasum -a 256 "$ARTIFACT" | cut -d' ' -f1)
          echo "sha256=$SHA" >> $GITHUB_OUTPUT
          echo "SHA256: $SHA"

    outputs:
      version: ${{ steps.version.outputs.version }}
      sha256: ${{ steps.sha.outputs.sha256 }}

  update-homebrew:
    needs: build
    runs-on: ubuntu-latest
    if: ${{ secrets.TAP_GITHUB_TOKEN != '' }}
    steps:
      - name: Update Homebrew tap
        env:
          TAP_GITHUB_TOKEN: ${{ secrets.TAP_GITHUB_TOKEN }}
        run: |
          VERSION="${{ needs.build.outputs.version }}"
          SHA256="${{ needs.build.outputs.sha256 }}"
          TAP_REPO="your-org/homebrew-your-app"  # adjust

          if [ -z "$TAP_GITHUB_TOKEN" ]; then
            echo "TAP_GITHUB_TOKEN not set, skipping Homebrew update"
            exit 0
          fi

          # Clone tap repo
          git clone "https://x-access-token:${TAP_GITHUB_TOKEN}@github.com/${TAP_REPO}.git"
          cd "$(basename $TAP_REPO)"

          # Update version and sha256 in Cask/Formula
          sed -i "s/version \".*\"/version \"${VERSION}\"/" Casks/your-app.rb
          sed -i "s/sha256 \".*\"/sha256 \"${SHA256}\"/" Casks/your-app.rb

          # Commit and push
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add Casks/your-app.rb
          git commit -m "feat: bump to v${VERSION}"
          git push

          echo "Homebrew tap updated to v${VERSION}"
```

### Step 6: Configure GitHub Repository

1. **Enable Actions** (Settings → Actions → General):

   - Check "Allow GitHub Actions to create and approve pull requests"
   - Set workflow permissions to "Read and write permissions"

2. **Optional: Set up Secrets** (Settings → Secrets and variables → Actions):

   - `TAP_GITHUB_TOKEN`: Personal Access Token with `repo` scope for Homebrew updates

3. **Optional: Branch Protection** (Settings → Branches):
   - Protect `main` branch
   - Allow Release Please to bypass (it has admin privileges)

### Step 7: Initialize CHANGELOG.md

Create `CHANGELOG.md`:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - YYYY-MM-DD

### Added

- Initial release
```

## Configuration Files

### File Structure

```
.
├── .github/
│   └── workflows/
│       ├── release-please.yml
│       └── build-on-tag.yml
├── .husky/
│   └── pre-commit
├── release-please-config.json
├── .release-please-manifest.json
└── CHANGELOG.md
```

### Key Configuration Options

#### release-please-config.json

| Option                     | Description                  | Example                        |
| -------------------------- | ---------------------------- | ------------------------------ |
| `release-type`             | Package type                 | `"node"`, `"rust"`, `"python"` |
| `changelog-path`           | Path to changelog file       | `"CHANGELOG.md"`               |
| `include-component-in-tag` | Include component in tag     | `false`                        |
| `extra-files`              | Files to update with version | See examples above             |
| `changelog-sections`       | Customize changelog sections | See examples above             |

#### .release-please-manifest.json

Tracks current version for each package:

```json
{
  ".": "1.0.0",
  "packages/core": "2.1.0",
  "packages/ui": "1.5.0"
}
```

## Git Workflow

### Commit Convention

This workflow uses [Conventional Commits](https://www.conventionalcommits.org/):

| Type                                               | Description     | Version Bump  |
| -------------------------------------------------- | --------------- | ------------- |
| `feat`                                             | New feature     | MINOR (0.x.0) |
| `fix`                                              | Bug fix         | PATCH (0.0.x) |
| `feat!` or `BREAKING CHANGE:`                      | Breaking change | MAJOR (x.0.0) |
| `docs`, `style`, `refactor`, `test`, `ci`, `chore` | Other           | No bump       |

### Commit Message Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Examples:**

```bash
# Simple feature
feat: add dark mode toggle

# With scope
feat(terminal): add command history navigation

# With body
feat(api): add user authentication

Implement JWT-based authentication with refresh tokens.
Add login and logout endpoints.

# Breaking change
feat(api)!: change response format

BREAKING CHANGE: API responses now return JSON instead of XML
```

### Branch Strategy

1. **Feature branches**: `feat/feature-name`, `fix/bug-name`
2. **Main branch**: `main` (protected, requires PR)
3. **Release PRs**: Auto-created by Release Please

### Workflow Steps

```bash
# 1. Create feature branch
git checkout -b feat/new-feature

# 2. Make changes and commit
git add .
git commit -m "feat: add new feature"

# 3. Push and create PR
git push origin feat/new-feature
# Create PR on GitHub

# 4. After PR review, merge to main
# Release Please will automatically create/update Release PR

# 5. Review and merge Release PR when ready
# Tag and release are created automatically
```

## Release Process

### Normal Release (Recommended)

1. **Develop and commit** using conventional commit messages:

   ```bash
   git commit -m "feat(terminal): add new feature"
   git push origin main
   ```

2. **Wait for Release Please** to create/update a PR titled `chore: release vX.Y.Z`

3. **Review the Release PR**:

   - Check version bump is correct
   - Verify changelog entries
   - Ensure all changes are included

4. **Merge the Release PR** when ready

5. **Build triggers automatically** via the Build on Tag workflow

6. **Verify the release** at `https://github.com/your-org/your-repo/releases`

### Manual Release (Emergency)

If automated release fails:

1. **Create and push tag manually:**

   ```bash
   git tag v1.3.0
   git push origin v1.3.0
   ```

2. **Create GitHub Release** (if not auto-created):

   ```bash
   gh release create v1.3.0 --title "v1.3.0" --generate-notes
   ```

3. **Build on Tag** workflow will trigger and upload artifacts

4. **Update Homebrew manually** if needed:

   ```bash
   # Get SHA256
   shasum -a 256 dist/app.dmg

   # Update tap
   cd ~/Github/homebrew-your-app
   # Edit Casks/your-app.rb with new version and sha256
   git commit -am "feat: bump to v1.3.0"
   git push
   ```

### Skipping a Release

If you want to skip a release for certain commits:

1. Add `[skip release]` or `[release skip]` to commit message
2. Or use `chore` type commits (won't trigger version bump)

## Troubleshooting

### Release Please doesn't create PR

**Possible causes:**

- No releasable commits (only `chore`, `docs`, etc.)
- Invalid `release-please-config.json`
- Missing `.release-please-manifest.json`

**Solution:**

```bash
# Check config is valid JSON
cat release-please-config.json | jq .

# Verify manifest exists
cat .release-please-manifest.json

# Check workflow logs in GitHub Actions
```

### Build fails on tag push

**Possible causes:**

- Build command errors
- Missing dependencies
- Incorrect artifact paths

**Solution:**

```bash
# Check workflow logs in Actions tab
# Verify build command works locally
npm run build  # or your build command

# Verify artifact paths in workflow match actual output
ls -la dist/
```

### PR stuck with "autorelease: pending"

The `fix-stuck-releases` job should handle this automatically. If not:

```bash
# Manually fix label
gh pr edit <PR_NUMBER> \
  --remove-label "autorelease: pending" \
  --add-label "autorelease: tagged"
```

### Homebrew update fails

**Possible causes:**

- `TAP_GITHUB_TOKEN` not set or invalid
- Token doesn't have write access
- Incorrect tap repository path

**Solution:**

```bash
# Verify token is set
gh secret list

# Test token manually
gh auth token | gh api user

# Check tap repo path in workflow
```

### Pre-commit hook fails

**Possible causes:**

- Lint errors
- Formatting issues
- Missing dependencies

**Solution:**

```bash
# Run checks manually
npm run lint
cargo fmt --check

# Fix issues and commit again
# Or skip hook (not recommended)
git commit --no-verify
```

## Advanced Configuration

### Custom Version Bumping

For custom version logic, modify `release-please-config.json`:

```json
{
  "release-type": "node",
  "packages": {
    ".": {
      "version-file": "version.txt",
      "changelog-path": "CHANGELOG.md"
    }
  }
}
```

### Multi-package Releases

For monorepos with multiple packages:

```json
{
  "release-type": "node",
  "packages": {
    "packages/core": {
      "changelog-path": "packages/core/CHANGELOG.md"
    },
    "packages/ui": {
      "changelog-path": "packages/ui/CHANGELOG.md"
    }
  },
  "separate-pull-requests": true
}
```

### Custom Changelog Sections

```json
{
  "changelog-sections": [
    { "type": "feat", "section": "🚀 Features" },
    { "type": "fix", "section": "🐛 Bug Fixes" },
    { "type": "perf", "section": "⚡ Performance" },
    { "type": "security", "section": "🔒 Security" }
  ]
}
```

## Best Practices

1. **Always use Conventional Commits** - Enables automatic versioning
2. **Review Release PRs carefully** - Verify version and changelog
3. **Keep commits focused** - One feature/fix per commit
4. **Test before merging Release PR** - Ensure build works
5. **Document breaking changes** - Use `BREAKING CHANGE:` footer
6. **Keep changelog readable** - Review generated changelog before release

## Migration Checklist

When setting up this workflow in a new project:

- [ ] Install Husky and create pre-commit hook
- [ ] Create `release-please-config.json`
- [ ] Create `.release-please-manifest.json` with current version
- [ ] Create `.github/workflows/release-please.yml`
- [ ] Create `.github/workflows/build-on-tag.yml`
- [ ] Initialize `CHANGELOG.md`
- [ ] Configure GitHub repository settings
- [ ] Set up secrets (if needed)
- [ ] Test with a test commit
- [ ] Verify Release PR is created
- [ ] Test release process end-to-end

## References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Release Please](https://github.com/googleapis/release-please)
- [Semantic Versioning](https://semver.org/)
- [Husky](https://typicode.github.io/husky/)
- [GitHub Actions](https://docs.github.com/en/actions)
