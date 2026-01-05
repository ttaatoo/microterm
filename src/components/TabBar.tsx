import { PinIcon } from "@/components/icons";
import { useTabContext, type Tab } from "@/contexts/TabContext";
import { usePinState } from "@/hooks/usePinState";
import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import * as styles from "./TabBar.css";

interface TabBarProps {
  settingsButton?: ReactNode;
}

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  canClose: boolean;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onRename: (tabId: string, newTitle: string, manuallySet?: boolean) => void;
}

// Constants
const MAX_TAB_TITLE_LENGTH = 50;
const TOOLTIP_DELAY_MS = 200;

// Memoized individual tab component to prevent re-renders when other tabs change
const TabItem = memo(function TabItem({
  tab,
  isActive,
  canClose,
  onSelect,
  onClose,
  onRename,
}: TabItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingValue, setEditingValue] = useState(tab.title);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const tabRef = useRef<HTMLDivElement>(null);
  const isEditingRef = useRef(false);
  const justRenamedRef = useRef(false);
  const isMountedRef = useRef(true);

  const handleClick = useCallback(() => {
    if (!isEditing) {
      onSelect(tab.id);
    }
  }, [onSelect, tab.id, isEditing]);

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose(tab.id);
    },
    [onClose, tab.id]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      isEditingRef.current = true;
      setIsEditing(true);
      setEditingValue(tab.title);
    },
    [tab.title]
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingValue(e.target.value);
  }, []);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        // Validate and sanitize tab title
        let trimmedValue = editingValue.trim();
        // Remove control characters
        trimmedValue = trimmedValue.replace(/[\x00-\x1F\x7F]/g, "");
        // Limit length
        if (trimmedValue.length > MAX_TAB_TITLE_LENGTH) {
          trimmedValue = trimmedValue.slice(0, MAX_TAB_TITLE_LENGTH);
        }
        if (trimmedValue) {
          justRenamedRef.current = true;
          isEditingRef.current = false;
          setIsEditing(false);
          onRename(tab.id, trimmedValue, true);
        } else {
          isEditingRef.current = false;
          setIsEditing(false);
          setEditingValue(tab.title);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        isEditingRef.current = false;
        setIsEditing(false);
        setEditingValue(tab.title);
      }
    },
    [editingValue, tab.id, tab.title, onRename]
  );

  const handleInputBlur = useCallback(() => {
    const trimmedValue = editingValue.trim();
    isEditingRef.current = false;
    setIsEditing(false);
    if (trimmedValue && trimmedValue !== tab.title) {
      onRename(tab.id, trimmedValue, true);
    } else {
      setEditingValue(tab.title);
    }
  }, [editingValue, tab.id, tab.title, onRename]);

  // Focus and select text when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Update editing value when tab title changes externally (only when not editing)
  useEffect(() => {
    if (!isEditingRef.current) {
      // If we just renamed, don't sync - the title is already correct
      if (justRenamedRef.current) {
        justRenamedRef.current = false;
        return;
      }
      setEditingValue(tab.title);
    }
  }, [tab.title]);

  // Show tooltip on hover
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTabMouseEnter = useCallback(() => {
    if (isEditing || !tabRef.current) return;

    // Small delay to avoid flickering on quick mouse movements
    tooltipTimeoutRef.current = setTimeout(() => {
      // Check if component is still mounted and ref is valid
      if (tabRef.current && isMountedRef.current) {
        const rect = tabRef.current.getBoundingClientRect();
        setTooltipPosition({
          top: rect.bottom + 8, // Position below the tab
          left: rect.left + rect.width / 2,
        });
        setShowTooltip(true);
      }
    }, TOOLTIP_DELAY_MS);
  }, [isEditing]);

  const handleTabMouseLeave = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setShowTooltip(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={tabRef}
      className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
      onClick={handleClick}
      onMouseEnter={handleTabMouseEnter}
      onMouseLeave={handleTabMouseLeave}
    >
      <span
        className={`${styles.tabTitle} ${isEditing ? styles.tabTitleHidden : ""}`}
        onDoubleClick={handleDoubleClick}
      >
        {tab.number}: {tab.title}
      </span>
      {showTooltip && !isEditing && (
        <div
          className={styles.tabTooltip}
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }}
        >
          {tab.number}: {tab.title}
        </div>
      )}
      {isEditing && (
        <input
          ref={inputRef}
          className={styles.tabTitleInput}
          value={editingValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onBlur={handleInputBlur}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {canClose && (
        <button className={styles.tabClose} onClick={handleClose} title="Close tab">
          ×
        </button>
      )}
    </div>
  );
});

export default function TabBar({ settingsButton }: TabBarProps) {
  const { tabs, activeTabId, createTab, closeTab, setActiveTab, updateTabTitle, canCloseTab } =
    useTabContext();
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
    <div className={styles.tabBar}>
      <div className={styles.tabsContainer} ref={tabsContainerRef} onWheel={handleWheel}>
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            canClose={canCloseTab}
            onSelect={setActiveTab}
            onClose={closeTab}
            onRename={updateTabTitle}
          />
        ))}
      </div>
      <button className={styles.tabAdd} onClick={createTab} title="New tab (⌘T)">
        +
      </button>
      <button
        className={`${styles.pinButton} ${pinned ? styles.pinButtonPinned : ""}`}
        onClick={togglePin}
        title={pinned ? "Unpin window (⌘`)" : "Pin window (⌘`)"}
      >
        <PinIcon />
      </button>
      {settingsButton}
    </div>
  );
}
