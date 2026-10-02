import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common";

const db = vi.hoisted(() => ({
    prismaClient: {
        room: { findUnique: vi.fn() },
        roomMember: { findUnique: vi.fn() },
        user: { findUnique: vi.fn() },
        chat: { create: vi.fn() },
    },
}));
vi.mock("@repo/db", async () => {
    // Use the real access rules, running against the mocked client.
    const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
    return {
        ...db,
        canAccessRoom: (room: any, userId: string | undefined) => actual.canAccessRoom(room, userId, db.prismaClient as any),
    };
});

const { createWsServer, CLOSE_UNAUTHORIZED, normalizeRoomMessage, MAX_CHAT_LENGTH } = await import("../src/server.js");
const prisma = db.prismaClient;

let wss: WebSocketServer;
let url: string;
const open: WebSocket[] = [];

beforeAll(async () => {
    wss = createWsServer({ port: 0 });
    await new Promise((resolve) => wss.once("listening", resolve));
    url = `ws://localhost:${(wss.address() as AddressInfo).port}`;
});

afterAll(async () => {
    open.forEach((ws) => ws.terminate());
    await new Promise((resolve) => wss.close(resolve));
});

beforeEach(() => {
    vi.clearAllMocks();
    prisma.room.findUnique.mockImplementation(async ({ where }: { where: { slug: string } }) =>
        where.slug === "missing" ? null
            : { id: 1, slug: where.slug, adminId: "owner", isPrivate: where.slug.startsWith("private") });
    prisma.roomMember.findUnique.mockImplementation(async ({ where }: any) =>
        where.roomId_userId.userId === "member" ? { id: 1 } : null);
    prisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({ name: `Name of ${where.id}` }));
    prisma.chat.create.mockResolvedValue({});
});

/** A test client that records everything it receives. */
async function connect(userId: string | null) {
    const token = userId ? jwt.sign({ userId }, JWT_SECRET) : "bad";
    const ws = new WebSocket(`${url}?token=${token}`);
    open.push(ws);
    const received: any[] = [];
    ws.on("message", (data) => received.push(JSON.parse(data.toString())));

    const client = {
        ws,
        received,
        send: (msg: object) => ws.send(JSON.stringify(msg)),
        /** Waits until a message matching `pred` arrives. */
        waitFor: (pred: (m: any) => boolean) => new Promise<any>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`timed out; got ${JSON.stringify(received)}`)), 2000);
            const check = () => {
                const found = received.find(pred);
                if (found) {
                    clearTimeout(timer);
                    ws.off("message", check);
                    resolve(found);
                }
            };
            ws.on("message", check);
            check();
        }),
        join: async (roomId: string) => {
            client.send({ type: "join_room", roomId });
            return client.waitFor((m) => m.type === "joined" || m.type === "error");
        },
    };
    if (userId) await new Promise((resolve) => ws.once("open", resolve));
    return client;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
const lastPresence = (c: { received: any[] }) =>
    [...c.received].reverse().find((m) => m.type === "presence")?.users.map((u: any) => u.userId).sort();

