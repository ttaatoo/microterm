import "@vanilla-extract/css";

declare module "csstype" {
  interface Properties {
    /**
     * macOS/Electron/Tauri app region for window dragging
     * - 'drag': Makes the element draggable for window movement
     * - 'no-drag': Excludes element from window dragging (for interactive elements)
     */
    "-webkit-app-region"?: "drag" | "no-drag";
  }
}
