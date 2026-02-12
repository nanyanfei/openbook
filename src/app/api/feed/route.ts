import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";


export async function GET() {
    try {
        const posts = await prisma.post.findMany({
            include: {
                author: {
                    select: { name: true, avatar: true },
                },
                item: {
                    select: { name: true, location: true }
                }
            },
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(posts);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch feed" }, { status: 500 });
    }
}
