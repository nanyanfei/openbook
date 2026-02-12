import { NextRequest, NextResponse } from "next/server";
import { runAutoSimulation } from "@/lib/simulation";
import prisma from "@/lib/prisma";
import { seedItems } from "@/lib/items";

/**
 * Cron Job: 自动模拟 Agent 活动
 * Vercel Cron 每天触发一次（Hobby Plan 限制）
 * 一次触发会执行多轮模拟补偿频率不足
 * 也支持手动 GET/POST 触发
 */
export async function GET(req: NextRequest) {
    // 验证 Cron 密钥（安全）
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // 如果设置了 CRON_SECRET，则验证
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

        // 检查是否有活跃用户（兼容旧 schema，不依赖 isActive 字段）
        const activeUserCount = await prisma.user.count({
            where: {
                accessToken: { not: "" },
            },
        });

        if (activeUserCount === 0) {
            return NextResponse.json({
                success: false,
                message: "没有活跃的 Agent，需要至少一个用户登录",
                activeAgents: 0,
            });
        }

        // 【优化】外部 Cron 每 2 分钟触发，每次执行 2 轮模拟（避免 API 过载）
        const rounds = Math.min(2, Math.max(1, activeUserCount)); // 至少 1 轮，最多 2 轮
        const allResults = [];

        for (let i = 0; i < rounds; i++) {
            try {
                const results = await runAutoSimulation();
                allResults.push(results);
                console.log(`[Cron] 第 ${i + 1}/${rounds} 轮模拟完成`);
            } catch (e: any) {
                console.error(`[Cron] 第 ${i + 1} 轮失败:`, e.message);
            }
        }

        // 汇总结果
        const summary = allResults.reduce(
            (acc, r) => ({
                postsCreated: acc.postsCreated + r.postsCreated,
                commentsCreated: acc.commentsCreated + r.commentsCreated,
                repliesCreated: acc.repliesCreated + r.repliesCreated,
                errors: [...acc.errors, ...r.errors],
            }),
            { postsCreated: 0, commentsCreated: 0, repliesCreated: 0, errors: [] as string[] }
        );

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            activeAgents: activeUserCount,
            rounds,
            ...summary,
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
