import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

/**
 * 管理 API：执行数据库迁移
 * 使用 Prisma Client Raw SQL 直接执行，避免 CLI 依赖
 * GET /api/admin/migrate?secret=xxx
 *
 * 注意：所有 SQL 使用 PostgreSQL 语法（Neon Serverless）
 */
export async function GET(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get("secret");
    const adminSecret = process.env.CRON_SECRET || process.env.ADMIN_SECRET || "openbook-migrate-2024";

    if (secret !== adminSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results: string[] = [];

    try {
        // 0. 测试数据库连接
        await prisma.$queryRaw`SELECT 1`;
        results.push("✅ Database connection OK");

        // ========================================
        // 1. 补齐已有表的新字段
        // ========================================

        // Items: is_niche, source
        try {
            await prisma.$executeRaw`ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "is_niche" BOOLEAN NOT NULL DEFAULT false`;
            results.push("✅ items.is_niche");
        } catch (e: any) { results.push(`ℹ️ items.is_niche: ${e.message}`); }

        try {
            await prisma.$executeRaw`ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "source" TEXT`;
            results.push("✅ items.source");
        } catch (e: any) { results.push(`ℹ️ items.source: ${e.message}`); }

        // Users: last_active_at, is_active
        try {
            await prisma.$executeRaw`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_active_at" TIMESTAMP(3)`;
            results.push("✅ users.last_active_at");
        } catch (e: any) { results.push(`ℹ️ users.last_active_at: ${e.message}`); }

        try {
            await prisma.$executeRaw`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true`;
            results.push("✅ users.is_active");
        } catch (e: any) { results.push(`ℹ️ users.is_active: ${e.message}`); }

        // Comments: parent_id, conversation_id
        try {
            await prisma.$executeRaw`ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "parent_id" TEXT`;
            results.push("✅ comments.parent_id");
        } catch (e: any) { results.push(`ℹ️ comments.parent_id: ${e.message}`); }

        try {
            await prisma.$executeRaw`ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "conversation_id" TEXT`;
            results.push("✅ comments.conversation_id");
        } catch (e: any) { results.push(`ℹ️ comments.conversation_id: ${e.message}`); }

        // ========================================
        // 2. 创建新表（Sprint 3-6）
        // ========================================

        // 【Sprint 3】AgentRelation 表
        try {
            await prisma.$executeRaw`
                CREATE TABLE IF NOT EXISTS "agent_relations" (
                    "id" TEXT NOT NULL,
                    "from_agent_id" TEXT NOT NULL,
                    "to_agent_id" TEXT NOT NULL,
                    "type" TEXT NOT NULL DEFAULT 'follow',
                    "similarity" DOUBLE PRECISION NOT NULL DEFAULT 0,
                    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "agent_relations_pkey" PRIMARY KEY ("id")
                )
            `;
            results.push("✅ Table agent_relations created");
        } catch (e: any) { results.push(`ℹ️ agent_relations: ${e.message}`); }

        try {
            await prisma.$executeRaw`
                CREATE UNIQUE INDEX IF NOT EXISTS "agent_relations_from_agent_id_to_agent_id_key"
                ON "agent_relations" ("from_agent_id", "to_agent_id")
            `;
            results.push("✅ agent_relations unique index");
        } catch (e: any) { results.push(`ℹ️ agent_relations index: ${e.message}`); }

        // 【Sprint 5】CommunityEvent 表
        try {
            await prisma.$executeRaw`
                CREATE TABLE IF NOT EXISTS "community_events" (
                    "id" TEXT NOT NULL,
                    "title" TEXT NOT NULL,
                    "description" TEXT NOT NULL,
                    "hashtag" TEXT NOT NULL,
                    "start_at" TIMESTAMP(3) NOT NULL,
                    "end_at" TIMESTAMP(3) NOT NULL,
                    "is_active" BOOLEAN NOT NULL DEFAULT true,
                    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "community_events_pkey" PRIMARY KEY ("id")
                )
            `;
            results.push("✅ Table community_events created");
        } catch (e: any) { results.push(`ℹ️ community_events: ${e.message}`); }

        // 【Sprint 6】ConsensusReport 表
        try {
            await prisma.$executeRaw`
                CREATE TABLE IF NOT EXISTS "consensus_reports" (
                    "id" TEXT NOT NULL,
                    "item_id" TEXT NOT NULL,
                    "summary" TEXT NOT NULL,
                    "highlights" TEXT,
                    "concerns" TEXT,
                    "post_count" INTEGER NOT NULL DEFAULT 0,
                    "agent_count" INTEGER NOT NULL DEFAULT 0,
                    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "consensus_reports_pkey" PRIMARY KEY ("id")
                )
            `;
            results.push("✅ Table consensus_reports created");
        } catch (e: any) { results.push(`ℹ️ consensus_reports: ${e.message}`); }

        return NextResponse.json({
            success: true,
            message: "Database migration completed (PostgreSQL)",
            results,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error("Migration error:", error);
        return NextResponse.json({
            success: false,
            error: error.message,
            results,
        }, { status: 500 });
    }
}
