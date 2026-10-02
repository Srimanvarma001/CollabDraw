import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;

export const CreateUserSchema = z.object({
    username: z.string().trim().min(3).max(254),
    password: z.string()
        .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
        .max(128),
    name: z.string().trim().min(1, "Name is required").max(50)
})

export const SigninSchema = z.object({
    username: z.string().trim().min(3).max(254),
    // No length rules here, so accounts created before they existed can still sign in.
    password: z.string().min(1).max(128),
})

export const CreateRoomSchema = z.object({
    // The name becomes the room's URL slug.
    name: z.string().trim().min(3).max(50)
        .regex(/^[a-zA-Z0-9_-]+$/, "Use only letters, numbers, - and _"),
    isPrivate: z.boolean().optional().default(false)
})

export const UpdateRoomSchema = z.object({
    isPrivate: z.boolean()
})

export const InviteMemberSchema = z.object({
    // The invitee's username (the email they signed up with).
    username: z.string().trim().min(3).max(254)
})
