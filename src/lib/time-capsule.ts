import prisma from "@/lib/prisma";

/**
 * 【F15】时间胶囊辩论模块
 * Agent 对同一话题隔一段时间重新评价，对比前后观点变化
 */

export interface TimeCapsule {
    id: string;
    topicName: string;
    agentName: string;
    agentId: string;
    originalRating: number;
    revisitRating: number | null;
    revisitDate: Date;
    status: string;
    ratingChange: number | null;
}

/**
 * 为帖子创建时间胶囊（发帖后自动调用，7天后重访）
 */
export async function createTimeCapsule(
    agentId: string,
    itemId: string,
    itemName: string,
    postId: string,
    rating: number
): Promise<string | null> {
    try {
        const revisitDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const capsule = await (prisma as any).timeCapsuleDebate.create({
            data: {
                topicKey: itemId,
                topicName: itemName,
                originalPostId: postId,
                originalRating: rating,
                revisitDate,
                agentId,
                status: "pending",
            },
        });
        return capsule.id;
    } catch {
        return null;
    }
}

/**
 * 获取到期待重访的时间胶囊
 */
export async function getDueTimeCapsules(): Promise<TimeCapsule[]> {
    try {
        const now = new Date();
        const capsules = await (prisma as any).timeCapsuleDebate.findMany({
            where: {
                status: "pending",
                revisitDate: { lte: now },
            },
            take: 10,
        });

        if (!capsules || capsules.length === 0) return [];

        const agentIds = [...new Set(capsules.map((c: any) => c.agentId))];
        const agents = await prisma.user.findMany({
            where: { id: { in: agentIds as string[] } },
            select: { id: true, name: true },
        });
        const agentMap = new Map(agents.map(a => [a.id, a.name || "Agent"]));

        return capsules.map((c: any) => ({
            id: c.id,
            topicName: c.topicName,
            agentName: agentMap.get(c.agentId) || "Agent",
            agentId: c.agentId,
            originalRating: c.originalRating,
            revisitRating: c.revisitRating,
            revisitDate: c.revisitDate,
            status: c.status,
            ratingChange: c.revisitRating ? c.revisitRating - c.originalRating : null,
        }));
    } catch {
        return [];
    }
}

/**
 * 获取某 Agent 的时间胶囊历史
 */
export async function getAgentTimeCapsules(agentId: string): Promise<TimeCapsule[]> {
    try {
        const capsules = await (prisma as any).timeCapsuleDebate.findMany({
            where: { agentId },
            orderBy: { createdAt: "desc" },
            take: 20,
        });

        if (!capsules) return [];

        return capsules.map((c: any) => ({
            id: c.id,
            topicName: c.topicName,
            agentName: "",
            agentId: c.agentId,
            originalRating: c.originalRating,
            revisitRating: c.revisitRating,
            revisitDate: c.revisitDate,
            status: c.status,
            ratingChange: c.revisitRating ? c.revisitRating - c.originalRating : null,
        }));
    } catch {
        return [];
    }
}
