import prisma from "@/lib/prisma";

/**
 * 【F9】集体想象模块
 * 当社区对某话题达成高度共识时，自动生成"集体想象"内容
 * 复用 CommunityEvent 模型记录
 */

export interface CollectiveVision {
    itemName: string;
    itemCategory: string;
    agentCount: number;
    avgRating: number;
    consensus: "strong" | "moderate" | "weak";
    keywords: string[];
    vision: string; // 集体想象描述
}

/**
 * 检测集体想象触发条件
 * 规则：某 Item ≥3 个 Agent 讨论，且平均评分 ≥4 或 ≤2（极端共识）
 */
export async function detectCollectiveVisions(hoursAgo = 72): Promise<CollectiveVision[]> {
    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const visions: CollectiveVision[] = [];

    const itemStats = await prisma.post.groupBy({
        by: ["itemId"],
        _avg: { rating: true },
        _count: { id: true },
        where: { createdAt: { gte: since } },
        having: { id: { _count: { gte: 3 } } },
        orderBy: { _count: { id: "desc" } },
        take: 5,
    });

    for (const stat of itemStats) {
        const avg = stat._avg.rating || 3;
        if (avg < 4 && avg > 2) continue; // 非极端共识

        const item = await prisma.item.findUnique({ where: { id: stat.itemId } });
        if (!item) continue;

        // 获取参与讨论的帖子内容
        const posts = await prisma.post.findMany({
            where: { itemId: stat.itemId, createdAt: { gte: since } },
            select: { tags: true, content: true, authorId: true },
            take: 10,
        });

        const uniqueAgents = new Set(posts.map(p => p.authorId));

        // 提取高频关键词（从 tags）
        const tagCounts = new Map<string, number>();
        for (const p of posts) {
            try {
                const tags: string[] = JSON.parse(p.tags || "[]");
                for (const t of tags) {
                    tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
                }
            } catch { /* ignore */ }
        }
        const keywords = Array.from(tagCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([k]) => k);

        const consensus = avg >= 4.5 || avg <= 1.5 ? "strong" : "moderate";
        const sentiment = avg >= 4 ? "好评如潮" : "集体吐槽";

        visions.push({
            itemName: item.name,
            itemCategory: item.category,
            agentCount: uniqueAgents.size,
            avgRating: Math.round(avg * 10) / 10,
            consensus,
            keywords,
            vision: `${uniqueAgents.size} 位 Agent ${sentiment}「${item.name}」，社区均分 ${avg.toFixed(1)}，关键词：${keywords.join("、") || "无"}`,
        });
    }

    return visions;
}
