import express, { Express, NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import cors from "cors";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import { JWT_ALGORITHM, JWT_EXPIRES_IN, JWT_SECRET } from '@repo/backend-common';
import { middleware, optionalAuth } from "./middleware.js";
import { CreateUserSchema, SigninSchema, CreateRoomSchema, UpdateRoomSchema, InviteMemberSchema } from "@repo/common/types";
import { prismaClient, Prisma, canAccessRoom, visibleRoomsWhere } from "@repo/db";


function invalidInput(res: Response, error: { flatten(): { fieldErrors: unknown } }) {
    res.status(400).json({
        message: "Incorrect inputs",
        errors: error.flatten().fieldErrors
    });
}

function isUniqueViolation(e: unknown): boolean {
    return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export interface AppOptions {
    /** Max sign-in/sign-up attempts per IP per window. */
    authRateLimit?: number;
    authRateWindowMs?: number;
}

export function createApp({
    authRateLimit = Number(process.env.AUTH_RATE_LIMIT ?? 10),
    authRateWindowMs = 15 * 60 * 1000,
}: AppOptions = {}): Express {
    const app = express();

    // Needed behind a reverse proxy so rate limiting sees the client's IP.
    if (process.env.TRUST_PROXY) {
        app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
    }
    app.use(express.json({ limit: "100kb" }));
    app.use(cors({
        // Comma-separated list of allowed origins; any origin if unset (development).
        origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map(o => o.trim()) : true
    }));

    const authLimiter = rateLimit({
        windowMs: authRateWindowMs,
        limit: authRateLimit,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        message: { message: "Too many attempts, please try again later" }
    });

    app.post("/signup", authLimiter, async (req, res) => {
        const parsedData = CreateUserSchema.safeParse(req.body);
        if (!parsedData.success) {
            invalidInput(res, parsedData.error);
            return;
        }
        const hashedPassword = await bcrypt.hash(parsedData.data.password, 10);
        try {
            const user = await prismaClient.user.create({
                data: {
                    email: parsedData.data.username,
                    password: hashedPassword,
                    name: parsedData.data.name
                }
            })
            res.status(201).json({
                userId: user.id
            })
        } catch (e) {
            if (isUniqueViolation(e)) {
                res.status(409).json({
                    message: "User already exists with this username"
                })
                return;
            }
            throw e;
        }
    })

    app.post("/signin", authLimiter, async (req, res) => {
        const parsedData = SigninSchema.safeParse(req.body);
        if (!parsedData.success) {
            invalidInput(res, parsedData.error);
            return;
        }

        const user = await prismaClient.user.findFirst({
            where: {
                email: parsedData.data.username
            }
        })

        // Same response for unknown user and wrong password, so accounts can't be probed.
        const isValid = user ? await bcrypt.compare(parsedData.data.password, user.password) : false;
        if (!user || !isValid) {
            res.status(401).json({
                message: "Invalid username or password"
            })
            return;
        }

        const token = jwt.sign({
            userId: user.id
        }, JWT_SECRET, {
            algorithm: JWT_ALGORITHM,
            expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]
        });

        res.json({
            token,
            name: user.name
        })
    })

    app.post("/room", middleware, async (req, res) => {
        const parsedData = CreateRoomSchema.safeParse(req.body);
        if (!parsedData.success) {
            invalidInput(res, parsedData.error);
            return;
        }

        try {
            const room = await prismaClient.room.create({
                data: {
                    slug: parsedData.data.name,
                    isPrivate: parsedData.data.isPrivate,
                    adminId: req.userId!
                }
            })

            res.status(201).json({
                room: {
                    id: room.id,
                    slug: room.slug,
                    isPrivate: room.isPrivate
                }
            })
        } catch (e) {
            if (isUniqueViolation(e)) {
                res.status(409).json({
                    message: "Room already exists with this name"
                })
                return;
            }
            throw e;
        }
    })

    app.get("/chats/:roomId", middleware, async (req, res) => {
        const roomId = req.params.roomId;
        const room = await prismaClient.room.findUnique({ where: { slug: roomId } });
        if (!room) {
            res.status(404).json({ message: "Room not found" });
            return;
        }
        if (!await canAccessRoom(room, req.userId)) {
            res.status(403).json({ message: "This room is private" });
            return;
        }

        // Clients rebuild the canvas by replaying every op in order, so this
        // must be the full history, oldest first.
        const messages = await prismaClient.chat.findMany({
            where: {
                roomId: roomId
            },
            orderBy: {
                id: "asc"
            }
        });

        res.json({
            messages,
        })
    })

    app.get("/room/:slug", optionalAuth, async (req, res) => {
        const slug = req.params.slug;
        const room = await prismaClient.room.findUnique({
            where: {
                slug
            }
        });

        if (!room) {
            res.status(404).json({ message: "Room not found" });
            return;
        }
        if (!await canAccessRoom(room, req.userId)) {
            res.status(403).json({ message: "This room is private" });
            return;
        }

        res.json({
            room
        })
    });

    app.get("/rooms", optionalAuth, async (req, res) => {
        const rooms = await prismaClient.room.findMany({
            where: visibleRoomsWhere(req.userId),
            orderBy: { createdAt: "desc" },
            include: { admin: { select: { name: true } } }
        });
        res.json({ rooms });
    });

    /** Loads a room by numeric id for an admin-only route; responds and returns null otherwise. */
    async function findAdminRoom(req: Request, res: Response) {
        const roomId = Number(req.params.id);
        if (!Number.isInteger(roomId)) {
            res.status(400).json({ message: "Invalid room id" });
            return null;
        }

        const room = await prismaClient.room.findUnique({
            where: { id: roomId }
        });

        if (!room) {
            res.status(404).json({ message: "Room not found" });
            return null;
        }

        if (room.adminId !== req.userId) {
            res.status(403).json({ message: "Only the room admin can do this" });
            return null;
        }
        return room;
    }

    app.patch("/room/:id", middleware, async (req, res) => {
        const parsedData = UpdateRoomSchema.safeParse(req.body);
        if (!parsedData.success) {
            invalidInput(res, parsedData.error);
            return;
        }
        const room = await findAdminRoom(req, res);
        if (!room) return;

        const updated = await prismaClient.room.update({
            where: { id: room.id },
            data: { isPrivate: parsedData.data.isPrivate }
        });
        res.json({ room: { id: updated.id, slug: updated.slug, isPrivate: updated.isPrivate } });
    });

    app.delete("/room/:id", middleware, async (req, res) => {
        const room = await findAdminRoom(req, res);
        if (!room) return;

        // Members are removed by the database (ON DELETE CASCADE).
        await prismaClient.$transaction([
            prismaClient.chat.deleteMany({ where: { roomId: room.slug } }),
            prismaClient.room.delete({ where: { id: room.id } }),
        ]);

        res.json({ message: "Room deleted successfully" });
    });

    app.get("/room/:id/members", middleware, async (req, res) => {
        const room = await findAdminRoom(req, res);
        if (!room) return;

        const members = await prismaClient.roomMember.findMany({
            where: { roomId: room.id },
            orderBy: { createdAt: "asc" },
            include: { user: { select: { id: true, name: true, email: true } } }
        });
        res.json({
            members: members.map(m => ({ userId: m.user.id, name: m.user.name, username: m.user.email }))
        });
    });

    app.post("/room/:id/members", middleware, async (req, res) => {
        const parsedData = InviteMemberSchema.safeParse(req.body);
        if (!parsedData.success) {
            invalidInput(res, parsedData.error);
            return;
        }
        const room = await findAdminRoom(req, res);
        if (!room) return;

        const user = await prismaClient.user.findUnique({
            where: { email: parsedData.data.username },
            select: { id: true, name: true, email: true }
        });
        if (!user) {
            res.status(404).json({ message: "No user with that email" });
            return;
        }
        if (user.id === room.adminId) {
            res.status(400).json({ message: "You already own this room" });
            return;
        }

        try {
            await prismaClient.roomMember.create({ data: { roomId: room.id, userId: user.id } });
        } catch (e) {
            if (isUniqueViolation(e)) {
                res.status(409).json({ message: "Already a member" });
                return;
            }
            throw e;
        }
        res.status(201).json({ member: { userId: user.id, name: user.name, username: user.email } });
    });

    app.delete("/room/:id/members/:userId", middleware, async (req, res) => {
        const room = await findAdminRoom(req, res);
        if (!room) return;

        const { count } = await prismaClient.roomMember.deleteMany({
            where: { roomId: room.id, userId: req.params.userId }
        });
        if (count === 0) {
            res.status(404).json({ message: "Not a member" });
            return;
        }
        res.json({ message: "Member removed" });
    });

    // Express 5 forwards rejected promises from async handlers here.
    app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
        if (err instanceof SyntaxError && "body" in err) {
            res.status(400).json({ message: "Malformed JSON body" });
            return;
        }
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
    });

    return app;
}
