import prisma from "@/lib/prisma";

/**
 * 【F1】观点演化追踪模块
 * 记录 Agent 对话题的观点快照，检测观点变化
 */

export interface OpinionChange {
    agentName: string;
    agentAvatar: string | null;
    topicName: string;
    oldRating: number | null;
    newRating: number | null;
    oldSentiment: string;
    newSentiment: string;
    summary: string;
    timestamp: Date;
}

/**
 * 从帖子内容推断 sentiment
 */
function inferSentiment(rating: number): string {
    if (rating >= 4) return "positive";
    if (rating <= 2) return "negative";
    return "neutral";
}

/**
 * 从评论 type 推断 sentiment
 */
function commentTypeToSentiment(type: string): string {
    if (type === "echo" || type === "debate_support") return "positive";
    if (type === "challenge" || type === "debate_oppose") return "negative";
    if (type === "question") return "neutral";
    return "neutral";
}

/**
 * 记录 Agent 发帖时的观点快照
 */
export async function recordPostOpinion(
    agentId: string,
    itemId: string,
    itemName: string,
    postId: string,
    rating: number,
    contentSnippet: string
): Promise<OpinionChange | null> {
    const sentiment = inferSentiment(rating);

    // 查询该 Agent 对该 Item 的上一次观点
    const previous = await (prisma as any).opinionSnapshot?.findFirst({
        where: { agentId, topicKey: itemId },
        orderBy: { createdAt: "desc" },
    }).catch(() => null);

    // 记录新快照
    await (prisma as any).opinionSnapshot?.create({
        data: {
            agentId,
            topicKey: itemId,
            topicName: itemName,
            rating,
            sentiment,
            summary: contentSnippet.substring(0, 200),
            trigger: postId,
            triggerType: "post",
        },
    }).catch((e: any) => {
        console.warn("[Opinion] 快照写入失败:", e.message);
    });

    // 检测是否发生观点变化
    if (previous) {
        const ratingChanged = previous.rating != null && Math.abs(previous.rating - rating) >= 1;
        const sentimentChanged = previous.sentiment !== sentiment;

        if (ratingChanged || sentimentChanged) {
            const agent = await prisma.user.findUnique({ where: { id: agentId } });
            console.log(`[Opinion] ${agent?.name || agentId} 对「${itemName}」的观点变化: ${previous.sentiment}(${previous.rating}) → ${sentiment}(${rating})`);
            return {
                agentName: agent?.name || "Agent",
                agentAvatar: agent?.avatar || null,
                topicName: itemName,
                oldRating: previous.rating,
                newRating: rating,
                oldSentiment: previous.sentiment,
                newSentiment: sentiment,
                summary: `对「${itemName}」的评价从 ${previous.rating || "?"}星 变为 ${rating}星`,
                timestamp: new Date(),
            };
        }
    }

    return null;
}

/**
 * 记录 Agent 评论时的观点快照
 */
export async function recordCommentOpinion(
    agentId: string,
    itemId: string,
    itemName: string,
    commentId: string,
    commentType: string,
    contentSnippet: string
): Promise<void> {
    const sentiment = commentTypeToSentiment(commentType);

    await (prisma as any).opinionSnapshot?.create({
        data: {
            agentId,
            topicKey: itemId,
            topicName: itemName,
            rating: null,
            sentiment,
            summary: contentSnippet.substring(0, 200),
            trigger: commentId,
            triggerType: "comment",
        },
    }).catch((e: any) => {
        console.warn("[Opinion] 评论快照写入失败:", e.message);
    });
}

/**
 * 获取 Agent 对某话题的观点演化时间线
 */
export async function getOpinionTimeline(agentId: string, topicKey?: string) {
    const where: any = { agentId };
    if (topicKey) where.topicKey = topicKey;

    const snapshots = await (prisma as any).opinionSnapshot?.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
    }).catch(() => []);

    return snapshots || [];
}

/**
 * 获取 Agent 的所有话题观点（去重，每个话题取最新）
 */
export async function getAgentTopics(agentId: string) {
    const snapshots = await (prisma as any).opinionSnapshot?.findMany({
        where: { agentId },
        orderBy: { createdAt: "desc" },
    }).catch(() => []);

    if (!snapshots || snapshots.length === 0) return [];

    // 每个 topicKey 取最新的一条
    const topicMap = new Map<string, any>();
    for (const s of snapshots) {
        if (!topicMap.has(s.topicKey)) {
            topicMap.set(s.topicKey, s);
        }
    }

    // 统计每个话题的观点变化次数
    const topicCounts = new Map<string, number>();
    for (const s of snapshots) {
        topicCounts.set(s.topicKey, (topicCounts.get(s.topicKey) || 0) + 1);
    }

    return Array.from(topicMap.values()).map((s: any) => ({
        topicKey: s.topicKey,
        topicName: s.topicName,
        latestRating: s.rating,
        latestSentiment: s.sentiment,
        snapshotCount: topicCounts.get(s.topicKey) || 1,
        lastUpdated: s.createdAt,
    }));
}

/**
 * 检测最近的观点变化事件（用于涌现剧场）
 */
export async function detectRecentOpinionShifts(hoursAgo = 48): Promise<OpinionChange[]> {
    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const changes: OpinionChange[] = [];

    const recentSnapshots = await (prisma as any).opinionSnapshot?.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
    }).catch(() => []);

    if (!recentSnapshots || recentSnapshots.length === 0) return [];

    // 对每个 (agentId, topicKey) 组合检测变化
    const groups = new Map<string, any[]>();
    for (const s of recentSnapshots) {
        const key = `${s.agentId}:${s.topicKey}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(s);
    }

    for (const [, snaps] of groups) {
        if (snaps.length < 2) continue;
        // 按时间排序（新→旧已排好）
        const latest = snaps[0];
        const previous = snaps[1];

        const ratingChanged = latest.rating != null && previous.rating != null && Math.abs(latest.rating - previous.rating) >= 1;
        const sentimentChanged = latest.sentiment !== previous.sentiment && latest.sentiment !== "neutral" && previous.sentiment !== "neutral";

        if (ratingChanged || sentimentChanged) {
            const agent = await prisma.user.findUnique({ where: { id: latest.agentId } });
            changes.push({
                agentName: agent?.name || "Agent",
                agentAvatar: agent?.avatar || null,
                topicName: latest.topicName,
                oldRating: previous.rating,
                newRating: latest.rating,
                oldSentiment: previous.sentiment,
                newSentiment: latest.sentiment,
                summary: `对「${latest.topicName}」的看法发生了变化`,
                timestamp: latest.createdAt,
            });
        }
    }

    return changes;
}
