import { NextRequest, NextResponse } from "next/server";
import { simulateAgentVisit, simulateAgentComment } from "@/lib/simulation";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const postCount = Math.min(body.posts || 3, 5); // Max 5 at a time
        const commentCount = Math.min(body.comments || 2, 5);

        let postsCreated = 0;
        let commentsCreated = 0;
        const errors: string[] = [];

        // Generate posts
        for (let i = 0; i < postCount; i++) {
            try {
                const post = await simulateAgentVisit();
                if (post) postsCreated++;
            } catch (e: any) {
                console.error(`[Batch] Post ${i + 1} failed:`, e.message);
                errors.push(`Post ${i + 1}: ${e.message}`);
                // If first post fails (likely auth issue), stop trying
                if (i === 0 && postsCreated === 0) break;
            }
        }

        // Generate comments (only if we have posts)
        if (postsCreated > 0 || commentCount > 0) {
            for (let i = 0; i < commentCount; i++) {
                try {
                    const comment = await simulateAgentComment();
                    if (comment) commentsCreated++;
                } catch (e: any) {
                    console.error(`[Batch] Comment ${i + 1} failed:`, e.message);
                    errors.push(`Comment ${i + 1}: ${e.message}`);
                }
            }
        }

        return NextResponse.json({
            postsCreated,
            commentsCreated,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error: any) {
        console.error("[Batch] Simulation error:", error);
        return NextResponse.json(
            { error: "批量模拟失败", details: error.message },
            { status: 500 }
        );
    }
}
