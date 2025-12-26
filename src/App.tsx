import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TabProvider } from "@/contexts/TabContext";
import { TerminalView } from "@/features/terminal";

export default function App() {
  return (
    <ErrorBoundary>
      <TabProvider>
        <TerminalView />
      </TabProvider>
    </ErrorBoundary>
  );
}
