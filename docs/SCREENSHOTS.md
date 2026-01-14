# Screenshot Maintenance

**Every UI change requires updating both `docs/screenshot.svg` and `docs/screenshot.png`.**

## File Specifications

| File                  | Format     | Dimensions            | Purpose               |
| --------------------- | ---------- | --------------------- | --------------------- |
| `docs/screenshot.svg` | Vector SVG | 760×620 viewBox       | Source file, editable |
| `docs/screenshot.png` | Raster PNG | 1520×1240 (2x Retina) | README display        |

## Update Workflow

1. **Edit the SVG** - Modify `docs/screenshot.svg` to reflect UI changes
2. **Regenerate PNG** - Run conversion command:
   ```bash
   rsvg-convert -w 1520 -h 1240 docs/screenshot.svg -o docs/screenshot.png
   ```

## SVG Layout Reference

The SVG mockup includes:

- **macOS Menubar** (y=0-24)

  - App name at x=32 should be `µTerm` (not Finder or other apps)
  - µTerm tray icon at x=562

- **Terminal Window** (translated to x=30, y=44)
  - **Tab Bar** (y=0-40): tabs-container on left, "+" button and settings icon on right
    - "+" button: `translate(628, 6)` - right side, before settings
    - Settings gear: `translate(664, 11)` - rightmost
  - **Terminal Content** (y=56+): shell prompts, command output

## Important Notes

- Always verify menubar shows "µTerm" as the active app
- Tab bar layout: scrollable tabs (left), "+" button (right), settings (rightmost)
- PNG uses 2x scale for Retina display quality
