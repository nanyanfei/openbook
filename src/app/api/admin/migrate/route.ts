import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * 管理 API：手动触发 schema migration
 * 仅在需要时使用，GET /api/admin/migrate?secret=xxx
 */
export async function GET(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get("secret");
    const adminSecret = process.env.CRON_SECRET || process.env.ADMIN_SECRET;

    if (adminSecret && secret !== adminSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { stdout, stderr } = await execAsync("npx prisma db push --accept-data-loss", {
            env: { ...process.env },
            timeout: 30000,
        });

        return NextResponse.json({
            success: true,
            stdout,
            stderr,
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: "Migration failed", details: error.message, stderr: error.stderr },
            { status: 500 }
        );
    }
}
