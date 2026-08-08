import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { signToken } from "@/lib/jwt";

export async function GET(request: NextRequest) {


    try {
        const code = request.nextUrl.searchParams.get("code");

        if (!code) {
            return NextResponse.redirect(
                `${process.env.NEXTAUTH_URL}/login?error=no_code`
            );
        }

        //token or code exchange

        const tokenResponse = await fetch("https://oauth2.googleapis.com/token",
            {
                method: "POST",
                headers: {
                    "Content-type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    code,
                    client_id: process.env.GOOGLE_CLIENT_ID!,
                    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                    redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/google/callback`,
                    grant_type: "authorization_code",
                }),
            },
        );

        const tokens = await tokenResponse.json();

        if (!tokens.access_token) {
            return NextResponse.redirect(
                `${process.env.NEXTAUTH_URL}/login?error=token_exchange_failed`,
            );
        };

        // get/fetch user from google 

        const profileResponse = await fetch(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            {
                headers: {
                    Authorization: `Bearer ${tokens.access_token}`
                },
            },
        );

        const profile = await profileResponse.json();
        const { id: googleId, email, name } = profile;

        if (!email) {
            return NextResponse.redirect(
                `${process.env.NEXTAUTH_URL}/login?error=no_email`,
            );
        };

        //search user if not found create them
        let user = await prisma.user.findUnique(
            {
                where: { googleId },
            },
        );

        if (!user) {
            user = await prisma.user.create({
                data: {
                    googleId,
                    email,
                    name
                },
            });
        };

        //generate jwt and store sessions
        const token = signToken(user.id);
        await redis.setEx(
            `session${user.id}`,
            60 * 60 * 24 * 7,
            JSON.stringify(
                {
                    userId: user.id,
                    email: user.email,
                },
            ),
        );

        // jwt as httpOnly cookieand redirect the user to dashbaord after authorization
        const response = NextResponse.redirect(`${process.env.NEXTAUTH_URL}/`);

        response.cookies.set("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7,
            path: "/",
        });

        return response;
    } catch (error) {
        return NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/login?error=server_error`
        );
    };
};