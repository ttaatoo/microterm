/**
 * Terminal addon setup utilities
 *
 * Best practices from xterm.js documentation:
 * - Load addons after terminal.open() is called
 * - WebGL renderer improves performance for large buffers (1000+ lines)
 * - Canvas renderer (default) is sufficient for typical terminal use
 * - Browser WebGL context limits: Chrome/Firefox ~16, Safari ~8
 */

import { openUrl } from "@/lib/tauri";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import type { Terminal } from "@xterm/xterm";

export interface TerminalAddons {
  fitAddon: FitAddon;
  searchAddon: SearchAddon;
  webLinksAddon: WebLinksAddon;
  webglAddon?: WebglAddon;
}

export interface SetupTerminalAddonsOptions {
  /**
   * Enable WebGL renderer for improved performance with large buffers.
   * Disabled by default to avoid WebGL context limits with split panes.
   * Canvas renderer (default) is sufficient for most terminal use cases.
   */
  enableWebGL?: boolean;
}

/**
 * Creates and loads all terminal addons
 * IMPORTANT: Call this after terminal.open() is executed
 *
 * @param terminal - xterm.js Terminal instance (must be opened)
 * @param options - Configuration options
 * @returns Object containing addon instances
 */
export function setupTerminalAddons(
  terminal: Terminal,
  options: SetupTerminalAddonsOptions = {}
): TerminalAddons {
  const { enableWebGL = false } = options;

  // Core addons - always loaded
  const fitAddon = new FitAddon();
  const searchAddon = new SearchAddon();
  const webLinksAddon = new WebLinksAddon((event: MouseEvent, uri: string) => {
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      event.stopPropagation();
      openUrl(uri).catch((error) => {
        console.error("[WebLinks] Failed to open URL:", error);
      });
    }
  });

  terminal.loadAddon(fitAddon);
  terminal.loadAddon(webLinksAddon);
  terminal.loadAddon(searchAddon);

  // WebGL renderer (optional, for performance with large buffers)
  let webglAddon: WebglAddon | undefined = undefined;
  if (enableWebGL) {
    webglAddon = loadWebGLRenderer(terminal);
  }

  return { fitAddon, searchAddon, webLinksAddon, webglAddon };
}

/**
 * Loads WebGL renderer with proper error handling and restoration
 * Based on xterm.js official documentation examples
 */
function loadWebGLRenderer(terminal: Terminal): WebglAddon | undefined {
  try {
    // Note: No constructor options needed per official xterm.js examples
    const webglAddon = new WebglAddon();

    // Handle context loss (GPU crashes, driver updates, OOM, suspend/resume)
    webglAddon.onContextLoss(() => {
      console.warn("[Terminal] WebGL context lost, disposing addon");
      webglAddon.dispose();

      // Attempt restoration after delay (optional pattern from xterm.js docs)
      setTimeout(() => {
        try {
          const newWebglAddon = new WebglAddon();
          terminal.loadAddon(newWebglAddon);
          console.log("[Terminal] WebGL renderer restored");
        } catch (error) {
          console.error("[Terminal] Failed to restore WebGL:", error);
        }
      }, 2000);
    });

    terminal.loadAddon(webglAddon);
    console.log("[Terminal] WebGL renderer enabled");
    return webglAddon;

  } catch (error) {
    console.warn("[Terminal] WebGL not available, using canvas renderer:", error);
    return undefined;
  }
}
