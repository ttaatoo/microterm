import { globalStyle, style } from "@vanilla-extract/css";

export const xterminalContainer = style({
  width: "100%",
  height: "100%",
  minHeight: 0,
  // Default background prevents transparent flash during terminal init
  // Inline style will override this with user's opacity setting
  background: "rgba(0, 0, 0, 0.95)",
  overflow: "hidden",
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
});

// Apply minimal padding via xterm's internal structure
// Use uniform padding to avoid height calculation issues
// The FitAddon calculates available space by subtracting this padding
globalStyle(`${xterminalContainer} .xterm`, {
  padding: "8px",
  height: "100%",
  boxSizing: "border-box",
});

// Hide default scrollbar, only show xterm's
globalStyle(`${xterminalContainer} .xterm-viewport::-webkit-scrollbar`, {
  width: "8px",
  background: "transparent",
});

globalStyle(`${xterminalContainer} .xterm-viewport::-webkit-scrollbar-track`, {
  background: "transparent",
  margin: "4px 0",
});

globalStyle(`${xterminalContainer} .xterm-viewport::-webkit-scrollbar-thumb`, {
  background: "rgba(75, 82, 99, 0.6)",
  borderRadius: "4px",
});

globalStyle(`${xterminalContainer} .xterm-viewport::-webkit-scrollbar-thumb:hover`, {
  background: "rgba(92, 99, 112, 0.8)",
});

export const terminalLoading = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: "#5c6370",
  fontSize: "13px",
  fontFamily: '"SF Mono", Menlo, Monaco, monospace',
  background: "transparent",
});

// Use visibility instead of display:none to preserve layout dimensions
// This prevents terminal sizing issues when switching tabs
export const terminalHidden = style({
  visibility: "hidden",
  pointerEvents: "none",
});

export const terminalVisible = style({
  visibility: "visible",
  pointerEvents: "auto",
});

// Active pane indicator - subtle border
export const paneActive = style({
  boxShadow: "none",
});

// Inactive pane - slightly dimmed
export const paneInactive = style({
  // No visual change for inactive panes for now
});
