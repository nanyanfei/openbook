import prisma from "@/lib/prisma";

/**
 * 【F14】认知肖像对比模块
 * 对比 Agent 与主人的认知差异
 * 【F5】信任链推荐：基于品味相似度推荐可信 Agent
 */

export interface CognitivePortrait {
    agentId: string;
    agentName: string;
    totalPosts: number;
    avgRating: number;
    topCategories: Array<{ category: string; count: number }>;
    ratingStyle: "generous" | "strict" | "balanced";
    explorationBreadth: number; // 探索广度：涉及的不同 Item 数
    nicheRatio: number;         // 小众比例
}

/**
 * 生成 Agent 认知肖像
 */
export async function getCognitivePortrait(agentId: string): Promise<CognitivePortrait | null> {
    const agent = await prisma.user.findUnique({ where: { id: agentId } });
    if (!agent) return null;

    const posts = await prisma.post.findMany({
        where: { authorId: agentId },
        include: { item: true },
    });

    if (posts.length === 0) {
        return {
            agentId,
            agentName: agent.name || "AI Agent",
            totalPosts: 0,
            avgRating: 0,
            topCategories: [],
            ratingStyle: "balanced",
            explorationBreadth: 0,
            nicheRatio: 0,
        };
    }

    const ratings = posts.map(p => p.rating);
    const avgRating = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;

    // 分类统计
    const categoryMap = new Map<string, number>();
    const uniqueItems = new Set<string>();
    let nicheCount = 0;

    for (const p of posts) {
        categoryMap.set(p.item.category, (categoryMap.get(p.item.category) || 0) + 1);
        uniqueItems.add(p.itemId);
        if (p.item.isNiche) nicheCount++;
    }

    const topCategories = Array.from(categoryMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    let ratingStyle: "generous" | "strict" | "balanced" = "balanced";
    if (avgRating >= 4.0) ratingStyle = "generous";
    else if (avgRating <= 2.5) ratingStyle = "strict";

    return {
        agentId,
        agentName: agent.name || "AI Agent",
        totalPosts: posts.length,
        avgRating,
        topCategories,
        ratingStyle,
        explorationBreadth: uniqueItems.size,
        nicheRatio: Math.round((nicheCount / posts.length) * 100),
    };
}

/**
 * 【F5】信任链推荐：找到品味相似的 Agent
 */
export async function findTrustChainAgents(agentId: string, limit = 5): Promise<Array<{
    agent: CognitivePortrait;
    similarity: number;
    sharedTopics: string[];
}>> {
    const myPortrait = await getCognitivePortrait(agentId);
    if (!myPortrait || myPortrait.totalPosts === 0) return [];

    // 获取我探索过的 Item
    const myPosts = await prisma.post.findMany({
        where: { authorId: agentId },
        select: { itemId: true, rating: true },
    });
    const myItemRatings = new Map(myPosts.map(p => [p.itemId, p.rating]));

    // 获取所有其他 Agent
    const otherAgents = await prisma.user.findMany({
        where: { id: { not: agentId }, accessToken: { not: "" } },
        take: 20,
    });

    const results: Array<{ agent: CognitivePortrait; similarity: number; sharedTopics: string[] }> = [];

    for (const other of otherAgents) {
        const otherPosts = await prisma.post.findMany({
            where: { authorId: other.id },
            include: { item: true },
        });
        if (otherPosts.length === 0) continue;

        // 计算品味相似度（基于共同探索的 Item 评分差异）
        let sharedCount = 0;
        let ratingDiffSum = 0;
        const sharedTopics: string[] = [];

        for (const op of otherPosts) {
            const myRating = myItemRatings.get(op.itemId);
            if (myRating !== undefined) {
                sharedCount++;
                ratingDiffSum += Math.abs(myRating - op.rating);
                sharedTopics.push(op.item.name);
            }
        }

        if (sharedCount === 0) continue;

        // 相似度 = 1 - (平均评分差 / 4)
        const avgDiff = ratingDiffSum / sharedCount;
        const similarity = Math.round((1 - avgDiff / 4) * 100);

        const portrait = await getCognitivePortrait(other.id);
        if (portrait) {
            results.push({ agent: portrait, similarity, sharedTopics: [...new Set(sharedTopics)] });
        }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
}
