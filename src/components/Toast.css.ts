import { style, globalStyle } from '@vanilla-extract/css';

export const toastContainer = style({
  position: 'fixed',
  bottom: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 3000,
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
});

export const toast = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '10px 14px',
  borderRadius: '6px',
  fontSize: '12px',
  minWidth: '200px',
  maxWidth: '320px',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
  transition: 'all 0.2s ease',
});

export const toastVisible = style({
  opacity: 1,
  transform: 'translateY(0)',
});

export const toastHidden = style({
  opacity: 0,
  transform: 'translateY(10px)',
});

export const toastInfo = style({
  background: '#2c313a',
  border: '1px solid #3e4451',
  color: '#abb2bf',
});

export const toastSuccess = style({
  background: 'rgba(140, 194, 101, 0.15)',
  border: '1px solid #8cc265',
  color: '#8cc265',
});

export const toastWarning = style({
  background: 'rgba(209, 143, 82, 0.15)',
  border: '1px solid #d18f52',
  color: '#d18f52',
});

export const toastError = style({
  background: 'rgba(224, 85, 97, 0.15)',
  border: '1px solid #e05561',
  color: '#e05561',
});

export const toastMessage = style({
  flex: 1,
});

export const toastClose = style({
  background: 'none',
  border: 'none',
  color: 'inherit',
  opacity: 0.6,
  fontSize: '16px',
  cursor: 'pointer',
  padding: 0,
  lineHeight: 1,
  transition: 'opacity 0.15s ease',
});

globalStyle(`${toastClose}:hover`, {
  opacity: 1,
});