describe("ws-backend", () => {
    it("closes connections with a bad token", async () => {
        const client = await connect(null);
        const code = await new Promise((resolve) => client.ws.once("close", resolve));
        expect(code).toBe(CLOSE_UNAUTHORIZED);
    });

    it("refuses to join a room that does not exist", async () => {
        const a = await connect("a");
        const reply = await a.join("missing");
        expect(reply).toMatchObject({ type: "error", code: "room_not_found" });
    });

    it("only lets the admin and members join a private room", async () => {
        expect(await (await connect("outsider")).join("private-room")).toMatchObject({ type: "error", code: "forbidden" });
        expect(await (await connect("owner")).join("private-room")).toMatchObject({ type: "joined" });
        expect(await (await connect("member")).join("private-room")).toMatchObject({ type: "joined" });
    });

    it("does not store ops for a room the sender has not joined", async () => {
        const a = await connect("a");
        a.send({ type: "chat", roomId: "r1", message: JSON.stringify({ op: "delete", ids: ["x"] }) });
        await a.waitFor((m) => m.code === "not_in_room");
        expect(prisma.chat.create).not.toHaveBeenCalled();
    });

    it("stores ops and sends them to everyone in the room except the sender", async () => {
        const a = await connect("a");
        const b = await connect("b");
        const outsider = await connect("c");
        await a.join("r1");
        await b.join("r1");
        await outsider.join("r2");

        const message = JSON.stringify({ op: "add", shape: { id: "s1", type: "rect" } });
        a.send({ type: "chat", roomId: "r1", message });

        await b.waitFor((m) => m.type === "chat");
        await settle();
        expect(prisma.chat.create).toHaveBeenCalledWith({ data: { roomId: "r1", message, userId: "a" } });
        expect(a.received.some((m) => m.type === "chat")).toBe(false);
        expect(outsider.received.some((m) => m.type === "chat")).toBe(false);
    });

    it("rejects malformed drawing messages", async () => {
        const a = await connect("a");
        await a.join("r1");
        a.send({ type: "chat", roomId: "r1", message: "not json" });
        a.send({ type: "chat", roomId: "r1", message: JSON.stringify({ op: "drop-table" }) });
        await settle();
        expect(prisma.chat.create).not.toHaveBeenCalled();
    });

    it("sends presence to the user who joins, with names from the database", async () => {
        const a = await connect("a");
        await a.join("fresh-room");
        const presence = await a.waitFor((m) => m.type === "presence");
        expect(presence.users).toEqual([{ userId: "a", userName: "Name of a" }]);
    });

    it("keeps a user present while they still have another tab open", async () => {
        const tab1 = await connect("a");
        const tab2 = await connect("a");
        const watcher = await connect("w");
        await watcher.join("presence-room");
        await tab1.join("presence-room");
        await tab2.join("presence-room");
        await settle();
        expect(lastPresence(watcher)).toEqual(["a", "w"]);

        tab1.ws.close();
        await settle();
        expect(lastPresence(watcher)).toEqual(["a", "w"]);

        tab2.ws.close();
        await settle();
        expect(lastPresence(watcher)).toEqual(["w"]);
    });

    it("stores chat messages and echoes them to the sender too", async () => {
        const a = await connect("a");
        const b = await connect("b");
        await a.join("chat-room");
        await b.join("chat-room");
        a.send({ type: "chat", roomId: "chat-room", message: JSON.stringify({ op: "chat", text: "hello" }) });
        const mine = await a.waitFor((m) => m.type === "chat");
        const theirs = await b.waitFor((m) => m.type === "chat");
        expect(JSON.parse(mine.message)).toMatchObject({ text: "hello", userName: "Name of a" });
        expect(theirs.message).toBe(mine.message);
        expect(prisma.chat.create).toHaveBeenCalledTimes(1);
    });

    it("relays cursors to others only", async () => {
        const a = await connect("a");
        const b = await connect("b");
        await a.join("cursor-room");
        await b.join("cursor-room");
        a.send({ type: "cursor", roomId: "cursor-room", cursor: { x: 1, y: 2 } });
        const cursor = await b.waitFor((m) => m.type === "cursor");
        expect(cursor).toMatchObject({ userId: "a", cursor: { x: 1, y: 2 } });
        await settle();
        expect(a.received.some((m) => m.type === "cursor")).toBe(false);
    });

    it("processes a join before the ops sent right after it", async () => {
        // A slow DB lookup must not let the following op skip the membership check.
        prisma.room.findUnique.mockImplementation(async ({ where }: { where: { slug: string } }) => {
            await new Promise((r) => setTimeout(r, 30));
            return { id: 1, slug: where.slug, adminId: "owner", isPrivate: false };
        });
        const a = await connect("a");
        a.send({ type: "join_room", roomId: "slow" });
        a.send({ type: "chat", roomId: "slow", message: JSON.stringify({ op: "delete", ids: ["x"] }) });
        await settle();
        await settle();
        expect(prisma.chat.create).toHaveBeenCalledTimes(1);
    });
});

describe("normalizeRoomMessage", () => {
    const sender = { userId: "u1", userName: "Ann" };

    it("passes drawing ops through unchanged", () => {
        const message = JSON.stringify({ op: "update", shape: {} });
        expect(normalizeRoomMessage(message, sender)).toEqual({ message, isChat: false });
    });

    it("rejects unknown ops and non-strings", () => {
        expect(normalizeRoomMessage(JSON.stringify({ shape: {} }), sender)).toBeNull();
        expect(normalizeRoomMessage(42, sender)).toBeNull();
    });

    it("rebuilds chat messages with the real sender and a timestamp", () => {
        const forged = JSON.stringify({ op: "chat", text: "  hi  ", userId: "someone-else", userName: "Admin" });
        const result = normalizeRoomMessage(forged, sender)!;
        expect(result.isChat).toBe(true);
        const data = JSON.parse(result.message);
        expect(data).toMatchObject({ op: "chat", text: "hi", userId: "u1", userName: "Ann" });
        expect(typeof data.id).toBe("string");
        expect(Date.parse(data.sentAt)).not.toBeNaN();
    });

    it("drops empty chat messages and truncates long ones", () => {
        expect(normalizeRoomMessage(JSON.stringify({ op: "chat", text: "   " }), sender)).toBeNull();
        const long = normalizeRoomMessage(JSON.stringify({ op: "chat", text: "x".repeat(5000) }), sender)!;
        expect(JSON.parse(long.message).text).toHaveLength(MAX_CHAT_LENGTH);
    });
});
