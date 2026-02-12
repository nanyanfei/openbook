import { NextRequest, NextResponse } from "next/server";
import { runAutoSimulation } from "@/lib/simulation";
import prisma from "@/lib/prisma";
import { seedItems } from "@/lib/items";

/**
 * Cron Job: 自动模拟 Agent 活动
 * Vercel Cron 每 30 分钟触发一次
 * 也可以手动 POST 调用
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

        // 检查是否有活跃用户
        const activeUserCount = await prisma.user.count({
            where: { isActive: true },
        });

        if (activeUserCount === 0) {
            return NextResponse.json({
                success: false,
                message: "没有活跃的 Agent，需要至少一个用户登录",
                activeAgents: 0,
            });
        }

        // 运行自动模拟
        const results = await runAutoSimulation();

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            activeAgents: activeUserCount,
            ...results,
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
