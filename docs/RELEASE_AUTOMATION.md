# Release Automation

This document describes the automated release process for µTerm.

## Overview

The release process is fully automated using GitHub Actions:

```
Developer pushes to main
        ↓
Pre-commit hooks run (lint + format check)
        ↓
Release Please creates/updates PR
        ↓
Merge Release PR
        ↓
Release Please creates tag + GitHub Release
        ↓
Build on Tag workflow triggers
        ↓
Build DMG on macOS
        ↓
Upload assets to Release
        ↓
Update Homebrew tap (if TAP_GITHUB_TOKEN is set)
```

## Components

### 1. Pre-commit Hooks (`.husky/pre-commit`)

Runs automatically before each commit:

- **Frontend lint**: `bun run lint`
- **Rust format check**: `cargo fmt --check`

This prevents format issues from entering the repository.

### 2. Release Please (`.github/workflows/release-please.yml`)

Triggered on every push to `main`:

- Analyzes commits since last release
- Creates/updates a Release PR with version bump and changelog
- When PR is merged, creates git tag and GitHub Release

**Configuration files:**
- `release-please-config.json` - Release type, changelog sections, PR title pattern
- `.release-please-manifest.json` - Current version tracking

### 3. Build on Tag (`.github/workflows/build-on-tag.yml`)

Triggered when a version tag (`v*`) is pushed:

- Builds the Tauri app on macOS
- Creates DMG installer
- Uploads both original (`µTerm_x.y.z_aarch64.dmg`) and renamed (`microterm_x.y.z_aarch64.dmg`) DMGs
- Optionally updates Homebrew tap

### 4. Fix Stuck Releases

Part of the Release Please workflow. Automatically fixes PRs that are stuck with `autorelease: pending` label when the tag already exists.

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

| Type | Description | Version Bump |
|------|-------------|--------------|
| `feat` | New feature | MINOR (0.x.0) |
| `fix` | Bug fix | PATCH (0.0.x) |
| `feat!` or `BREAKING CHANGE:` | Breaking change | MAJOR (x.0.0) |
| `docs`, `style`, `refactor`, `test`, `ci`, `chore` | Other | No bump |

## Releasing a New Version

### Normal Release (Recommended)

1. **Develop and commit** using conventional commit messages:
   ```bash
   git commit -m "feat(terminal): add new feature"
   git push origin main
   ```

2. **Wait for Release Please** to create/update a PR titled `chore: release vX.Y.Z`

3. **Merge the Release PR** when ready

4. **Build triggers automatically** via the Build on Tag workflow

5. **Verify the release** at https://github.com/ttaatoo/microterm/releases

### Manual Release (Emergency)

If automated release fails:

1. **Create and push tag manually:**
   ```bash
   git tag v1.3.0
   git push origin v1.3.0
   ```

2. **Create GitHub Release** (if not auto-created):
   ```bash
   gh release create v1.3.0 --title "µTerm v1.3.0" --generate-notes
   ```

3. **Build on Tag** workflow will trigger and upload DMG

4. **Update Homebrew manually** if needed:
   ```bash
   # Get SHA256
   shasum -a 256 microterm_1.3.0_aarch64.dmg

   # Update tap
   cd ~/Github/homebrew-microterm
   # Edit Casks/microterm.rb with new version and sha256
   git commit -am "feat: bump to v1.3.0"
   git push
   ```

## Setup Requirements

### GitHub Repository Settings

1. **Actions permissions** (Settings → Actions → General):
   - Check "Allow GitHub Actions to create and approve pull requests"

2. **Branch protection** (optional):
   - Release Please can bypass with admin privileges

### Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `GITHUB_TOKEN` | Auto | Provided by GitHub Actions |
| `TAP_GITHUB_TOKEN` | Optional | PAT with repo access to homebrew-microterm |

To enable automatic Homebrew updates:

1. Create a Personal Access Token with `repo` scope
2. Add it as `TAP_GITHUB_TOKEN` secret in repository settings

## Troubleshooting

### Release Please doesn't create PR

- Check if there are releasable commits (feat, fix, etc.)
- Verify `release-please-config.json` is valid

### Build fails on tag push

- Check workflow logs in Actions tab
- Verify Rust and Bun versions are compatible
- Check if DMG signing is configured

### Homebrew update fails

- Verify `TAP_GITHUB_TOKEN` is set and valid
- Check token has write access to homebrew-microterm repo

### PR stuck with "autorelease: pending"

The `fix-stuck-releases` job should handle this automatically. If not:

```bash
# Manually fix label
gh pr edit <PR_NUMBER> \
  --remove-label "autorelease: pending" \
  --add-label "autorelease: tagged"
```

## File Reference

| File | Purpose |
|------|---------|
| `.husky/pre-commit` | Pre-commit hook script |
| `.github/workflows/release-please.yml` | Release PR automation |
| `.github/workflows/build-on-tag.yml` | Build and upload on tag |
| `release-please-config.json` | Release Please configuration |
| `.release-please-manifest.json` | Current version manifest |

## Version History

- **v1.3.0**: Added Build on Tag workflow, Homebrew automation, pre-commit hooks
- **v1.2.x**: Initial Release Please setup
