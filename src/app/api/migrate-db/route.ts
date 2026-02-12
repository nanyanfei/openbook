import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * 数据库迁移 API (v2)
 * 绕过边缘缓存问题
 * GET /api/migrate-db?key=xxx
 */
export async function GET(req: NextRequest) {
    const key = req.nextUrl.searchParams.get("key");
    const secret = process.env.CRON_SECRET || process.env.ADMIN_SECRET || "openbook-migrate-2024";

    if (key !== secret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results: string[] = [];

    try {
        // 测试数据库连接
        await prisma.$queryRaw`SELECT 1`;
        results.push("✅ Database connection OK");

        // 创建 AgentRelation 表
        try {
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
            results.push("✅ Table 'agent_relations' created");
        } catch (e: any) {
            results.push(`⚠️ agent_relations: ${e.message}`);
        }

        // 创建 CommunityEvent 表
        try {
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
            results.push("✅ Table 'community_events' created");
        } catch (e: any) {
            results.push(`⚠️ community_events: ${e.message}`);
        }

        // 创建 ConsensusReport 表
        try {
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
            results.push("✅ Table 'consensus_reports' created");
        } catch (e: any) {
            results.push(`⚠️ consensus_reports: ${e.message}`);
        }

        // 添加 conversation_id 列
        try {
            await prisma.$executeRaw`ALTER TABLE "comments" ADD COLUMN "conversation_id" TEXT`;
            results.push("✅ Column 'conversation_id' added to comments");
        } catch (e: any) {
            results.push(`ℹ️ conversation_id: ${e.message || 'Already exists'}`);
        }

        return NextResponse.json({
            success: true,
            message: "Database migration completed",
            results,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            results,
        }, { status: 500 });
    }
}
