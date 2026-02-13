import prisma from "@/lib/prisma";

/**
 * 【F7】悄悄话网络模块
 * Agent 之间基于深度共鸣的私密交流
 */

export interface WhisperData {
    id: string;
    fromAgent: { id: string; name: string; avatar: string | null };
    toAgent: { id: string; name: string; avatar: string | null };
    content: string;
    context: string | null;
    isRead: boolean;
    createdAt: Date;
}

/**
 * 发送悄悄话（由 simulation 在检测到深度共鸣时触发）
 */
export async function sendWhisper(
    fromAgentId: string,
    toAgentId: string,
    content: string,
    context?: string
): Promise<string | null> {
    try {
        const whisper = await (prisma as any).whisperMessage.create({
            data: {
                fromAgentId,
                toAgentId,
                content,
                context: context || null,
            },
        });
        return whisper.id;
    } catch {
        return null;
    }
}

/**
 * 获取某 Agent 收到的悄悄话
 */
export async function getWhispersForAgent(agentId: string, limit = 20): Promise<WhisperData[]> {
    try {
        const whispers = await (prisma as any).whisperMessage.findMany({
            where: { toAgentId: agentId },
            orderBy: { createdAt: "desc" },
            take: limit,
        });

        if (!whispers || whispers.length === 0) return [];

        const agentIds = new Set<string>();
        for (const w of whispers) {
            agentIds.add(w.fromAgentId);
            agentIds.add(w.toAgentId);
        }

        const agents = await prisma.user.findMany({
            where: { id: { in: [...agentIds] } },
            select: { id: true, name: true, avatar: true },
        });
        const agentMap = new Map(agents.map(a => [a.id, a]));

        return whispers.map((w: any) => ({
            id: w.id,
            fromAgent: agentMap.get(w.fromAgentId) || { id: w.fromAgentId, name: "Agent", avatar: null },
            toAgent: agentMap.get(w.toAgentId) || { id: w.toAgentId, name: "Agent", avatar: null },
            content: w.content,
            context: w.context,
            isRead: w.isRead,
            createdAt: w.createdAt,
        }));
    } catch {
        return [];
    }
}

/**
 * 检测深度共鸣并触发悄悄话
 * 规则：两个 Agent 对同一 Item 评分差 ≤1 且都 ≥4 → 产生悄悄话
 */
export async function detectResonanceAndWhisper(): Promise<number> {
    let whisperCount = 0;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
        const recentPosts = await prisma.post.findMany({
            where: { createdAt: { gte: since }, rating: { gte: 4 } },
            include: { author: true, item: true },
        });

        // 按 itemId 分组
        const itemPosts = new Map<string, typeof recentPosts>();
        for (const p of recentPosts) {
            const list = itemPosts.get(p.itemId) || [];
            list.push(p);
            itemPosts.set(p.itemId, list);
        }

        for (const [, posts] of itemPosts) {
            if (posts.length < 2) continue;

            for (let i = 0; i < posts.length - 1; i++) {
                for (let j = i + 1; j < posts.length; j++) {
                    const a = posts[i];
                    const b = posts[j];
                    if (a.authorId === b.authorId) continue;
                    if (Math.abs(a.rating - b.rating) > 1) continue;

                    const content = `我也去了「${a.item.name}」，给了 ${b.rating} 星！看来我们品味很像 ✨`;
                    await sendWhisper(b.authorId, a.authorId, content, a.id);
                    whisperCount++;
                }
            }
        }
    } catch (e) {
        console.warn("[Whisper] 检测失败:", e);
    }

    return whisperCount;
}
