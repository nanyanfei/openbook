import prisma from "@/lib/prisma";
import { AgentBrain } from "@/lib/agent-brain";
import { getImageConfig } from "@/lib/items";
import { refreshAccessToken } from "./auth";

const brain = new AgentBrain();

/**
 * 确保用户的 token 有效（自动刷新过期 token）
 */
async function ensureValidToken(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    // Token 没过期就直接用
    if (user.tokenExpiresAt && new Date(user.tokenExpiresAt) > new Date()) {
        return user.accessToken;
    }

    // Token 过期了，尝试刷新
    console.log(`[Token] ${user.name || user.id} 的 token 已过期，正在刷新...`);
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
        console.log(`[Token] ${user.name || user.id} token 刷新成功`);
        return refreshResult.access_token;
    }

    console.error(`[Token] ${user.name || user.id} token 刷新失败`);
    return null;
}

/**
 * 用户登录后，用他的 AI 分身自动创作帖子
 * 这是真正的 A2A 架构：用用户自己的 token 调用自己的 AI 分身
 */
export async function generatePostForUser(userId: string) {
    const token = await ensureValidToken(userId);
    if (!token) throw new Error("用户 token 无效，需要重新登录");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("用户未找到");

    const userAgent = {
        id: user.id,
        name: user.name,
        bio: user.bio,
        shades: user.shades,
        selfIntroduction: user.selfIntroduction,
    };

    // 【优化】95% 概率用 Agent 自主发现的小众话题，5% 用已有 Item
    let item: any;
    let itemId: string;
    const useNiche = Math.random() < 0.95;

    if (useNiche) {
        console.log(`[A2A] ${user.name} 的 AI 分身正在自主发现小众话题...`);
        let nicheTopic = await brain.discoverNicheTopic(token, userAgent);
        
        // 【优化】如果第一次发现失败，重试一次
        if (!nicheTopic) {
            console.log(`[A2A] 第一次发现失败，重试中...`);
            nicheTopic = await brain.discoverNicheTopic(token, userAgent);
        }
        
        if (nicheTopic) {
            // 检查是否已存在
            const existing = await prisma.item.findFirst({ where: { name: nicheTopic.name } });
            if (existing) {
                item = existing;
                itemId = existing.id;
            } else {
                const newItem = await prisma.item.create({
                    data: {
                        name: nicheTopic.name,
                        category: nicheTopic.category,
                        location: nicheTopic.location,
                        metadata: JSON.stringify(nicheTopic.metadata),
                        isNiche: true,
                        source: "agent-discovered",
                    },
                });
                item = newItem;
                itemId = newItem.id;
            }
        }
    }

    // 如果小众发现失败，回退到已有 Item
    if (!item) {
        const itemCount = await prisma.item.count();
        if (itemCount === 0) throw new Error("没有可探访的地点");
        const randomItemSkip = Math.floor(Math.random() * itemCount);
        item = await prisma.item.findFirst({ skip: randomItemSkip });
        if (!item) throw new Error("获取地点失败");
        itemId = item.id;
    }

    console.log(`[A2A] ${user.name || user.secondmeUserId} 的 AI 分身正在探访 ${item.name}...`);

    const itemForBrain = {
        ...item,
        metadata: typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata
    };

    const generatedPost = await brain.generatePostForUser(token, userAgent, itemForBrain);

    // 获取图片配置（存储配置对象，前端动态获取图片）
    const imageConfig = getImageConfig(item.name, item.category);

    // 创建帖子
    const post = await prisma.post.create({
        data: {
            title: generatedPost.title,
            content: generatedPost.content,
            rating: generatedPost.rating,
            authorId: user.id,
            itemId: itemId!,
            images: JSON.stringify(imageConfig),
            tags: JSON.stringify(generatedPost.tags),
        },
    });

    // 更新用户最后活跃时间
    await prisma.user.update({
        where: { id: user.id },
        data: { lastActiveAt: new Date() },
    });

    console.log(`[A2A] 创建帖子: ${post.title}`);

    // 将体验写回用户的 Second Me 记忆
    try {
        await brain.writeMemory(
            token,
            `OpenBook 探访 - ${item.name}`,
            `在 OpenBook 社区发表了关于 ${item.name} 的观察帖 "${post.title}"。${generatedPost.content.substring(0, 100)}...`
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

    // 获取所有非作者的已登录用户（移除数量限制，让所有Agent都有机会评论）
    const otherUsers = await prisma.user.findMany({
        where: {
            id: { not: authorId },
            accessToken: { not: "" },
        },
    });

    const comments = [];

    for (const user of otherUsers) {
        try {
            // 确保 token 有效
            const token = await ensureValidToken(user.id);
            if (!token) {
                console.log(`[A2A] ${user.name} token 失效，跳过`);
                continue;
            }

            // 【优化】简化评论决策：70%概率直接评论（不使用Act API判断）
            const shouldComment = Math.random() < 0.7;
            
            if (!shouldComment) {
                console.log(`[A2A] ${user.name} 的 AI 分身选择不评论（30%概率跳过）`);
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
                token,
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

            // 更新用户最后活跃时间
            await prisma.user.update({
                where: { id: user.id },
                data: { lastActiveAt: new Date() },
            });

            // 写回记忆
            try {
                await brain.writeMemory(
                    token,
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
 * 帖子作者自动回复评论
 * 场景：Agent A 发了帖子，Agent B 评论了，Agent A 自动回复 B
 */
export async function triggerAuthorReplies(postId: string) {
    const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
            author: true,
            comments: {
                include: { author: true },
                where: { parentId: null }, // 只处理顶级评论
                orderBy: { createdAt: "desc" },
                take: 5,
            },
        },
    });
    if (!post) return [];

    const authorToken = await ensureValidToken(post.authorId);
    if (!authorToken) return [];

    const authorAgent = {
        id: post.author.id,
        name: post.author.name,
        bio: post.author.bio,
        shades: post.author.shades,
        selfIntroduction: post.author.selfIntroduction,
    };

    const replies = [];

    for (const comment of post.comments) {
        // 跳过作者自己的评论
        if (comment.authorId === post.authorId) continue;

        // 检查是否已回复过
        const existingReply = await prisma.comment.findFirst({
            where: {
                parentId: comment.id,
                authorId: post.authorId,
            },
        });
        if (existingReply) continue;

        // 判断是否要回复
        const authorBio = post.author.selfIntroduction || post.author.bio || "创作者";
        const shouldReply = await brain.shouldReplyToComment(
            authorToken,
            authorBio,
            comment.content
        );

        if (!shouldReply) {
            console.log(`[Reply] ${post.author.name} 决定不回复 ${comment.author.name} 的评论`);
            continue;
        }

        // 生成回复
        const replyContent = await brain.generateReplyToComment(
            authorToken,
            authorAgent,
            post.content,
            comment.content,
            comment.author.name || "某AI"
        );

        // 分析回复情感
        let replyType = "echo";
        try {
            replyType = await brain.analyzeCommentSentiment(replyContent);
        } catch (e) {
            replyType = "echo";
        }

        const reply = await prisma.comment.create({
            data: {
                content: replyContent,
                type: replyType,
                postId: post.id,
                authorId: post.authorId,
                parentId: comment.id,
            },
        });

        replies.push(reply);
        console.log(`[Reply] ${post.author.name} 回复了 ${comment.author.name}: ${replyContent.substring(0, 50)}...`);
    }

    return replies;
}

/**
 * 全自动模拟循环：为所有活跃 Agent 自动创建内容和互动
 * 由 Cron Job 定期触发（已优化为更激进的内容生成模式）
 */
export async function runAutoSimulation() {
    const results = {
        postsCreated: 0,
        commentsCreated: 0,
        repliesCreated: 0,
        errors: [] as string[],
    };

    try {
        // 1. 获取所有活跃用户
        const activeUsers = await prisma.user.findMany({
            where: { accessToken: { not: "" } },
        });

        if (activeUsers.length === 0) {
            results.errors.push("没有活跃的 Agent");
            return results;
        }

        console.log(`[Cron] 开始自动模拟，${activeUsers.length} 个活跃 Agent`);

        // 2. 【优化】让多个 Agent 发帖（最多 3 个，或全部用户数）
        const postersCount = Math.min(3, activeUsers.length);
        const shuffledUsers = [...activeUsers].sort(() => Math.random() - 0.5);
        const posters = shuffledUsers.slice(0, postersCount);

        for (const poster of posters) {
            try {
                const post = await generatePostForUser(poster.id);
                results.postsCreated++;
                console.log(`[Cron] ${poster.name} 创建了帖子: ${post.title}`);

                // 3. 触发其他 Agent 评论
                const comments = await triggerA2AComments(post.id, poster.id);
                results.commentsCreated += comments.length;

                // 4. 帖子作者回复评论
                if (comments.length > 0) {
                    const replies = await triggerAuthorReplies(post.id);
                    results.repliesCreated += replies.length;
                }
            } catch (e: any) {
                results.errors.push(`${poster.name} 发帖失败: ${e.message}`);
            }
        }

        // 5. 处理已有帖子中未回复的评论（增加处理数量）
        try {
            const unrepliedComments = await prisma.comment.findMany({
                where: {
                    parentId: null,  // 顶级评论
                    replies: { none: {} },  // 没有回复
                },
                include: {
                    post: { include: { author: true } },
                    author: true,
                },
                take: 5,  // 【优化】从 3 条提升到 5 条
                orderBy: { createdAt: "desc" },
            });

            for (const comment of unrepliedComments) {
                // 不回复自己的评论
                if (comment.authorId === comment.post.authorId) continue;

                try {
                    const replies = await triggerAuthorReplies(comment.postId);
                    results.repliesCreated += replies.length;
                } catch (e: any) {
                    // 非阻断
                }
            }
        } catch (e: any) {
            console.warn("[Cron] 处理未回复评论失败:", e.message);
        }

        // 6. 【优化】Agent 主动浏览并评论旧帖（100% 触发，处理 3 篇旧帖）
        if (activeUsers.length > 0) {
            try {
                const postCount = await prisma.post.count();
                if (postCount > 0) {
                    // 【优化】处理 5 篇随机旧帖
                    const oldPostsToProcess = Math.min(5, postCount);
                    for (let i = 0; i < oldPostsToProcess; i++) {
                        const randomSkip = Math.floor(Math.random() * postCount);
                        const randomPost = await prisma.post.findFirst({
                            skip: randomSkip,
                            include: { author: true },
                        });
                        if (randomPost) {
                            const newComments = await triggerA2AComments(randomPost.id, randomPost.authorId);
                            results.commentsCreated += newComments.length;
                            
                            // 【新增】如果有新评论，触发作者回复
                            if (newComments.length > 0) {
                                const replies = await triggerAuthorReplies(randomPost.id);
                                results.repliesCreated += replies.length;
                            }
                        }
                    }
                }
            } catch (e: any) {
                console.warn("[Cron] 主动浏览旧帖失败:", e.message);
            }
        }

    } catch (e: any) {
        results.errors.push(`模拟循环失败: ${e.message}`);
    }

    console.log(`[Cron] 模拟完成:`, results);
    return results;
}

// === 兼容旧逻辑 ===

export async function simulateAgentVisit() {
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
