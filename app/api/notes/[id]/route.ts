import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// Helper: Check if user has access to this note
async function checkAccess(
    noteId: string,
    userId: string,
    requiredPermission: "VIEW" | "EDIT" = "VIEW"
) {
    const note = await prisma.note.findUnique({
        where: { id: noteId },
        include: { sharedWith: true },
    });

    if (!note) {
        return { hasAccess: false, error: "Note not found" };
    }

    // User is owner
    if (note.ownerId === userId) {
        return { hasAccess: true, note };
    }

    // User has shared access
    const access = note.sharedWith.find((sa) => sa.userId === userId);

    if (requiredPermission === "EDIT" && (!access || access.permission !== "EDIT")) {
        return { hasAccess: false, error: "No edit permission" };
    }

    if (!access) {
        return { hasAccess: false, error: "No access to this note" };
    }

    return { hasAccess: true, note };
}

// GET /api/notes/[id] - Get a single note
export async function GET(
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
        const { hasAccess, error, note } = await checkAccess(id, userId, "VIEW");

        if (!hasAccess) {
            return NextResponse.json(
                { error },
                { status: 403 }
            );
        }

        return NextResponse.json({ note }, { status: 200 });
    } catch (error) {
        console.error("Error fetching note:", error);
        return NextResponse.json(
            { error: "Failed to fetch note" },
            { status: 500 }
        );
    }
}

// PUT /api/notes/[id] - Update a note
export async function PUT(
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
        const { hasAccess, error } = await checkAccess(id, userId, "EDIT");

        if (!hasAccess) {
            return NextResponse.json(
                { error },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { title, content } = body;

        const updatedNote = await prisma.note.update({
            where: { id },
            data: {
                ...(title && { title }),
                ...(content !== undefined && { content }),
            },
            include: {
                owner: { select: { id: true, name: true, email: true } },
                sharedWith: true,
            },
        });

        return NextResponse.json({ note: updatedNote }, { status: 200 });
    } catch (error) {
        console.error("Error updating note:", error);
        return NextResponse.json(
            { error: "Failed to update note" },
            { status: 500 }
        );
    }
}

// DELETE /api/notes/[id] - Delete a note (owner only)
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
        const note = await prisma.note.findUnique({
            where: { id },
        });

        if (!note) {
            return NextResponse.json(
                { error: "Note not found" },
                { status: 404 }
            );
        }

        // Only owner can delete
        if (note.ownerId !== userId) {
            return NextResponse.json(
                { error: "Only owner can delete this note" },
                { status: 403 }
            );
        }

        await prisma.note.delete({
            where: { id },
        });

        return NextResponse.json(
            { message: "Note deleted" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error deleting note:", error);
        return NextResponse.json(
            { error: "Failed to delete note" },
            { status: 500 }
        );
    }
}