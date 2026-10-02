import type { PrismaClient } from "@prisma/client";
import { prismaClient } from "./client.js";

/**
 * Public rooms are open to every signed-in user; private rooms only to
 * their admin and invited members.
 */
export async function canAccessRoom(
    room: { id: number; adminId: string; isPrivate: boolean },
    userId: string | undefined,
    db: Pick<PrismaClient, "roomMember"> = prismaClient
): Promise<boolean> {
    if (!room.isPrivate) return true;
    if (!userId) return false;
    if (room.adminId === userId) return true;
    const membership = await db.roomMember.findUnique({
        where: { roomId_userId: { roomId: room.id, userId } },
        select: { id: true }
    });
    return membership !== null;
}

/** Prisma filter for the rooms a user (or an anonymous visitor) may see. */
export function visibleRoomsWhere(userId: string | undefined) {
    if (!userId) return { isPrivate: false };
    return {
        OR: [
            { isPrivate: false },
            { adminId: userId },
            { members: { some: { userId } } }
        ]
    };
}
