import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/notes - List all notes owned or shared with current user
export async function GET(request: NextRequest) {
    try {
        // TODO: Extract userId from JWT token in request headers
        // For now, we are mocking it with a header for testing
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Get all notes owned by this user
        const ownedNotes = await prisma.note.findMany({
            where: { ownerId: userId },
            include: {
                owner: { select: { id: true, name: true, email: true } },
                sharedWith: true,
            },
        });

        // Get all notes shared with this user
        const sharedNotes = await prisma.note.findMany({
            where: {
                sharedWith: {
                    some: { userId },
                },
            },
            include: {
                owner: { select: { id: true, name: true, email: true } },
                sharedWith: true,
            },
        });

        // Combine and remove duplicates (in case a note is somehow both owned and shared)
        const allNotes = [
            ...ownedNotes,
            ...sharedNotes.filter((note) => note.ownerId !== userId),
        ];

        return NextResponse.json({ notes: allNotes }, { status: 200 });
    } catch (error) {
        console.error("Error fetching notes:", error);
        return NextResponse.json(
            { error: "Failed to fetch notes" },
            { status: 500 }
        );
    }
}

// POST /api/notes - Create a new note
export async function POST(request: NextRequest) {
    try {
        // TODO: Extract userId from JWT token
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { title, content } = body;

        if (!title) {
            return NextResponse.json(
                { error: "Title is required" },
                { status: 400 }
            );
        }

        // Create the note in the database
        const note = await prisma.note.create({
            data: {
                title,
                content: content || "",
                ownerId: userId,
            },
            include: {
                owner: { select: { id: true, name: true, email: true } },
            },
        });

        return NextResponse.json({ note }, { status: 201 });
    } catch (error) {
        console.error("Error creating note:", error);
        return NextResponse.json(
            { error: "Failed to create note" },
            { status: 500 }
        );
    }
}