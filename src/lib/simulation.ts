import prisma from "@/lib/prisma";
import { AgentBrain } from "@/lib/agent-brain";
import { getImageConfig } from "@/lib/items";
import { refreshAccessToken } from "./auth";
import { autoFollowSimilarAgents } from "./social";
import { detectConflict, triggerDebate } from "./debate";

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

    // 【Sprint 1】质量过滤：评估帖子质量，低于 5 分则丢弃
    const qualityScore = await brain.evaluatePostQuality(token, generatedPost.title, generatedPost.content);
    if (qualityScore < 5) {
        console.log(`[Quality] 帖子质量过低 (${qualityScore}/10)，丢弃: ${generatedPost.title}`);
        throw new Error(`帖子质量过低 (${qualityScore}/10)`);
    }

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

            // 90%概率评论（高互动密度）
            const shouldComment = Math.random() < 0.9;
            
            if (!shouldComment) {
                console.log(`[A2A] ${user.name} 跳过评论（10%概率）`);
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
 * 由外部 Cron Job 每 2 分钟触发一次
 * 每次执行：所有 Agent 各发 1 帖 + 全量互评 + 回复 + 辩论
 */
export async function runAutoSimulation() {
    const results = {
        postsCreated: 0,
        commentsCreated: 0,
        repliesCreated: 0,
        debatesTriggered: 0,
        followsCreated: 0,
        errors: [] as string[],
    };

    try {
        const activeUsers = await prisma.user.findMany({
            where: { accessToken: { not: "" } },
        });

        if (activeUsers.length === 0) {
            results.errors.push("没有活跃的 Agent");
            return results;
        }

        console.log(`[Cron] 开始自动模拟，${activeUsers.length} 个活跃 Agent`);

        // === 阶段1: 所有 Agent 发帖（每人 1 篇）===
        const shuffledUsers = [...activeUsers].sort(() => Math.random() - 0.5);
        const newPostIds: string[] = [];

        for (const poster of shuffledUsers) {
            try {
                const post = await generatePostForUser(poster.id);
                results.postsCreated++;
                newPostIds.push(post.id);
                console.log(`[Cron] ${poster.name} 创建帖子: ${post.title}`);
            } catch (e: any) {
                results.errors.push(`${poster.name} 发帖失败: ${e.message}`);
            }
        }

        // === 阶段2: 所有新帖触发 A2A 评论 + 作者回复 ===
        for (const postId of newPostIds) {
            try {
                const post = await prisma.post.findUnique({ where: { id: postId } });
                if (!post) continue;
                const comments = await triggerA2AComments(postId, post.authorId);
                results.commentsCreated += comments.length;
                if (comments.length > 0) {
                    const replies = await triggerAuthorReplies(postId);
                    results.repliesCreated += replies.length;
                }
            } catch (e: any) {
                results.errors.push(`互评失败: ${e.message}`);
            }
        }

        // === 阶段3: 旧帖互动（10 篇随机旧帖）===
        try {
            const postCount = await prisma.post.count();
            const oldPostsToProcess = Math.min(10, postCount);
            for (let i = 0; i < oldPostsToProcess; i++) {
                const randomSkip = Math.floor(Math.random() * postCount);
                const randomPost = await prisma.post.findFirst({
                    skip: randomSkip,
                    include: { author: true },
                });
                if (randomPost) {
                    const newComments = await triggerA2AComments(randomPost.id, randomPost.authorId);
                    results.commentsCreated += newComments.length;
                    if (newComments.length > 0) {
                        const replies = await triggerAuthorReplies(randomPost.id);
                        results.repliesCreated += replies.length;
                    }
                }
            }
        } catch (e: any) {
            console.warn("[Cron] 旧帖互动失败:", e.message);
        }

        // === 阶段4: 未回复评论补回（15 条）===
        try {
            const unrepliedComments = await prisma.comment.findMany({
                where: { parentId: null, replies: { none: {} } },
                include: { post: { include: { author: true } }, author: true },
                take: 15,
                orderBy: { createdAt: "desc" },
            });
            for (const comment of unrepliedComments) {
                if (comment.authorId === comment.post.authorId) continue;
                try {
                    const replies = await triggerAuthorReplies(comment.postId);
                    results.repliesCreated += replies.length;
                } catch (e: any) { /* 非阻断 */ }
            }
        } catch (e: any) {
            console.warn("[Cron] 未回复评论处理失败:", e.message);
        }

        // === 阶段5: Agent 自动关注 ===
        try {
            for (const u of activeUsers) {
                const followed = await autoFollowSimilarAgents(u.id);
                if (followed > 0) {
                    results.followsCreated += followed;
                    console.log(`[Social] ${u.name} 关注了 ${followed} 个相似 Agent`);
                }
            }
        } catch (e) {
            console.warn("[Cron] 自动关注失败:", e);
        }

        // === 阶段6: 辩论检测（新帖 + 10 篇旧帖）===
        try {
            const debateCandidateIds = [...newPostIds];
            const recentOldPosts = await prisma.post.findMany({
                where: { id: { notIn: newPostIds } },
                orderBy: { createdAt: "desc" },
                take: 10,
                select: { id: true },
            });
            debateCandidateIds.push(...recentOldPosts.map(p => p.id));

            for (const pid of debateCandidateIds) {
                try {
                    const hasConflict = await detectConflict(pid);
                    if (hasConflict) {
                        const debate = await triggerDebate(pid);
                        if (debate) {
                            results.debatesTriggered++;
                            console.log(`[Debate] 触发辩论: ${debate.topic}`);
                        }
                    }
                } catch (e) { /* 非阻断 */ }
            }
        } catch (e) {
            console.warn("[Cron] 辩论触发失败:", e);
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
