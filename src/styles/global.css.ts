import { globalStyle } from "@vanilla-extract/css";

// Global reset styles
globalStyle("*", {
  boxSizing: "border-box",
  padding: 0,
  margin: 0,
});

// HTML and body styles
globalStyle("html, body", {
  width: "100%",
  height: "100%", // Ensure body fills the entire window
  maxWidth: "100vw",
  overflow: "hidden",
  fontFamily: '"SF Mono", "Monaco", "Menlo", "Ubuntu Mono", "Consolas", monospace',
  background: "transparent",
  color: "#abb2bf",
});

// Root element should also fill the entire window
globalStyle("#root", {
  width: "100%",
  height: "100%",
  overflow: "hidden",
});
