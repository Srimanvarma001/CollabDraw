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
            user: { create: vi.fn(), findFirst: vi.fn() },
            room: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
            chat: { findMany: vi.fn(), deleteMany: vi.fn() },
            $transaction: vi.fn(),
        },
    };
});
vi.mock("@repo/db", () => db);

const { app } = await import("../src/app.js");
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
        expect((jwt.verify(res.body.token, JWT_SECRET) as { userId: string }).userId).toBe("u1");
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
    });

    it("returns 409 for a duplicate room", async () => {
        prisma.room.create.mockRejectedValue(uniqueViolation());
        const res = await request(app).post("/room").set("Authorization", `Bearer ${tokenFor("u1")}`).send({ name: "my-room" });
        expect(res.status).toBe(409);
    });

    it("returns 404 for an unknown slug", async () => {
        prisma.room.findFirst.mockResolvedValue(null);
        const res = await request(app).get("/room/nope");
        expect(res.status).toBe(404);
    });

    it("only lets the admin delete a room", async () => {
        prisma.room.findFirst.mockResolvedValue({ id: 1, slug: "my-room", adminId: "owner" });
        const res = await request(app).delete("/room/1").set("Authorization", `Bearer ${tokenFor("someone-else")}`);
        expect(res.status).toBe(403);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("deletes the room and its history for the admin", async () => {
        prisma.room.findFirst.mockResolvedValue({ id: 1, slug: "my-room", adminId: "owner" });
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
    it("returns the full history oldest first", async () => {
        prisma.chat.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        const res = await request(app).get("/chats/my-room");
        expect(res.status).toBe(200);
        const args = prisma.chat.findMany.mock.calls[0][0];
        expect(args.orderBy).toEqual({ id: "asc" });
        expect(args.take).toBeUndefined();
    });

    it("returns 500 when the database fails", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        prisma.chat.findMany.mockRejectedValue(new Error("db down"));
        const res = await request(app).get("/chats/my-room");
        expect(res.status).toBe(500);
    });
});
