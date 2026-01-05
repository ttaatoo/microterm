import { style, globalStyle } from '@vanilla-extract/css';
import { fadeIn, scaleIn, pulse } from '../styles/animations.css';

export const settingsOverlay = style({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
  animation: `${fadeIn} 0.15s ease-out`,
});

export const settingsPanel = style({
  background: '#0d0d0d',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '10px',
  width: '320px',
  maxHeight: 'calc(100vh - 80px)',
  boxShadow: `
    0 0 0 1px rgba(0, 0, 0, 0.5),
    0 16px 48px rgba(0, 0, 0, 0.6),
    0 4px 16px rgba(0, 0, 0, 0.4)
  `,
  animation: `${scaleIn} 0.15s ease-out`,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

export const settingsHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 16px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  flexShrink: 0,
  background: 'rgba(255, 255, 255, 0.02)',
});

export const settingsTitle = style({
  fontSize: '14px',
  fontWeight: 600,
  color: 'rgba(255, 255, 255, 0.9)',
});

export const settingsClose = style({
  background: 'none',
  border: 'none',
  color: 'rgba(255, 255, 255, 0.4)',
  fontSize: '20px',
  cursor: 'pointer',
  padding: 0,
  lineHeight: 1,
  transition: 'color 0.15s ease',
});

globalStyle(`${settingsClose}:hover`, {
  color: 'rgba(255, 255, 255, 0.8)',
});

export const settingsContent = style({
  padding: '16px',
  flex: 1,
  overflowY: 'auto',
});

export const settingsItem = style({
  marginBottom: '16px',
});

globalStyle(`${settingsItem}:last-child`, {
  marginBottom: 0,
});

export const settingsLabel = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: '13px',
  color: 'rgba(255, 255, 255, 0.7)',
  marginBottom: '8px',
});

export const settingsValue = style({
  color: 'rgba(255, 255, 255, 0.5)',
  fontWeight: 500,
});

export const settingsSlider = style({
  width: '100%',
  height: '4px',
  borderRadius: '2px',
  background: 'rgba(255, 255, 255, 0.1)',
  outline: 'none',
  WebkitAppearance: 'none',
  appearance: 'none',
  cursor: 'pointer',
});

globalStyle(`${settingsSlider}::-webkit-slider-thumb`, {
  WebkitAppearance: 'none',
  appearance: 'none',
  width: '14px',
  height: '14px',
  borderRadius: '50%',
  background: 'rgba(255, 255, 255, 0.8)',
  cursor: 'pointer',
  transition: 'transform 0.1s ease',
  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.4)',
});

globalStyle(`${settingsSlider}::-webkit-slider-thumb:hover`, {
  transform: 'scale(1.1)',
  background: 'rgba(255, 255, 255, 0.95)',
});

globalStyle(`${settingsSlider}::-webkit-slider-thumb:active`, {
  transform: 'scale(0.95)',
});

export const settingsHint = style({
  fontSize: '11px',
  color: 'rgba(255, 255, 255, 0.35)',
  marginTop: '8px',
});

export const settingsDivider = style({
  height: '1px',
  background: 'rgba(255, 255, 255, 0.08)',
  margin: '16px 0',
});

export const settingsToggle = style({
  position: 'relative',
  display: 'inline-block',
  width: '36px',
  height: '20px',
  cursor: 'pointer',
});

globalStyle(`${settingsToggle} input`, {
  opacity: 0,
  width: 0,
  height: 0,
});

export const toggleSlider = style({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  borderRadius: '20px',
  transition: '0.2s',
});

globalStyle(`${toggleSlider}:before`, {
  position: 'absolute',
  content: '""',
  height: '14px',
  width: '14px',
  left: '3px',
  bottom: '3px',
  backgroundColor: 'rgba(255, 255, 255, 0.4)',
  borderRadius: '50%',
  transition: '0.2s',
});

globalStyle(`${settingsToggle} input:checked + .${toggleSlider}`, {
  backgroundColor: 'rgba(255, 255, 255, 0.25)',
});

globalStyle(`${settingsToggle} input:checked + .${toggleSlider}:before`, {
  transform: 'translateX(16px)',
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
});

export const shortcutRecorder = style({
  marginTop: '8px',
});

export const shortcutButton = style({
  width: '100%',
  padding: '10px 14px',
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '6px',
  color: 'rgba(255, 255, 255, 0.7)',
  fontSize: '13px',
  fontFamily: 'inherit',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  textAlign: 'center',
});

globalStyle(`${shortcutButton}:hover:not(:disabled)`, {
  borderColor: 'rgba(255, 255, 255, 0.25)',
  background: 'rgba(255, 255, 255, 0.06)',
});

globalStyle(`${shortcutButton}:disabled`, {
  opacity: 0.5,
  cursor: 'not-allowed',
});

export const shortcutButtonRecording = style({
  borderColor: 'rgba(209, 143, 82, 0.6)',
  background: 'rgba(209, 143, 82, 0.1)',
});

export const shortcutDisplay = style({
  fontWeight: 500,
  letterSpacing: '0.5px',
});

export const recordingText = style({
  color: '#d18f52',
  animation: `${pulse} 1s infinite`,
});

