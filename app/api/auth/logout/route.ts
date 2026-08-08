import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { verifyToken } from "@/lib/jwt";

import { extractUserIdFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
    const userId = extractUserIdFromRequest(request);

    if (userId) {
        await redis.del(`session:${userId}`);
    }


    const response = NextResponse.json({
        message: "Logged out"
    });

    response.cookies.delete("token");
    return response;
}