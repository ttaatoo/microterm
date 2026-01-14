import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Onboarding from "./Onboarding";

// Mock CSS modules
vi.mock("./Onboarding.css", () => ({
  onboardingOverlay: "onboarding-overlay",
  onboardingPanel: "onboarding-panel",
  onboardingHeader: "onboarding-header",
  onboardingTitle: "onboarding-title",
  onboardingSubtitle: "onboarding-subtitle",
  onboardingContent: "onboarding-content",
  onboardingItem: "onboarding-item",
  onboardingIcon: "onboarding-icon",
  onboardingText: "onboarding-text",
  onboardingKbd: "onboarding-kbd",
  onboardingFooter: "onboarding-footer",
  onboardingButton: "onboarding-button",
}));

describe("Onboarding", () => {
  it("should render welcome message", () => {
    const onComplete = vi.fn();
    render(<Onboarding onComplete={onComplete} />);
    expect(screen.getByText("Welcome to µTerm")).toBeInTheDocument();
    expect(screen.getByText("A lightweight menubar terminal")).toBeInTheDocument();
  });

  it("should render all onboarding items", () => {
    const onComplete = vi.fn();
    render(<Onboarding onComplete={onComplete} />);
    expect(screen.getByText("Quick Access")).toBeInTheDocument();
    expect(screen.getByText("Global Shortcut")).toBeInTheDocument();
    expect(screen.getByText("Hide Window")).toBeInTheDocument();
    expect(screen.getByText("Customize")).toBeInTheDocument();
  });

  it("should render Get Started button", () => {
    const onComplete = vi.fn();
    render(<Onboarding onComplete={onComplete} />);
    expect(screen.getByText("Get Started")).toBeInTheDocument();
  });

  it("should call onComplete when Get Started button is clicked", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Onboarding onComplete={onComplete} />);
    const button = screen.getByText("Get Started");
    await user.click(button);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("should call onComplete when overlay is clicked", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const { container } = render(<Onboarding onComplete={onComplete} />);
    const overlay = container.querySelector(".onboarding-overlay");
    expect(overlay).toBeInTheDocument();
    if (overlay) {
      await user.click(overlay);
      expect(onComplete).toHaveBeenCalledTimes(1);
    }
  });

  it("should not call onComplete when panel is clicked", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const { container } = render(<Onboarding onComplete={onComplete} />);
    const panel = container.querySelector(".onboarding-panel");
    expect(panel).toBeInTheDocument();
    if (panel) {
      await user.click(panel);
      expect(onComplete).not.toHaveBeenCalled();
    }
  });

  it("should render keyboard shortcuts", () => {
    const onComplete = vi.fn();
    render(<Onboarding onComplete={onComplete} />);
    expect(screen.getByText("⌘⇧T")).toBeInTheDocument();
    expect(screen.getByText("ESC")).toBeInTheDocument();
  });
});
