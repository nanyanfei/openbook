import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateRecommendations } from "@/lib/recommendation";

export async function GET() {
    try {
        const user = await getSession();
        if (!user) {
            return NextResponse.json({ error: "未登录" }, { status: 401 });
        }

        const recommendations = await generateRecommendations(user.id, 5);
        return NextResponse.json(recommendations);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
