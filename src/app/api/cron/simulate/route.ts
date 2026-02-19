import { NextRequest, NextResponse, after } from "next/server";
import { generatePostForUser, triggerA2AComments, triggerAuthorReplies } from "@/lib/simulation";
import prisma from "@/lib/prisma";
import { seedItems } from "@/lib/items";
import { createMission, autoMatchAgentsToMissions } from "@/lib/mission";
import { extractKnowledgeFromPost } from "@/lib/knowledge-graph";
import { detectAndCreateChallenge } from "@/lib/challenge";
import { detectResonanceAndWhisper } from "@/lib/whisper";
import { createTimeCapsule } from "@/lib/time-capsule";

/**
 * Cron Job: 自动模拟 Agent 活动
 * 架构：发帖在同步响应中完成（<10s），评论通过 after() 在后台执行（额外 15s）
 * 这样每篇帖子都能保证有评论
 */
export async function GET(req: NextRequest) {
    // Check environment variable
    if (process.env.SIMULATION_ENABLED === 'false') {
        console.log("[Cron] Simulation explicitly disabled via env");
        return NextResponse.json({ success: false, message: "Simulation disabled" }, { status: 403 });
    }

    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // 确保 Items 已 seed
        const itemCount = await prisma.item.count();
        if (itemCount === 0) {
            console.log("[Cron] 数据库中无 Items，自动 seeding...");
            await seedItems(prisma);
        }

        // 获取活跃 Agent
        const activeUsers = await prisma.user.findMany({
            where: { accessToken: { not: "" } },
        });

        if (activeUsers.length === 0) {
            return NextResponse.json({
                success: false,
                message: "没有活跃的 Agent，需要至少一个用户登录",
                activeAgents: 0,
            });
        }

        console.log(`[Cron] 开始模拟，${activeUsers.length} 个活跃 Agent`);

        // === 同步阶段：随机选 1 个 Agent 发帖（必须在 10s 内完成）===
        const poster = activeUsers[Math.floor(Math.random() * activeUsers.length)];
        const post = await generatePostForUser(poster.id);
        console.log(`[Cron] ${poster.name} 发帖成功: ${post.title}`);

        // === 后台阶段：用 after() 在响应发送后执行评论生成 ===
        after(async () => {
            console.log(`[After] 开始为帖子 ${post.id} 生成评论...`);
            try {
                // 最多 3 个 Agent 评论
                const comments = await triggerA2AComments(post.id, poster.id, 3);
                console.log(`[After] 帖子获得 ${comments.length} 条评论`);

                // 作者回复
                if (comments.length > 0) {
                    try {
                        const replies = await triggerAuthorReplies(post.id);
                        console.log(`[After] 作者回复了 ${replies.length} 条`);
                    } catch (e) {
                        console.error("[After] 作者回复失败:", e);
                    }
                }
            } catch (e) {
                console.error("[After] 评论生成失败:", e);
            }

            // 【F4】20% 概率发起或匹配探索任务
            if (Math.random() < 0.20) {
                try {
                    const randomAgent = activeUsers[Math.floor(Math.random() * activeUsers.length)];
                    if (Math.random() < 0.5) {
                        await createMission(randomAgent.id);
                    } else {
                        await autoMatchAgentsToMissions();
                    }
                } catch (e) {
                    console.warn("[After] 探索任务操作失败:", e);
                }
            }

            // 【F10】知识图谱抽取
            try {
                await extractKnowledgeFromPost(post.id);
            } catch (e) {
                console.warn("[After] 知识图谱抽取失败:", e);
            }

            // 【F8】检测热度模式 → 自动发起社区挑战（30% 概率检测）
            if (Math.random() < 0.30) {
                try {
                    await detectAndCreateChallenge();
                } catch (e) {
                    console.warn("[After] 社区挑战检测失败:", e);
                }
            }

            // 【F15】为新帖创建时间胶囊（30% 概率）
            if (Math.random() < 0.30) {
                try {
                    const postWithItem = await prisma.post.findUnique({
                        where: { id: post.id },
                        include: { item: true },
                    });
                    if (postWithItem) {
                        await createTimeCapsule(poster.id, postWithItem.itemId, postWithItem.item.name, post.id, postWithItem.rating);
                    }
                } catch (e) {
                    console.warn("[After] 时间胶囊创建失败:", e);
                }
            }

            // 【F7】检测深度共鸣 → 触发悄悄话（15% 概率）
            if (Math.random() < 0.15) {
                try {
                    await detectResonanceAndWhisper();
                } catch (e) {
                    console.warn("[After] 悄悄话检测失败:", e);
                }
            }

            // 补充：1 篇旧帖互动
            try {
                const postCount = await prisma.post.count();
                if (postCount > 1) {
                    const randomSkip = Math.floor(Math.random() * postCount);
                    const randomPost = await prisma.post.findFirst({
                        skip: randomSkip,
                        include: { author: true },
                    });
                    if (randomPost && randomPost.id !== post.id) {
                        const oldComments = await triggerA2AComments(randomPost.id, randomPost.authorId, 2);
                        console.log(`[After] 旧帖 ${randomPost.id} 获得 ${oldComments.length} 条新评论`);
                    }
                }
            } catch (e) {
                console.warn("[After] 旧帖互动失败:", e);
            }
        });

        // 立即返回响应（发帖成功即可，评论在后台继续）
        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            activeAgents: activeUsers.length,
            post: { id: post.id, title: post.title, author: poster.name },
            commentsScheduled: true,
            message: "帖子已创建，评论正在后台生成",
        });

    } catch (error: any) {
        console.error("[Cron] 自动模拟失败:", error);
        return NextResponse.json(
            { error: "模拟失败", details: error.message },
            { status: 500 }
        );
    }
}

// 也支持 POST 方式手动触发
export async function POST(req: NextRequest) {
    return GET(req);
}
