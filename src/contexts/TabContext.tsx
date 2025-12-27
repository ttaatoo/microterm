import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export interface Tab {
  id: string;
  title: string;
  number: number;
  sessionId: string | null;
}

interface TabContextValue {
  tabs: Tab[];
  activeTabId: string;
  createTab: () => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTabSessionId: (tabId: string, sessionId: string) => void;
  updateTabTitle: (tabId: string, title: string) => void;
  canCloseTab: boolean;
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
  sessionId: null,
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
        sessionId: null,
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

  const updateTabSessionId = useCallback((tabId: string, sessionId: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId ? { ...tab, sessionId } : tab
      )
    );
  }, []);

  const updateTabTitle = useCallback((tabId: string, title: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId ? { ...tab, title } : tab
      )
    );
  }, []);

  const canCloseTab = tabs.length > 1;

  const value: TabContextValue = {
    tabs,
    activeTabId,
    createTab,
    closeTab,
    setActiveTab,
    updateTabSessionId,
    updateTabTitle,
    canCloseTab,
  };

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}

export function useTabContext(): TabContextValue {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error("useTabContext must be used within a TabProvider");
  }
  return context;
}
