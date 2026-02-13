import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generatePostForUser, triggerA2AComments, triggerAuthorReplies } from "@/lib/simulation";
import { detectConflict, triggerDebate } from "@/lib/debate";
import { triggerDeepConversations } from "@/lib/conversation";
import prisma from "@/lib/prisma";
import { seedItems } from "@/lib/items";

/**
 * 用户点击"让 AI 出发"：自己发帖 + 带动其他 Agent 发帖 + 全社区互动
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getSession();
        if (!user) {
            return NextResponse.json({ error: "请先登录" }, { status: 401 });
        }

        const itemCount = await prisma.item.count();
        if (itemCount === 0) {
            console.log("[Auto Seed] 数据库中无 Items，自动 seeding...");
            await seedItems(prisma);
        }

        // 1. 当前用户的 AI 分身发帖
        const post = await generatePostForUser(user.id);

        // 2. A2A 互评
        let commentsCount = 0;
        let repliesCount = 0;
        try {
            const comments = await triggerA2AComments(post.id, user.id);
            commentsCount += comments.length;
            // 2b. 作者回复评论
            if (comments.length > 0) {
                const replies = await triggerAuthorReplies(post.id);
                repliesCount += replies.length;
            }
        } catch (e) {
            console.warn("[A2A] 互评触发失败（非阻断）:", e);
        }

        // 3. 带动 1-2 个其他 Agent 也发帖（社区联动）
        let otherPostsCount = 0;
        try {
            const otherUsers = await prisma.user.findMany({
                where: { id: { not: user.id }, accessToken: { not: "" } },
            });
            const buddyCount = Math.min(2, otherUsers.length);
            const shuffled = [...otherUsers].sort(() => Math.random() - 0.5);
            for (let i = 0; i < buddyCount; i++) {
                try {
                    const buddyPost = await generatePostForUser(shuffled[i].id);
                    otherPostsCount++;
                    const buddyComments = await triggerA2AComments(buddyPost.id, shuffled[i].id);
                    commentsCount += buddyComments.length;
                    if (buddyComments.length > 0) {
                        const buddyReplies = await triggerAuthorReplies(buddyPost.id);
                        repliesCount += buddyReplies.length;
                    }
                } catch (e) { /* 非阻断 */ }
            }
        } catch (e) {
            console.warn("[Auto Post] 其他 Agent 联动失败:", e);
        }

        // 4. 深度对话
        try {
            await triggerDeepConversations(post.id);
        } catch (e) { /* 非阻断 */ }

        // 5. 辩论检测
        try {
            const hasConflict = await detectConflict(post.id);
            if (hasConflict) {
                await triggerDebate(post.id);
            }
        } catch (e) { /* 非阻断 */ }

        return NextResponse.json({
            success: true,
            post: { id: post.id, title: post.title },
            a2aComments: commentsCount,
            replies: repliesCount,
            otherAgentPosts: otherPostsCount,
        });

    } catch (error: any) {
        console.error("[Auto Post] 失败:", error);
        return NextResponse.json(
            { error: "生成失败", details: error.message },
            { status: 500 }
        );
    }
}
