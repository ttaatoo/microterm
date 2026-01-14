/**
 * Terminal addon setup utilities
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

/**
 * Creates and loads all terminal addons
 * @param terminal - xterm.js Terminal instance
 * @returns Object containing addon instances
 */
export function setupTerminalAddons(terminal: Terminal): TerminalAddons {
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

  // WebGL renderer for better performance and transparency handling
  let webglAddon: WebglAddon | undefined = undefined;
  try {
    webglAddon = new WebglAddon({ preserveDrawingBuffer: true });
    webglAddon.onContextLoss(() => {
      console.warn("[Terminal] WebGL context lost, falling back to canvas renderer");
      webglAddon?.dispose();
    });
    terminal.loadAddon(webglAddon);
    console.log("[Terminal] WebGL renderer enabled");
  } catch (error) {
    console.warn("[Terminal] WebGL not available, using canvas renderer:", error);
    webglAddon = undefined;
  }

  return { fitAddon, searchAddon, webLinksAddon, webglAddon };
}
