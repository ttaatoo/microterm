import { globalStyle, style } from "@vanilla-extract/css";
import { tooltipFadeIn } from "../styles/animations.css";

export const tabBar = style({
  display: "flex",
  alignItems: "center",
  height: "40px",
  background: "#101010",
  padding: "6px 8px",
  gap: "8px",
  flexShrink: 0,
});

globalStyle(`${tabBar}`, {
  "-webkit-app-region": "drag",
});

export const tabsContainer = style({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flex: 1,
  overflowX: "auto",
  overflowY: "hidden",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
});

globalStyle(`${tabsContainer}`, {
  "-webkit-app-region": "no-drag",
});

globalStyle(`${tabsContainer}::-webkit-scrollbar`, {
  display: "none",
});

export const tab = style({
  display: "flex",
  alignItems: "center",
  height: "28px",
  padding: "0 14px",
  background: "transparent",
  border: "none",
  borderRadius: 0,
  cursor: "pointer",
  transition: "all 0.15s ease",
  maxWidth: "200px",
  minWidth: "120px",
  gap: "8px",
  flexShrink: 0,
  position: "relative",
});

globalStyle(`${tab}`, {
  "-webkit-app-region": "no-drag",
});

globalStyle(`${tab}::before`, {
  content: '""',
  position: "absolute",
  right: 0,
  top: "50%",
  transform: "translateY(-50%)",
  width: "1.5px",
  height: "12px",
  background: "rgba(255, 255, 255, 0.06)",
});

globalStyle(`${tab}::after`, {
  content: '""',
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  height: "3px",
  background: "transparent",
  borderRadius: "2px 2px 0 0",
  transition: "background 0.15s ease",
});

globalStyle(`${tab}:hover`, {
  background: "rgba(255, 255, 255, 0.03)",
});

export const tabActive = style({
  selectors: {
    "&::after": {
      background: "#a855f7",
    },
  },
});

export const tabTitle = style({
  fontSize: "13px",
  color: "rgba(255, 255, 255, 0.5)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  flex: 1,
});

globalStyle(`${tabActive} .${tabTitle}`, {
  color: "rgba(255, 255, 255, 0.9)",
});

// Handle .tab:has(.tab-title-input) .tab-title with a specific class
export const tabTitleHidden = style({
  opacity: 0,
});

export const tabTooltip = style({
  position: "fixed",
  transform: "translateX(-50%)",
  background: "rgba(75, 75, 80, 0.95)",
  color: "rgba(255, 255, 255, 0.95)",
  padding: "6px 12px",
  borderRadius: "6px",
  fontSize: "12px",
  whiteSpace: "nowrap",
  zIndex: 10000,
  pointerEvents: "none",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  animation: `${tooltipFadeIn} 0.15s ease`,
});

globalStyle(`${tabTooltip}::before`, {
  content: '""',
  position: "absolute",
  bottom: "100%",
  left: "50%",
  transform: "translateX(-50%)",
  width: 0,
  height: 0,
  borderLeft: "6px solid transparent",
  borderRight: "6px solid transparent",
  borderBottom: "6px solid rgba(75, 75, 80, 0.95)",
});

export const tabTitleInput = style({
  position: "absolute",
  left: "14px",
  right: "14px",
  top: "50%",
  transform: "translateY(-50%)",
  fontSize: "13px",
  color: "rgba(255, 255, 255, 0.5)",
  background: "transparent",
  border: "none",
  borderRadius: 0,
  padding: 0,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
  width: "calc(100% - 28px)",
  zIndex: 1,
  lineHeight: 1,
  height: "auto",
  transition: "color 0.15s ease",
});

globalStyle(`${tabActive} .${tabTitleInput}`, {
  color: "rgba(255, 255, 255, 0.9)",
});

globalStyle(`${tabTitleInput}:focus`, {
  color: "rgba(255, 255, 255, 0.9)",
});

globalStyle(`${tabTitleInput}::selection`, {
  background: "rgba(168, 85, 247, 0.35)",
  color: "rgba(255, 255, 255, 1)",
});

export const tabClose = style({
  width: "16px",
  height: "16px",
  background: "none",
  border: "none",
  color: "rgba(255, 255, 255, 0.3)",
  fontSize: "14px",
  cursor: "pointer",
  borderRadius: "4px",
  opacity: 0,
  transition: "all 0.1s ease",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  lineHeight: 1,
  flexShrink: 0,
});

globalStyle(`${tab}:hover .${tabClose}, ${tabActive} .${tabClose}`, {
  opacity: 1,
});

globalStyle(`${tabClose}:hover`, {
  background: "rgba(255, 255, 255, 0.1)",
  color: "rgba(255, 255, 255, 0.8)",
});

export const tabAdd = style({
  width: "28px",
  height: "28px",
  background: "transparent",
  border: "1px solid transparent",
  color: "rgba(255, 255, 255, 0.4)",
  fontSize: "18px",
  cursor: "pointer",
  borderRadius: "6px",
  transition: "all 0.15s ease",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  lineHeight: 1,
  flexShrink: 0,
});

globalStyle(`${tabAdd}`, {
  "-webkit-app-region": "no-drag",
});

globalStyle(`${tabAdd}:hover`, {
  background: "rgba(255, 255, 255, 0.05)",
  borderColor: "rgba(255, 255, 255, 0.15)",
  color: "rgba(255, 255, 255, 0.8)",
});

export const pinButton = style({
  width: "28px",
  height: "28px",
  background: "transparent",
  border: "1px solid transparent",
  color: "rgba(255, 255, 255, 0.4)",
  cursor: "pointer",
  borderRadius: "6px",
  transition: "all 0.15s ease",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  lineHeight: 1,
  flexShrink: 0,
});

globalStyle(`${pinButton}`, {
  "-webkit-app-region": "no-drag",
});

globalStyle(`${pinButton}:hover`, {
  background: "rgba(255, 255, 255, 0.05)",
  borderColor: "rgba(255, 255, 255, 0.15)",
  color: "rgba(255, 255, 255, 0.8)",
});

export const pinButtonPinned = style({
  color: "#a855f7",
  background: "rgba(168, 85, 247, 0.1)",
  borderColor: "rgba(168, 85, 247, 0.2)",
});

globalStyle(`${pinButtonPinned}:hover`, {
  background: "rgba(168, 85, 247, 0.15)",
  borderColor: "rgba(168, 85, 247, 0.3)",
  color: "#a855f7",
});

globalStyle(`${pinButton} svg`, {
  width: "16px",
  height: "16px",
});
