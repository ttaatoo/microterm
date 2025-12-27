import { useTabContext } from "@/contexts/TabContext";
import { useCallback, useEffect, useRef, type ReactNode } from "react";

interface TabBarProps {
  settingsButton?: ReactNode;
}

export default function TabBar({ settingsButton }: TabBarProps) {
  const { tabs, activeTabId, createTab, closeTab, setActiveTab, canCloseTab } =
    useTabContext();
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
      const activeTabElement = tabsContainerRef.current?.querySelector('.tab-active');
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
      <div
        className="tabs-container"
        ref={tabsContainerRef}
        onWheel={handleWheel}
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? "tab-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-title">{tab.number}: {tab.title}</span>
            {canCloseTab && (
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                title="Close tab"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <button className="tab-add" onClick={createTab} title="New tab (⌘T)">
        +
      </button>
      {settingsButton}
    </div>
  );
}
