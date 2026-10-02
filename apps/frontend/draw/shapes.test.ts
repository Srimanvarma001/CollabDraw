import { describe, expect, it } from "vitest";
import { applyOp, parseRoomMessage, replayRoom, Shape } from "./shapes";

const rect = (id: string, x = 0): Shape => ({
    id, type: "rect", x, y: 0, width: 10, height: 10, strokeColor: "#fff", strokeWidth: 2,
});

const row = (id: number, message: object) => ({ id, message: JSON.stringify(message) });

describe("applyOp", () => {
    it("adds, updates and deletes by id", () => {
        let shapes = applyOp([], { op: "add", shape: rect("a") });
        shapes = applyOp(shapes, { op: "add", shape: rect("b") });
        shapes = applyOp(shapes, { op: "update", shape: rect("a", 50) });
        expect(shapes.map((s) => s.id)).toEqual(["a", "b"]);
        expect(shapes[0]).toMatchObject({ x: 50 });

        shapes = applyOp(shapes, { op: "delete", ids: ["a"] });
        expect(shapes.map((s) => s.id)).toEqual(["b"]);
    });

    it("is idempotent, so a duplicated add does not draw twice", () => {
        let shapes = applyOp([], { op: "add", shape: rect("a") });
        shapes = applyOp(shapes, { op: "add", shape: rect("a") });
        expect(shapes).toHaveLength(1);
    });

    it("ignores updates to shapes someone else deleted", () => {
        const shapes = applyOp([], { op: "update", shape: rect("gone") });
        expect(shapes).toEqual([]);
    });

    it("does not mutate its input", () => {
        const before = [rect("a")];
        applyOp(before, { op: "delete", ids: ["a"] });
        expect(before).toHaveLength(1);
    });
});

describe("replayRoom", () => {
    it("keeps erased shapes erased after a reload", () => {
        const state = replayRoom([
            row(1, { op: "add", shape: rect("a") }),
            row(2, { op: "add", shape: rect("b") }),
            row(3, { op: "delete", ids: ["a"] }),
        ]);
        expect(state.shapes.map((s) => s.id)).toEqual(["b"]);
    });

    it("draws shapes in the order they were made", () => {
        const state = replayRoom([
            row(1, { op: "add", shape: rect("first") }),
            row(2, { op: "add", shape: rect("second") }),
        ]);
        expect(state.shapes.map((s) => s.id)).toEqual(["first", "second"]);
    });

    it("replays an undo (delete) and redo (add) of the same shape", () => {
        const state = replayRoom([
            row(1, { op: "add", shape: rect("a") }),
            row(2, { op: "delete", ids: ["a"] }),
            row(3, { op: "add", shape: rect("a") }),
        ]);
        expect(state.shapes.map((s) => s.id)).toEqual(["a"]);
    });

    it("understands legacy { shape } and { shapes } rows", () => {
        const legacyRect = { type: "rect", x: 1, y: 1, width: 5, height: 5, strokeColor: "#fff", strokeWidth: 1 };
        const state = replayRoom([
            row(1, { shape: legacyRect }),
            row(2, { shape: { ...legacyRect, x: 2 } }),
            // Old eraser snapshot: only the second shape survived.
            row(3, { shapes: [{ ...legacyRect, x: 2 }] }),
            row(4, { shape: { ...legacyRect, x: 3 } }),
        ]);
        expect(state.shapes.map((s) => (s as { x: number }).x)).toEqual([2, 3]);
        expect(new Set(state.shapes.map((s) => s.id)).size).toBe(2);
    });

    it("collects chat messages separately from shapes", () => {
        const state = replayRoom([
            row(1, { op: "chat", id: "m1", text: "hi", userId: "u1", userName: "Ann", sentAt: "2026-01-01T00:00:00.000Z" }),
            row(2, { op: "add", shape: rect("a") }),
        ]);
        expect(state.chat).toEqual([{ id: "m1", text: "hi", userId: "u1", userName: "Ann", sentAt: "2026-01-01T00:00:00.000Z" }]);
        expect(state.shapes).toHaveLength(1);
    });

    it("skips malformed rows", () => {
        const state = replayRoom([
            { id: 1, message: "not json" },
            row(2, { op: "add", shape: { type: "rect" } }),
            row(3, { op: "add", shape: rect("ok") }),
        ]);
        expect(state.shapes.map((s) => s.id)).toEqual(["ok"]);
    });
});

describe("parseRoomMessage", () => {
    it("returns nothing for unknown ops", () => {
        expect(parseRoomMessage(JSON.stringify({ op: "explode" }), "x")).toEqual([]);
    });
});
