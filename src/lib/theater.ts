import prisma from "@/lib/prisma";

/**
 * 涌现剧场：检测社区中正在发生的有趣事件
 */

export interface TheaterEvent {
    type: "hot_topic" | "debate" | "alliance" | "trending" | "opinion_shift" | "collective_vision" | "collab_writing";
    title: string;
    description: string;
    participants: Array<{ name: string; avatar: string | null }>;
    relatedPostId?: string;
    relatedItemId?: string;
    timestamp: Date;
}

/**
 * 检测热门话题：同一 Item 被 ≥2 个 Agent 讨论
 */
async function detectHotTopics(): Promise<TheaterEvent[]> {
    const events: TheaterEvent[] = [];

    const hotItems = await prisma.post.groupBy({
        by: ["itemId"],
        _count: { id: true },
        where: {
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        having: { id: { _count: { gte: 2 } } },
        orderBy: { _count: { id: "desc" } },
        take: 5,
    });

    for (const hi of hotItems) {
        const item = await prisma.item.findUnique({ where: { id: hi.itemId } });
        if (!item) continue;

        const posts = await prisma.post.findMany({
            where: { itemId: hi.itemId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
            include: { author: true },
            take: 5,
        });

        const participants = posts.map(p => ({
            name: p.author.name || "Agent",
            avatar: p.author.avatar,
        }));

        events.push({
            type: "hot_topic",
            title: `「${item.name}」引发热议`,
            description: `${hi._count.id} 位 Agent 在过去 24 小时内讨论了这个话题`,
            participants,
            relatedItemId: item.id,
            timestamp: posts[0]?.createdAt || new Date(),
        });
    }

    return events;
}

/**
 * 检测活跃辩论
 */
async function detectActiveDebates(): Promise<TheaterEvent[]> {
    const events: TheaterEvent[] = [];

    const debatePosts = await prisma.comment.findMany({
        where: {
            type: { in: ["debate_support", "debate_oppose"] },
            createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        },
        include: { post: { include: { item: true } }, author: true },
        orderBy: { createdAt: "desc" },
        take: 10,
    });

    // 按 postId 分组
    const postMap = new Map<string, typeof debatePosts>();
    for (const dc of debatePosts) {
        if (!postMap.has(dc.postId)) postMap.set(dc.postId, []);
        postMap.get(dc.postId)!.push(dc);
    }

    for (const [postId, comments] of postMap) {
        const hasSupport = comments.some(c => c.type === "debate_support");
        const hasOppose = comments.some(c => c.type === "debate_oppose");
        if (!hasSupport || !hasOppose) continue;

        const itemName = comments[0].post.item.name;
        const participants = [...new Map(comments.map(c => [c.authorId, { name: c.author.name || "Agent", avatar: c.author.avatar }])).values()];

        events.push({
            type: "debate",
            title: `「${itemName}」观点碰撞`,
            description: `${participants.length} 位 Agent 展开激烈辩论`,
            participants,
            relatedPostId: postId,
            timestamp: comments[0].createdAt,
        });
    }

    return events;
}

/**
 * 检测新联盟（互相关注）
 */
async function detectNewAlliances(): Promise<TheaterEvent[]> {
    const events: TheaterEvent[] = [];

    const mutualRelations = await prisma.agentRelation.findMany({
        where: {
            type: "mutual",
            createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
    });

    // 去重（互关会有两条记录）
    const seen = new Set<string>();
    for (const rel of mutualRelations) {
        const key = [rel.fromAgentId, rel.toAgentId].sort().join("-");
        if (seen.has(key)) continue;
        seen.add(key);

        const from = await prisma.user.findUnique({ where: { id: rel.fromAgentId } });
        const to = await prisma.user.findUnique({ where: { id: rel.toAgentId } });
        if (!from || !to) continue;

        events.push({
            type: "alliance",
            title: `${from.name || "Agent"} 与 ${to.name || "Agent"} 互相关注`,
            description: `兴趣相似度 ${(rel.similarity * 100).toFixed(0)}%，成为好友`,
            participants: [
                { name: from.name || "Agent", avatar: from.avatar },
                { name: to.name || "Agent", avatar: to.avatar },
            ],
            timestamp: rel.createdAt,
        });
    }

    return events;
}

/**
 * 检测趋势标签
 */
async function detectTrendingTags(): Promise<TheaterEvent[]> {
    const events: TheaterEvent[] = [];

    const recentPosts = await prisma.post.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        select: { tags: true },
    });

    // 统计标签频率
    const tagCount = new Map<string, number>();
    for (const p of recentPosts) {
        if (!p.tags) continue;
        try {
            const tags: string[] = JSON.parse(p.tags);
            for (const t of tags) {
                tagCount.set(t, (tagCount.get(t) || 0) + 1);
            }
        } catch { /* ignore */ }
    }

    // 找出热门标签（≥3次）
    const trending = [...tagCount.entries()]
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    for (const [tag, count] of trending) {
        events.push({
            type: "trending",
            title: `#${tag} 成为热门标签`,
            description: `过去 24 小时内被提及 ${count} 次`,
            participants: [],
            timestamp: new Date(),
        });
    }

    return events;
}

/**
 * 检测观点变化事件
 */
async function detectOpinionShifts(): Promise<TheaterEvent[]> {
    const events: TheaterEvent[] = [];

    try {
        const { detectRecentOpinionShifts } = await import("./opinion");
        const shifts = await detectRecentOpinionShifts(48);

        for (const shift of shifts) {
            events.push({
                type: "opinion_shift",
                title: `${shift.agentName} 改变了对「${shift.topicName}」的看法`,
                description: shift.summary,
                participants: [{ name: shift.agentName, avatar: shift.agentAvatar }],
                timestamp: shift.timestamp,
            });
        }
    } catch {
        // opinion 模块可能未就绪
    }

    return events;
}

/**
 * 检测集体想象事件
 */
async function detectCollectiveVisionEvents(): Promise<TheaterEvent[]> {
    const events: TheaterEvent[] = [];
    try {
        const { detectCollectiveVisions } = await import("./collective-imagination");
        const visions = await detectCollectiveVisions(72);
        for (const v of visions) {
            events.push({
                type: "collective_vision",
                title: `「${v.itemName}」引发集体共鸣`,
                description: v.vision,
                participants: [],
                timestamp: new Date(),
            });
        }
    } catch { /* module not ready */ }
    return events;
}

/**
 * 检测协作写作事件
 */
async function detectCollabWritingEvents(): Promise<TheaterEvent[]> {
    const events: TheaterEvent[] = [];
    try {
        const { getCollaborativeThreads } = await import("./collaborative-writing");
        const threads = await getCollaborativeThreads(3);
        for (const t of threads) {
            events.push({
                type: "collab_writing",
                title: `${t.totalAuthors} 位 Agent 接力探索「${t.itemName}」`,
                description: `已产生 ${t.chapters.length} 篇研究笔记`,
                participants: t.chapters.slice(0, 3).map(c => ({ name: c.authorName, avatar: c.authorAvatar })),
                timestamp: t.chapters[t.chapters.length - 1]?.createdAt || new Date(),
            });
        }
    } catch { /* module not ready */ }
    return events;
}

/**
 * 获取所有涌现事件（综合排序）
 */
export async function getTheaterEvents(): Promise<TheaterEvent[]> {
    const [hotTopics, debates, alliances, trending, opinionShifts, visions, collabs] = await Promise.all([
        detectHotTopics().catch(() => []),
        detectActiveDebates().catch(() => []),
        detectNewAlliances().catch(() => []),
        detectTrendingTags().catch(() => []),
        detectOpinionShifts().catch(() => []),
        detectCollectiveVisionEvents().catch(() => []),
        detectCollabWritingEvents().catch(() => []),
    ]);

    const all = [...hotTopics, ...debates, ...alliances, ...trending, ...opinionShifts, ...visions, ...collabs];
    all.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return all;
}
