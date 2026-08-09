import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST /api/notes/[id]/share - Share a note with another user
export async function POST(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const resolvedParams = await params;
        const { id } = resolvedParams;
        const body = await request.json();
        const { shareWithUserId, permission } = body;

        if (!shareWithUserId || !permission) {
            return NextResponse.json(
                { error: "shareWithUserId and permission are required" },
                { status: 400 }
            );
        }

        if (!["VIEW", "EDIT"].includes(permission)) {
            return NextResponse.json(
                { error: "permission must be VIEW or EDIT" },
                { status: 400 }
            );
        }

        // Check if note exists and user is owner
        const note = await prisma.note.findUnique({
            where: { id },
        });

        if (!note) {
            return NextResponse.json(
                { error: "Note not found" },
                { status: 404 }
            );
        }

        if (note.ownerId !== userId) {
            return NextResponse.json(
                { error: "Only owner can share this note" },
                { status: 403 }
            );
        }

        // Check if recipient user exists
        const recipientUser = await prisma.user.findUnique({
            where: { id: shareWithUserId },
        });

        if (!recipientUser) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        // Can't share with self
        if (shareWithUserId === userId) {
            return NextResponse.json(
                { error: "Cannot share with yourself" },
                { status: 400 }
            );
        }

        // Create or update SharedAccess record
        const sharedAccess = await prisma.sharedAccess.upsert({
            where: {
                noteId_userId: {
                    noteId: id,
                    userId: shareWithUserId,
                },
            },
            update: { permission },
            create: {
                noteId: id,
                userId: shareWithUserId,
                permission,
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
                note: { select: { id: true, title: true } },
            },
        });

        return NextResponse.json(
            { sharedAccess, message: "Note shared successfully" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error sharing note:", error);
        return NextResponse.json(
            { error: "Failed to share note" },
            { status: 500 }
        );
    }
}

// DELETE /api/notes/[id]/share - Revoke sharing with a user
export async function DELETE(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const resolvedParams = await params;
        const { id } = resolvedParams;
        const body = await request.json();
        const { shareWithUserId } = body;

        if (!shareWithUserId) {
            return NextResponse.json(
                { error: "shareWithUserId is required" },
                { status: 400 }
            );
        }

        // Check if note exists and user is owner
        const note = await prisma.note.findUnique({
            where: { id },
        });

        if (!note) {
            return NextResponse.json(
                { error: "Note not found" },
                { status: 404 }
            );
        }

        if (note.ownerId !== userId) {
            return NextResponse.json(
                { error: "Only owner can modify sharing" },
                { status: 403 }
            );
        }

        // Delete the SharedAccess record
        await prisma.sharedAccess.delete({
            where: {
                noteId_userId: {
                    noteId: id,
                    userId: shareWithUserId,
                },
            },
        });

        return NextResponse.json(
            { message: "Sharing revoked" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error revoking share:", error);
        return NextResponse.json(
            { error: "Failed to revoke sharing" },
            { status: 500 }
        );
    }
}