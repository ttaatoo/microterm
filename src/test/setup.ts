import "@testing-library/jest-dom/vitest";
import { vi, beforeEach } from "vitest";

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
