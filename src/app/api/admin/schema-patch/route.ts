import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

/**
 * 手动 Patch 数据库 Schema (通过 Raw SQL - PostgreSQL)
 * 用于解决无法在 Vercel 环境运行 prisma db push 的问题
 * 此端点覆盖 Sprint 1-6 所有 Schema 变更
 *
 * GET /api/admin/schema-patch?secret=xxx
 */
export async function GET(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get("secret");
    const adminSecret = process.env.CRON_SECRET || process.env.ADMIN_SECRET;

    // 简单的鉴权
    if (adminSecret && secret !== adminSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const results = [];

        // 0. 连接检查
        await prisma.$queryRaw`SELECT 1`;
        results.push("✅ DB connected");

        // ===== 1. Items 表新字段 =====
        try {
            await prisma.$executeRaw`ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "is_niche" BOOLEAN NOT NULL DEFAULT false`;
            results.push("✅ items.is_niche");
        } catch (e: any) { results.push(`ℹ️ is_niche: ${e.message}`); }

        try {
            await prisma.$executeRaw`ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "source" TEXT`;
            results.push("✅ items.source");
        } catch (e: any) { results.push(`ℹ️ source: ${e.message}`); }

        // ===== 2. Users 表新字段 =====
        try {
            await prisma.$executeRaw`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_active_at" TIMESTAMP(3)`;
            results.push("✅ users.last_active_at");
        } catch (e: any) { results.push(`ℹ️ last_active_at: ${e.message}`); }

        try {
            await prisma.$executeRaw`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true`;
            results.push("✅ users.is_active");
        } catch (e: any) { results.push(`ℹ️ is_active: ${e.message}`); }

        // ===== 3. Comments 表新字段 =====
        try {
            await prisma.$executeRaw`ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "parent_id" TEXT`;
            results.push("✅ comments.parent_id");
        } catch (e: any) { results.push(`ℹ️ parent_id: ${e.message}`); }

        try {
            await prisma.$executeRaw`ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "conversation_id" TEXT`;
            results.push("✅ comments.conversation_id");
        } catch (e: any) { results.push(`ℹ️ conversation_id: ${e.message}`); }

        // ===== 4.【Sprint 3】Agent 社交关系表 =====
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
            results.push("✅ agent_relations table");
        } catch (e: any) { results.push(`ℹ️ agent_relations: ${e.message}`); }

        try {
            await prisma.$executeRaw`
                CREATE UNIQUE INDEX IF NOT EXISTS "agent_relations_from_agent_id_to_agent_id_key"
                ON "agent_relations" ("from_agent_id", "to_agent_id")
            `;
            results.push("✅ agent_relations unique index");
        } catch (e: any) { results.push(`ℹ️ agent_relations idx: ${e.message}`); }

        // ===== 5.【Sprint 5】社区事件表 =====
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
            results.push("✅ community_events table");
        } catch (e: any) { results.push(`ℹ️ community_events: ${e.message}`); }

        // ===== 6.【Sprint 6】共识报告表 =====
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
            results.push("✅ consensus_reports table");
        } catch (e: any) { results.push(`ℹ️ consensus_reports: ${e.message}`); }

        return NextResponse.json({
            success: true,
            results,
            timestamp: new Date().toISOString(),
        });

    } catch (error: any) {
        return NextResponse.json(
            { error: "Patch failed", details: error.message },
            { status: 500 }
        );
    }
}
