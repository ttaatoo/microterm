import { globalStyle, style } from "@vanilla-extract/css";
import { slideDown } from "../../styles/animations.css";

export const mainContainer = style({
  width: "100%",
  height: "100%", // Changed from 100vh to 100% to properly fit Tauri window content area
  display: "flex",
  flexDirection: "column",
  // Background removed - controlled via inline style for dynamic opacity
  overflow: "hidden",
  position: "relative",
  borderRadius: "10px",
  boxShadow: `
    0 0 0 1px rgba(0, 0, 0, 0.3),
    0 8px 32px rgba(0, 0, 0, 0.5),
    0 2px 8px rgba(0, 0, 0, 0.3)
  `,
  minHeight: 0,
  animation: `${slideDown} 0.2s ease-out`,
});

export const terminalArea = style({
  flex: 1,
  position: "relative",
  overflow: "visible", // Changed from hidden to allow content to extend into padding
  minHeight: 0,
  // Add bottom padding to compensate for parent's borderRadius (10px)
  // This prevents the rounded corner from creating a visible gap
  paddingBottom: "10px",
});

export const tabContainer = style({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  // Inherit parent's bottom border radius
  borderBottomLeftRadius: "10px",
  borderBottomRightRadius: "10px",
  overflow: "hidden", // Clip content to rounded corners
});

export const tabHidden = style({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  visibility: "hidden",
  pointerEvents: "none",
  // Inherit parent's bottom border radius
  borderBottomLeftRadius: "10px",
  borderBottomRightRadius: "10px",
  overflow: "hidden", // Clip content to rounded corners
});

export const settingsButton = style({
  width: "28px",
  height: "28px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "1px solid transparent",
  color: "rgba(255, 255, 255, 0.4)",
  cursor: "pointer",
  borderRadius: "6px",
  transition: "all 0.15s ease",
  flexShrink: 0,
});

globalStyle(`${settingsButton}`, {
  "-webkit-app-region": "no-drag",
});

globalStyle(`${settingsButton}:hover`, {
  color: "rgba(255, 255, 255, 0.8)",
  background: "rgba(255, 255, 255, 0.05)",
  borderColor: "rgba(255, 255, 255, 0.15)",
});

globalStyle(`${settingsButton} svg`, {
  width: "14px",
  height: "14px",
});
