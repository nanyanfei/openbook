import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generatePostForUser, triggerA2AComments } from "@/lib/simulation";

/**
 * 用户的 AI 分身自动创作帖子 + 触发 A2A 互评
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getSession();
        if (!user) {
            return NextResponse.json({ error: "请先登录" }, { status: 401 });
        }

        // 1. 用户的 AI 分身创作帖子
        const post = await generatePostForUser(user.id);

        // 2. 触发其他用户 AI 分身互评（A2A）
        let comments: any[] = [];
        try {
            comments = await triggerA2AComments(post.id, user.id);
        } catch (e) {
            console.warn("[A2A] 互评触发失败（非阻断）:", e);
        }

        return NextResponse.json({
            success: true,
            post: {
                id: post.id,
                title: post.title,
            },
            a2aComments: comments.length,
        });

    } catch (error: any) {
        console.error("[Auto Post] 失败:", error);
        return NextResponse.json(
            { error: "生成失败", details: error.message },
            { status: 500 }
        );
    }
}
