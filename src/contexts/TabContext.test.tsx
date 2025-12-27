import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { TabProvider, useTabContext, type Tab } from "./TabContext";
import type { ReactNode } from "react";

// Wrapper for testing hooks with context
const wrapper = ({ children }: { children: ReactNode }) => (
  <TabProvider>{children}</TabProvider>
);

describe("TabContext", () => {
  describe("initial state", () => {
    it("should start with one tab", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      expect(result.current.tabs).toHaveLength(1);
      expect(result.current.tabs[0].number).toBe(1);
      expect(result.current.tabs[0].title).toBe("1");
      expect(result.current.tabs[0].sessionId).toBeNull();
    });

    it("should have the first tab as active", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      expect(result.current.activeTabId).toBe(result.current.tabs[0].id);
    });

    it("should not allow closing the only tab", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      expect(result.current.canCloseTab).toBe(false);
    });
  });

  describe("createTab", () => {
    it("should create a new tab", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      act(() => {
        result.current.createTab();
      });

      expect(result.current.tabs).toHaveLength(2);
    });

    it("should return the new tab id", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      let newTabId: string = "";
      act(() => {
        newTabId = result.current.createTab();
      });

      expect(newTabId).toBeTruthy();
      expect(result.current.tabs.find((t) => t.id === newTabId)).toBeDefined();
    });

    it("should set the new tab as active", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      let newTabId: string = "";
      act(() => {
        newTabId = result.current.createTab();
      });

      expect(result.current.activeTabId).toBe(newTabId);
    });

    it("should assign sequential numbers", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      act(() => {
        result.current.createTab();
      });
      act(() => {
        result.current.createTab();
      });

      const numbers = result.current.tabs.map((t) => t.number).sort((a, b) => a - b);
      expect(numbers).toEqual([1, 2, 3]);
    });

    it("should reuse closed tab numbers", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      // Create tabs 1, 2, 3
      act(() => {
        result.current.createTab();
      });
      act(() => {
        result.current.createTab();
      });

      // Close tab 2
      const tab2 = result.current.tabs.find((t) => t.number === 2);
      act(() => {
        result.current.closeTab(tab2!.id);
      });

      // Create a new tab - should get number 2
      act(() => {
        result.current.createTab();
      });

      const numbers = result.current.tabs.map((t) => t.number).sort((a, b) => a - b);
      expect(numbers).toEqual([1, 2, 3]);
    });

    it("should generate unique tab ids", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      act(() => {
        result.current.createTab();
      });
      act(() => {
        result.current.createTab();
      });

      const ids = result.current.tabs.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("closeTab", () => {
    it("should remove the tab", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      act(() => {
        result.current.createTab();
      });

      const tabToClose = result.current.tabs[0];
      act(() => {
        result.current.closeTab(tabToClose.id);
      });

      expect(result.current.tabs).toHaveLength(1);
      expect(result.current.tabs.find((t) => t.id === tabToClose.id)).toBeUndefined();
    });

    it("should not close the last tab", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      const onlyTab = result.current.tabs[0];
      act(() => {
        result.current.closeTab(onlyTab.id);
      });

      expect(result.current.tabs).toHaveLength(1);
      expect(result.current.tabs[0].id).toBe(onlyTab.id);
    });

    it("should switch to adjacent tab when closing active tab", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      // Create tab 2 and tab 3
      act(() => {
        result.current.createTab();
      });
      act(() => {
        result.current.createTab();
      });

      // Tab 3 is active, close it
      const tab3 = result.current.tabs[2];
      expect(result.current.activeTabId).toBe(tab3.id);

      act(() => {
        result.current.closeTab(tab3.id);
      });

      // Should switch to tab 2 (the new last tab)
      expect(result.current.activeTabId).toBe(result.current.tabs[1].id);
    });

    it("should keep current active tab if closing a different tab", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      const firstTabId = result.current.tabs[0].id;

      act(() => {
        result.current.createTab();
      });

      // Switch back to first tab
      act(() => {
        result.current.setActiveTab(firstTabId);
      });

      // Close the second tab
      const secondTab = result.current.tabs[1];
      act(() => {
        result.current.closeTab(secondTab.id);
      });

      // First tab should still be active
      expect(result.current.activeTabId).toBe(firstTabId);
    });

    it("should handle closing non-existent tab gracefully", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      act(() => {
        result.current.createTab();
      });

      const tabCount = result.current.tabs.length;

      act(() => {
        result.current.closeTab("non-existent-id");
      });

      expect(result.current.tabs).toHaveLength(tabCount);
    });
  });

  describe("setActiveTab", () => {
    it("should change the active tab", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      act(() => {
        result.current.createTab();
      });

      const firstTabId = result.current.tabs[0].id;

      act(() => {
        result.current.setActiveTab(firstTabId);
      });

      expect(result.current.activeTabId).toBe(firstTabId);
    });
  });

  describe("updateTabSessionId", () => {
    it("should update the session id for a tab", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      const tabId = result.current.tabs[0].id;
      const sessionId = "session-123";

      act(() => {
        result.current.updateTabSessionId(tabId, sessionId);
      });

      expect(result.current.tabs[0].sessionId).toBe(sessionId);
    });

    it("should not affect other tabs", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      act(() => {
        result.current.createTab();
      });

      const firstTabId = result.current.tabs[0].id;
      const secondTabId = result.current.tabs[1].id;

      act(() => {
        result.current.updateTabSessionId(firstTabId, "session-1");
      });

      expect(result.current.tabs.find((t) => t.id === secondTabId)?.sessionId).toBeNull();
    });
  });

  describe("updateTabTitle", () => {
    it("should update the title for a tab", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      const tabId = result.current.tabs[0].id;

      act(() => {
        result.current.updateTabTitle(tabId, "new-title");
      });

      expect(result.current.tabs[0].title).toBe("new-title");
    });

    it("should not affect other tabs", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      act(() => {
        result.current.createTab();
      });

      const firstTabId = result.current.tabs[0].id;
      const secondTab = result.current.tabs[1];
      const originalTitle = secondTab.title;

      act(() => {
        result.current.updateTabTitle(firstTabId, "modified");
      });

      expect(result.current.tabs.find((t) => t.id === secondTab.id)?.title).toBe(originalTitle);
    });
  });

  describe("canCloseTab", () => {
    it("should be false with one tab", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      expect(result.current.canCloseTab).toBe(false);
    });

    it("should be true with multiple tabs", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      act(() => {
        result.current.createTab();
      });

      expect(result.current.canCloseTab).toBe(true);
    });

    it("should update when tabs change", () => {
      const { result } = renderHook(() => useTabContext(), { wrapper });

      expect(result.current.canCloseTab).toBe(false);

      act(() => {
        result.current.createTab();
      });
      expect(result.current.canCloseTab).toBe(true);

      // Close the new tab
      act(() => {
        result.current.closeTab(result.current.tabs[1].id);
      });
      expect(result.current.canCloseTab).toBe(false);
    });
  });

  describe("useTabContext outside provider", () => {
    it("should throw error when used outside TabProvider", () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        renderHook(() => useTabContext());
      }).toThrow("useTabContext must be used within a TabProvider");

      consoleSpy.mockRestore();
    });
  });
});
