import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TabBar from "./TabBar";
import type { Tab } from "@/contexts/TabContext";

// Mock CSS modules
vi.mock("./TabBar.css", () => ({
  tabBar: "tab-bar",
  tabsContainer: "tabs-container",
  tab: "tab",
  tabActive: "tab-active",
  tabTitle: "tab-title",
  tabTitleHidden: "tab-title-hidden",
  tabTitleInput: "tab-title-input",
  tabClose: "tab-close",
  tabTooltip: "tab-tooltip",
  tabAdd: "tab-add",
  pinButton: "pin-button",
  pinButtonPinned: "pin-button-pinned",
}));

// Mock dependencies
const mockCreateTab = vi.fn();
const mockCloseTab = vi.fn();
const mockSetActiveTab = vi.fn();
const mockUpdateTabTitle = vi.fn();
const mockTogglePin = vi.fn();

vi.mock("@/contexts/TabContext", () => ({
  useTabContext: vi.fn(),
}));

vi.mock("@/hooks/usePinState", () => ({
  usePinState: vi.fn(),
}));

vi.mock("@/components/icons", () => ({
  PinIcon: () => <div data-testid="pin-icon">📌</div>,
}));

import { useTabContext } from "@/contexts/TabContext";
import { usePinState } from "@/hooks/usePinState";

