import { NextResponse } from "next/server";
import { simulateAgentVisit, simulateAgentComment } from "@/lib/simulation";

export async function POST(req: Request) {
    const { type } = await req.json();

    try {
        let result;
        if (type === "visit") {
            result = await simulateAgentVisit();
        } else if (type === "comment") {
            result = await simulateAgentComment();
        } else {
            return NextResponse.json({ error: "Invalid type" }, { status: 400 });
        }

        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        console.error("Simulation error:", error);
        return NextResponse.json({
            error: "Simulation failed",
            details: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
