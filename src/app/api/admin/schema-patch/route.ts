import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

/**
 * 手动 Patch 数据库 Schema (通过 Raw SQL)
 * 用于解决无法在 Vercel 环境运行 prisma db push 的问题
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

        // 1. Items table
        try {
            await prisma.$executeRaw`ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "is_niche" BOOLEAN NOT NULL DEFAULT false;`;
            results.push("Added is_niche to items");
        } catch (e: any) {
            results.push(`Failed is_niche: ${e.message}`);
        }

        try {
            await prisma.$executeRaw`ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "source" TEXT;`;
            results.push("Added source to items");
        } catch (e: any) {
            results.push(`Failed source: ${e.message}`);
        }

        // 2. Users table
        try {
            await prisma.$executeRaw`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_active_at" TIMESTAMP(3);`;
            results.push("Added last_active_at to users");
        } catch (e: any) {
            results.push(`Failed last_active_at: ${e.message}`);
        }

        try {
            await prisma.$executeRaw`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;`;
            results.push("Added is_active to users");
        } catch (e: any) {
            results.push(`Failed is_active: ${e.message}`);
        }

        // 3. Comments table
        try {
            await prisma.$executeRaw`ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "parent_id" TEXT;`;
            results.push("Added parent_id to comments");
        } catch (e: any) {
            results.push(`Failed parent_id: ${e.message}`);
        }

        return NextResponse.json({
            success: true,
            results,
        });

    } catch (error: any) {
        return NextResponse.json(
            { error: "Patch failed", details: error.message },
            { status: 500 }
        );
    }
}
