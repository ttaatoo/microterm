import { style, globalStyle } from '@vanilla-extract/css';
import { slideInSearch } from '../styles/animations.css';

export const searchBarOverlay = style({
  position: 'absolute',
  top: '48px',
  right: '8px',
  zIndex: 100,
  animation: `${slideInSearch} 0.15s ease-out`,
});

export const searchBar = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '6px 8px',
  background: '#1e1e1e',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '8px',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
});

export const searchInputContainer = style({
  display: 'flex',
  alignItems: 'center',
  background: 'rgba(0, 0, 0, 0.3)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '6px',
  padding: '0 10px',
  transition: 'border-color 0.15s ease',
  width: '180px',
});

globalStyle(`${searchInputContainer}:focus-within`, {
  borderColor: 'rgba(168, 85, 247, 0.5)',
});

export const searchInput = style({
  flex: 1,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: 'rgba(255, 255, 255, 0.9)',
  fontSize: '13px',
  fontFamily: 'inherit',
  padding: '6px 0',
  width: '100%',
});

globalStyle(`${searchInput}::placeholder`, {
  color: 'rgba(255, 255, 255, 0.35)',
});

export const searchOptions = style({
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  borderRight: '1px solid rgba(255, 255, 255, 0.1)',
  paddingRight: '6px',
  marginRight: '2px',
});

export const searchOptionBtn = style({
  width: '26px',
  height: '26px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: '4px',
  color: 'rgba(255, 255, 255, 0.4)',
  fontSize: '12px',
  fontFamily: 'inherit',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
});

globalStyle(`${searchOptionBtn}:hover`, {
  background: 'rgba(255, 255, 255, 0.08)',
  color: 'rgba(255, 255, 255, 0.7)',
});

export const searchOptionBtnActive = style({
  background: 'rgba(168, 85, 247, 0.2)',
  borderColor: 'rgba(168, 85, 247, 0.4)',
  color: '#a855f7',
});

export const wholeWordIcon = style({
  fontSize: '10px',
  letterSpacing: '-1px',
});

export const searchNav = style({
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
  paddingLeft: '6px',
  marginLeft: '2px',
});

export const searchNavBtn = style({
  width: '26px',
  height: '26px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: '4px',
  color: 'rgba(255, 255, 255, 0.5)',
  fontSize: '14px',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
});

globalStyle(`${searchNavBtn}:hover:not(:disabled)`, {
  background: 'rgba(255, 255, 255, 0.08)',
  color: 'rgba(255, 255, 255, 0.8)',
});

globalStyle(`${searchNavBtn}:disabled`, {
  color: 'rgba(255, 255, 255, 0.2)',
  cursor: 'not-allowed',
});

export const searchCloseBtn = style({
  width: '26px',
  height: '26px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  borderRadius: '4px',
  color: 'rgba(255, 255, 255, 0.4)',
  fontSize: '16px',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  padding: 0,
  lineHeight: 1,
});

globalStyle(`${searchCloseBtn}:hover`, {
  background: 'rgba(255, 255, 255, 0.08)',
  color: 'rgba(255, 255, 255, 0.8)',
});

