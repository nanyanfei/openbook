import prisma from "@/lib/prisma";

/**
 * 【F8】自发社区挑战模块
 * 检测热度模式，自动发起社区挑战
 * 复用已有 CommunityEvent 模型
 */

/**
 * 检测热度模式并自动发起挑战
 * 规则：过去 48h 内某个 category 下帖子数 ≥ 3，则自动发起挑战
 */
export async function detectAndCreateChallenge(): Promise<string | null> {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // 按 category 聚合最近帖子
    const categoryStats = await prisma.post.groupBy({
        by: ["itemId"],
        _count: { id: true },
        where: { createdAt: { gte: since } },
        having: { id: { _count: { gte: 3 } } },
        orderBy: { _count: { id: "desc" } },
        take: 3,
    });

    if (categoryStats.length === 0) return null;

    // 获取最热 Item 的信息
    const hotItemId = categoryStats[0].itemId;
    const hotItem = await prisma.item.findUnique({ where: { id: hotItemId } });
    if (!hotItem) return null;

    // 检查是否已有同主题的活跃挑战
    const existing = await prisma.communityEvent.findFirst({
        where: {
            hashtag: { contains: hotItem.category },
            isActive: true,
        },
    });
    if (existing) return existing.id;

    // 生成挑战
    const challengeTemplates = [
        { title: `寻找被低估的${hotItem.category}`, hashtag: `#被低估的${hotItem.category}` },
        { title: `${hotItem.category}的 N 种打开方式`, hashtag: `#${hotItem.category}新玩法` },
        { title: `挑战：发现最小众的${hotItem.category}`, hashtag: `#小众${hotItem.category}` },
    ];

    const template = challengeTemplates[Math.floor(Math.random() * challengeTemplates.length)];
    const now = new Date();
    const endAt = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72h 后结束

    try {
        const event = await prisma.communityEvent.create({
            data: {
                title: template.title,
                description: `社区热度触发！最近有 ${categoryStats[0]._count.id} 篇关于「${hotItem.name}」的讨论，快来参与这个挑战吧！`,
                hashtag: template.hashtag,
                startAt: now,
                endAt,
                isActive: true,
            },
        });

        console.log(`[Challenge] 自动发起社区挑战: ${template.title}`);
        return event.id;
    } catch (e) {
        console.warn("[Challenge] 创建挑战失败:", e);
        return null;
    }
}

/**
 * 获取活跃的社区挑战
 */
export async function getActiveChallenges() {
    const now = new Date();
    return prisma.communityEvent.findMany({
        where: {
            isActive: true,
            endAt: { gt: now },
        },
        orderBy: { startAt: "desc" },
        take: 10,
    });
}

/**
 * 检查并关闭过期挑战
 */
export async function closeExpiredChallenges(): Promise<number> {
    const now = new Date();
    const result = await prisma.communityEvent.updateMany({
        where: {
            isActive: true,
            endAt: { lte: now },
        },
        data: { isActive: false },
    });
    return result.count;
}
