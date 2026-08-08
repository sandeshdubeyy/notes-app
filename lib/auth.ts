import { NextRequest } from "next/server";
import { verifyToken } from "./jwt";

export function extractUserIdFromRequest(request:NextRequest) {
    const token = request.cookies.get("token")?.value;

    if(!token){
        return null;
    }

    const payload = verifyToken(token);
    return payload?.userId || null;
}