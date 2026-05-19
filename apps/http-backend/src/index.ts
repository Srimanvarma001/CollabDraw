import express from "express";
import jwt from "jsonwebtoken";
import cors from "cors";
import bcrypt from "bcrypt";
import { JWT_SECRET } from '@repo/backend-common';
import { middleware } from "./middleware.js";
import { CreateUserSchema, SigninSchema, CreateRoomSchema } from "@repo/common/types";
import { prismaClient } from "@repo/db";


const app = express();
app.use(express.json());
app.use(cors());


app.post("/signup", async (req, res) => {

    const parsedData = CreateUserSchema.safeParse(req.body);
    if (!parsedData.success) {
        console.log(parsedData.error);
        res.json({
            message: "Incorrect inputs"
        })
        return;
    }
    const hashedPassword = await bcrypt.hash(parsedData.data.password, 10);
    try {
        const user = await prismaClient.user.create({
            data: {
                email: parsedData.data?.username,
                password: hashedPassword,
                name: parsedData.data.name
            }
        })
        res.json({
            userId: user.id
        })
    } catch (e) {
        res.status(411).json({
            message: "User already exists with this username"
        })
    }
})

app.post("/signin", async (req, res) => {
    const parsedData = SigninSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.json({
            message: "Incorrect inputs"
        })
        return;
    }

    const user = await prismaClient.user.findFirst({
        where: {
            email: parsedData.data.username
        }
    })

    if (!user) {
        res.status(403).json({
            message: "Not authorized"
        })
        return;
    }

    const isValid = await bcrypt.compare(parsedData.data.password, user.password);

    if (!isValid) {
        res.status(403).json({
            message: "Not authorized"
        })
        return;
    }

    const token = jwt.sign({
        userId: user?.id
    }, JWT_SECRET);

    res.json({
        token
    })
})

app.post("/room", middleware, async (req, res) => {
    const parsedData = CreateRoomSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.json({
            message: "Incorrect inputs"
        })
        return;
    }
    const userId = req.userId;

    if (!userId) {
        res.status(403).json({ message: "Unauthorized" });
        return;
    }

    try {
        const room = await prismaClient.room.create({
            data: {
                slug: parsedData.data.name,
                adminId: userId
            }
        })

        res.json({
            roomId: room.id
        })
    } catch (e) {
        res.status(411).json({
            message: "Room already exists with this name"
        })
    }
})

app.get("/chats/:roomId", async (req, res) => {
    try {
        const roomId = Number(req.params.roomId);
        console.log(req.params.roomId);
        const messages = await prismaClient.chat.findMany({
            where: {
                roomId: roomId
            },
            orderBy: {
                id: "desc"
            },
            take: 1000
        });

        res.json({
            messages,
        })
    } catch (e) {
        console.log(e);
        res.json({
            messages: []
        })
    }

})

app.get("/room/:slug", async (req, res) => {
    const slug = req.params.slug;
    const room = await prismaClient.room.findFirst({
        where: {
            slug
        }
    });

    res.json({
        room
    })
});

app.get("/rooms", async (req, res) => {
    const rooms = await prismaClient.room.findMany({
        orderBy: { createdAt: "desc" },
        include: { admin: { select: { name: true, email: true } } }
    });
    res.json({ rooms });
});

app.delete("/room/:id", middleware, async (req, res) => {
    const roomId = Number(req.params.id);
    const userId = req.userId;

    if (!userId) {
        res.status(403).json({ message: "Unauthorized" });
        return;
    }

    const room = await prismaClient.room.findFirst({
        where: { id: roomId }
    });

    if (!room) {
        res.status(404).json({ message: "Room not found" });
        return;
    }

    if (room.adminId !== userId) {
        res.status(403).json({ message: "Only the room admin can delete this room" });
        return;
    }

    await prismaClient.chat.deleteMany({ where: { roomId } });
    await prismaClient.room.delete({ where: { id: roomId } });

    res.json({ message: "Room deleted successfully" });
});

app.listen(3001);