import { keyframes } from "@vanilla-extract/css";

export const slideDown = keyframes({
  from: {
    opacity: 0,
    transform: "translateY(-10px)",
  },
  to: {
    opacity: 1,
    transform: "translateY(0)",
  },
});

export const fadeIn = keyframes({
  from: {
    opacity: 0,
  },
  to: {
    opacity: 1,
  },
});

export const scaleIn = keyframes({
  from: {
    transform: "scale(0.95)",
    opacity: 0,
  },
  to: {
    transform: "scale(1)",
    opacity: 1,
  },
});

export const pulse = keyframes({
  "0%, 100%": {
    opacity: 1,
  },
  "50%": {
    opacity: 0.5,
  },
});

export const tooltipFadeIn = keyframes({
  from: {
    opacity: 0,
    transform: "translateX(-50%) translateY(-4px)",
  },
  to: {
    opacity: 1,
    transform: "translateX(-50%) translateY(0)",
  },
});

export const slideInSearch = keyframes({
  from: {
    opacity: 0,
    transform: "translateY(-8px)",
  },
  to: {
    opacity: 1,
    transform: "translateY(0)",
  },
});
