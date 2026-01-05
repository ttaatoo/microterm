import { globalStyle, style } from "@vanilla-extract/css";

export const resizeHandle = style({
  position: "absolute",
  bottom: 0,
  width: "20px",
  height: "20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
});

globalStyle(`${resizeHandle} svg`, {
  display: "none",
});

export const resizeHandleBottomRight = style({
  right: 0,
  cursor: "nwse-resize",
});

export const resizeHandleBottomLeft = style({
  left: 0,
  cursor: "nesw-resize",
});
