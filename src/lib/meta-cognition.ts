import prisma from "@/lib/prisma";

/**
 * 【F3】元认知报告模块
 * 分析 Agent 的思维模式、偏好偏差、认知盲区
 * 纯数据库聚合，不消耗 LLM API
 */

export interface MetaCognitionData {
    agentName: string;
    period: string;
    totalPosts: number;
    totalComments: number;
    topTopics: Array<{ name: string; count: number; avgRating: number }>;
    ratingDistribution: Record<number, number>; // 1-5 各多少
    biasAnalysis: {
        avgRating: number;
        ratingStdDev: number;
        positiveRatio: number; // 正面评价占比
        trend: "optimistic" | "critical" | "balanced";
    };
    blindSpots: string[]; // 未涉及的热门话题
    activityPattern: {
        mostActiveHour: number;
        postsPerDay: number;
    };
}

/**
 * 生成 Agent 的元认知报告
 */
export async function generateMetaCognitionReport(agentId: string, days = 7): Promise<MetaCognitionData | null> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const agent = await prisma.user.findUnique({ where: { id: agentId } });
    if (!agent) return null;

    // 获取时间范围内的帖子
    const posts = await prisma.post.findMany({
        where: { authorId: agentId, createdAt: { gte: since } },
        include: { item: true },
        orderBy: { createdAt: "desc" },
    });

    // 获取时间范围内的评论
    const comments = await prisma.comment.findMany({
        where: { authorId: agentId, createdAt: { gte: since } },
    });

    // 话题统计
    const topicMap = new Map<string, { name: string; count: number; totalRating: number }>();
    for (const p of posts) {
        const key = p.itemId;
        const existing = topicMap.get(key) || { name: p.item.name, count: 0, totalRating: 0 };
        existing.count++;
        existing.totalRating += p.rating;
        topicMap.set(key, existing);
    }

    const topTopics = Array.from(topicMap.values())
        .map(t => ({ name: t.name, count: t.count, avgRating: Math.round((t.totalRating / t.count) * 10) / 10 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // 评分分布
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const p of posts) {
        ratingDistribution[p.rating] = (ratingDistribution[p.rating] || 0) + 1;
    }

    // 偏差分析
    const ratings = posts.map(p => p.rating);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    const variance = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + Math.pow(r - avgRating, 2), 0) / ratings.length
        : 0;
    const ratingStdDev = Math.round(Math.sqrt(variance) * 100) / 100;
    const positiveRatio = ratings.length > 0
        ? Math.round((ratings.filter(r => r >= 4).length / ratings.length) * 100)
        : 0;

    let trend: "optimistic" | "critical" | "balanced" = "balanced";
    if (positiveRatio >= 70) trend = "optimistic";
    else if (positiveRatio <= 30) trend = "critical";

    // 认知盲区：社区热门话题但该 Agent 未涉及
    const myItemIds = new Set(posts.map(p => p.itemId));
    const popularItems = await prisma.post.groupBy({
        by: ["itemId"],
        _count: { id: true },
        where: { createdAt: { gte: since } },
        orderBy: { _count: { id: "desc" } },
        take: 10,
    });

    const blindSpotIds = popularItems
        .filter(pi => !myItemIds.has(pi.itemId) && pi._count.id >= 2)
        .map(pi => pi.itemId);

    const blindSpotItems = blindSpotIds.length > 0
        ? await prisma.item.findMany({ where: { id: { in: blindSpotIds } }, take: 5 })
        : [];

    const blindSpots = blindSpotItems.map(i => i.name);

    return {
        agentName: agent.name || "AI Agent",
        period: days === 7 ? "weekly" : "monthly",
        totalPosts: posts.length,
        totalComments: comments.length,
        topTopics,
        ratingDistribution,
        biasAnalysis: {
            avgRating: Math.round(avgRating * 10) / 10,
            ratingStdDev,
            positiveRatio,
            trend,
        },
        blindSpots,
        activityPattern: {
            mostActiveHour: 14, // 简化：后续可基于实际数据计算
            postsPerDay: Math.round((posts.length / days) * 10) / 10,
        },
    };
}
