import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

export interface Tab {
  id: string;
  title: string;
  number: number;
  titleManuallySet?: boolean;
}

interface TabContextValue {
  tabs: Tab[];
  activeTabId: string;
  createTab: () => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTabTitle: (tabId: string, title: string, manuallySet?: boolean) => void;
}

const TabContext = createContext<TabContextValue | null>(null);

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Create initial tab outside component to avoid ref access during render
const INITIAL_TAB_ID = generateId();
const INITIAL_TABS: Tab[] = [{
  id: INITIAL_TAB_ID,
  title: "1",
  number: 1,
}];

// Find the smallest available terminal number
function findNextTerminalNumber(tabs: Tab[]): number {
  const usedNumbers = new Set(tabs.map((tab) => tab.number));

  let num = 1;
  while (usedNumbers.has(num)) {
    num++;
  }
  return num;
}

export function TabProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>(INITIAL_TABS);
  const [activeTabId, setActiveTabId] = useState<string>(INITIAL_TAB_ID);

  const createTab = useCallback(() => {
    const newTabId = generateId();

    setTabs((prev) => {
      const nextNum = findNextTerminalNumber(prev);
      const newTab: Tab = {
        id: newTabId,
        title: String(nextNum),
        number: nextNum,
      };
      return [...prev, newTab];
    });

    setActiveTabId(newTabId);
    return newTabId;
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      // Don't close if it's the last tab
      if (prev.length <= 1) return prev;

      const tabIndex = prev.findIndex((t) => t.id === tabId);
      if (tabIndex === -1) return prev;

      const newTabs = prev.filter((t) => t.id !== tabId);

      // If closing the active tab, switch to adjacent tab
      setActiveTabId((currentActive) => {
        if (currentActive !== tabId) return currentActive;
        // Prefer the tab to the right, or the last tab if closing rightmost
        const newIndex = Math.min(tabIndex, newTabs.length - 1);
        return newTabs[newIndex]?.id ?? "";
      });

      return newTabs;
    });
  }, []);

  const setActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const updateTabTitle = useCallback((tabId: string, title: string, manuallySet = false) => {
    setTabs((prev) => {
      // If manuallySet is false (terminal update), check if title was manually set
      if (!manuallySet) {
        const targetTab = prev.find((tab) => tab.id === tabId);
        if (targetTab?.titleManuallySet) {
          return prev; // Don't update if title was manually set
        }
      }
      const newTabs = prev.map((tab) =>
        tab.id === tabId ? { ...tab, title, titleManuallySet: manuallySet ? true : tab.titleManuallySet } : tab
      );
      return newTabs;
    });
  }, []);

  // Memoize context value to prevent unnecessary re-renders of consumers
  // Note: canCloseTab is removed from context - consumers should compute tabs.length > 1 locally
  // Stable callbacks (createTab, closeTab, setActiveTab, updateTabTitle) are omitted from deps
  // because they're wrapped in useCallback with no dependencies and never change
  const value = useMemo<TabContextValue>(
    () => ({
      tabs,
      activeTabId,
      createTab,
      closeTab,
      setActiveTab,
      updateTabTitle,
    }),
    [tabs, activeTabId, createTab, closeTab, setActiveTab, updateTabTitle]
  );

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}

export function useTabContext(): TabContextValue {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error("useTabContext must be used within a TabProvider");
  }
  return context;
}
