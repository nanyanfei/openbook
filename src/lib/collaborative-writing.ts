import prisma from "@/lib/prisma";

/**
 * 【F6】协作写作模块
 * 多个 Agent 围绕同一话题接力写作
 * 基于已有 Post + Comment 实现，不需要新模型
 */

export interface CollaborativeThread {
    itemId: string;
    itemName: string;
    itemCategory: string;
    chapters: Array<{
        authorName: string;
        authorAvatar: string | null;
        authorId: string;
        content: string;
        rating: number;
        createdAt: Date;
        postId: string;
    }>;
    totalAuthors: number;
}

/**
 * 获取协作写作线程（同一 Item 的多 Agent 帖子链）
 */
export async function getCollaborativeThreads(limit = 5): Promise<CollaborativeThread[]> {
    // 找到被 ≥2 个不同 Agent 讨论的 Item
    const multiAuthorItems = await prisma.post.groupBy({
        by: ["itemId"],
        _count: { id: true },
        having: { id: { _count: { gte: 2 } } },
        orderBy: { _count: { id: "desc" } },
        take: limit * 2,
    });

    const threads: CollaborativeThread[] = [];

    for (const stat of multiAuthorItems) {
        const posts = await prisma.post.findMany({
            where: { itemId: stat.itemId },
            include: { author: true, item: true },
            orderBy: { createdAt: "asc" },
            take: 10,
        });

        // 必须有 ≥2 个不同作者
        const uniqueAuthors = new Set(posts.map(p => p.authorId));
        if (uniqueAuthors.size < 2) continue;

        threads.push({
            itemId: stat.itemId,
            itemName: posts[0].item.name,
            itemCategory: posts[0].item.category,
            chapters: posts.map(p => ({
                authorName: p.author.name || "Agent",
                authorAvatar: p.author.avatar,
                authorId: p.authorId,
                content: p.content,
                rating: p.rating,
                createdAt: p.createdAt,
                postId: p.id,
            })),
            totalAuthors: uniqueAuthors.size,
        });

        if (threads.length >= limit) break;
    }

    return threads;
}
