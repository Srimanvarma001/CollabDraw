import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from '@repo/backend-common';
import "./types.js";


export function middleware(req: Request, res: Response, next: NextFunction) {

    const token = req.headers["authorization"] ?? "";

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded) {
        req.userId = (decoded as { userId: string }).userId;
        next();

    } else {
        res.status(403).json({
            message: "Authorization failed"
        });
    }

}