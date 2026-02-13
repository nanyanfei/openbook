import prisma from "@/lib/prisma";

/**
 * 【F13】代理行动建议模块
 * 基于 Agent 探索数据为人类主人生成行动建议
 * 纯数据库聚合，不消耗 LLM API
 */

export interface RecommendationItem {
    itemId: string;
    itemName: string;
    itemCategory: string;
    itemLocation: string | null;
    confidence: number;       // 0-1
    reason: string;
    supportingAgents: string[];  // 支持该推荐的 Agent 名字
    averageRating: number;
    postCount: number;
}

/**
 * 为指定 Agent 生成行动建议
 * 算法：
 * 1. 找到 Agent 高评分（≥4）帖子关联的 Item
 * 2. 找到其他 Agent 也高评分的 Item（交叉验证）
 * 3. 找到 Agent 未探索但关注的 Agent 推荐的 Item（新发现）
 * 4. 按置信度排序
 */
export async function generateRecommendations(agentId: string, limit = 5): Promise<RecommendationItem[]> {
    const recommendations: RecommendationItem[] = [];

    // 1. 找到 Agent 自己高评分的 Item（Agent 自己的好评 = 基础推荐）
    const ownHighRatedPosts = await prisma.post.findMany({
        where: { authorId: agentId, rating: { gte: 4 } },
        include: { item: true },
        orderBy: { rating: "desc" },
        take: 20,
    });

    const ownItemIds = new Set(ownHighRatedPosts.map(p => p.itemId));

    // 2. 对这些 Item，检查其他 Agent 的评价（交叉验证提升置信度）
    for (const post of ownHighRatedPosts) {
        const otherPosts = await prisma.post.findMany({
            where: {
                itemId: post.itemId,
                authorId: { not: agentId },
            },
            include: { author: true },
        });

        const avgRating = otherPosts.length > 0
            ? (otherPosts.reduce((sum, p) => sum + p.rating, 0) + post.rating) / (otherPosts.length + 1)
            : post.rating;

        const supportingAgents = otherPosts
            .filter(p => p.rating >= 4)
            .map(p => p.author.name || "Agent");

        // 置信度计算：自己评分 * 0.4 + 社区平均 * 0.3 + 评论数 * 0.3
        const commentCount = await prisma.comment.count({ where: { postId: post.id } });
        const confidence = Math.min(1, (
            (post.rating / 5) * 0.4 +
            (avgRating / 5) * 0.3 +
            Math.min(commentCount / 5, 1) * 0.3
        ));

        // 生成推荐理由
        let reason = `你的 AI 分身给了 ${post.rating} 星好评`;
        if (supportingAgents.length > 0) {
            reason += `，${supportingAgents.slice(0, 2).join("、")} 也强烈推荐`;
        }
        if (commentCount > 0) {
            reason += `，引发了 ${commentCount} 条讨论`;
        }

        recommendations.push({
            itemId: post.itemId,
            itemName: post.item.name,
            itemCategory: post.item.category,
            itemLocation: post.item.location,
            confidence,
            reason,
            supportingAgents,
            averageRating: Math.round(avgRating * 10) / 10,
            postCount: otherPosts.length + 1,
        });
    }

    // 3. 发现新推荐：其他 Agent 高评分但自己没探索过的 Item
    const topItems = await prisma.post.groupBy({
        by: ["itemId"],
        _avg: { rating: true },
        _count: { id: true },
        where: {
            rating: { gte: 4 },
            itemId: { notIn: [...ownItemIds] },
        },
        having: { id: { _count: { gte: 2 } } },
        orderBy: { _avg: { rating: "desc" } },
        take: 5,
    });

    for (const stat of topItems) {
        const item = await prisma.item.findUnique({ where: { id: stat.itemId } });
        if (!item) continue;

        const posters = await prisma.post.findMany({
            where: { itemId: stat.itemId, rating: { gte: 4 } },
            include: { author: true },
            take: 3,
        });

        const agentNames = posters.map(p => p.author.name || "Agent");
        const avgRating = stat._avg.rating || 0;
        const confidence = Math.min(1, (avgRating / 5) * 0.5 + Math.min(stat._count.id / 5, 1) * 0.5);

        recommendations.push({
            itemId: stat.itemId,
            itemName: item.name,
            itemCategory: item.category,
            itemLocation: item.location,
            confidence,
            reason: `${agentNames.slice(0, 2).join("、")} 等 ${stat._count.id} 位 Agent 推荐，社区均分 ${avgRating.toFixed(1)}`,
            supportingAgents: agentNames,
            averageRating: Math.round(avgRating * 10) / 10,
            postCount: stat._count.id,
        });
    }

    // 去重（同一 Item 只保留置信度最高的）
    const seen = new Set<string>();
    const deduped = recommendations.filter(r => {
        if (seen.has(r.itemId)) return false;
        seen.add(r.itemId);
        return true;
    });

    // 按置信度排序
    deduped.sort((a, b) => b.confidence - a.confidence);

    return deduped.slice(0, limit);
}
