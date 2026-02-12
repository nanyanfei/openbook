import prisma from "@/lib/prisma";

/**
 * 【Sprint 3】Agent 社交关系模块
 */

/**
 * 计算两个 Agent 的 Shades 相似度
 */
export function computeShadesSimilarity(shadesA: string | null, shadesB: string | null): number {
    if (!shadesA || !shadesB) return 0;

    try {
        const listA = JSON.parse(shadesA);
        const listB = JSON.parse(shadesB);

        if (!Array.isArray(listA) || !Array.isArray(listB)) return 0;

        const namesA = new Set(listA.map((s: { name?: string }) => s.name || s).map(String));
        const namesB = new Set(listB.map((s: { name?: string }) => s.name || s).map(String));

        // Jaccard 相似度
        const intersection = [...namesA].filter(x => namesB.has(x)).length;
        const union = new Set([...namesA, ...namesB]).size;

        return union > 0 ? intersection / union : 0;
    } catch {
        return 0;
    }
}

/**
 * 为用户自动关注兴趣相似的 Agent
 * 相似度 > 0.3 时自动建立关注关系
 */
export async function autoFollowSimilarAgents(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.shades) return 0;

    const otherUsers = await prisma.user.findMany({
        where: {
            id: { not: userId },
            shades: { not: null },
        },
    });

    let followCount = 0;

    for (const other of otherUsers) {
        const similarity = computeShadesSimilarity(user.shades, other.shades);

        if (similarity >= 0.3) {
            try {
                // 检查是否已存在关系
                const existing = await prisma.agentRelation.findUnique({
                    where: {
                        fromAgentId_toAgentId: {
                            fromAgentId: userId,
                            toAgentId: other.id,
                        },
                    },
                });

                if (!existing) {
                    await prisma.agentRelation.create({
                        data: {
                            fromAgentId: userId,
                            toAgentId: other.id,
                            type: "follow",
                            similarity,
                        },
                    });
                    console.log(`[Social] ${user.name} 关注了 ${other.name} (相似度: ${(similarity * 100).toFixed(0)}%)`);
                    followCount++;

                    // 检查是否互关
                    const reverseRelation = await prisma.agentRelation.findUnique({
                        where: {
                            fromAgentId_toAgentId: {
                                fromAgentId: other.id,
                                toAgentId: userId,
                            },
                        },
                    });

                    if (reverseRelation) {
                        // 更新为互关
                        await prisma.agentRelation.updateMany({
                            where: {
                                OR: [
                                    { fromAgentId: userId, toAgentId: other.id },
                                    { fromAgentId: other.id, toAgentId: userId },
                                ],
                            },
                            data: { type: "mutual" },
                        });
                        console.log(`[Social] ${user.name} 与 ${other.name} 互相关注了!`);
                    }
                }
            } catch (e) {
                // 可能是唯一约束冲突，忽略
            }
        }
    }

    return followCount;
}

/**
 * 获取用户关注的 Agent 列表
 */
export async function getFollowing(userId: string) {
    const relations = await prisma.agentRelation.findMany({
        where: { fromAgentId: userId },
        orderBy: { similarity: "desc" },
    });

    const followingIds = relations.map(r => r.toAgentId);
    
    const users = await prisma.user.findMany({
        where: { id: { in: followingIds } },
        select: { id: true, name: true, avatar: true, bio: true },
    });

    return users;
}

/**
 * 获取用户的粉丝列表
 */
export async function getFollowers(userId: string) {
    const relations = await prisma.agentRelation.findMany({
        where: { toAgentId: userId },
        orderBy: { similarity: "desc" },
    });

    const followerIds = relations.map(r => r.fromAgentId);
    
    const users = await prisma.user.findMany({
        where: { id: { in: followerIds } },
        select: { id: true, name: true, avatar: true, bio: true },
    });

    return users;
}

/**
 * 获取关注的 Agent 的帖子（关注流）
 */
export async function getFollowingFeed(userId: string, limit = 20) {
    const relations = await prisma.agentRelation.findMany({
        where: { fromAgentId: userId },
    });

    const followingIds = relations.map(r => r.toAgentId);

    if (followingIds.length === 0) {
        return [];
    }

    const posts = await prisma.post.findMany({
        where: {
            authorId: { in: followingIds },
        },
        include: {
            author: true,
            item: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
    });

    return posts;
}
