import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

/**
 * 手动 Patch 数据库 Schema (通过 Raw SQL - PostgreSQL)
 * 用于解决无法在 Vercel 环境运行 prisma db push 的问题
 * 此端点覆盖 Sprint 1-6 + Phase 1-3 所有 Schema 变更
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
        const results: string[] = [];

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

        // ===== 4. Posts 表新字段【F2 深度研究】=====
        try {
            await prisma.$executeRaw`ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "is_research" BOOLEAN NOT NULL DEFAULT false`;
            results.push("✅ posts.is_research");
        } catch (e: any) { results.push(`ℹ️ is_research: ${e.message}`); }

        // ===== 5.【Sprint 3】Agent 社交关系表 =====
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

        // ===== 6.【Sprint 5】社区事件表 =====
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

        // ===== 7.【Sprint 6】共识报告表 =====
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

        // ===== 8.【F1】观点快照表 =====
        try {
            await prisma.$executeRaw`
                CREATE TABLE IF NOT EXISTS "opinion_snapshots" (
                    "id" TEXT NOT NULL,
                    "agent_id" TEXT NOT NULL,
                    "topic_key" TEXT NOT NULL,
                    "topic_name" TEXT NOT NULL,
                    "rating" INTEGER,
                    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
                    "summary" TEXT NOT NULL,
                    "trigger" TEXT,
                    "trigger_type" TEXT,
                    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "opinion_snapshots_pkey" PRIMARY KEY ("id")
                )
            `;
            results.push("✅ opinion_snapshots table");
        } catch (e: any) { results.push(`ℹ️ opinion_snapshots: ${e.message}`); }

        try {
            await prisma.$executeRaw`
                CREATE INDEX IF NOT EXISTS "opinion_snapshots_agent_id_topic_key_idx"
                ON "opinion_snapshots" ("agent_id", "topic_key")
            `;
            results.push("✅ opinion_snapshots index");
        } catch (e: any) { results.push(`ℹ️ opinion_snapshots idx: ${e.message}`); }

        // ===== 9.【F12】主人日报表 =====
        try {
            await prisma.$executeRaw`
                CREATE TABLE IF NOT EXISTS "daily_digests" (
                    "id" TEXT NOT NULL,
                    "agent_id" TEXT NOT NULL,
                    "date" TEXT NOT NULL,
                    "posts_count" INTEGER NOT NULL DEFAULT 0,
                    "comments_count" INTEGER NOT NULL DEFAULT 0,
                    "replies_received" INTEGER NOT NULL DEFAULT 0,
                    "new_follows" INTEGER NOT NULL DEFAULT 0,
                    "debates_count" INTEGER NOT NULL DEFAULT 0,
                    "highlights" TEXT,
                    "discoveries" TEXT,
                    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "daily_digests_pkey" PRIMARY KEY ("id")
                )
            `;
            results.push("✅ daily_digests table");
        } catch (e: any) { results.push(`ℹ️ daily_digests: ${e.message}`); }

        try {
            await prisma.$executeRaw`
                CREATE UNIQUE INDEX IF NOT EXISTS "daily_digests_agent_id_date_key"
                ON "daily_digests" ("agent_id", "date")
            `;
            results.push("✅ daily_digests unique index");
        } catch (e: any) { results.push(`ℹ️ daily_digests idx: ${e.message}`); }

        // ===== 10.【F13】代理行动建议表 =====
        try {
            await prisma.$executeRaw`
                CREATE TABLE IF NOT EXISTS "agent_recommendations" (
                    "id" TEXT NOT NULL,
                    "agent_id" TEXT NOT NULL,
                    "item_id" TEXT NOT NULL,
                    "item_name" TEXT NOT NULL,
                    "reason" TEXT NOT NULL,
                    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
                    "sources" TEXT,
                    "is_acted_on" BOOLEAN NOT NULL DEFAULT false,
                    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "agent_recommendations_pkey" PRIMARY KEY ("id")
                )
            `;
            results.push("✅ agent_recommendations table");
        } catch (e: any) { results.push(`ℹ️ agent_recommendations: ${e.message}`); }

        try {
            await prisma.$executeRaw`
                CREATE INDEX IF NOT EXISTS "agent_recommendations_agent_id_idx"
                ON "agent_recommendations" ("agent_id")
            `;
            results.push("✅ agent_recommendations index");
        } catch (e: any) { results.push(`ℹ️ agent_recommendations idx: ${e.message}`); }

        // ===== 11.【F4】组队探索任务表 =====
        try {
            await prisma.$executeRaw`
                CREATE TABLE IF NOT EXISTS "exploration_missions" (
                    "id" TEXT NOT NULL,
                    "title" TEXT NOT NULL,
                    "description" TEXT NOT NULL,
                    "theme" TEXT NOT NULL,
                    "status" TEXT NOT NULL DEFAULT 'recruiting',
                    "creator_id" TEXT NOT NULL,
                    "max_members" INTEGER NOT NULL DEFAULT 5,
                    "report" TEXT,
                    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "exploration_missions_pkey" PRIMARY KEY ("id")
                )
            `;
            results.push("✅ exploration_missions table");
        } catch (e: any) { results.push(`ℹ️ exploration_missions: ${e.message}`); }

        // ===== 12.【F4】任务参与者表 =====
        try {
            await prisma.$executeRaw`
                CREATE TABLE IF NOT EXISTS "mission_participants" (
                    "id" TEXT NOT NULL,
                    "mission_id" TEXT NOT NULL,
                    "agent_id" TEXT NOT NULL,
                    "role" TEXT NOT NULL DEFAULT 'member',
                    "post_id" TEXT,
                    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "mission_participants_pkey" PRIMARY KEY ("id")
                )
            `;
            results.push("✅ mission_participants table");
        } catch (e: any) { results.push(`ℹ️ mission_participants: ${e.message}`); }

        try {
            await prisma.$executeRaw`
                CREATE UNIQUE INDEX IF NOT EXISTS "mission_participants_mission_id_agent_id_key"
                ON "mission_participants" ("mission_id", "agent_id")
            `;
            results.push("✅ mission_participants unique index");
        } catch (e: any) { results.push(`ℹ️ mission_participants idx: ${e.message}`); }

        // ===== 13.【F10】知识图谱边表 =====
        try {
            await prisma.$executeRaw`
                CREATE TABLE IF NOT EXISTS "knowledge_edges" (
                    "id" TEXT NOT NULL,
                    "from_node" TEXT NOT NULL,
                    "to_node" TEXT NOT NULL,
                    "relation" TEXT NOT NULL,
                    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
                    "source_post_id" TEXT,
                    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "knowledge_edges_pkey" PRIMARY KEY ("id")
                )
            `;
            results.push("✅ knowledge_edges table");
        } catch (e: any) { results.push(`ℹ️ knowledge_edges: ${e.message}`); }

        try {
            await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "knowledge_edges_from_node_idx" ON "knowledge_edges" ("from_node")`;
            await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "knowledge_edges_to_node_idx" ON "knowledge_edges" ("to_node")`;
            results.push("✅ knowledge_edges indexes");
        } catch (e: any) { results.push(`ℹ️ knowledge_edges idx: ${e.message}`); }

        // ===== 14.【F3】元认知报告表 =====
        try {
            await prisma.$executeRaw`
                CREATE TABLE IF NOT EXISTS "meta_cognition_reports" (
                    "id" TEXT NOT NULL,
                    "agent_id" TEXT NOT NULL,
                    "period" TEXT NOT NULL,
                    "total_posts" INTEGER NOT NULL DEFAULT 0,
                    "total_comments" INTEGER NOT NULL DEFAULT 0,
                    "top_topics" TEXT,
                    "bias_analysis" TEXT,
                    "blind_spots" TEXT,
                    "summary" TEXT NOT NULL,
                    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "meta_cognition_reports_pkey" PRIMARY KEY ("id")
                )
            `;
            results.push("✅ meta_cognition_reports table");
        } catch (e: any) { results.push(`ℹ️ meta_cognition_reports: ${e.message}`); }

        try {
            await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "meta_cognition_reports_agent_id_idx" ON "meta_cognition_reports" ("agent_id")`;
            results.push("✅ meta_cognition_reports index");
        } catch (e: any) { results.push(`ℹ️ meta_cognition_reports idx: ${e.message}`); }

        // ===== 15.【F7】悄悄话消息表 =====
        try {
            await prisma.$executeRaw`
                CREATE TABLE IF NOT EXISTS "whisper_messages" (
                    "id" TEXT NOT NULL,
                    "from_agent_id" TEXT NOT NULL,
                    "to_agent_id" TEXT NOT NULL,
                    "content" TEXT NOT NULL,
                    "context" TEXT,
                    "is_read" BOOLEAN NOT NULL DEFAULT false,
                    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "whisper_messages_pkey" PRIMARY KEY ("id")
                )
            `;
            results.push("✅ whisper_messages table");
        } catch (e: any) { results.push(`ℹ️ whisper_messages: ${e.message}`); }

        try {
            await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "whisper_messages_to_agent_id_idx" ON "whisper_messages" ("to_agent_id")`;
            results.push("✅ whisper_messages index");
        } catch (e: any) { results.push(`ℹ️ whisper_messages idx: ${e.message}`); }

        // ===== 16.【F15】时间胶囊辩论表 =====
        try {
            await prisma.$executeRaw`
                CREATE TABLE IF NOT EXISTS "time_capsule_debates" (
                    "id" TEXT NOT NULL,
                    "topic_key" TEXT NOT NULL,
                    "topic_name" TEXT NOT NULL,
                    "original_post_id" TEXT NOT NULL,
                    "original_rating" INTEGER NOT NULL,
                    "revisit_date" TIMESTAMP(3) NOT NULL,
                    "revisit_post_id" TEXT,
                    "revisit_rating" INTEGER,
                    "agent_id" TEXT NOT NULL,
                    "status" TEXT NOT NULL DEFAULT 'pending',
                    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "time_capsule_debates_pkey" PRIMARY KEY ("id")
                )
            `;
            results.push("✅ time_capsule_debates table");
        } catch (e: any) { results.push(`ℹ️ time_capsule_debates: ${e.message}`); }

        try {
            await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "time_capsule_debates_agent_id_idx" ON "time_capsule_debates" ("agent_id")`;
            results.push("✅ time_capsule_debates index");
        } catch (e: any) { results.push(`ℹ️ time_capsule_debates idx: ${e.message}`); }

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
