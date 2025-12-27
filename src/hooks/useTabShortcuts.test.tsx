import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTabShortcuts } from "./useTabShortcuts";
import { TabProvider, useTabContext } from "@/contexts/TabContext";
import type { ReactNode } from "react";

// Mock Tauri APIs
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/tauri", () => ({
  registerLocalShortcut: vi.fn().mockResolvedValue(vi.fn()),
}));

// Wrapper for testing hooks with context
const wrapper = ({ children }: { children: ReactNode }) => (
  <TabProvider>{children}</TabProvider>
);

// Custom hook that combines useTabShortcuts and useTabContext for testing
function useTestHook() {
  useTabShortcuts();
  return useTabContext();
}

describe("useTabShortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock document.hasFocus to return true
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initialization", () => {
    it("should not throw when initialized", () => {
      expect(() => {
        renderHook(() => useTabShortcuts(), { wrapper });
      }).not.toThrow();
    });

    it("should not register shortcuts when disabled", async () => {
      const { registerLocalShortcut } = await import("@/lib/tauri");

      renderHook(() => useTabShortcuts(true), { wrapper });

      // Wait for any async operations
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(registerLocalShortcut).not.toHaveBeenCalled();
    });
  });

  describe("keyboard shortcuts", () => {
    it("should handle Cmd+T to create new tab", async () => {
      const { result } = renderHook(() => useTestHook(), { wrapper });

      expect(result.current.tabs).toHaveLength(1);

      await act(async () => {
        const event = new KeyboardEvent("keydown", {
          key: "t",
          metaKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.tabs).toHaveLength(2);
    });

    it("should handle Cmd+W to close tab when multiple tabs exist", async () => {
      const { result } = renderHook(() => useTestHook(), { wrapper });

      // Create a second tab first
      await act(async () => {
        result.current.createTab();
      });

      expect(result.current.tabs).toHaveLength(2);

      await act(async () => {
        const event = new KeyboardEvent("keydown", {
          key: "w",
          metaKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.tabs).toHaveLength(1);
    });

    it("should handle Cmd+W to hide window when only one tab exists", async () => {
      const { invoke } = await import("@tauri-apps/api/core");

      renderHook(() => useTabShortcuts(), { wrapper });

      await act(async () => {
        const event = new KeyboardEvent("keydown", {
          key: "w",
          metaKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
        // Wait for async invoke
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(invoke).toHaveBeenCalledWith("hide_window");
    });

    it("should handle Cmd+] to navigate to next tab", async () => {
      const { result } = renderHook(() => useTestHook(), { wrapper });

      // Create second tab
      await act(async () => {
        result.current.createTab();
      });

      // Switch back to first tab
      await act(async () => {
        result.current.setActiveTab(result.current.tabs[0].id);
      });

      expect(result.current.activeTabId).toBe(result.current.tabs[0].id);

      // Use Cmd+] to go to next tab
      await act(async () => {
        const event = new KeyboardEvent("keydown", {
          key: "]",
          metaKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.activeTabId).toBe(result.current.tabs[1].id);
    });

    it("should handle Cmd+[ to navigate to previous tab", async () => {
      const { result } = renderHook(() => useTestHook(), { wrapper });

      // Create second tab (now active)
      await act(async () => {
        result.current.createTab();
      });

      expect(result.current.activeTabId).toBe(result.current.tabs[1].id);

      // Use Cmd+[ to go to previous tab
      await act(async () => {
        const event = new KeyboardEvent("keydown", {
          key: "[",
          metaKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.activeTabId).toBe(result.current.tabs[0].id);
    });

    it("should handle Cmd+1 to switch to first tab", async () => {
      const { result } = renderHook(() => useTestHook(), { wrapper });

      // Create second tab (now active)
      await act(async () => {
        result.current.createTab();
      });

      expect(result.current.activeTabId).toBe(result.current.tabs[1].id);

      // Use Cmd+1 to go to first tab
      await act(async () => {
        const event = new KeyboardEvent("keydown", {
          key: "1",
          metaKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.activeTabId).toBe(result.current.tabs[0].id);
    });

    it("should handle Cmd+2 to switch to second tab", async () => {
      const { result } = renderHook(() => useTestHook(), { wrapper });

      // Create second tab
      await act(async () => {
        result.current.createTab();
      });

      // Switch back to first tab
      await act(async () => {
        result.current.setActiveTab(result.current.tabs[0].id);
      });

      // Use Cmd+2 to go to second tab
      await act(async () => {
        const event = new KeyboardEvent("keydown", {
          key: "2",
          metaKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.activeTabId).toBe(result.current.tabs[1].id);
    });

    it("should ignore number shortcuts for non-existent tabs", async () => {
      const { result } = renderHook(() => useTestHook(), { wrapper });

      const originalActiveId = result.current.activeTabId;

      // Use Cmd+5 when only 1 tab exists
      await act(async () => {
        const event = new KeyboardEvent("keydown", {
          key: "5",
          metaKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      // Should not change active tab
      expect(result.current.activeTabId).toBe(originalActiveId);
    });

    it("should wrap around when navigating past last tab", async () => {
      const { result } = renderHook(() => useTestHook(), { wrapper });

      // Create second tab (now active, index 1)
      await act(async () => {
        result.current.createTab();
      });

      // Navigate to next tab - should wrap to first
      await act(async () => {
        const event = new KeyboardEvent("keydown", {
          key: "]",
          metaKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.activeTabId).toBe(result.current.tabs[0].id);
    });

    it("should wrap around when navigating before first tab", async () => {
      const { result } = renderHook(() => useTestHook(), { wrapper });

      // Create second tab
      await act(async () => {
        result.current.createTab();
      });

      // Switch to first tab
      await act(async () => {
        result.current.setActiveTab(result.current.tabs[0].id);
      });

      // Navigate to previous tab - should wrap to last
      await act(async () => {
        const event = new KeyboardEvent("keydown", {
          key: "[",
          metaKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.activeTabId).toBe(result.current.tabs[1].id);
    });

    it("should not handle shortcuts without meta/ctrl key", async () => {
      const { result } = renderHook(() => useTestHook(), { wrapper });

      const initialTabCount = result.current.tabs.length;

      // Press 't' without modifier
      await act(async () => {
        const event = new KeyboardEvent("keydown", {
          key: "t",
          bubbles: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.tabs).toHaveLength(initialTabCount);
    });
  });

  describe("cleanup", () => {
    it("should clean up event listeners on unmount", async () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = renderHook(() => useTabShortcuts(), { wrapper });

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith("focus", expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith("blur", expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });
});
