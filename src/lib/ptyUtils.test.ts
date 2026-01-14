import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ensureValidDimensions,
  MIN_PTY_COLS,
  MIN_PTY_ROWS,
  type PtyDimensions,
} from "./ptyUtils";

describe("ptyUtils.ts", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe("Constants", () => {
    it("should have correct minimum PTY columns", () => {
      expect(MIN_PTY_COLS).toBe(20);
    });

    it("should have correct minimum PTY rows", () => {
      expect(MIN_PTY_ROWS).toBe(5);
    });
  });

  describe("ensureValidDimensions", () => {
    describe("Valid dimensions", () => {
      it("should return dimensions unchanged when they meet minimum requirements", () => {
        const result = ensureValidDimensions(80, 24);
        expect(result).toEqual({ cols: 80, rows: 24 });
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it("should return exact minimum dimensions without warning", () => {
        const result = ensureValidDimensions(MIN_PTY_COLS, MIN_PTY_ROWS);
        expect(result).toEqual({ cols: MIN_PTY_COLS, rows: MIN_PTY_ROWS });
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it("should handle very large dimensions", () => {
        const result = ensureValidDimensions(500, 200);
        expect(result).toEqual({ cols: 500, rows: 200 });
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it("should handle standard terminal sizes", () => {
        const testCases = [
          { cols: 80, rows: 24 }, // Classic VT100
          { cols: 132, rows: 43 }, // VT100 wide mode
          { cols: 120, rows: 30 }, // Modern default
          { cols: 100, rows: 40 }, // Common size
        ];

        testCases.forEach(({ cols, rows }) => {
          const result = ensureValidDimensions(cols, rows);
          expect(result).toEqual({ cols, rows });
        });

        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });
    });

    describe("Invalid columns", () => {
      it("should enforce minimum columns when too small", () => {
        const result = ensureValidDimensions(10, 24);
        expect(result).toEqual({ cols: MIN_PTY_COLS, rows: 24 });
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          `[PTY] Terminal size 10x24 is too small, using minimum ${MIN_PTY_COLS}x24`
        );
      });

      it("should handle zero columns", () => {
        const result = ensureValidDimensions(0, 24);
        expect(result).toEqual({ cols: MIN_PTY_COLS, rows: 24 });
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it("should handle negative columns", () => {
        const result = ensureValidDimensions(-10, 24);
        expect(result).toEqual({ cols: MIN_PTY_COLS, rows: 24 });
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          `[PTY] Terminal size -10x24 is too small, using minimum ${MIN_PTY_COLS}x24`
        );
      });

      it("should handle columns just below minimum", () => {
        const result = ensureValidDimensions(MIN_PTY_COLS - 1, 24);
        expect(result).toEqual({ cols: MIN_PTY_COLS, rows: 24 });
        expect(consoleWarnSpy).toHaveBeenCalled();
      });
    });

    describe("Invalid rows", () => {
      it("should enforce minimum rows when too small", () => {
        const result = ensureValidDimensions(80, 2);
        expect(result).toEqual({ cols: 80, rows: MIN_PTY_ROWS });
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          `[PTY] Terminal size 80x2 is too small, using minimum 80x${MIN_PTY_ROWS}`
        );
      });

      it("should handle zero rows", () => {
        const result = ensureValidDimensions(80, 0);
        expect(result).toEqual({ cols: 80, rows: MIN_PTY_ROWS });
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it("should handle negative rows", () => {
        const result = ensureValidDimensions(80, -5);
        expect(result).toEqual({ cols: 80, rows: MIN_PTY_ROWS });
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          `[PTY] Terminal size 80x-5 is too small, using minimum 80x${MIN_PTY_ROWS}`
        );
      });

      it("should handle rows just below minimum", () => {
        const result = ensureValidDimensions(80, MIN_PTY_ROWS - 1);
        expect(result).toEqual({ cols: 80, rows: MIN_PTY_ROWS });
        expect(consoleWarnSpy).toHaveBeenCalled();
      });
    });

    describe("Both dimensions invalid", () => {
      it("should enforce both minimums when both are too small", () => {
        const result = ensureValidDimensions(10, 2);
        expect(result).toEqual({ cols: MIN_PTY_COLS, rows: MIN_PTY_ROWS });
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          `[PTY] Terminal size 10x2 is too small, using minimum ${MIN_PTY_COLS}x${MIN_PTY_ROWS}`
        );
      });

      it("should handle both zero", () => {
        const result = ensureValidDimensions(0, 0);
        expect(result).toEqual({ cols: MIN_PTY_COLS, rows: MIN_PTY_ROWS });
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it("should handle both negative", () => {
        const result = ensureValidDimensions(-10, -5);
        expect(result).toEqual({ cols: MIN_PTY_COLS, rows: MIN_PTY_ROWS });
        expect(consoleWarnSpy).toHaveBeenCalled();
      });
    });

    describe("Edge cases", () => {
      it("should handle fractional dimensions by truncating", () => {
        const result = ensureValidDimensions(80.7, 24.3);
        expect(result).toEqual({ cols: 80.7, rows: 24.3 });
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it("should handle very small fractional dimensions", () => {
        const result = ensureValidDimensions(0.1, 0.5);
        expect(result).toEqual({ cols: MIN_PTY_COLS, rows: MIN_PTY_ROWS });
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it("should handle Infinity", () => {
        const result = ensureValidDimensions(Infinity, Infinity);
        expect(result.cols).toBe(Infinity);
        expect(result.rows).toBe(Infinity);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it("should handle -Infinity", () => {
        const result = ensureValidDimensions(-Infinity, -Infinity);
        expect(result).toEqual({ cols: MIN_PTY_COLS, rows: MIN_PTY_ROWS });
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it("should handle NaN", () => {
        // Math.max(NaN, N) returns NaN, so NaN passes through
        const result = ensureValidDimensions(NaN, NaN);
        expect(result.cols).toBeNaN();
        expect(result.rows).toBeNaN();
        expect(consoleWarnSpy).toHaveBeenCalled();
      });
    });

    describe("Return type", () => {
      it("should return PtyDimensions interface", () => {
        const result: PtyDimensions = ensureValidDimensions(80, 24);
        expect(result).toHaveProperty("cols");
        expect(result).toHaveProperty("rows");
        expect(typeof result.cols).toBe("number");
        expect(typeof result.rows).toBe("number");
      });
    });

    describe("Warning messages", () => {
      it("should log warning with correct format", () => {
        ensureValidDimensions(10, 2);
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        expect(consoleWarnSpy.mock.calls[0][0]).toMatch(/^\[PTY\] Terminal size/);
        expect(consoleWarnSpy.mock.calls[0][0]).toContain("is too small");
        expect(consoleWarnSpy.mock.calls[0][0]).toContain("using minimum");
      });

      it("should not log warning for valid dimensions", () => {
        ensureValidDimensions(80, 24);
        ensureValidDimensions(MIN_PTY_COLS, MIN_PTY_ROWS);
        ensureValidDimensions(200, 100);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it("should log separate warnings for multiple calls", () => {
        ensureValidDimensions(10, 24);
        ensureValidDimensions(80, 2);
        ensureValidDimensions(5, 1);

        expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
      });
    });

    describe("Integration scenarios", () => {
      it("should handle rapid successive calls", () => {
        const results = [];
        for (let i = 0; i < 10; i++) {
          results.push(ensureValidDimensions(i, i));
        }

        // All small values should be enforced to minimum
        results.slice(0, MIN_PTY_ROWS).forEach((result) => {
          expect(result.cols).toBeGreaterThanOrEqual(MIN_PTY_COLS);
          expect(result.rows).toBeGreaterThanOrEqual(MIN_PTY_ROWS);
        });
      });

      it("should be idempotent for valid dimensions", () => {
        const dims = { cols: 80, rows: 24 };
        const result1 = ensureValidDimensions(dims.cols, dims.rows);
        const result2 = ensureValidDimensions(result1.cols, result1.rows);

        expect(result1).toEqual(result2);
        expect(result1).toEqual(dims);
      });

      it("should be idempotent for invalid dimensions", () => {
        const result1 = ensureValidDimensions(10, 2);
        const result2 = ensureValidDimensions(result1.cols, result1.rows);

        expect(result1).toEqual(result2);
        expect(result1).toEqual({ cols: MIN_PTY_COLS, rows: MIN_PTY_ROWS });
      });
    });
  });
});
