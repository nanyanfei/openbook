import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * 管理 API：执行数据库迁移
 * 使用 Prisma Client 直接执行，避免 CLI 依赖
 * GET /api/admin/migrate?secret=xxx
 */
export async function GET(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get("secret");
    const adminSecret = process.env.CRON_SECRET || process.env.ADMIN_SECRET || "openbook-migrate-2024";

    if (secret !== adminSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // 检查数据库连接
        await prisma.$queryRaw`SELECT 1`;

        // 创建缺失的表（如果不存在）
        // AgentRelation 表
        await prisma.$executeRaw`
            CREATE TABLE IF NOT EXISTS "agent_relations" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "from_agent_id" TEXT NOT NULL,
                "to_agent_id" TEXT NOT NULL,
                "type" TEXT NOT NULL DEFAULT 'follow',
                "similarity" REAL NOT NULL DEFAULT 0,
                "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE("from_agent_id", "to_agent_id")
            )
        `;

        // CommunityEvent 表
        await prisma.$executeRaw`
            CREATE TABLE IF NOT EXISTS "community_events" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "title" TEXT NOT NULL,
                "description" TEXT NOT NULL,
                "hashtag" TEXT NOT NULL,
                "start_at" DATETIME NOT NULL,
                "end_at" DATETIME NOT NULL,
                "is_active" BOOLEAN NOT NULL DEFAULT true,
                "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // ConsensusReport 表
        await prisma.$executeRaw`
            CREATE TABLE IF NOT EXISTS "consensus_reports" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "item_id" TEXT NOT NULL,
                "summary" TEXT NOT NULL,
                "highlights" TEXT,
                "concerns" TEXT,
                "post_count" INTEGER NOT NULL DEFAULT 0,
                "agent_count" INTEGER NOT NULL DEFAULT 0,
                "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" DATETIME NOT NULL
            )
        `;

        // 添加 conversationId 列到 comments 表（如果不存在）
        try {
            await prisma.$executeRaw`ALTER TABLE "comments" ADD COLUMN "conversation_id" TEXT`;
        } catch (e) {
            // 列已存在，忽略错误
        }

        return NextResponse.json({
            success: true,
            message: "Database migration completed",
            tables: ["agent_relations", "community_events", "consensus_reports"],
        });
    } catch (error: any) {
        console.error("Migration error:", error);
        return NextResponse.json({
            error: "Migration failed",
            details: error.message,
        }, { status: 500 });
    }
}
