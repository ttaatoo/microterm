import { usePaneContext } from "@/contexts/PaneContext";
import { isLeaf, type PaneBranch, type PaneLeaf, type PaneNode } from "@/lib/paneTree";
import { memo, useCallback } from "react";
import SplitDivider from "./SplitDivider";
import * as styles from "./SplitPaneContainer.css";
import XTerminal, { type XTerminalHandle } from "./XTerminal";

interface SplitPaneContainerProps {
  tabId: string;
  node: PaneNode;
  activePaneId: string;
  opacity: number;
  fontSize: number;
  isTabVisible: boolean;
  onTerminalRef: (paneId: string, handle: XTerminalHandle | null) => void;
  onSessionCreated: (paneId: string, sessionId: string) => void;
  onTitleChange: (paneId: string, title: string) => void;
  onPaneClick: (paneId: string) => void;
}

/** Recursive component that renders the pane tree */
function SplitPaneContainerInner({
  tabId,
  node,
  activePaneId,
  opacity,
  fontSize,
  isTabVisible,
  onTerminalRef,
  onSessionCreated,
  onTitleChange,
  onPaneClick,
}: SplitPaneContainerProps) {
  const { resizeSplit } = usePaneContext();

  const handleResize = useCallback(
    (branchId: string) => (newRatio: number) => {
      resizeSplit(tabId, branchId, newRatio);
    },
    [tabId, resizeSplit]
  );

  if (isLeaf(node)) {
    return (
      <LeafPane
        pane={node}
        tabId={tabId}
        isActive={node.id === activePaneId}
        opacity={opacity}
        fontSize={fontSize}
        isTabVisible={isTabVisible}
        onRef={onTerminalRef}
        onSessionCreated={onSessionCreated}
        onTitleChange={onTitleChange}
        onClick={onPaneClick}
      />
    );
  }

  // It's a branch - render both children with a divider
  const branch = node as PaneBranch;
  const isVertical = branch.direction === "vertical";
  const containerClass = isVertical
    ? styles.splitContainerVertical
    : styles.splitContainerHorizontal;

  // Calculate flex sizes based on ratio
  const firstFlex = branch.ratio;
  const secondFlex = 1 - branch.ratio;

  return (
    <div className={`${styles.splitContainer} ${containerClass}`}>
      <div
        className={styles.paneWrapper}
        style={{ flex: firstFlex }}
      >
        <SplitPaneContainerInner
          key={branch.first.id}
          tabId={tabId}
          node={branch.first}
          activePaneId={activePaneId}
          opacity={opacity}
          fontSize={fontSize}
          isTabVisible={isTabVisible}
          onTerminalRef={onTerminalRef}
          onSessionCreated={onSessionCreated}
          onTitleChange={onTitleChange}
          onPaneClick={onPaneClick}
        />
      </div>
      <SplitDivider
        direction={branch.direction}
        branchId={branch.id}
        onResize={handleResize(branch.id)}
      />
      <div
        className={styles.paneWrapper}
        style={{ flex: secondFlex }}
      >
        <SplitPaneContainerInner
          key={branch.second.id}
          tabId={tabId}
          node={branch.second}
          activePaneId={activePaneId}
          opacity={opacity}
          fontSize={fontSize}
          isTabVisible={isTabVisible}
          onTerminalRef={onTerminalRef}
          onSessionCreated={onSessionCreated}
          onTitleChange={onTitleChange}
          onPaneClick={onPaneClick}
        />
      </div>
    </div>
  );
}

/** Wrapper for leaf pane rendering XTerminal */
interface LeafPaneProps {
  pane: PaneLeaf;
  tabId: string;
  isActive: boolean;
  opacity: number;
  fontSize: number;
  isTabVisible: boolean;
  onRef: (paneId: string, handle: XTerminalHandle | null) => void;
  onSessionCreated: (paneId: string, sessionId: string) => void;
  onTitleChange: (paneId: string, title: string) => void;
  onClick: (paneId: string) => void;
}

const LeafPane = memo(function LeafPane({
  pane,
  tabId,
  isActive,
  opacity,
  fontSize,
  isTabVisible,
  onRef,
  onSessionCreated,
  onTitleChange,
  onClick,
}: LeafPaneProps) {
  const handleRef = useCallback(
    (handle: XTerminalHandle | null) => {
      onRef(pane.id, handle);
    },
    [pane.id, onRef]
  );

  const handleSessionCreated = useCallback(
    (sessionId: string) => {
      onSessionCreated(pane.id, sessionId);
    },
    [pane.id, onSessionCreated]
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      onTitleChange(pane.id, title);
    },
    [pane.id, onTitleChange]
  );

  const handleClick = useCallback(() => {
    onClick(pane.id);
  }, [pane.id, onClick]);

  return (
    <div
      className={`${styles.paneWrapper} ${isActive ? styles.paneWrapperActive : ""}`}
      style={{ width: "100%", height: "100%" }}
    >
      <XTerminal
        key={pane.id}
        ref={handleRef}
        tabId={tabId}
        paneId={pane.id}
        existingSessionId={pane.sessionId}
        isVisible={isTabVisible}
        isActivePane={isActive}
        opacity={opacity}
        fontSize={fontSize}
        onSessionCreated={handleSessionCreated}
        onTitleChange={handleTitleChange}
        onClick={handleClick}
      />
    </div>
  );
});

const SplitPaneContainer = memo(SplitPaneContainerInner);

export default SplitPaneContainer;
