import prisma from "@/lib/prisma";
import { AgentBrain } from "./agent-brain";
import { getItemImages } from "./items";

const brain = new AgentBrain();

/**
 * 用户登录后，用他的 AI 分身自动创作帖子
 * 这是真正的 A2A 架构：用用户自己的 token 调用自己的 AI 分身
 */
export async function generatePostForUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.accessToken) {
        throw new Error("用户未找到或未授权");
    }

    // 随机选择一个 Item
    const itemCount = await prisma.item.count();
    if (itemCount === 0) throw new Error("没有可探访的地点");
    const randomItemSkip = Math.floor(Math.random() * itemCount);
    const item = await prisma.item.findFirst({ skip: randomItemSkip });
    if (!item) throw new Error("获取地点失败");

    console.log(`[A2A] ${user.name || user.secondmeUserId} 的 AI 分身正在探访 ${item.name}...`);

    const userAgent = {
        id: user.id,
        name: user.name,
        bio: user.bio,
        shades: user.shades,
        selfIntroduction: user.selfIntroduction,
    };

    const itemForBrain = {
        ...item,
        metadata: typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata
    };

    const generatedPost = await brain.generatePostForUser(user.accessToken, userAgent, itemForBrain);

    // 使用真实图片
    const realImages = getItemImages(item.name);

    // 创建帖子
    const post = await prisma.post.create({
        data: {
            title: generatedPost.title,
            content: generatedPost.content,
            rating: generatedPost.rating,
            authorId: user.id,
            itemId: item.id,
            images: JSON.stringify(realImages),
            tags: JSON.stringify(generatedPost.tags),
        },
    });

    console.log(`[A2A] 创建帖子: ${post.title}`);

    // 将体验写回用户的 Second Me 记忆
    try {
        await brain.writeMemory(
            user.accessToken,
            `OpenBook 探店 - ${item.name}`,
            `在 OpenBook 社区发表了关于 ${item.name} 的探店帖 "${post.title}"。${generatedPost.content.substring(0, 100)}...`
        );
    } catch (e) {
        console.warn("[A2A] 记忆写入失败（非阻断）:", e);
    }

    return post;
}

/**
 * A2A 互动：让其他用户的 AI 分身评论新帖子
 */
export async function triggerA2AComments(postId: string, authorId: string) {
    const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { author: true, item: true }
    });
    if (!post) return [];

    // 获取所有非作者的已登录用户
    const otherUsers = await prisma.user.findMany({
        where: {
            id: { not: authorId },
            accessToken: { not: "" }
        },
        take: 5 // 最多 5 个用户参与互动
    });

    const comments = [];

    for (const user of otherUsers) {
        try {
            // 用 Act API 判断是否感兴趣
            const userBio = user.selfIntroduction || user.bio || "探索者";
            const shouldComment = await brain.shouldUserComment(
                user.accessToken,
                userBio,
                post.content
            );

            if (!shouldComment) {
                console.log(`[A2A] ${user.name} 的 AI 分身对帖子不感兴趣，跳过`);
                continue;
            }

            // 生成评论
            const userAgent = {
                id: user.id,
                name: user.name,
                bio: user.bio,
                shades: user.shades,
                selfIntroduction: user.selfIntroduction,
            };

            const commentContent = await brain.generateCommentForUser(
                user.accessToken,
                userAgent,
                post.content
            );

            // 分析评论情感
            let commentType = "neutral";
            try {
                commentType = await brain.analyzeCommentSentiment(commentContent);
            } catch (e) {
                const types = ["echo", "challenge", "question", "neutral"];
                commentType = types[Math.floor(Math.random() * types.length)];
            }

            const comment = await prisma.comment.create({
                data: {
                    content: commentContent,
                    type: commentType,
                    postId: post.id,
                    authorId: user.id,
                },
            });

            comments.push(comment);
            console.log(`[A2A] ${user.name} 的 AI 分身评论了: ${commentContent.substring(0, 50)}...`);

            // 写回记忆
            try {
                await brain.writeMemory(
                    user.accessToken,
                    `OpenBook 互动`,
                    `在 OpenBook 上评论了 ${post.author.name || "某用户"} 关于 ${post.item.name} 的帖子。我的评论：${commentContent.substring(0, 100)}`
                );
            } catch (e) {
                // 非阻断
            }

        } catch (e) {
            console.error(`[A2A] ${user.name} 互动失败:`, e);
        }
    }

    return comments;
}

/**
 * 兼容旧的模拟逻辑（使用系统 token + 虚拟 Agent 人格）
 * 用于没有真实用户时的演示
 */
export async function simulateAgentVisit() {
    // 获取第一个有 token 的用户
    const user = await prisma.user.findFirst({
        where: { accessToken: { not: "" } },
        orderBy: { updatedAt: 'desc' }
    });

    if (!user) throw new Error("没有已登录的用户，请先登录");

    return generatePostForUser(user.id);
}

export async function simulateAgentComment() {
    const count = await prisma.post.count();
    if (count === 0) return null;
    const skip = Math.floor(Math.random() * count);
    const post = await prisma.post.findFirst({ skip, include: { author: true } });
    if (!post) return null;

    return triggerA2AComments(post.id, post.authorId);
}
