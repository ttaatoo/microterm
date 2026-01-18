import { globalStyle, keyframes, style } from "@vanilla-extract/css";

export const gridContainer = style({
  display: "grid",
  width: "100%",
  height: "100%",
  overflow: "hidden",
  position: "relative",
});

export const paneCell = style({
  position: "relative",
  overflow: "hidden",
  minWidth: 0,
  minHeight: 0,
});

// Explicit style to prevent CSS loading flash
export const paneCellActive = style({
  position: "relative",
});

// Empty cell style (for grid cells without panes)
export const emptyCell = style({
  position: "relative",
  minWidth: 0,
  minHeight: 0,
  backgroundColor: "transparent",
});

// Fade in animation for initial render
const fadeIn = keyframes({
  "0%": { opacity: 0 },
  "100%": { opacity: 1 },
});

// Breathing animation for active pane indicator
const breathe = keyframes({
  "0%, 100%": { opacity: 1 },
  "50%": { opacity: 0.4 },
});

// Active pane indicator - purple breathing orb in top-left corner
globalStyle(`${paneCellActive}::before`, {
  content: '""',
  position: "absolute",
  top: "4px",
  left: "4px",
  width: "5px",
  height: "5px",
  background: "#a855f7",
  borderRadius: "50%",
  zIndex: 10,
  boxShadow: "0 0 2px rgba(168, 85, 247, 0.5)",
  // Explicitly set initial state to prevent flash before animation loads
  opacity: 0,
  // Wait 500ms for prompt, then fade in (300ms), then breathe infinitely
  animation: `${fadeIn} 0.3s ease-out 0.5s both, ${breathe} 2s ease-in-out 0.8s infinite`,
});
