import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { JWT_SECRET } from "@repo/backend-common";

const db = vi.hoisted(() => {
    class PrismaClientKnownRequestError extends Error {
        code: string;
        constructor(message: string, { code }: { code: string }) {
            super(message);
            this.code = code;
        }
    }
    return {
        Prisma: { PrismaClientKnownRequestError },
        prismaClient: {
            user: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
            room: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
            roomMember: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
            chat: { findMany: vi.fn(), deleteMany: vi.fn() },
            $transaction: vi.fn(),
        },
    };
});
vi.mock("@repo/db", async () => {
    // Use the real access rules, running against the mocked client.
    const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
    return {
        ...db,
        canAccessRoom: (room: any, userId: string | undefined) => actual.canAccessRoom(room, userId, db.prismaClient as any),
        visibleRoomsWhere: actual.visibleRoomsWhere,
    };
});

const { createApp } = await import("../src/app.js");
const app = createApp({ authRateLimit: 1000 });
const prisma = db.prismaClient;

const tokenFor = (userId: string) => jwt.sign({ userId }, JWT_SECRET);
const uniqueViolation = () => new db.Prisma.PrismaClientKnownRequestError("dup", { code: "P2002" });

beforeEach(() => {
    vi.clearAllMocks();
});

describe("POST /signup", () => {
    it("returns 400 with field errors for invalid input", async () => {
        const res = await request(app).post("/signup").send({ username: "ab" });
        expect(res.status).toBe(400);
        expect(res.body.errors).toHaveProperty("password");
    });

    it("rejects passwords shorter than 8 characters", async () => {
        const res = await request(app).post("/signup").send({ username: "ann@example.com", password: "short", name: "Ann" });
        expect(res.status).toBe(400);
        expect(res.body.errors.password[0]).toMatch(/at least 8/);
    });

    it("returns 201 and the new user id", async () => {
        prisma.user.create.mockResolvedValue({ id: "u1" });
        const res = await request(app).post("/signup").send({ username: "ann@example.com", password: "password123", name: "Ann" });
        expect(res.status).toBe(201);
        expect(res.body).toEqual({ userId: "u1" });
        // The password is stored hashed.
        expect(prisma.user.create.mock.calls[0][0].data.password).not.toBe("password123");
    });

    it("returns 409 when the username is taken", async () => {
        prisma.user.create.mockRejectedValue(uniqueViolation());
        const res = await request(app).post("/signup").send({ username: "ann@example.com", password: "password123", name: "Ann" });
        expect(res.status).toBe(409);
    });

    it("returns 400 for a malformed JSON body", async () => {
        const res = await request(app).post("/signup").set("Content-Type", "application/json").send("{oops");
        expect(res.status).toBe(400);
    });
});

describe("POST /signin", () => {
    it("returns 400 for invalid input", async () => {
        const res = await request(app).post("/signin").send({});
        expect(res.status).toBe(400);
    });

    it("returns 401 for an unknown user", async () => {
        prisma.user.findFirst.mockResolvedValue(null);
        const res = await request(app).post("/signin").send({ username: "ann@example.com", password: "password123" });
        expect(res.status).toBe(401);
    });

    it("returns 401 for a wrong password", async () => {
        prisma.user.findFirst.mockResolvedValue({ id: "u1", name: "Ann", password: await bcrypt.hash("right-password", 4) });
        const res = await request(app).post("/signin").send({ username: "ann@example.com", password: "wrong-password" });
        expect(res.status).toBe(401);
    });

    it("returns a token that identifies the user", async () => {
        prisma.user.findFirst.mockResolvedValue({ id: "u1", name: "Ann", password: await bcrypt.hash("password123", 4) });
        const res = await request(app).post("/signin").send({ username: "ann@example.com", password: "password123" });
        expect(res.status).toBe(200);
        expect(res.body.name).toBe("Ann");
        const payload = jwt.verify(res.body.token, JWT_SECRET) as jwt.JwtPayload;
        expect(payload.userId).toBe("u1");
        // Tokens expire.
        expect(payload.exp).toBeGreaterThan(Date.now() / 1000);
    });

    it("rate limits repeated attempts with 429", async () => {
        const limited = createApp({ authRateLimit: 3 });
        prisma.user.findFirst.mockResolvedValue(null);
        const statuses = [];
        for (let i = 0; i < 4; i++) {
            statuses.push((await request(limited).post("/signin").send({ username: "ann@example.com", password: "x" })).status);
        }
        expect(statuses).toEqual([401, 401, 401, 429]);
    });
});

