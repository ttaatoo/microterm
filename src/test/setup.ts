import "@testing-library/jest-dom/vitest";
import { vi, beforeEach } from "vitest";

// Ensure window is defined for Tauri mocks
if (typeof window !== "undefined" && !("__TAURI__" in window)) {
  (window as any).__TAURI__ = {};
}

// Mock Vanilla Extract CSS modules
// These are build-time only and don't work in test environment
vi.mock("@vanilla-extract/css", () => ({
  style: () => "mocked-style",
  globalStyle: () => undefined,
  keyframes: () => "mocked-keyframes",
  styleVariants: () => ({}),
  createTheme: () => ["mocked-theme", {}],
  createThemeContract: () => ({}),
}));

// Global mock for Tauri APIs to support dynamic imports
// Individual test files can override these with more specific mocks
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    innerSize: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
    outerPosition: vi.fn().mockResolvedValue({ x: 100, y: 100 }),
    setSize: vi.fn().mockResolvedValue(undefined),
    setPosition: vi.fn().mockResolvedValue(undefined),
    listen: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
  }),
}));

vi.mock("@tauri-apps/api/dpi", () => ({
  PhysicalSize: class PhysicalSize {
    constructor(public width: number, public height: number) {}
  },
  PhysicalPosition: class PhysicalPosition {
    constructor(public x: number, public y: number) {}
  },
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Reset mocks before each test
beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});
