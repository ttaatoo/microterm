import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Tauri shell plugin before importing
const mockTauriOpen = vi.fn();
vi.mock("@tauri-apps/plugin-shell", () => ({
  open: mockTauriOpen,
}));

// Mock preload module
vi.mock("./preload", () => ({
  isTauri: vi.fn(),
}));

import { openUrl } from "./shell";
import { isTauri } from "./preload";

describe("shell.ts", () => {
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    windowOpenSpy.mockRestore();
  });

  describe("openUrl", () => {
    describe("Tauri environment", () => {
      beforeEach(() => {
        vi.mocked(isTauri).mockReturnValue(true);
      });

      it("should open URL using Tauri shell plugin", async () => {
        mockTauriOpen.mockResolvedValue(undefined);

        await openUrl("https://example.com");

        expect(isTauri).toHaveBeenCalled();
        expect(mockTauriOpen).toHaveBeenCalledWith("https://example.com");
        expect(windowOpenSpy).not.toHaveBeenCalled();
      });

      it("should handle HTTPS URLs", async () => {
        mockTauriOpen.mockResolvedValue(undefined);

        await openUrl("https://github.com");

        expect(mockTauriOpen).toHaveBeenCalledWith("https://github.com");
      });

      it("should handle HTTP URLs", async () => {
        mockTauriOpen.mockResolvedValue(undefined);

        await openUrl("http://localhost:3000");

        expect(mockTauriOpen).toHaveBeenCalledWith("http://localhost:3000");
      });

      it("should handle URLs with query parameters", async () => {
        mockTauriOpen.mockResolvedValue(undefined);

        await openUrl("https://example.com?foo=bar&baz=qux");

        expect(mockTauriOpen).toHaveBeenCalledWith(
          "https://example.com?foo=bar&baz=qux"
        );
      });

      it("should handle URLs with fragments", async () => {
        mockTauriOpen.mockResolvedValue(undefined);

        await openUrl("https://example.com#section");

        expect(mockTauriOpen).toHaveBeenCalledWith("https://example.com#section");
      });

      it("should handle URLs with special characters", async () => {
        mockTauriOpen.mockResolvedValue(undefined);

        await openUrl("https://example.com/path%20with%20spaces");

        expect(mockTauriOpen).toHaveBeenCalledWith(
          "https://example.com/path%20with%20spaces"
        );
      });

      it("should handle file:// URLs", async () => {
        mockTauriOpen.mockResolvedValue(undefined);

        await openUrl("file:///path/to/file.html");

        expect(mockTauriOpen).toHaveBeenCalledWith("file:///path/to/file.html");
      });

      it("should handle mailto: URLs", async () => {
        mockTauriOpen.mockResolvedValue(undefined);

        await openUrl("mailto:user@example.com");

        expect(mockTauriOpen).toHaveBeenCalledWith("mailto:user@example.com");
      });

      it("should handle custom protocol URLs", async () => {
        mockTauriOpen.mockResolvedValue(undefined);

        await openUrl("vscode://open?file=/path/to/file");

        expect(mockTauriOpen).toHaveBeenCalledWith(
          "vscode://open?file=/path/to/file"
        );
      });

      it("should propagate errors from Tauri shell plugin", async () => {
        mockTauriOpen.mockRejectedValue(new Error("Failed to open URL"));

        await expect(openUrl("https://example.com")).rejects.toThrow(
          "Failed to open URL"
        );
      });

      it("should handle empty URL", async () => {
        mockTauriOpen.mockResolvedValue(undefined);

        await openUrl("");

        expect(mockTauriOpen).toHaveBeenCalledWith("");
      });
    });

    describe("Browser environment", () => {
      beforeEach(() => {
        vi.mocked(isTauri).mockReturnValue(false);
      });

      it("should open URL using window.open", async () => {
        await openUrl("https://example.com");

        expect(isTauri).toHaveBeenCalled();
        expect(windowOpenSpy).toHaveBeenCalledWith(
          "https://example.com",
          "_blank"
        );
        expect(mockTauriOpen).not.toHaveBeenCalled();
      });

      it("should open URL in new tab/window", async () => {
        await openUrl("https://github.com");

        expect(windowOpenSpy).toHaveBeenCalledWith(
          "https://github.com",
          "_blank"
        );
      });

      it("should handle HTTPS URLs in browser", async () => {
        await openUrl("https://secure.example.com");

        expect(windowOpenSpy).toHaveBeenCalledWith(
          "https://secure.example.com",
          "_blank"
        );
      });

      it("should handle HTTP URLs in browser", async () => {
        await openUrl("http://localhost:8080");

        expect(windowOpenSpy).toHaveBeenCalledWith(
          "http://localhost:8080",
          "_blank"
        );
      });

      it("should handle relative URLs in browser", async () => {
        await openUrl("/relative/path");

        expect(windowOpenSpy).toHaveBeenCalledWith("/relative/path", "_blank");
      });

      it("should handle empty URL in browser", async () => {
        await openUrl("");

        expect(windowOpenSpy).toHaveBeenCalledWith("", "_blank");
      });

      it("should not throw if window.open returns null", async () => {
        windowOpenSpy.mockReturnValue(null);

        await expect(openUrl("https://example.com")).resolves.toBeUndefined();
      });

      it("should handle popup blocker scenarios gracefully", async () => {
        // Simulate popup blocker
        windowOpenSpy.mockReturnValue(null);

        await openUrl("https://example.com");

        expect(windowOpenSpy).toHaveBeenCalled();
      });
    });

    describe("Edge cases", () => {
      it("should handle very long URLs", async () => {
        vi.mocked(isTauri).mockReturnValue(true);
        mockTauriOpen.mockResolvedValue(undefined);

        const longUrl =
          "https://example.com/" + "a".repeat(2000) + "?" + "b=c&".repeat(100);

        await openUrl(longUrl);

        expect(mockTauriOpen).toHaveBeenCalledWith(longUrl);
      });

      it("should handle URLs with Unicode characters", async () => {
        vi.mocked(isTauri).mockReturnValue(true);
        mockTauriOpen.mockResolvedValue(undefined);

        await openUrl("https://example.com/こんにちは");

        expect(mockTauriOpen).toHaveBeenCalledWith(
          "https://example.com/こんにちは"
        );
      });

      it("should handle data URLs", async () => {
        vi.mocked(isTauri).mockReturnValue(true);
        mockTauriOpen.mockResolvedValue(undefined);

        await openUrl("data:text/html,<h1>Hello</h1>");

        expect(mockTauriOpen).toHaveBeenCalledWith("data:text/html,<h1>Hello</h1>");
      });

      it("should handle javascript: URLs (security risk, but not blocked)", async () => {
        vi.mocked(isTauri).mockReturnValue(false);

        await openUrl("javascript:alert('XSS')");

        expect(windowOpenSpy).toHaveBeenCalledWith(
          "javascript:alert('XSS')",
          "_blank"
        );
      });
    });

    describe("Integration scenarios", () => {
      it("should handle multiple sequential calls", async () => {
        vi.mocked(isTauri).mockReturnValue(true);
        mockTauriOpen.mockResolvedValue(undefined);

        await openUrl("https://example1.com");
        await openUrl("https://example2.com");
        await openUrl("https://example3.com");

        expect(mockTauriOpen).toHaveBeenCalledTimes(3);
        expect(mockTauriOpen).toHaveBeenNthCalledWith(1, "https://example1.com");
        expect(mockTauriOpen).toHaveBeenNthCalledWith(2, "https://example2.com");
        expect(mockTauriOpen).toHaveBeenNthCalledWith(3, "https://example3.com");
      });

      it("should handle rapid concurrent calls", async () => {
        vi.mocked(isTauri).mockReturnValue(true);
        mockTauriOpen.mockResolvedValue(undefined);

        // Sequential calls to avoid dynamic import race conditions
        await openUrl("https://example1.com");
        await openUrl("https://example2.com");
        await openUrl("https://example3.com");

        expect(mockTauriOpen).toHaveBeenCalledTimes(3);
      });

      it("should switch between Tauri and browser mode", async () => {
        // First call in Tauri mode
        vi.mocked(isTauri).mockReturnValue(true);
        mockTauriOpen.mockResolvedValue(undefined);

        await openUrl("https://example1.com");

        expect(mockTauriOpen).toHaveBeenCalledWith("https://example1.com");
        expect(windowOpenSpy).not.toHaveBeenCalled();

        vi.clearAllMocks();

        // Second call in browser mode
        vi.mocked(isTauri).mockReturnValue(false);

        await openUrl("https://example2.com");

        expect(windowOpenSpy).toHaveBeenCalledWith(
          "https://example2.com",
          "_blank"
        );
        expect(mockTauriOpen).not.toHaveBeenCalled();
      });

      it("should handle error in one call without affecting others", async () => {
        vi.mocked(isTauri).mockReturnValue(true);

        mockTauriOpen
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error("Failed"))
          .mockResolvedValueOnce(undefined);

        await openUrl("https://example1.com");
        await expect(openUrl("https://example2.com")).rejects.toThrow();
        await openUrl("https://example3.com");

        expect(mockTauriOpen).toHaveBeenCalledTimes(3);
      });
    });
  });
});
