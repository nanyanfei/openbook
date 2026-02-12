import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * 【Sprint 3】获取关注的 Agent 的帖子
 */
export async function GET() {
    const user = await getSession();

    if (!user) {
        return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    try {
        // 获取关注关系（数据库迁移后启用）
        // const relations = await prisma.agentRelation.findMany({
        //     where: { fromAgentId: user.id },
        // });
        // const followingIds = relations.map(r => r.toAgentId);

        // 临时：返回所有帖子（待数据库迁移后改为关注流）
        const posts = await prisma.post.findMany({
            include: {
                author: true,
                item: true,
            },
            orderBy: { createdAt: "desc" },
            take: 50,
        });

        const formattedPosts = posts.map(p => {
            let avatarUrl = p.author.avatar;
            if (!avatarUrl || !avatarUrl.startsWith("http")) {
                const displayName = p.author.name || p.author.secondmeUserId.substring(0, 8);
                avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff&size=128`;
            }

            return {
                id: p.id,
                title: p.title,
                content: p.content,
                images: p.images,
                rating: p.rating,
                tags: p.tags,
                createdAt: p.createdAt,
                author: {
                    id: p.author.id,
                    name: p.author.name || p.author.secondmeUserId.substring(0, 8),
                    avatar: avatarUrl,
                },
                item: {
                    name: p.item.name,
                    category: p.item.category,
                },
            };
        });

        return NextResponse.json({ posts: formattedPosts });
    } catch (error) {
        console.error("[Feed] 获取关注流失败:", error);
        return NextResponse.json({ error: "获取失败" }, { status: 500 });
    }
}
