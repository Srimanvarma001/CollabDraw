type ShapeBase = {
    id: string;
    strokeColor: string;
};

type StrokedShape = ShapeBase & { strokeWidth: number };

export type Shape =
    | (StrokedShape & { type: "rect"; x: number; y: number; width: number; height: number })
    | (StrokedShape & { type: "circle"; centerX: number; centerY: number; radius: number })
    | (StrokedShape & { type: "pencil"; points: { x: number; y: number }[] })
    | (StrokedShape & { type: "line"; startX: number; startY: number; endX: number; endY: number })
    | (StrokedShape & { type: "arrow"; startX: number; startY: number; endX: number; endY: number })
    | (ShapeBase & { type: "text"; x: number; y: number; text: string; fontSize: number });

/** Distributes Omit over the union so each variant keeps its own fields. */
export type ShapeWithoutId = Shape extends infer S ? (S extends Shape ? Omit<S, "id"> : never) : never;

export interface ChatEntry {
    text: string;
    userId: string;
    userName: string;
    sentAt: string;
}

/**
 * An operation on a room's canvas. Each one is persisted as a single row and
 * broadcast to everyone else in the room, so replaying the rows in order
 * rebuilds the canvas exactly.
 */
export type DrawOp =
    | { op: "add"; shape: Shape }
    | { op: "update"; shape: Shape }
    | { op: "delete"; ids: string[] }
    // Only produced from legacy full-canvas snapshots; never sent by current clients.
    | { op: "reset"; shapes: Shape[] };

export type RoomMessage = DrawOp | ({ op: "chat" } & ChatEntry);

export function newShapeId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    // crypto.randomUUID is only available in secure contexts (https/localhost).
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Applies an op without mutating `shapes`. Ops are idempotent, so replays are safe. */
export function applyOp(shapes: Shape[], op: DrawOp): Shape[] {
    switch (op.op) {
        case "add": {
            const index = shapes.findIndex((s) => s.id === op.shape.id);
            if (index === -1) return [...shapes, op.shape];
            const next = [...shapes];
            next[index] = op.shape;
            return next;
        }
        case "update": {
            const index = shapes.findIndex((s) => s.id === op.shape.id);
            // The shape was deleted by someone else in the meantime: keep it deleted.
            if (index === -1) return shapes;
            const next = [...shapes];
            next[index] = op.shape;
            return next;
        }
        case "delete": {
            const ids = new Set(op.ids);
            return shapes.filter((s) => !ids.has(s.id));
        }
        case "reset":
            return op.shapes;
    }
}

function isShape(value: unknown): value is ShapeWithoutId {
    return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
}

/**
 * Turns one stored/broadcast message into ops. Besides the current format this
 * understands the two legacy formats written before shapes had ids:
 * `{ shape }` (one new shape) and `{ shapes }` (a full snapshot written by the
 * old eraser). `fallbackId` is used to give legacy shapes a stable id.
 */
export function parseRoomMessage(raw: string, fallbackId: string): RoomMessage[] {
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch {
        return [];
    }
    if (typeof data !== "object" || data === null) return [];
    const msg = data as Record<string, unknown>;

    switch (msg.op) {
        case "add":
        case "update":
            if (isShape(msg.shape) && typeof (msg.shape as Shape).id === "string") {
                return [{ op: msg.op, shape: msg.shape as Shape }];
            }
            return [];
        case "delete":
            if (Array.isArray(msg.ids)) {
                return [{ op: "delete", ids: msg.ids.filter((id): id is string => typeof id === "string") }];
            }
            return [];
        case "chat":
            if (typeof msg.text === "string") {
                return [{
                    op: "chat",
                    text: msg.text,
                    userId: typeof msg.userId === "string" ? msg.userId : "",
                    userName: typeof msg.userName === "string" ? msg.userName : "Unknown",
                    sentAt: typeof msg.sentAt === "string" ? msg.sentAt : new Date(0).toISOString(),
                }];
            }
            return [];
    }

    // Legacy formats.
    if (isShape(msg.shape)) {
        return [{ op: "add", shape: { ...msg.shape, id: `legacy-${fallbackId}` } as Shape }];
    }
    if (Array.isArray(msg.shapes)) {
        // A snapshot replaces everything drawn before it.
        return [{
            op: "reset",
            shapes: msg.shapes.filter(isShape).map((shape, i) => ({ ...shape, id: `legacy-${fallbackId}-${i}` }) as Shape),
        }];
    }
    return [];
}

export interface RoomState {
    shapes: Shape[];
    chat: ChatEntry[];
}

/** Rebuilds a room from its stored messages, oldest first. */
export function replayRoom(messages: { id: number | string; message: string }[]): RoomState {
    let shapes: Shape[] = [];
    const chat: ChatEntry[] = [];
    for (const row of messages) {
        for (const msg of parseRoomMessage(row.message, String(row.id))) {
            if (msg.op === "chat") {
                const { op: _op, ...entry } = msg;
                chat.push(entry);
            } else {
                shapes = applyOp(shapes, msg);
            }
        }
    }
    return { shapes, chat };
}
