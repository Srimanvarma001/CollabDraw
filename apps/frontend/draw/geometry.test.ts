import { describe, expect, it } from "vitest";
import { getBounds, hitTest, isPointNearShape, translateShape, unionBounds } from "./geometry";
import { Shape } from "./shapes";

const base = { strokeColor: "#fff", strokeWidth: 2 };

describe("isPointNearShape", () => {
    it("handles rectangles drawn right-to-left (negative width)", () => {
        const rect: Shape = { ...base, id: "r", type: "rect", x: 100, y: 100, width: -50, height: -50 };
        expect(isPointNearShape(75, 75, rect, 0)).toBe(true);
        expect(isPointNearShape(150, 150, rect, 0)).toBe(false);
    });

    it("hits a circle on its outline only", () => {
        const circle: Shape = { ...base, id: "c", type: "circle", centerX: 0, centerY: 0, radius: 10 };
        expect(isPointNearShape(10, 0, circle, 1)).toBe(true);
        expect(isPointNearShape(0, 0, circle, 1)).toBe(false);
    });

    it("hits along a pencil stroke", () => {
        const pencil: Shape = { ...base, id: "p", type: "pencil", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] };
        expect(isPointNearShape(5, 1, pencil, 2)).toBe(true);
        expect(isPointNearShape(5, 10, pencil, 2)).toBe(false);
    });
});

describe("hitTest", () => {
    it("returns the topmost (last drawn) shape", () => {
        const a: Shape = { ...base, id: "a", type: "rect", x: 0, y: 0, width: 10, height: 10 };
        const b: Shape = { ...base, id: "b", type: "rect", x: 5, y: 5, width: 10, height: 10 };
        expect(hitTest([a, b], 7, 7, 0)?.id).toBe("b");
        expect(hitTest([a, b], 1, 1, 0)?.id).toBe("a");
        expect(hitTest([a, b], 50, 50, 0)).toBeNull();
    });
});

describe("translateShape", () => {
    it("moves every point of a shape", () => {
        const line: Shape = { ...base, id: "l", type: "line", startX: 0, startY: 0, endX: 10, endY: 10 };
        expect(translateShape(line, 5, -5)).toMatchObject({ startX: 5, startY: -5, endX: 15, endY: 5 });
    });

    it("keeps the id", () => {
        const text: Shape = { id: "t", type: "text", x: 0, y: 0, text: "hi", fontSize: 10, strokeColor: "#fff" };
        expect(translateShape(text, 1, 1).id).toBe("t");
    });
});

describe("bounds", () => {
    it("unions the bounds of several shapes", () => {
        const a: Shape = { ...base, id: "a", type: "circle", centerX: 0, centerY: 0, radius: 5 };
        const b: Shape = { ...base, id: "b", type: "line", startX: 10, startY: 10, endX: 20, endY: 30 };
        expect(getBounds(a)).toEqual({ minX: -5, minY: -5, maxX: 5, maxY: 5 });
        expect(unionBounds([a, b])).toEqual({ minX: -5, minY: -5, maxX: 20, maxY: 30 });
        expect(unionBounds([])).toBeNull();
    });
});
