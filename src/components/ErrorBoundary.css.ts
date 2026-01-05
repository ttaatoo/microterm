import { globalStyle, style } from "@vanilla-extract/css";

export const errorBoundary = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
  background: "rgba(30, 30, 30, 0.95)",
  color: "#e5e5e5",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
});

export const errorBoundaryContent = style({
  textAlign: "center",
  padding: "2rem",
  maxWidth: "400px",
});

globalStyle(`${errorBoundary} h2`, {
  color: "#e06c75",
  marginBottom: "1rem",
  fontSize: "1.5rem",
});

export const errorMessage = style({
  color: "#abb2bf",
  marginBottom: "1.5rem",
  fontSize: "0.9rem",
  wordBreak: "break-word",
});

export const errorActions = style({
  display: "flex",
  gap: "1rem",
  justifyContent: "center",
});

export const errorButton = style({
  padding: "0.5rem 1rem",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "0.9rem",
  transition: "opacity 0.2s",
});

globalStyle(`${errorButton}:hover`, {
  opacity: 0.8,
});

export const errorButtonRetry = style({
  background: "#a855f7",
  color: "#ffffff",
});

export const errorButtonReload = style({
  background: "#4b5263",
  color: "#e5e5e5",
});

