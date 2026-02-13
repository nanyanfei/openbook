import prisma from "@/lib/prisma";
import { AgentBrain } from "@/lib/agent-brain";
import { getImageConfig, fetchImageForPost } from "@/lib/items";
import { refreshAccessToken } from "./auth";
import { autoFollowSimilarAgents } from "./social";
import { detectConflict, triggerDebate } from "./debate";
import { recordPostOpinion, recordCommentOpinion } from "./opinion";

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

    // 【F2】10% 概率触发深度研究模式
    const isResearchMode = Math.random() < 0.10;
    let generatedPost;
    let isResearch = false;

    if (isResearchMode) {
        console.log(`[Research] ${user.name} 的 AI 分身进入深度研究模式...`);
        const researchPost = await brain.conductDeepResearch(token, userAgent, item.name, item.category);
        if (researchPost) {
            generatedPost = researchPost;
            isResearch = true;
        } else {
            // 深度研究失败，回退到普通发帖
            generatedPost = await brain.generatePostForUser(token, userAgent, itemForBrain);
        }
    } else {
        generatedPost = await brain.generatePostForUser(token, userAgent, itemForBrain);
    }

    // 【Sprint 1】质量过滤：评估帖子质量，低于 5 分则丢弃（深度研究帖子跳过质量检查）
    if (!isResearch) {
        const qualityScore = await brain.evaluatePostQuality(token, generatedPost.title, generatedPost.content);
        if (qualityScore < 5) {
            console.log(`[Quality] 帖子质量过低 (${qualityScore}/10)，丢弃: ${generatedPost.title}`);
            throw new Error(`帖子质量过低 (${qualityScore}/10)`);
        }
    }

    // 获取真实配图 URL（一次获取，永久绑定）
    const imageConfig = getImageConfig(item.name, item.category);
    let imageUrl: string;
    if (imageConfig.type === "fixed" && imageConfig.urls && imageConfig.urls.length > 0) {
        // 种子数据使用预设图片，随机选一张
        imageUrl = imageConfig.urls[Math.floor(Math.random() * imageConfig.urls.length)];
    } else {
        // 从互联网获取配图（Unsplash 或 picsum）
        const uniqueId = `${user.id}-${item.name}-${Date.now()}`;
        imageUrl = await fetchImageForPost(imageConfig.keywords || "lifestyle", uniqueId);
    }

    // 创建帖子（存储实际 URL，不再存配置对象）
    const post = await prisma.post.create({
        data: {
            title: generatedPost.title,
            content: generatedPost.content,
            rating: generatedPost.rating,
            authorId: user.id,
            itemId: itemId!,
            images: JSON.stringify([imageUrl]),
            tags: JSON.stringify(generatedPost.tags),
            isResearch,
        },
    });

    // 更新用户最后活跃时间
    await prisma.user.update({
        where: { id: user.id },
        data: { lastActiveAt: new Date() },
    });

    console.log(`[A2A] 创建帖子: ${post.title}`);

    // 【F1】记录观点快照
    try {
        await recordPostOpinion(
            user.id,
            itemId!,
            item.name,
            post.id,
            generatedPost.rating,
            generatedPost.content
        );
    } catch (e) {
        console.warn("[Opinion] 发帖观点记录失败（非阻断）:", e);
    }

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
export async function triggerA2AComments(postId: string, authorId: string, maxCommenters?: number) {
    const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { author: true, item: true }
    });
    if (!post) return [];

    // 获取非作者的已登录用户，随机打乱并限制数量
    let otherUsers = await prisma.user.findMany({
        where: {
            id: { not: authorId },
            accessToken: { not: "" },
        },
    });
    otherUsers = otherUsers.sort(() => Math.random() - 0.5);
    if (maxCommenters && maxCommenters > 0) {
        otherUsers = otherUsers.slice(0, maxCommenters);
    }

    const comments = [];

    for (const user of otherUsers) {
        try {
            const token = await ensureValidToken(user.id);
            if (!token) {
                console.log(`[A2A] ${user.name} token 失效，跳过`);
                continue;
            }

            // 简化决策：80% 概率评论（节省 Act API 调用时间）
            if (Math.random() > 0.8) {
                console.log(`[A2A] ${user.name} 随机跳过`);
                continue;
            }

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

            // 简化情感分析：基于关键词快速判断（节省 API 调用）
            const commentType = quickSentiment(commentContent);

            const comment = await prisma.comment.create({
                data: {
                    content: commentContent,
                    type: commentType,
                    postId: post.id,
                    authorId: user.id,
                },
            });

            comments.push(comment);
            console.log(`[A2A] ${user.name} 评论成功: ${commentContent.substring(0, 50)}...`);

            // 【F1】记录评论者的观点快照（fire-and-forget）
            recordCommentOpinion(
                user.id, post.itemId, post.item.name,
                comment.id, commentType, commentContent
            ).catch(() => {});

            // 更新活跃时间（不 await，fire-and-forget）
            prisma.user.update({
                where: { id: user.id },
                data: { lastActiveAt: new Date() },
            }).catch(() => {});

        } catch (e) {
            console.error(`[A2A] ${user.name} 互动失败:`, e);
        }
    }

    return comments;
}

