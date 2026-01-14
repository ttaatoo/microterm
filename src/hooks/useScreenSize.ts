import { useEffect, useState } from "react";

export interface ScreenSize {
  width: number;
  height: number;
}

/**
 * Hook to get the current screen/monitor size
 * Uses Tauri API if available, otherwise falls back to window.screen
 */
export function useScreenSize(): ScreenSize | null {
  const [screenSize, setScreenSize] = useState<ScreenSize | null>(null);

  useEffect(() => {
    const getScreenSize = async () => {
      try {
        // Try to use Tauri API to get current monitor size
        if ("__TAURI__" in window) {
          const { currentMonitor } = await import("@tauri-apps/api/window");

          // Get the monitor where the window is located
          const monitor = await currentMonitor();
          if (monitor) {
            const size = monitor.size;
            const scale = monitor.scaleFactor;
            // Convert physical pixels to logical pixels
            setScreenSize({
              width: Math.floor(size.width / scale),
              height: Math.floor(size.height / scale),
            });
            return;
          }
        }
      } catch (error) {
        console.warn("Failed to get screen size from Tauri:", error);
      }

      // Fallback to window.screen (browser API)
      if (typeof window !== "undefined" && window.screen) {
        setScreenSize({
          width: window.screen.width,
          height: window.screen.height,
        });
      }
    };

    getScreenSize();

    // Listen for screen size changes (e.g., when window moves to different monitor)
    const handleResize = () => {
      getScreenSize();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return screenSize;
}