describe("TabBar", () => {
  const mockTabs: Tab[] = [
    {
      id: "tab-1",
      number: 1,
      title: "First Tab",
    },
    {
      id: "tab-2",
      number: 2,
      title: "Second Tab",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useTabContext).mockReturnValue({
      tabs: mockTabs,
      activeTabId: "tab-1",
      createTab: mockCreateTab,
      closeTab: mockCloseTab,
      setActiveTab: mockSetActiveTab,
      updateTabTitle: mockUpdateTabTitle,
      setActivePane: vi.fn(),
      updateTabSessionId: vi.fn(),
    });

    vi.mocked(usePinState).mockReturnValue({
      pinned: false,
      togglePin: mockTogglePin,
      setPin: vi.fn(),
    });

    // Mock requestAnimationFrame
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Rendering", () => {
    it("should render all tabs", () => {
      render(<TabBar />);

      expect(screen.getByText("1: First Tab")).toBeInTheDocument();
      expect(screen.getByText("2: Second Tab")).toBeInTheDocument();
    });

    it("should apply active class to active tab", () => {
      render(<TabBar />);

      const firstTab = screen.getByText("1: First Tab").closest("div");
      const secondTab = screen.getByText("2: Second Tab").closest("div");

      expect(firstTab).toHaveClass("tab-active");
      expect(secondTab).not.toHaveClass("tab-active");
    });

    it("should render new tab button", () => {
      render(<TabBar />);

      const addButton = screen.getByTitle("New tab (⌘T)");
      expect(addButton).toBeInTheDocument();
      expect(addButton).toHaveTextContent("+");
    });

    it("should render pin button", () => {
      render(<TabBar />);

      const pinButton = screen.getByTitle("Pin window (⌘`)");
      expect(pinButton).toBeInTheDocument();
      expect(screen.getByTestId("pin-icon")).toBeInTheDocument();
    });

    it("should render settings button when provided", () => {
      const settingsButton = <button data-testid="settings-btn">Settings</button>;
      render(<TabBar settingsButton={settingsButton} />);

      expect(screen.getByTestId("settings-btn")).toBeInTheDocument();
    });

    it("should show close buttons when multiple tabs exist", () => {
      render(<TabBar />);

      const closeButtons = screen.getAllByTitle("Close tab");
      expect(closeButtons).toHaveLength(2);
    });

    it("should not show close buttons when only one tab exists", () => {
      vi.mocked(useTabContext).mockReturnValue({
        tabs: [mockTabs[0]],
        activeTabId: "tab-1",
        createTab: mockCreateTab,
        closeTab: mockCloseTab,
        setActiveTab: mockSetActiveTab,
        updateTabTitle: mockUpdateTabTitle,
        setActivePane: vi.fn(),
        updateTabSessionId: vi.fn(),
      });

      render(<TabBar />);

      expect(screen.queryByTitle("Close tab")).not.toBeInTheDocument();
    });
  });

  describe("Tab Selection", () => {
    it("should call setActiveTab when clicking a tab", () => {
      render(<TabBar />);

      const secondTab = screen.getByText("2: Second Tab");
      fireEvent.click(secondTab);

      expect(mockSetActiveTab).toHaveBeenCalledWith("tab-2");
    });

    it("should not select tab when clicking during edit mode", async () => {
      const user = userEvent.setup();
      render(<TabBar />);

      const firstTab = screen.getByText("1: First Tab");

      // Enter edit mode (dblClick fires click events)
      await user.dblClick(firstTab);

      const input = screen.getByDisplayValue("First Tab");
      expect(input).toBeInTheDocument();

      // Clear mock calls from double-click (which includes clicks)
      vi.clearAllMocks();

      // Try to click the tab while editing
      fireEvent.click(firstTab.closest("div")!);

      // Should not change active tab during edit
      expect(mockSetActiveTab).not.toHaveBeenCalled();
    });
  });

  describe("Tab Creation", () => {
    it("should call createTab when clicking add button", () => {
      render(<TabBar />);

      const addButton = screen.getByTitle("New tab (⌘T)");
      fireEvent.click(addButton);

      expect(mockCreateTab).toHaveBeenCalledTimes(1);
    });
  });

  describe("Tab Closing", () => {
    it("should call closeTab when clicking close button", () => {
      render(<TabBar />);

      const closeButtons = screen.getAllByTitle("Close tab");
      fireEvent.click(closeButtons[0]);

      expect(mockCloseTab).toHaveBeenCalledWith("tab-1");
    });

    it("should not propagate click to tab when closing", () => {
      render(<TabBar />);

      const closeButtons = screen.getAllByTitle("Close tab");
      fireEvent.click(closeButtons[1]);

      expect(mockCloseTab).toHaveBeenCalledWith("tab-2");
      expect(mockSetActiveTab).not.toHaveBeenCalled();
    });
  });

  describe("Tab Renaming", () => {
    it("should enter edit mode on double click", async () => {
      const user = userEvent.setup();
      render(<TabBar />);

      const firstTab = screen.getByText("1: First Tab");
      await user.dblClick(firstTab);

      const input = screen.getByDisplayValue("First Tab");
      expect(input).toBeInTheDocument();
      expect(input).toHaveFocus();
    });

    it("should save new title on Enter key", async () => {
      const user = userEvent.setup();
      render(<TabBar />);

      const firstTab = screen.getByText("1: First Tab");
      await user.dblClick(firstTab);

      const input = screen.getByDisplayValue("First Tab");
      await user.clear(input);
      await user.type(input, "Renamed Tab{Enter}");

      expect(mockUpdateTabTitle).toHaveBeenCalledWith("tab-1", "Renamed Tab", true);
    });

    it("should trim whitespace from title", async () => {
      const user = userEvent.setup();
      render(<TabBar />);

      const firstTab = screen.getByText("1: First Tab");
      await user.dblClick(firstTab);

      const input = screen.getByDisplayValue("First Tab");
      await user.clear(input);
      await user.type(input, "  Spaced  {Enter}");

      expect(mockUpdateTabTitle).toHaveBeenCalledWith("tab-1", "Spaced", true);
    });

    it("should limit title length to 50 characters", async () => {
      const user = userEvent.setup();
      render(<TabBar />);

      const firstTab = screen.getByText("1: First Tab");
      await user.dblClick(firstTab);

      const longTitle = "a".repeat(60);
      const input = screen.getByDisplayValue("First Tab");
      await user.clear(input);
      await user.type(input, `${longTitle}{Enter}`);

      const expected = "a".repeat(50);
      expect(mockUpdateTabTitle).toHaveBeenCalledWith("tab-1", expected, true);
    });

    it("should remove control characters from title", async () => {
      const user = userEvent.setup();
      render(<TabBar />);

      const firstTab = screen.getByText("1: First Tab");
      await user.dblClick(firstTab);

      const input = screen.getByDisplayValue("First Tab");
      await user.clear(input);

      // Manually set value with control characters
      fireEvent.change(input, { target: { value: "Test\x00Tab\x1F" } });
      await user.keyboard("{Enter}");

      expect(mockUpdateTabTitle).toHaveBeenCalledWith("tab-1", "TestTab", true);
    });

    it("should revert to original title if new title is empty after trim", async () => {
      const user = userEvent.setup();
      render(<TabBar />);

      const firstTab = screen.getByText("1: First Tab");
      await user.dblClick(firstTab);

      const input = screen.getByDisplayValue("First Tab");
      await user.clear(input);
      await user.type(input, "   {Enter}");

      // Should not call updateTabTitle with empty string
      expect(mockUpdateTabTitle).not.toHaveBeenCalled();

      // Should revert to original title
      expect(screen.getByText("1: First Tab")).toBeInTheDocument();
    });

    it("should cancel edit on Escape key", async () => {
      const user = userEvent.setup();
      render(<TabBar />);

      const firstTab = screen.getByText("1: First Tab");
      await user.dblClick(firstTab);

      const input = screen.getByDisplayValue("First Tab");
      await user.clear(input);
      await user.type(input, "Changed{Escape}");

      // Should not update title
      expect(mockUpdateTabTitle).not.toHaveBeenCalled();

      // Should show original title
      expect(screen.getByText("1: First Tab")).toBeInTheDocument();
      expect(screen.queryByDisplayValue("Changed")).not.toBeInTheDocument();
    });

    it("should save on blur if title changed", async () => {
      const user = userEvent.setup();
      render(<TabBar />);

      const firstTab = screen.getByText("1: First Tab");
      await user.dblClick(firstTab);

      const input = screen.getByDisplayValue("First Tab");
      await user.clear(input);
      await user.type(input, "Blurred");

      // Click outside to blur
      fireEvent.blur(input);

      expect(mockUpdateTabTitle).toHaveBeenCalledWith("tab-1", "Blurred", true);
    });

    it("should not save on blur if title unchanged", async () => {
      const user = userEvent.setup();
      render(<TabBar />);

      const firstTab = screen.getByText("1: First Tab");
      await user.dblClick(firstTab);

      const input = screen.getByDisplayValue("First Tab");

      // Blur without changing
      fireEvent.blur(input);

      expect(mockUpdateTabTitle).not.toHaveBeenCalled();
    });

    it("should not propagate click when clicking input", async () => {
      const user = userEvent.setup();
      render(<TabBar />);

      const firstTab = screen.getByText("1: First Tab");
      await user.dblClick(firstTab);

      const input = screen.getByDisplayValue("First Tab");

      // Clear mock calls from double-click
      vi.clearAllMocks();

      fireEvent.click(input);

      // Should not select tab when clicking input
      expect(mockSetActiveTab).not.toHaveBeenCalled();
    });

    it("should update editing value when tab title changes externally (not while editing)", () => {
      const { rerender } = render(<TabBar />);

      // Update tab title externally
      const updatedTabs = [
        { ...mockTabs[0], title: "Updated Externally" },
        mockTabs[1],
      ];

      vi.mocked(useTabContext).mockReturnValue({
        tabs: updatedTabs,
        activeTabId: "tab-1",
        createTab: mockCreateTab,
        closeTab: mockCloseTab,
        setActiveTab: mockSetActiveTab,
        updateTabTitle: mockUpdateTabTitle,
        setActivePane: vi.fn(),
        updateTabSessionId: vi.fn(),
      });

      rerender(<TabBar />);

      expect(screen.getByText("1: Updated Externally")).toBeInTheDocument();
    });
  });

  describe("Tooltips", () => {
    beforeEach(() => {
      vi.useFakeTimers();

      // Mock getBoundingClientRect for tooltip positioning
      Element.prototype.getBoundingClientRect = vi.fn(() => ({
        left: 100,
        right: 200,
        top: 10,
        bottom: 50,
        width: 100,
        height: 40,
        x: 100,
        y: 10,
        toJSON: () => {},
      }));
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("should show tooltip on hover after delay", () => {
      render(<TabBar />);

      const firstTab = screen.getByText("1: First Tab").closest("div")!;

      // Mouse enter
      fireEvent.mouseEnter(firstTab);

      // Should not show immediately
      let tooltip = document.querySelector(".tab-tooltip");
      expect(tooltip).not.toBeInTheDocument();

      // Advance past delay
      act(() => {
        vi.runOnlyPendingTimers();
      });

      // Tooltip should now be visible
      tooltip = document.querySelector(".tab-tooltip");
      expect(tooltip).toBeInTheDocument();
      expect(tooltip?.textContent).toContain("1: First Tab");
    });

    it("should hide tooltip on mouse leave", () => {
      render(<TabBar />);

      const firstTab = screen.getByText("1: First Tab").closest("div")!;

      // Show tooltip first
      fireEvent.mouseEnter(firstTab);
      act(() => {
        vi.runOnlyPendingTimers();
      });

      let tooltip = document.querySelector(".tab-tooltip");
      expect(tooltip).toBeInTheDocument();

      // Mouse leave
      fireEvent.mouseLeave(firstTab);

      // Tooltip should be removed immediately
      tooltip = document.querySelector(".tab-tooltip");
      expect(tooltip).not.toBeInTheDocument();
    });

    it("should cancel tooltip if mouse leaves before delay", () => {
      render(<TabBar />);

      const firstTab = screen.getByText("1: First Tab").closest("div")!;
      fireEvent.mouseEnter(firstTab);

      // Leave before delay completes
      vi.advanceTimersByTime(100);
      fireEvent.mouseLeave(firstTab);

      // Complete the delay
      vi.advanceTimersByTime(200);

      // Tooltip should not appear
      const tooltips = screen.getAllByText("1: First Tab");
      expect(tooltips.length).toBe(1);
    });

    it("should not show tooltip when editing", () => {
      render(<TabBar />);

      const firstTab = screen.getByText("1: First Tab");

      // Enter edit mode using fireEvent for simplicity with fake timers
      fireEvent.doubleClick(firstTab);

      // Should be in edit mode
      const input = screen.getByDisplayValue("First Tab");
      expect(input).toBeInTheDocument();

      const tabDiv = firstTab.closest("div")!;

      // Try to show tooltip
      fireEvent.mouseEnter(tabDiv);
      act(() => {
        vi.runOnlyPendingTimers();
      });

      // Should not show tooltip during edit
      const tooltip = document.querySelector(".tab-tooltip");
      expect(tooltip).not.toBeInTheDocument();
    });

    it("should cleanup tooltip timeout on unmount", () => {
      const { unmount } = render(<TabBar />);

      const firstTab = screen.getByText("1: First Tab").closest("div")!;
      fireEvent.mouseEnter(firstTab);

      unmount();

      // Should not throw or cause issues
      vi.advanceTimersByTime(200);
    });
  });

  describe("Pin Button", () => {
    it("should call togglePin when clicked", () => {
      render(<TabBar />);

      const pinButton = screen.getByTitle("Pin window (⌘`)");
      fireEvent.click(pinButton);

      expect(mockTogglePin).toHaveBeenCalledTimes(1);
    });

    it("should show pinned styling when pinned", () => {
      vi.mocked(usePinState).mockReturnValue({
        pinned: true,
        togglePin: mockTogglePin,
        setPin: vi.fn(),
      });

      render(<TabBar />);

      const pinButton = screen.getByTitle("Unpin window (⌘`)");
      expect(pinButton).toHaveClass("pin-button-pinned");
    });

    it("should show unpinned styling when not pinned", () => {
      render(<TabBar />);

      const pinButton = screen.getByTitle("Pin window (⌘`)");
      expect(pinButton).not.toHaveClass("pin-button-pinned");
    });
  });

  describe("Scrolling Behavior", () => {
    let mockScrollIntoView: ReturnType<typeof vi.fn>;
    let mockGetBoundingClientRect: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockScrollIntoView = vi.fn();
      mockGetBoundingClientRect = vi.fn();

      Element.prototype.getBoundingClientRect = mockGetBoundingClientRect as unknown as () => DOMRect;
      Element.prototype.scrollIntoView = mockScrollIntoView as unknown as (arg?: boolean | ScrollIntoViewOptions) => void;

      mockGetBoundingClientRect.mockReturnValue({
        left: 0,
        right: 100,
        top: 0,
        bottom: 40,
        width: 100,
        height: 40,
      });
    });

    it("should auto-scroll to end when new tab is added", () => {
      const { rerender } = render(<TabBar />);

      const tabsContainer = screen.getByText("1: First Tab").closest("div")?.parentElement;
      if (tabsContainer) {
        Object.defineProperty(tabsContainer, "scrollWidth", { value: 500, configurable: true });
        Object.defineProperty(tabsContainer, "scrollLeft", { value: 0, writable: true, configurable: true });
      }

      // Add new tab
      const newTabs = [
        ...mockTabs,
        {
          id: "tab-3",
          number: 3,
          title: "Third Tab",
          paneTree: { type: "terminal" as const, paneId: "pane-3" },
        },
      ];

      vi.mocked(useTabContext).mockReturnValue({
        tabs: newTabs,
        activeTabId: "tab-1",
        createTab: mockCreateTab,
        closeTab: mockCloseTab,
        setActiveTab: mockSetActiveTab,
        updateTabTitle: mockUpdateTabTitle,
        setActivePane: vi.fn(),
        updateTabSessionId: vi.fn(),
      });

      rerender(<TabBar />);

      // Should scroll to end
      if (tabsContainer) {
        expect(tabsContainer.scrollLeft).toBe(500);
      }
    });

    it("should handle mouse wheel for horizontal scroll", () => {
      render(<TabBar />);

      const tabsContainer = screen.getByText("1: First Tab").closest("div")?.parentElement;
      expect(tabsContainer).toBeInTheDocument();

      if (tabsContainer) {
        // Set initial scrollLeft
        let scrollLeft = 0;
        Object.defineProperty(tabsContainer, "scrollLeft", {
          get: () => scrollLeft,
          set: (value) => {
            scrollLeft = value;
          },
          configurable: true,
        });

        // Fire wheel event
        fireEvent.wheel(tabsContainer, { deltaY: 100 });

        // Should scroll horizontally by deltaY amount
        expect(scrollLeft).toBe(100);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty tabs array", () => {
      vi.mocked(useTabContext).mockReturnValue({
        tabs: [],
        activeTabId: "",
        createTab: mockCreateTab,
        closeTab: mockCloseTab,
        setActiveTab: mockSetActiveTab,
        updateTabTitle: mockUpdateTabTitle,
        setActivePane: vi.fn(),
        updateTabSessionId: vi.fn(),
      });

      render(<TabBar />);

      // Should still render container and buttons
      expect(screen.getByTitle("New tab (⌘T)")).toBeInTheDocument();
      expect(screen.getByTitle("Pin window (⌘`)")).toBeInTheDocument();
    });

    it("should handle very long tab titles", () => {
      const longTitle = "a".repeat(100);
      const tabWithLongTitle = {
        ...mockTabs[0],
        title: longTitle,
      };

      vi.mocked(useTabContext).mockReturnValue({
        tabs: [tabWithLongTitle],
        activeTabId: "tab-1",
        createTab: mockCreateTab,
        closeTab: mockCloseTab,
        setActiveTab: mockSetActiveTab,
        updateTabTitle: mockUpdateTabTitle,
        setActivePane: vi.fn(),
        updateTabSessionId: vi.fn(),
      });

      render(<TabBar />);

      // Should render without crashing
      expect(screen.getByText(`1: ${longTitle}`)).toBeInTheDocument();
    });

    it("should handle rapid tab selection changes", () => {
      render(<TabBar />);

      const firstTab = screen.getByText("1: First Tab");
      const secondTab = screen.getByText("2: Second Tab");

      // Rapid clicks
      fireEvent.click(secondTab);
      fireEvent.click(firstTab);
      fireEvent.click(secondTab);

      expect(mockSetActiveTab).toHaveBeenCalledTimes(3);
    });
  });
});
