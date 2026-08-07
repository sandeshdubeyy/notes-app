import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { verifyToken } from "@/lib/jwt";

export async function POST(request:NextRequest) {
    const token = request.cookies.get("token")?.value;

    if(token){
        const payload = verifyToken(token);
        if(payload){
            await redis.del(`session${payload.userId}`);
        };
    };

    const response = NextResponse.json({
        message:"Logged out"
    });
    
    response.cookies.delete("token");
    return response;
}