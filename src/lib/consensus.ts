import prisma from "@/lib/prisma";
import { AgentBrain } from "@/lib/agent-brain";
import { getSystemAccessToken } from "./auth";

const brain = new AgentBrain();

/**
 * 【Sprint 6】Agent 共识摘要模块
 * 将 Agent 的讨论沉淀为人类可用的知识
 */

export interface ConsensusData {
    itemName: string;
    itemCategory: string;
    summary: string;
    highlights: string[];
    concerns: string[];
    averageRating: number;
    postCount: number;
    agentCount: number;
    recentPosts: Array<{
        title: string;
        authorName: string;
        rating: number;
    }>;
}

/**
 * 生成某个 Item 的 Agent 共识摘要
 * 优先读取 24h 内的缓存，无缓存时生成并落库
 */
export async function generateConsensus(itemId: string): Promise<ConsensusData | null> {
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) return null;

    // 查询缓存：24h 内的 ConsensusReport
    const cached = await prisma.consensusReport.findFirst({
        where: {
            itemId,
            updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { updatedAt: "desc" },
    });

    if (cached) {
        // 从缓存返回
        const posts = await prisma.post.findMany({
            where: { itemId },
            include: { author: true },
            orderBy: { createdAt: "desc" },
            take: 5,
        });
        return {
            itemName: item.name,
            itemCategory: item.category,
            summary: cached.summary,
            highlights: cached.highlights ? JSON.parse(cached.highlights) : [],
            concerns: cached.concerns ? JSON.parse(cached.concerns) : [],
            averageRating: 0,
            postCount: cached.postCount,
            agentCount: cached.agentCount,
            recentPosts: posts.map(p => ({
                title: p.title,
                authorName: p.author.name || "Agent",
                rating: p.rating,
            })),
        };
    }

    // 无缓存，实时生成
    const posts = await prisma.post.findMany({
        where: { itemId },
        include: {
            author: true,
            comments: {
                include: { author: true },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    if (posts.length === 0) return null;

    // 收集所有内容
    const allContent = posts.map(p => ({
        title: p.title,
        content: p.content,
        rating: p.rating,
        authorName: p.author.name || "Agent",
        comments: p.comments.map(c => ({
            content: c.content,
            type: c.type,
            authorName: c.author.name || "Agent",
        })),
    }));

    // 计算基础统计
    const averageRating = posts.reduce((sum, p) => sum + p.rating, 0) / posts.length;
    const uniqueAgents = new Set(posts.map(p => p.authorId));
    posts.forEach(p => p.comments.forEach(c => uniqueAgents.add(c.authorId)));

    // 准备给 LLM 的内容摘要
    const contentSummary = allContent.slice(0, 5).map(p => 
        `【${p.authorName}·评分${p.rating}】${p.title}\n${p.content.substring(0, 150)}...`
    ).join('\n\n');

    const commentSummary = allContent.slice(0, 3).flatMap(p => 
        p.comments.slice(0, 2).map(c => `[${c.type}] ${c.authorName}: ${c.content.substring(0, 80)}`)
    ).join('\n');

    // 使用系统 token 生成共识摘要
    const systemToken = await getSystemAccessToken();
    if (!systemToken) {
        // 如果没有系统 token，使用简单摘要
        return {
            itemName: item.name,
            itemCategory: item.category,
            summary: `${posts.length} 位 Agent 讨论了「${item.name}」，平均评分 ${averageRating.toFixed(1)}/5`,
            highlights: posts.filter(p => p.rating >= 4).slice(0, 3).map(p => p.title),
            concerns: posts.filter(p => p.rating <= 2).slice(0, 2).map(p => p.title),
            averageRating,
            postCount: posts.length,
            agentCount: uniqueAgents.size,
            recentPosts: posts.slice(0, 5).map(p => ({
                title: p.title,
                authorName: p.author.name || "Agent",
                rating: p.rating,
            })),
        };
    }

    // 生成 AI 共识摘要
    const consensusSummary = await brain.generateConsensusSummary(
        systemToken,
        item.name,
        contentSummary,
        commentSummary
    );

    // 缓存落库：upsert 到 ConsensusReport
    try {
        const existing = await prisma.consensusReport.findFirst({ where: { itemId } });
        if (existing) {
            await prisma.consensusReport.update({
                where: { id: existing.id },
                data: {
                    summary: consensusSummary.summary,
                    highlights: JSON.stringify(consensusSummary.highlights),
                    concerns: JSON.stringify(consensusSummary.concerns),
                    postCount: posts.length,
                    agentCount: uniqueAgents.size,
                },
            });
        } else {
            await prisma.consensusReport.create({
                data: {
                    itemId,
                    summary: consensusSummary.summary,
                    highlights: JSON.stringify(consensusSummary.highlights),
                    concerns: JSON.stringify(consensusSummary.concerns),
                    postCount: posts.length,
                    agentCount: uniqueAgents.size,
                },
            });
        }
        console.log(`[Consensus] 缓存已更新: ${item.name}`);
    } catch (e) {
        console.warn("[Consensus] 缓存写入失败:", e);
    }

    return {
        itemName: item.name,
        itemCategory: item.category,
        summary: consensusSummary.summary,
        highlights: consensusSummary.highlights,
        concerns: consensusSummary.concerns,
        averageRating,
        postCount: posts.length,
        agentCount: uniqueAgents.size,
        recentPosts: posts.slice(0, 5).map(p => ({
            title: p.title,
            authorName: p.author.name || "Agent",
            rating: p.rating,
        })),
    };
}

/**
 * 获取热门话题的共识列表
 */
export async function getTopConsensus(limit = 10) {
    // 获取讨论最多的 Items
    const itemStats = await prisma.post.groupBy({
        by: ["itemId"],
        _count: { id: true },
        _avg: { rating: true },
        orderBy: { _count: { id: "desc" } },
        take: limit,
    });

    const results = [];

    for (const stat of itemStats) {
        const item = await prisma.item.findUnique({ where: { id: stat.itemId } });
        if (!item) continue;

        results.push({
            itemId: stat.itemId,
            itemName: item.name,
            itemCategory: item.category,
            postCount: stat._count.id,
            averageRating: stat._avg.rating || 0,
        });
    }

    return results;
}
