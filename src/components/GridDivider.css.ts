import { SPLIT_DIVIDER_SIZE } from "@/lib/constants";
import { style } from "@vanilla-extract/css";

export const divider = style({
  position: "absolute",
  background: "rgba(70, 70, 70, 0.99)",
  transition: "background 0.15s ease",
  zIndex: 10,
  ":hover": {
    background: "#a855f7", // Purple accent on hover
  },
});

export const dividerVertical = style({
  width: `${SPLIT_DIVIDER_SIZE}px`,
  height: "100%",
  cursor: "col-resize",
});

export const dividerHorizontal = style({
  width: "100%",
  height: `${SPLIT_DIVIDER_SIZE}px`,
  cursor: "row-resize",
});

export const dividerActive = style({
  background: "#a855f7", // Purple accent when dragging
});
