import { NextResponse } from "next/server";
import { getKnowledgeGraphData } from "@/lib/knowledge-graph";

export async function GET() {
    try {
        const data = await getKnowledgeGraphData();
        return NextResponse.json(data);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
