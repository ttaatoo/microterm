// Terminal theme configuration and caching

// Base theme colors (One Dark Pro)
const BASE_THEME = {
  foreground: "#abb2bf",
  cursor: "#528bff",
  cursorAccent: "#282c34",
  selectionBackground: "#abb2bf30",
  selectionForeground: "#ffffff",
  black: "#3f4451",
  red: "#e05561",
  green: "#8cc265",
  yellow: "#d18f52",
  blue: "#4aa5f0",
  magenta: "#c162de",
  cyan: "#42b3c2",
  white: "#d7dae0",
  brightBlack: "#4f5666",
  brightRed: "#ff616e",
  brightGreen: "#a5e075",
  brightYellow: "#f0a45d",
  brightBlue: "#4dc4ff",
  brightMagenta: "#de73ff",
  brightCyan: "#4cd1e0",
  brightWhite: "#e6e6e6",
} as const;

export type TerminalTheme = typeof BASE_THEME & { background: string };

// Theme cache to avoid recreating objects
const themeCache = new Map<number, TerminalTheme>();

/**
 * Get theme with specified opacity
 * The terminal background has the opacity - container should be transparent
 * @param opacity - Background opacity (0-1), defaults to 0.95 if not provided
 * @returns Terminal theme object with background color
 */
export function getTerminalTheme(opacity?: number): TerminalTheme {
  // Default to 0.95 if undefined to prevent rgba(0, 0, 0, NaN)
  const validOpacity = opacity ?? 0.95;
  const clampedOpacity = Math.max(0, Math.min(1, validOpacity));
  const cacheKey = Math.round(clampedOpacity * 100);

  let theme = themeCache.get(cacheKey);
  if (!theme) {
    theme = {
      ...BASE_THEME,
      background: `rgba(0, 0, 0, ${clampedOpacity})`,
    };
    themeCache.set(cacheKey, theme);
  }

  return theme;
}

