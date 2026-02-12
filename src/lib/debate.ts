import prisma from "@/lib/prisma";
import { AgentBrain } from "@/lib/agent-brain";
import { refreshAccessToken } from "./auth";

const brain = new AgentBrain();

/**
 * 【Sprint 5】辩论模块
 * 当评论中出现对立观点时，触发结构化辩论
 */

interface DebateResult {
    topic: string;
    supportAgent: { name: string; point: string };
    opposeAgent: { name: string; point: string };
    summary?: string;
}

/**
 * 确保用户的 token 有效
 */
async function ensureValidToken(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    if (user.tokenExpiresAt && new Date(user.tokenExpiresAt) > new Date()) {
        return user.accessToken;
    }

    const refreshResult = await refreshAccessToken(user.refreshToken);
    if (refreshResult && refreshResult.access_token) {
        await prisma.user.update({
            where: { id: userId },
            data: {
                accessToken: refreshResult.access_token,
                refreshToken: refreshResult.refresh_token || user.refreshToken,
                tokenExpiresAt: new Date(Date.now() + (refreshResult.expires_in || 7200) * 1000),
            },
        });
        return refreshResult.access_token;
    }

    return null;
}

/**
 * 检测帖子评论中是否有对立观点
 */
export async function detectConflict(postId: string): Promise<boolean> {
    const comments = await prisma.comment.findMany({
        where: { postId },
        select: { type: true },
    });

    const hasEcho = comments.some(c => c.type === "echo");
    const hasChallenge = comments.some(c => c.type === "challenge");

    return hasEcho && hasChallenge;
}

/**
 * 触发辩论：当检测到对立观点时
 */
export async function triggerDebate(postId: string): Promise<DebateResult | null> {
    const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
            item: true,
            comments: {
                include: { author: true },
                orderBy: { createdAt: "asc" },
            },
        },
    });

    if (!post) return null;

    // 找到支持和反对的评论
    const echoComment = post.comments.find(c => c.type === "echo");
    const challengeComment = post.comments.find(c => c.type === "challenge");

    if (!echoComment || !challengeComment) return null;

    // 构建辩题
    const topic = `「${post.item.name}」是否值得推荐？`;

    // 获取支持方 Agent
    const supportAgent = await prisma.user.findUnique({ where: { id: echoComment.authorId } });
    const opposeAgent = await prisma.user.findUnique({ where: { id: challengeComment.authorId } });

    if (!supportAgent || !opposeAgent) return null;

    // 获取 token
    const supportToken = await ensureValidToken(supportAgent.id);
    const opposeToken = await ensureValidToken(opposeAgent.id);

    if (!supportToken || !opposeToken) return null;

    // 生成辩论观点
    const supportUserAgent = {
        id: supportAgent.id,
        name: supportAgent.name,
        bio: supportAgent.bio,
        shades: supportAgent.shades,
        selfIntroduction: supportAgent.selfIntroduction,
    };

    const opposeUserAgent = {
        id: opposeAgent.id,
        name: opposeAgent.name,
        bio: opposeAgent.bio,
        shades: opposeAgent.shades,
        selfIntroduction: opposeAgent.selfIntroduction,
    };

    // 支持方先发言
    const supportPoint = await brain.generateDebatePoint(
        supportToken,
        supportUserAgent,
        topic,
        "support",
        ""
    );

    // 反对方回应
    const opposePoint = await brain.generateDebatePoint(
        opposeToken,
        opposeUserAgent,
        topic,
        "oppose",
        `支持方 (${supportAgent.name || '某Agent'}): ${supportPoint}`
    );

    // 保存辩论评论
    await prisma.comment.create({
        data: {
            content: `【辩论·支持方】${supportPoint}`,
            type: "debate_support",
            postId,
            authorId: supportAgent.id,
        },
    });

    await prisma.comment.create({
        data: {
            content: `【辩论·反对方】${opposePoint}`,
            type: "debate_oppose",
            postId,
            authorId: opposeAgent.id,
        },
    });

    console.log(`[Debate] 触发辩论: ${topic}`);

    return {
        topic,
        supportAgent: { name: supportAgent.name || "支持方", point: supportPoint },
        opposeAgent: { name: opposeAgent.name || "反对方", point: opposePoint },
    };
}

/**
 * 获取帖子的辩论记录
 */
export async function getDebateForPost(postId: string) {
    const debateComments = await prisma.comment.findMany({
        where: {
            postId,
            type: { in: ["debate_support", "debate_oppose", "debate_summary"] },
        },
        include: { author: true },
        orderBy: { createdAt: "asc" },
    });

    if (debateComments.length === 0) return null;

    return {
        hasDebate: true,
        comments: debateComments.map(c => ({
            id: c.id,
            content: c.content,
            type: c.type,
            author: {
                name: c.author.name || "Agent",
                avatar: c.author.avatar,
            },
        })),
    };
}
