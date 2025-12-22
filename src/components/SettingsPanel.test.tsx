import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SettingsPanel from "./SettingsPanel";
import { MIN_OPACITY, MAX_OPACITY, MIN_FONT_SIZE, MAX_FONT_SIZE } from "@/lib/settings";

describe("SettingsPanel", () => {
  const mockOnClose = vi.fn();
  const mockOnSettingsChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("rendering", () => {
    it("should not render when isOpen is false", () => {
      render(
        <SettingsPanel
          isOpen={false}
          onClose={mockOnClose}
          onSettingsChange={mockOnSettingsChange}
        />
      );
      expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    });

    it("should render when isOpen is true", () => {
      render(
        <SettingsPanel
          isOpen={true}
          onClose={mockOnClose}
          onSettingsChange={mockOnSettingsChange}
        />
      );
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    it("should render opacity slider", () => {
      render(
        <SettingsPanel
          isOpen={true}
          onClose={mockOnClose}
          onSettingsChange={mockOnSettingsChange}
        />
      );
      expect(screen.getByText("Background Opacity")).toBeInTheDocument();
    });

    it("should render font size slider", () => {
      render(
        <SettingsPanel
          isOpen={true}
          onClose={mockOnClose}
          onSettingsChange={mockOnSettingsChange}
        />
      );
      expect(screen.getByText("Font Size")).toBeInTheDocument();
    });

    it("should render close button", () => {
      render(
        <SettingsPanel
          isOpen={true}
          onClose={mockOnClose}
          onSettingsChange={mockOnSettingsChange}
        />
      );
      expect(screen.getByText("×")).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("should call onClose when close button is clicked", () => {
      render(
        <SettingsPanel
          isOpen={true}
          onClose={mockOnClose}
          onSettingsChange={mockOnSettingsChange}
        />
      );
      fireEvent.click(screen.getByText("×"));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when overlay is clicked", () => {
      render(
        <SettingsPanel
          isOpen={true}
          onClose={mockOnClose}
          onSettingsChange={mockOnSettingsChange}
        />
      );
      fireEvent.click(screen.getByText("Settings").closest(".settings-overlay")!);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should not call onClose when panel content is clicked", () => {
      render(
        <SettingsPanel
          isOpen={true}
          onClose={mockOnClose}
          onSettingsChange={mockOnSettingsChange}
        />
      );
      fireEvent.click(screen.getByText("Settings").closest(".settings-panel")!);
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("should call onClose when ESC key is pressed", () => {
      render(
        <SettingsPanel
          isOpen={true}
          onClose={mockOnClose}
          onSettingsChange={mockOnSettingsChange}
        />
      );
      fireEvent.keyDown(document, { key: "Escape" });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should not respond to ESC when panel is closed", () => {
      render(
        <SettingsPanel
          isOpen={false}
          onClose={mockOnClose}
          onSettingsChange={mockOnSettingsChange}
        />
      );
      fireEvent.keyDown(document, { key: "Escape" });
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("opacity slider", () => {
    it("should display current opacity value", () => {
      render(
        <SettingsPanel
          isOpen={true}
          onClose={mockOnClose}
          onSettingsChange={mockOnSettingsChange}
        />
      );
      // Default opacity is 90%
      expect(screen.getByText("90%")).toBeInTheDocument();
    });

    it("should call onSettingsChange when opacity changes", () => {
      render(
        <SettingsPanel
          isOpen={true}
          onClose={mockOnClose}
          onSettingsChange={mockOnSettingsChange}
        />
      );
      const sliders = screen.getAllByRole("slider");
      const opacitySlider = sliders[0];

      fireEvent.change(opacitySlider, { target: { value: "0.5" } });
      expect(mockOnSettingsChange).toHaveBeenCalled();
      expect(mockOnSettingsChange.mock.calls[0][0].opacity).toBe(0.5);
    });

    it("should have correct min/max attributes", () => {
      render(
        <SettingsPanel
          isOpen={true}
          onClose={mockOnClose}
          onSettingsChange={mockOnSettingsChange}
        />
      );
      const sliders = screen.getAllByRole("slider");
      const opacitySlider = sliders[0];

      expect(opacitySlider).toHaveAttribute("min", String(MIN_OPACITY));
      expect(opacitySlider).toHaveAttribute("max", String(MAX_OPACITY));
    });
  });

  describe("font size slider", () => {
    it("should display current font size value", () => {
      render(
        <SettingsPanel
          isOpen={true}
          onClose={mockOnClose}
          onSettingsChange={mockOnSettingsChange}
        />
      );
      // Default font size is 13px
      expect(screen.getByText("13px")).toBeInTheDocument();
    });

    it("should call onSettingsChange when font size changes", () => {
      render(
        <SettingsPanel
          isOpen={true}
          onClose={mockOnClose}
          onSettingsChange={mockOnSettingsChange}
        />
      );
      const sliders = screen.getAllByRole("slider");
      const fontSizeSlider = sliders[1];

      fireEvent.change(fontSizeSlider, { target: { value: "16" } });
      expect(mockOnSettingsChange).toHaveBeenCalled();
      expect(mockOnSettingsChange.mock.calls[0][0].fontSize).toBe(16);
    });

    it("should have correct min/max attributes", () => {
      render(
        <SettingsPanel
          isOpen={true}
          onClose={mockOnClose}
          onSettingsChange={mockOnSettingsChange}
        />
      );
      const sliders = screen.getAllByRole("slider");
      const fontSizeSlider = sliders[1];

      expect(fontSizeSlider).toHaveAttribute("min", String(MIN_FONT_SIZE));
      expect(fontSizeSlider).toHaveAttribute("max", String(MAX_FONT_SIZE));
    });

    it("should show font size range in hint", () => {
      render(
        <SettingsPanel
          isOpen={true}
          onClose={mockOnClose}
          onSettingsChange={mockOnSettingsChange}
        />
      );
      expect(
        screen.getByText(`Adjust the terminal font size (${MIN_FONT_SIZE}-${MAX_FONT_SIZE}px)`)
      ).toBeInTheDocument();
    });
  });

  describe("settings persistence", () => {
    it("should load saved opacity from localStorage", () => {
      localStorage.setItem(
        "microterm-settings",
        JSON.stringify({ opacity: 0.7, fontSize: 13 })
      );

      render(
        <SettingsPanel
          isOpen={true}
          onClose={mockOnClose}
          onSettingsChange={mockOnSettingsChange}
        />
      );
      expect(screen.getByText("70%")).toBeInTheDocument();
    });

    it("should load saved font size from localStorage", () => {
      localStorage.setItem(
        "microterm-settings",
        JSON.stringify({ opacity: 0.9, fontSize: 18 })
      );

      render(
        <SettingsPanel
          isOpen={true}
          onClose={mockOnClose}
          onSettingsChange={mockOnSettingsChange}
        />
      );
      expect(screen.getByText("18px")).toBeInTheDocument();
    });

    it("should save settings when changed", () => {
      render(
        <SettingsPanel
          isOpen={true}
          onClose={mockOnClose}
          onSettingsChange={mockOnSettingsChange}
        />
      );
      const sliders = screen.getAllByRole("slider");

      fireEvent.change(sliders[0], { target: { value: "0.6" } });

      const saved = JSON.parse(localStorage.getItem("microterm-settings")!);
      expect(saved.opacity).toBe(0.6);
    });
  });
});