describe("auth middleware", () => {
    it("returns 401 without a token", async () => {
        const res = await request(app).post("/room").send({ name: "my-room" });
        expect(res.status).toBe(401);
    });

    it("returns 401 (not 500) for a garbage token", async () => {
        const res = await request(app).post("/room").set("Authorization", "Bearer not-a-jwt").send({ name: "my-room" });
        expect(res.status).toBe(401);
    });

    it("returns 401 for a token signed with another secret", async () => {
        const forged = jwt.sign({ userId: "u1" }, "some-other-secret");
        const res = await request(app).post("/room").set("Authorization", `Bearer ${forged}`).send({ name: "my-room" });
        expect(res.status).toBe(401);
    });

    it("returns 401 for an unsigned (alg: none) token", async () => {
        const unsigned = jwt.sign({ userId: "u1" }, "", { algorithm: "none" });
        const res = await request(app).post("/room").set("Authorization", `Bearer ${unsigned}`).send({ name: "my-room" });
        expect(res.status).toBe(401);
    });

    it("returns 401 for an expired token", async () => {
        const expired = jwt.sign({ userId: "u1", exp: Math.floor(Date.now() / 1000) - 60 }, JWT_SECRET);
        const res = await request(app).post("/room").set("Authorization", `Bearer ${expired}`).send({ name: "my-room" });
        expect(res.status).toBe(401);
    });
});

