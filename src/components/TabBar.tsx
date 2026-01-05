import { PinIcon } from "@/components/icons";
import { useTabContext, type Tab } from "@/contexts/TabContext";
import { usePinState } from "@/hooks/usePinState";
import { memo, useCallback, useEffect, useRef, type ReactNode } from "react";

interface TabBarProps {
  settingsButton?: ReactNode;
}

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  canClose: boolean;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
}

// Memoized individual tab component to prevent re-renders when other tabs change
const TabItem = memo(function TabItem({
  tab,
  isActive,
  canClose,
  onSelect,
  onClose,
}: TabItemProps) {
  const handleClick = useCallback(() => {
    onSelect(tab.id);
  }, [onSelect, tab.id]);

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose(tab.id);
    },
    [onClose, tab.id]
  );

  return (
    <div className={`tab ${isActive ? "tab-active" : ""}`} onClick={handleClick}>
      <span className="tab-title">
        {tab.number}: {tab.title}
      </span>
      {canClose && (
        <button className="tab-close" onClick={handleClose} title="Close tab">
          ×
        </button>
      )}
    </div>
  );
});

export default function TabBar({ settingsButton }: TabBarProps) {
  const { tabs, activeTabId, createTab, closeTab, setActiveTab, canCloseTab } = useTabContext();
  const { pinned, togglePin } = usePinState();
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const prevTabCountRef = useRef(tabs.length);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll to a specific element without smooth behavior conflicts
  const scrollToElement = useCallback((element: Element) => {
    if (!tabsContainerRef.current || isUserScrollingRef.current) return;

    const container = tabsContainerRef.current;
    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Check if element is outside visible area
    if (elementRect.left < containerRect.left) {
      // Element is to the left, scroll left
      container.scrollLeft -= containerRect.left - elementRect.left + 8;
    } else if (elementRect.right > containerRect.right) {
      // Element is to the right, scroll right
      container.scrollLeft += elementRect.right - containerRect.right + 8;
    }
  }, []);

  // Auto-scroll to the right when new tab is added
  useEffect(() => {
    if (tabs.length > prevTabCountRef.current && tabsContainerRef.current) {
      // New tab was added, scroll to the end
      tabsContainerRef.current.scrollLeft = tabsContainerRef.current.scrollWidth;
    }
    prevTabCountRef.current = tabs.length;
  }, [tabs.length]);

  // Scroll active tab into view when it changes (only if not user scrolling)
  useEffect(() => {
    if (!tabsContainerRef.current) return;

    // Small delay to let the DOM update
    requestAnimationFrame(() => {
      const activeTabElement = tabsContainerRef.current?.querySelector(".tab-active");
      if (activeTabElement) {
        scrollToElement(activeTabElement);
      }
    });
  }, [activeTabId, scrollToElement]);

  // Handle horizontal scroll with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!tabsContainerRef.current) return;

    e.preventDefault();

    // Mark that user is scrolling
    isUserScrollingRef.current = true;

    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Scroll with deltaY (vertical scroll converts to horizontal)
    tabsContainerRef.current.scrollLeft += e.deltaY;

    // Reset user scrolling flag after a delay
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 150);
  }, []);


  return (
    <div className="tab-bar">
      <div className="tabs-container" ref={tabsContainerRef} onWheel={handleWheel}>
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            canClose={canCloseTab}
            onSelect={setActiveTab}
            onClose={closeTab}
          />
        ))}
      </div>
      <button className="tab-add" onClick={createTab} title="New tab (⌘T)">
        +
      </button>
      <button
        className={`pin-button ${pinned ? "pinned" : ""}`}
        onClick={togglePin}
        title={pinned ? "Unpin window (⌘`)" : "Pin window (⌘`)"}
      >
        <PinIcon />
      </button>
      {settingsButton}
    </div>
  );
}
