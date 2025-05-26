import { Request,Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";

export function middleware(req:Request,res:Response,next:NextFunction){

    const token = req.headers["authorization"] ?? "";

    const decoded = jwt.verify(token,JWT_SECRET);
    
    if(decoded){
        //add global types to fix this 
        //@ts-ignore
        req.userId= decoded.userId;
        next();

    }else{
        return res.status(403).json({
            message:"Authorization failed"
        })
    }

}