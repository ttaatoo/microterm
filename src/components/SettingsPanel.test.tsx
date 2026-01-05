import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import SettingsPanel from "./SettingsPanel";
import { MIN_OPACITY, MAX_OPACITY, MIN_FONT_SIZE, MAX_FONT_SIZE } from "@/lib/settings";

// Mock Tauri's autostart plugin
vi.mock("@tauri-apps/plugin-autostart", () => ({
  enable: vi.fn(),
  disable: vi.fn(),
  isEnabled: vi.fn().mockResolvedValue(false),
}));

describe("SettingsPanel", () => {
  const mockOnClose = vi.fn();
  const mockOnSettingsChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset window.__TAURI__ for consistent testing
    (window as Window & { __TAURI__?: unknown }).__TAURI__ = undefined;
  });

  const renderSettingsPanel = async (isOpen: boolean) => {
    let result;
    await act(async () => {
      result = render(
        <SettingsPanel
          isOpen={isOpen}
          onClose={mockOnClose}
          onSettingsChange={mockOnSettingsChange}
        />
      );
    });
    return result;
  };

  describe("rendering", () => {
    it("should not render when isOpen is false", async () => {
      await renderSettingsPanel(false);
      expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    });

    it("should render when isOpen is true", async () => {
      await renderSettingsPanel(true);
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    it("should render opacity slider", async () => {
      await renderSettingsPanel(true);
      expect(screen.getByText("Background Opacity")).toBeInTheDocument();
    });

    it("should render font size slider", async () => {
      await renderSettingsPanel(true);
      expect(screen.getByText("Font Size")).toBeInTheDocument();
    });

    it("should render close button", async () => {
      await renderSettingsPanel(true);
      expect(screen.getByText("×")).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("should call onClose when close button is clicked", async () => {
      await renderSettingsPanel(true);
      await act(async () => {
        fireEvent.click(screen.getByText("×"));
      });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when overlay is clicked", async () => {
      await renderSettingsPanel(true);
      const overlay = screen.getByTestId("settings-overlay");
      await act(async () => {
        fireEvent.click(overlay);
      });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should not call onClose when panel content is clicked", async () => {
      await renderSettingsPanel(true);
      const panel = screen.getByTestId("settings-panel");
      await act(async () => {
        fireEvent.click(panel);
      });
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("should call onClose when ESC key is pressed", async () => {
      await renderSettingsPanel(true);
      await act(async () => {
        fireEvent.keyDown(document, { key: "Escape" });
      });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should not respond to ESC when panel is closed", async () => {
      await renderSettingsPanel(false);
      await act(async () => {
        fireEvent.keyDown(document, { key: "Escape" });
      });
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("opacity slider", () => {
    it("should display current opacity value", async () => {
      await renderSettingsPanel(true);
      // Default opacity is 90%
      expect(screen.getByText("90%")).toBeInTheDocument();
    });

    it("should call onSettingsChange when opacity changes", async () => {
      await renderSettingsPanel(true);
      const sliders = screen.getAllByRole("slider");
      const opacitySlider = sliders[0];

      await act(async () => {
        fireEvent.change(opacitySlider, { target: { value: "0.5" } });
      });
      expect(mockOnSettingsChange).toHaveBeenCalled();
      expect(mockOnSettingsChange.mock.calls[0][0].opacity).toBe(0.5);
    });

    it("should have correct min/max attributes", async () => {
      await renderSettingsPanel(true);
      const sliders = screen.getAllByRole("slider");
      const opacitySlider = sliders[0];

      expect(opacitySlider).toHaveAttribute("min", String(MIN_OPACITY));
      expect(opacitySlider).toHaveAttribute("max", String(MAX_OPACITY));
    });
  });

  describe("font size slider", () => {
    it("should display current font size value", async () => {
      await renderSettingsPanel(true);
      // Default font size is 13px
      expect(screen.getByText("13px")).toBeInTheDocument();
    });

    it("should call onSettingsChange when font size changes", async () => {
      await renderSettingsPanel(true);
      const sliders = screen.getAllByRole("slider");
      const fontSizeSlider = sliders[1];

      await act(async () => {
        fireEvent.change(fontSizeSlider, { target: { value: "16" } });
      });
      expect(mockOnSettingsChange).toHaveBeenCalled();
      expect(mockOnSettingsChange.mock.calls[0][0].fontSize).toBe(16);
    });

    it("should have correct min/max attributes", async () => {
      await renderSettingsPanel(true);
      const sliders = screen.getAllByRole("slider");
      const fontSizeSlider = sliders[1];

      expect(fontSizeSlider).toHaveAttribute("min", String(MIN_FONT_SIZE));
      expect(fontSizeSlider).toHaveAttribute("max", String(MAX_FONT_SIZE));
    });

    it("should show font size range in hint", async () => {
      await renderSettingsPanel(true);
      expect(
        screen.getByText(`Adjust the terminal font size (${MIN_FONT_SIZE}-${MAX_FONT_SIZE}px)`)
      ).toBeInTheDocument();
    });
  });

  describe("settings persistence", () => {
    it("should load saved opacity from localStorage", async () => {
      localStorage.setItem(
        "microterm-settings",
        JSON.stringify({ opacity: 0.7, fontSize: 13 })
      );

      await renderSettingsPanel(true);
      expect(screen.getByText("70%")).toBeInTheDocument();
    });

    it("should load saved font size from localStorage", async () => {
      localStorage.setItem(
        "microterm-settings",
        JSON.stringify({ opacity: 0.9, fontSize: 18 })
      );

      await renderSettingsPanel(true);
      expect(screen.getByText("18px")).toBeInTheDocument();
    });

    it("should save settings when changed", async () => {
      await renderSettingsPanel(true);
      const sliders = screen.getAllByRole("slider");

      await act(async () => {
        fireEvent.change(sliders[0], { target: { value: "0.6" } });
      });

      const saved = JSON.parse(localStorage.getItem("microterm-settings")!);
      expect(saved.opacity).toBe(0.6);
    });
  });

  describe("global shortcut", () => {
    it("should display default shortcut", async () => {
      await renderSettingsPanel(true);
      // Default shortcut is displayed with symbols
      expect(screen.getByText("Global Shortcut")).toBeInTheDocument();
    });

    it("should have shortcut toggle enabled by default", async () => {
      await renderSettingsPanel(true);
      const checkboxes = screen.getAllByRole("checkbox");
      // First checkbox is for shortcut enabled
      expect(checkboxes[0]).toBeChecked();
    });
  });
});
