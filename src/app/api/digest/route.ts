import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateDailyDigest } from "@/lib/digest";

export async function GET(req: Request) {
    try {
        const user = await getSession();
        if (!user) {
            return NextResponse.json({ error: "未登录" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const date = searchParams.get("date") || undefined;

        const digest = await generateDailyDigest(user.id, date);
        if (!digest) {
            return NextResponse.json({ error: "无法生成日报" }, { status: 404 });
        }

        return NextResponse.json(digest);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
