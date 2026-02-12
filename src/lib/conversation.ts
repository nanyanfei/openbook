import prisma from "@/lib/prisma";
import { AgentBrain } from "@/lib/agent-brain";
import { refreshAccessToken } from "./auth";

const brain = new AgentBrain();

/**
 * 【Sprint 4】深度对话模块
 * 支持 Agent 之间的多轮深度对话
 */

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
        const expiresIn = refreshResult.expires_in || 7200;
        await prisma.user.update({
            where: { id: userId },
            data: {
                accessToken: refreshResult.access_token,
                refreshToken: refreshResult.refresh_token || user.refreshToken,
                tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
            },
        });
        return refreshResult.access_token;
    }

    return null;
}

/**
 * 生成对话会话 ID
 */
function generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 获取帖子下的所有对话（按会话分组）
 */
export async function getConversations(postId: string) {
    const comments = await prisma.comment.findMany({
        where: { postId },
        include: { author: true },
        orderBy: { createdAt: "asc" },
    });

    // 按 conversationId 分组
    const conversationMap = new Map<string, typeof comments>();

    for (const comment of comments) {
        const convId = comment.conversationId || comment.id;
        if (!conversationMap.has(convId)) {
            conversationMap.set(convId, []);
        }
        conversationMap.get(convId)!.push(comment);
    }

    return Array.from(conversationMap.entries()).map(([convId, msgs]) => ({
        conversationId: convId,
        messages: msgs,
        participantCount: new Set(msgs.map(m => m.authorId)).size,
        messageCount: msgs.length,
    }));
}

/**
 * 延续对话：让 Agent 继续回复
 */
export async function continueConversation(
    postId: string,
    conversationId: string,
    responderId: string
): Promise<string | null> {
    const token = await ensureValidToken(responderId);
    if (!token) return null;

    const responder = await prisma.user.findUnique({ where: { id: responderId } });
    if (!responder) return null;

    // 获取对话上下文
    const existingComments = await prisma.comment.findMany({
        where: {
            postId,
            conversationId,
        },
        include: { author: true },
        orderBy: { createdAt: "asc" },
    });

    if (existingComments.length === 0) return null;

    // 构建对话历史
    const conversationHistory = existingComments
        .map(c => `${c.author.name || '某Agent'}: ${c.content}`)
        .join('\n');

    // 获取原帖内容
    const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { author: true },
    });
    if (!post) return null;

    const responderAgent = {
        id: responder.id,
        name: responder.name,
        bio: responder.bio,
        shades: responder.shades,
        selfIntroduction: responder.selfIntroduction,
    };

    // 生成深度回复
    const replyContent = await brain.generateDeepConversationReply(
        token,
        responderAgent,
        post.content,
        conversationHistory
    );

    // 创建回复
    const reply = await prisma.comment.create({
        data: {
            content: replyContent,
            type: "conversation",
            postId,
            authorId: responderId,
            conversationId,
        },
    });

    console.log(`[Conversation] ${responder.name} 继续对话: ${replyContent.substring(0, 50)}...`);

    return reply.id;
}

/**
 * 触发深度对话：当评论有争议或有趣时，自动延续
 */
export async function triggerDeepConversations(postId: string) {
    const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
            comments: {
                include: { author: true },
                where: { parentId: null },
                orderBy: { createdAt: "desc" },
                take: 5,
            },
            author: true,
        },
    });

    if (!post || post.comments.length < 2) return [];

    const results = [];

    // 找到可以延续的对话
    for (const comment of post.comments) {
        // 检查是否已有回复
        const existingReplies = await prisma.comment.count({
            where: { parentId: comment.id },
        });

        if (existingReplies >= 3) continue; // 已有足够回复

        // 随机选择一个其他 Agent 来回复
        const otherAgents = await prisma.user.findMany({
            where: {
                id: { not: comment.authorId },
                accessToken: { not: "" },
            },
            take: 3,
        });

        if (otherAgents.length === 0) continue;

        const responder = otherAgents[Math.floor(Math.random() * otherAgents.length)];

        // 50% 概率继续对话
        if (Math.random() < 0.5) {
            const convId = comment.conversationId || generateConversationId();

            // 如果评论没有 conversationId，更新它
            if (!comment.conversationId) {
                await prisma.comment.update({
                    where: { id: comment.id },
                    data: { conversationId: convId },
                });
            }

            const replyId = await continueConversation(postId, convId, responder.id);
            if (replyId) {
                results.push({ conversationId: convId, replyId });
            }
        }
    }

    return results;
}
