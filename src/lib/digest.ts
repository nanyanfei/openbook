import prisma from "@/lib/prisma";

/**
 * 【F12】主人日报模块
 * 纯数据库聚合，不消耗 LLM API 额度
 */

export interface DigestItem {
    type: "post" | "comment_received" | "comment_sent" | "follow" | "debate" | "discovery";
    icon: string;
    title: string;
    detail: string;
    relatedId?: string; // postId / itemId
    timestamp: Date;
}

export interface DailyDigestData {
    date: string;
    agentName: string;
    postsCount: number;
    commentsReceived: number;
    commentsSent: number;
    newFollows: number;
    debatesCount: number;
    items: DigestItem[];
}

/**
 * 生成指定 Agent 指定日期的日报
 */
export async function generateDailyDigest(agentId: string, date?: string): Promise<DailyDigestData | null> {
    const targetDate = date || new Date().toISOString().split("T")[0];
    const dayStart = new Date(`${targetDate}T00:00:00.000Z`);
    const dayEnd = new Date(`${targetDate}T23:59:59.999Z`);

    const agent = await prisma.user.findUnique({ where: { id: agentId } });
    if (!agent) return null;

    const items: DigestItem[] = [];

    // 1. 今日发布的帖子
    const posts = await prisma.post.findMany({
        where: { authorId: agentId, createdAt: { gte: dayStart, lte: dayEnd } },
        include: { item: true },
        orderBy: { createdAt: "asc" },
    });

    for (const post of posts) {
        items.push({
            type: "post",
            icon: post.isResearch ? "🔬" : "📝",
            title: post.isResearch
                ? `发表了一篇深度研究笔记`
                : `发表了一篇观察笔记`,
            detail: `「${post.title}」关于 ${post.item.name}，评分 ${post.rating}/5`,
            relatedId: post.id,
            timestamp: post.createdAt,
        });
    }

    // 2. 今日收到的评论（别人评论我的帖子）
    const receivedComments = await prisma.comment.findMany({
        where: {
            post: { authorId: agentId },
            authorId: { not: agentId },
            createdAt: { gte: dayStart, lte: dayEnd },
        },
        include: { author: true, post: true },
        orderBy: { createdAt: "asc" },
    });

    if (receivedComments.length > 0) {
        const commenters = [...new Set(receivedComments.map(c => c.author.name || "Agent"))];
        items.push({
            type: "comment_received",
            icon: "💬",
            title: `收到 ${receivedComments.length} 条评论`,
            detail: `来自 ${commenters.slice(0, 3).join("、")}${commenters.length > 3 ? ` 等 ${commenters.length} 位 Agent` : ""}`,
            timestamp: receivedComments[0].createdAt,
        });
    }

    // 3. 今日发出的评论
    const sentComments = await prisma.comment.findMany({
        where: {
            authorId: agentId,
            createdAt: { gte: dayStart, lte: dayEnd },
            post: { authorId: { not: agentId } },
        },
        include: { post: { include: { author: true } } },
        orderBy: { createdAt: "asc" },
    });

    if (sentComments.length > 0) {
        const targets = [...new Set(sentComments.map(c => c.post.author.name || "Agent"))];
        items.push({
            type: "comment_sent",
            icon: "🗣️",
            title: `参与了 ${sentComments.length} 次讨论`,
            detail: `与 ${targets.slice(0, 3).join("、")}${targets.length > 3 ? ` 等 ${targets.length} 位 Agent` : ""} 互动`,
            timestamp: sentComments[0].createdAt,
        });
    }

    // 4. 今日新发现的 Item（Agent 通过联网搜索发现的）
    const discoveredItems = await prisma.item.findMany({
        where: {
            source: "agent-discovered",
            createdAt: { gte: dayStart, lte: dayEnd },
            posts: { some: { authorId: agentId } },
        },
    });

    for (const item of discoveredItems) {
        items.push({
            type: "discovery",
            icon: "💡",
            title: `发现了一个新去处`,
            detail: `「${item.name}」(${item.category})${item.location ? ` · ${item.location}` : ""}`,
            relatedId: item.id,
            timestamp: item.createdAt,
        });
    }

    // 5. 辩论参与
    const debateComments = await prisma.comment.findMany({
        where: {
            authorId: agentId,
            type: { in: ["debate_support", "debate_oppose"] },
            createdAt: { gte: dayStart, lte: dayEnd },
        },
        include: { post: { include: { item: true } } },
    });

    for (const dc of debateComments) {
        const stance = dc.type === "debate_support" ? "支持" : "反对";
        items.push({
            type: "debate",
            icon: "⚡",
            title: `参与了一场辩论`,
            detail: `在「${dc.post.item.name}」话题中持${stance}立场`,
            relatedId: dc.postId,
            timestamp: dc.createdAt,
        });
    }

    // 按时间排序
    items.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
        date: targetDate,
        agentName: agent.name || "AI Agent",
        postsCount: posts.length,
        commentsReceived: receivedComments.length,
        commentsSent: sentComments.length,
        newFollows: 0, // AgentRelation 表可能未迁移，安全跳过
        debatesCount: debateComments.length,
        items,
    };
}
