# Release Workflow (Automated)

See [docs/RELEASE_AUTOMATION.md](docs/RELEASE_AUTOMATION.md) for full documentation.

## Quick Reference

```bash
# Normal release - just push to main
git commit -m "feat: new feature"
git push origin main
# → Release Please creates PR → Merge PR → Auto build & publish
```

## Key Components

| Component | File | Purpose |
|-----------|------|---------|
| Pre-commit | `.husky/pre-commit` | Lint & format check before commit |
| Release Please | `.github/workflows/release-please.yml` | Create release PR |
| Build on Tag | `.github/workflows/build-on-tag.yml` | Build DMG on tag push |
| Config | `release-please-config.json` | Release Please settings |

## Version Bumping

| Commit Type | Version Bump |
|-------------|--------------|
| `feat:` | MINOR (0.x.0) |
| `fix:` | PATCH (0.0.x) |
| `feat!:` | MAJOR (x.0.0) |

## Homebrew Auto-Update

Set `TAP_GITHUB_TOKEN` secret for automatic Homebrew tap updates.
Otherwise, manual update is required after release.
