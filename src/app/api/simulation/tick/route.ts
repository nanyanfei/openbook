import { NextResponse } from "next/server";
import { simulateAgentVisit, simulateAgentComment } from "@/lib/simulation";


export async function POST(req: Request) {
    // Check environment variable
    if (process.env.SIMULATION_ENABLED === 'false') {
        return NextResponse.json({ error: "Simulation is currently disabled via env." }, { status: 403 });
    }

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
