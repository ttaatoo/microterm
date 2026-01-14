import { describe, it, expect, beforeEach } from "vitest";
import { getTerminalTheme } from "./theme";

// Clear the theme cache before each test to avoid test interdependence
beforeEach(() => {
  // Since we can't access the cache directly, we'll work around it
  // by testing each scenario independently
});

describe("getTerminalTheme", () => {
  describe("Theme Generation", () => {
    it("should return theme with correct base colors", () => {
      const theme = getTerminalTheme(0.95);

      expect(theme).toMatchObject({
        foreground: "#abb2bf",
        cursor: "#528bff",
        cursorAccent: "#282c34",
        selectionBackground: "#abb2bf30",
        selectionForeground: "#ffffff",
        black: "#3f4451",
        red: "#e05561",
        green: "#8cc265",
        yellow: "#d18f52",
        blue: "#4aa5f0",
        magenta: "#c162de",
        cyan: "#42b3c2",
        white: "#d7dae0",
        brightBlack: "#4f5666",
        brightRed: "#ff616e",
        brightGreen: "#a5e075",
        brightYellow: "#f0a45d",
        brightBlue: "#4dc4ff",
        brightMagenta: "#de73ff",
        brightCyan: "#4cd1e0",
        brightWhite: "#e6e6e6",
      });
    });

    it("should generate correct background with opacity", () => {
      const theme = getTerminalTheme(0.95);
      expect(theme.background).toBe("rgba(0, 0, 0, 0.95)");
    });

    it("should handle full opacity", () => {
      const theme = getTerminalTheme(1.0);
      expect(theme.background).toBe("rgba(0, 0, 0, 1)");
    });

    it("should handle minimum opacity", () => {
      const theme = getTerminalTheme(0.3);
      expect(theme.background).toBe("rgba(0, 0, 0, 0.3)");
    });

    it("should handle zero opacity", () => {
      const theme = getTerminalTheme(0);
      expect(theme.background).toBe("rgba(0, 0, 0, 0)");
    });
  });

  describe("Opacity Clamping", () => {
    it("should clamp opacity above 1 to 1", () => {
      const theme = getTerminalTheme(1.5);
      expect(theme.background).toBe("rgba(0, 0, 0, 1)");
    });

    it("should clamp opacity below 0 to 0", () => {
      const theme = getTerminalTheme(-0.5);
      expect(theme.background).toBe("rgba(0, 0, 0, 0)");
    });

    it("should handle very large opacity values", () => {
      const theme = getTerminalTheme(999);
      expect(theme.background).toBe("rgba(0, 0, 0, 1)");
    });

    it("should handle very small opacity values", () => {
      const theme = getTerminalTheme(-999);
      expect(theme.background).toBe("rgba(0, 0, 0, 0)");
    });
  });

  describe("Caching", () => {
    it("should cache themes for same opacity", () => {
      const theme1 = getTerminalTheme(0.95);
      const theme2 = getTerminalTheme(0.95);

      // Should return exact same object reference
      expect(theme1).toBe(theme2);
    });

    it("should cache themes for rounded opacity values", () => {
      // These should all round to the same cache key (85)
      const theme1 = getTerminalTheme(0.85);
      const theme2 = getTerminalTheme(0.849);
      const theme3 = getTerminalTheme(0.851);

      // All should be the same cached object
      expect(theme1).toBe(theme2);
      expect(theme2).toBe(theme3);
    });

    it("should create different themes for different opacity values", () => {
      const theme1 = getTerminalTheme(0.9);
      const theme2 = getTerminalTheme(0.8);

      expect(theme1).not.toBe(theme2);
      expect(theme1.background).not.toBe(theme2.background);
    });

    it("should cache min and max opacity themes", () => {
      const theme1Min = getTerminalTheme(0);
      const theme2Min = getTerminalTheme(-1);
      expect(theme1Min).toBe(theme2Min);

      const theme1Max = getTerminalTheme(1);
      const theme2Max = getTerminalTheme(2);
      expect(theme1Max).toBe(theme2Max);
    });
  });

  describe("Precision", () => {
    it("should handle decimal precision correctly", () => {
      const theme1 = getTerminalTheme(0.951);
      const theme2 = getTerminalTheme(0.949);

      // Should round to same value (0.95)
      expect(theme1).toBe(theme2);
    });

    it("should differentiate close but distinct opacity values", () => {
      const theme1 = getTerminalTheme(0.94);
      const theme2 = getTerminalTheme(0.95);

      expect(theme1).not.toBe(theme2);
      expect(theme1.background).toBe("rgba(0, 0, 0, 0.94)");
      expect(theme2.background).toBe("rgba(0, 0, 0, 0.95)");
    });

    it("should handle floating point edge cases", () => {
      const theme = getTerminalTheme(0.1 + 0.2); // 0.30000000000000004
      expect(theme.background).toMatch(/rgba\(0, 0, 0, 0\.3\d*\)/);
    });
  });

  describe("Theme Immutability", () => {
    it("should return same reference for same opacity", () => {
      const theme1 = getTerminalTheme(0.88);
      const theme2 = getTerminalTheme(0.88);

      // Should return same cached object
      expect(theme1).toBe(theme2);
    });

    it("should preserve base colors", () => {
      const theme = getTerminalTheme(0.95);

      expect(theme.foreground).toBe("#abb2bf");
      expect(theme.cursor).toBe("#528bff");
      // ... all other colors should match BASE_THEME
    });
  });

  describe("Common Opacity Values", () => {
    it("should handle default opacity (0.96)", () => {
      const theme = getTerminalTheme(0.96);
      expect(theme.background).toBe("rgba(0, 0, 0, 0.96)");
    });

    it("should handle minimum recommended opacity (0.3)", () => {
      const theme = getTerminalTheme(0.3);
      expect(theme.background).toBe("rgba(0, 0, 0, 0.3)");
    });

    it("should handle common opacity values", () => {
      const opacities = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

      opacities.forEach((opacity) => {
        const theme = getTerminalTheme(opacity);
        expect(theme.background).toBe(`rgba(0, 0, 0, ${opacity})`);
      });
    });
  });

  describe("Cache Size", () => {
    it("should cache up to 101 distinct themes (0.00 to 1.00)", () => {
      const themes = new Set();

      for (let i = 0; i <= 100; i++) {
        const opacity = i / 100;
        const theme = getTerminalTheme(opacity);
        themes.add(theme);
      }

      // Should have cached 101 distinct themes
      expect(themes.size).toBe(101);
    });

    it("should reuse cached themes efficiently", () => {
      // Generate themes multiple times
      const firstRound = [];
      for (let i = 0; i <= 10; i++) {
        firstRound.push(getTerminalTheme(i / 10));
      }

      const secondRound: ReturnType<typeof getTerminalTheme>[] = [];
      for (let i = 0; i <= 10; i++) {
        secondRound.push(getTerminalTheme(i / 10));
      }

      // All themes should be identical (same references)
      firstRound.forEach((theme, index) => {
        expect(theme).toBe(secondRound[index]);
      });
    });
  });

  describe("Type Safety", () => {
    it("should return TerminalTheme type with all required fields", () => {
      const theme = getTerminalTheme(0.95);

      // Check all required fields exist
      expect(theme).toHaveProperty("foreground");
      expect(theme).toHaveProperty("cursor");
      expect(theme).toHaveProperty("cursorAccent");
      expect(theme).toHaveProperty("selectionBackground");
      expect(theme).toHaveProperty("selectionForeground");
      expect(theme).toHaveProperty("background");
      expect(theme).toHaveProperty("black");
      expect(theme).toHaveProperty("red");
      expect(theme).toHaveProperty("green");
      expect(theme).toHaveProperty("yellow");
      expect(theme).toHaveProperty("blue");
      expect(theme).toHaveProperty("magenta");
      expect(theme).toHaveProperty("cyan");
      expect(theme).toHaveProperty("white");
      expect(theme).toHaveProperty("brightBlack");
      expect(theme).toHaveProperty("brightRed");
      expect(theme).toHaveProperty("brightGreen");
      expect(theme).toHaveProperty("brightYellow");
      expect(theme).toHaveProperty("brightBlue");
      expect(theme).toHaveProperty("brightMagenta");
      expect(theme).toHaveProperty("brightCyan");
      expect(theme).toHaveProperty("brightWhite");
    });
  });
});
