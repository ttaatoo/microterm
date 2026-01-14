import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PinIcon } from "./PinIcon";

describe("PinIcon", () => {
  it("should render an SVG element", () => {
    const { container } = render(<PinIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("should have correct viewBox", () => {
    const { container } = render(<PinIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
  });

  it("should have stroke attributes", () => {
    const { container } = render(<PinIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("fill", "none");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("stroke-width", "2");
    expect(svg).toHaveAttribute("stroke-linecap", "round");
    expect(svg).toHaveAttribute("stroke-linejoin", "round");
  });

  it("should have aria-hidden attribute", () => {
    const { container } = render(<PinIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("should contain path elements", () => {
    const { container } = render(<PinIcon />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);
  });
});
