import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GearIcon } from "./GearIcon";

describe("GearIcon", () => {
  it("should render an SVG element", () => {
    const { container } = render(<GearIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("should have correct viewBox", () => {
    const { container } = render(<GearIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
  });

  it("should have stroke attributes", () => {
    const { container } = render(<GearIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("fill", "none");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("stroke-width", "2");
    expect(svg).toHaveAttribute("stroke-linecap", "round");
    expect(svg).toHaveAttribute("stroke-linejoin", "round");
  });

  it("should contain circle and path elements", () => {
    const { container } = render(<GearIcon />);
    const circle = container.querySelector("circle");
    const path = container.querySelector("path");
    expect(circle).toBeInTheDocument();
    expect(path).toBeInTheDocument();
  });
});