describe("rooms", () => {
    it("creates a room for the signed-in user", async () => {
        prisma.room.create.mockResolvedValue({ id: 1, slug: "my-room" });
        const res = await request(app).post("/room").set("Authorization", `Bearer ${tokenFor("u1")}`).send({ name: "my-room" });
        expect(res.status).toBe(201);
        expect(prisma.room.create.mock.calls[0][0].data.adminId).toBe("u1");
    });

    it("returns 400 for an invalid room name", async () => {
        const res = await request(app).post("/room").set("Authorization", `Bearer ${tokenFor("u1")}`).send({});
        expect(res.status).toBe(400);
        const spaces = await request(app).post("/room").set("Authorization", `Bearer ${tokenFor("u1")}`).send({ name: "has spaces" });
        expect(spaces.status).toBe(400);
    });

    it("returns 409 for a duplicate room", async () => {
        prisma.room.create.mockRejectedValue(uniqueViolation());
        const res = await request(app).post("/room").set("Authorization", `Bearer ${tokenFor("u1")}`).send({ name: "my-room" });
        expect(res.status).toBe(409);
    });

    it("returns 404 for an unknown slug", async () => {
        prisma.room.findUnique.mockResolvedValue(null);
        const res = await request(app).get("/room/nope");
        expect(res.status).toBe(404);
    });

    it("only lets the admin delete a room", async () => {
        prisma.room.findUnique.mockResolvedValue({ id: 1, slug: "my-room", adminId: "owner", isPrivate: false });
        const res = await request(app).delete("/room/1").set("Authorization", `Bearer ${tokenFor("someone-else")}`);
        expect(res.status).toBe(403);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("deletes the room and its history for the admin", async () => {
        prisma.room.findUnique.mockResolvedValue({ id: 1, slug: "my-room", adminId: "owner", isPrivate: false });
        prisma.$transaction.mockResolvedValue([]);
        const res = await request(app).delete("/room/1").set("Authorization", `Bearer ${tokenFor("owner")}`);
        expect(res.status).toBe(200);
        expect(prisma.chat.deleteMany).toHaveBeenCalledWith({ where: { roomId: "my-room" } });
    });

    it("returns 400 for a non-numeric room id", async () => {
        const res = await request(app).delete("/room/abc").set("Authorization", `Bearer ${tokenFor("owner")}`);
        expect(res.status).toBe(400);
    });
});

describe("GET /chats/:roomId", () => {
    beforeEach(() => {
        prisma.room.findUnique.mockResolvedValue({ id: 1, slug: "my-room", adminId: "owner", isPrivate: false });
    });

    it("requires sign-in", async () => {
        const res = await request(app).get("/chats/my-room");
        expect(res.status).toBe(401);
    });

    it("returns the full history oldest first", async () => {
        prisma.chat.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        const res = await request(app).get("/chats/my-room").set("Authorization", `Bearer ${tokenFor("u1")}`);
        expect(res.status).toBe(200);
        const args = prisma.chat.findMany.mock.calls[0][0];
        expect(args.orderBy).toEqual({ id: "asc" });
        expect(args.take).toBeUndefined();
    });

    it("returns 500 when the database fails", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        prisma.chat.findMany.mockRejectedValue(new Error("db down"));
        const res = await request(app).get("/chats/my-room").set("Authorization", `Bearer ${tokenFor("u1")}`);
        expect(res.status).toBe(500);
    });
});

describe("private rooms", () => {
    const privateRoom = { id: 7, slug: "secret", adminId: "owner", isPrivate: true };
    const auth = (userId: string) => ({ Authorization: `Bearer ${tokenFor(userId)}` });

    beforeEach(() => {
        prisma.room.findUnique.mockResolvedValue(privateRoom);
        prisma.roomMember.findUnique.mockImplementation(async ({ where }: any) =>
            where.roomId_userId.userId === "member" ? { id: 1 } : null);
        prisma.chat.findMany.mockResolvedValue([]);
    });

    it("can be created private", async () => {
        prisma.room.create.mockResolvedValue({ id: 7, slug: "secret", isPrivate: true });
        const res = await request(app).post("/room").set(auth("owner")).send({ name: "secret", isPrivate: true });
        expect(res.status).toBe(201);
        expect(prisma.room.create.mock.calls[0][0].data.isPrivate).toBe(true);
    });

    it("hides the history from outsiders and shows it to the admin and members", async () => {
        expect((await request(app).get("/chats/secret").set(auth("outsider"))).status).toBe(403);
        expect((await request(app).get("/chats/secret").set(auth("owner"))).status).toBe(200);
        expect((await request(app).get("/chats/secret").set(auth("member"))).status).toBe(200);
    });

    it("hides room details from anonymous visitors", async () => {
        expect((await request(app).get("/room/secret")).status).toBe(403);
    });

    it("lists only public rooms to anonymous visitors", async () => {
        prisma.room.findMany.mockResolvedValue([]);
        await request(app).get("/rooms");
        expect(prisma.room.findMany.mock.calls[0][0].where).toEqual({ isPrivate: false });
    });

    it("lists public, owned and member rooms to a signed-in user", async () => {
        prisma.room.findMany.mockResolvedValue([]);
        await request(app).get("/rooms").set(auth("u1"));
        expect(prisma.room.findMany.mock.calls[0][0].where).toEqual({
            OR: [{ isPrivate: false }, { adminId: "u1" }, { members: { some: { userId: "u1" } } }]
        });
    });

    it("lets only the admin invite, list and remove members", async () => {
        expect((await request(app).post("/room/7/members").set(auth("member")).send({ username: "x@example.com" })).status).toBe(403);
        expect((await request(app).get("/room/7/members").set(auth("member"))).status).toBe(403);
        expect((await request(app).delete("/room/7/members/u2").set(auth("member"))).status).toBe(403);
    });

    it("invites an existing user by email", async () => {
        prisma.user.findUnique.mockResolvedValue({ id: "u2", name: "Bob", email: "bob@example.com" });
        prisma.roomMember.create.mockResolvedValue({});
        const res = await request(app).post("/room/7/members").set(auth("owner")).send({ username: "bob@example.com" });
        expect(res.status).toBe(201);
        expect(prisma.roomMember.create).toHaveBeenCalledWith({ data: { roomId: 7, userId: "u2" } });
    });

    it("returns 404 when inviting an unknown email and 409 for a repeat invite", async () => {
        prisma.user.findUnique.mockResolvedValueOnce(null);
        expect((await request(app).post("/room/7/members").set(auth("owner")).send({ username: "nobody@example.com" })).status).toBe(404);

        prisma.user.findUnique.mockResolvedValueOnce({ id: "u2", name: "Bob", email: "bob@example.com" });
        prisma.roomMember.create.mockRejectedValueOnce(uniqueViolation());
        expect((await request(app).post("/room/7/members").set(auth("owner")).send({ username: "bob@example.com" })).status).toBe(409);
    });

    it("removes members", async () => {
        prisma.roomMember.deleteMany.mockResolvedValueOnce({ count: 1 });
        expect((await request(app).delete("/room/7/members/u2").set(auth("owner"))).status).toBe(200);
        prisma.roomMember.deleteMany.mockResolvedValueOnce({ count: 0 });
        expect((await request(app).delete("/room/7/members/u2").set(auth("owner"))).status).toBe(404);
    });

    it("lets the admin switch a room between public and private", async () => {
        prisma.room.update.mockResolvedValue({ id: 7, slug: "secret", isPrivate: false });
        const res = await request(app).patch("/room/7").set(auth("owner")).send({ isPrivate: false });
        expect(res.status).toBe(200);
        expect(res.body.room.isPrivate).toBe(false);
        expect((await request(app).patch("/room/7").set(auth("member")).send({ isPrivate: false })).status).toBe(403);
    });
});