// 快速情感判断（替代 API 调用，节省 ~3s/评论）
function quickSentiment(text: string): string {
    const lower = text.toLowerCase();
    if (/不同意|不太|但是|然而|质疑|反对/.test(lower)) return "challenge";
    if (/吗|呢|？|\?|为什么|怎么/.test(lower)) return "question";
    if (/赞同|同意|确实|没错|说得好|喜欢/.test(lower)) return "echo";
    return "neutral";
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

        try {
            // 直接生成回复（跳过 shouldReply 决策 API，节省时间）
            const replyContent = await brain.generateReplyToComment(
                authorToken,
                authorAgent,
                post.content,
                comment.content,
                comment.author.name || "某AI"
            );

            const replyType = quickSentiment(replyContent);

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
        } catch (e) {
            console.error(`[Reply] 回复 ${comment.author.name} 失败:`, e);
        }
    }

    return replies;
}

/**
 * 全自动模拟循环（适配 Vercel Hobby 10s 超时）
 * 核心策略：每轮只处理 1 个 Agent，发帖+评论合并为原子操作
 * 确保每篇帖子创建后立即有评论，而不是先全部发帖再批量评论
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

        // === 核心：随机选 1 个 Agent，发帖 + 立即评论（原子操作）===
        const poster = activeUsers[Math.floor(Math.random() * activeUsers.length)];
        try {
            const post = await generatePostForUser(poster.id);
            results.postsCreated++;
            console.log(`[Cron] ${poster.name} 创建帖子: ${post.title}`);

            // 立即触发其他 Agent 评论（限制最多 3 个评论者）
            try {
                const comments = await triggerA2AComments(post.id, poster.id, 3);
                results.commentsCreated += comments.length;
                console.log(`[Cron] 帖子获得 ${comments.length} 条评论`);

                // 作者回复评论
                if (comments.length > 0) {
                    try {
                        const replies = await triggerAuthorReplies(post.id);
                        results.repliesCreated += replies.length;
                    } catch { /* 非阻断 */ }
                }
            } catch (e: any) {
                results.errors.push(`评论生成失败: ${e.message}`);
            }

            // 辩论检测（轻量，单帖）
            try {
                const hasConflict = await detectConflict(post.id);
                if (hasConflict) {
                    const debate = await triggerDebate(post.id);
                    if (debate) results.debatesTriggered++;
                }
            } catch { /* 非阻断 */ }

        } catch (e: any) {
            results.errors.push(`${poster.name} 发帖失败: ${e.message}`);
        }

        // === 补充：1 篇随机旧帖补评论（让旧内容也有互动）===
        try {
            const postCount = await prisma.post.count();
            if (postCount > 1) {
                const randomSkip = Math.floor(Math.random() * postCount);
                const randomPost = await prisma.post.findFirst({
                    skip: randomSkip,
                    include: { author: true },
                });
                if (randomPost) {
                    const newComments = await triggerA2AComments(randomPost.id, randomPost.authorId, 2);
                    results.commentsCreated += newComments.length;
                    if (newComments.length > 0) {
                        try {
                            const replies = await triggerAuthorReplies(randomPost.id);
                            results.repliesCreated += replies.length;
                        } catch { /* 非阻断 */ }
                    }
                }
            }
        } catch (e: any) {
            console.warn("[Cron] 旧帖互动失败:", e.message);
        }

        // === 轻量任务：自动关注（仅当前 poster）===
        try {
            const followed = await autoFollowSimilarAgents(poster.id);
            if (followed > 0) {
                results.followsCreated += followed;
            }
        } catch { /* 非阻断 */ }

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
