import { globalStyle, style } from "@vanilla-extract/css";
import { fadeIn, scaleIn } from "../styles/animations.css";

export const onboardingOverlay = style({
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0, 0, 0, 0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2500,
  animation: `${fadeIn} 0.2s ease-out`,
});

export const onboardingPanel = style({
  background: "#21252b",
  border: "1px solid #3e4451",
  borderRadius: "12px",
  width: "360px",
  maxHeight: "calc(100vh - 80px)",
  boxShadow: "0 16px 48px rgba(0, 0, 0, 0.5)",
  animation: `${scaleIn} 0.2s ease-out`,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
});

export const onboardingHeader = style({
  padding: "24px 24px 20px",
  borderBottom: "1px solid #3e4451",
  textAlign: "center",
});

export const onboardingTitle = style({
  fontSize: "18px",
  fontWeight: 600,
  color: "#abb2bf",
});

export const onboardingSubtitle = style({
  fontSize: "13px",
  color: "#5c6370",
  marginTop: "6px",
});

export const onboardingContent = style({
  padding: "20px 24px",
  flex: 1,
  overflowY: "auto",
});

export const onboardingItem = style({
  display: "flex",
  alignItems: "flex-start",
  gap: "14px",
  marginBottom: "16px",
});

globalStyle(`${onboardingItem}:last-child`, {
  marginBottom: 0,
});

export const onboardingIcon = style({
  width: "36px",
  height: "36px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(168, 85, 247, 0.1)",
  borderRadius: "8px",
  flexShrink: 0,
});

globalStyle(`${onboardingIcon} svg`, {
  width: "18px",
  height: "18px",
  color: "#a855f7",
});

export const onboardingText = style({
  flex: 1,
  paddingTop: "2px",
});

globalStyle(`${onboardingText} h4`, {
  fontSize: "14px",
  fontWeight: 600,
  color: "#abb2bf",
  margin: "0 0 4px 0",
});

globalStyle(`${onboardingText} p`, {
  fontSize: "12px",
  color: "#5c6370",
  margin: 0,
  lineHeight: 1.5,
});

export const onboardingKbd = style({
  display: "inline-block",
  padding: "2px 6px",
  background: "#282c34",
  border: "1px solid #3e4451",
  borderRadius: "4px",
  fontSize: "11px",
  fontFamily: "inherit",
  color: "#a855f7",
});

export const onboardingFooter = style({
  padding: "20px 24px",
  borderTop: "1px solid #3e4451",
  flexShrink: 0,
});

export const onboardingButton = style({
  width: "100%",
  padding: "12px 16px",
  background: "#a855f7",
  border: "none",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.15s ease",
});

globalStyle(`${onboardingButton}:hover`, {
  background: "#9333ea",
});

globalStyle(`${onboardingButton}:active`, {
  background: "#7e22ce",
});
