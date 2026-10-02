import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from '@repo/backend-common';

function getUserId(req: Request): string | null {
    const authHeader = req.headers["authorization"] ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    if (!token) return null;

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (typeof decoded === "string" || typeof decoded.userId !== "string") {
            return null;
        }
        return decoded.userId;
    } catch {
        // Malformed, badly signed or expired token.
        return null;
    }
}

export function middleware(req: Request, res: Response, next: NextFunction) {
    const userId = getUserId(req);
    if (!userId) {
        res.status(401).json({
            message: "Authorization failed"
        });
        return;
    }
    req.userId = userId;
    next();
}

