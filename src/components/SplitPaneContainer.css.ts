import { style, globalStyle, keyframes } from "@vanilla-extract/css";

export const splitContainer = style({
  display: "flex",
  width: "100%",
  height: "100%",
  overflow: "hidden",
});

export const splitContainerVertical = style({
  flexDirection: "row",
});

export const splitContainerHorizontal = style({
  flexDirection: "column",
});

export const paneWrapper = style({
  position: "relative",
  overflow: "hidden",
  minWidth: 0,
  minHeight: 0,
});

export const paneWrapperActive = style({});

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
globalStyle(`${paneWrapperActive}::before`, {
  content: '""',
  position: "absolute",
  top: "4px",
  left: "4px",
  width: "5px",
  height: "5px",
  background: "#a855f7",
  borderRadius: "50%",
  zIndex: 10,
  // Wait 500ms for prompt, then fade in (300ms), then breathe infinitely
  animation: `${fadeIn} 0.3s ease-out 0.5s both, ${breathe} 2s ease-in-out 0.8s infinite`,
  boxShadow: "0 0 2px rgba(168, 85, 247, 0.5)",
});

export const tabContainer = style({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
});

export const tabHidden = style({
  display: "none",
});
