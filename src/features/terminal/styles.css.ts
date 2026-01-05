import { globalStyle, style } from "@vanilla-extract/css";
import { slideDown } from "../../styles/animations.css";

export const mainContainer = style({
  width: "100%",
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  background: "rgba(0, 0, 0, 0.95)",
  overflow: "hidden",
  position: "relative",
  borderRadius: "10px",
  border: "1px solid rgba(255, 255, 255, 0.1)",
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
  overflow: "hidden",
  minHeight: 0,
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
