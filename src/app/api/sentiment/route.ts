import { NextResponse } from "next/server";
import { getSentimentWeather } from "@/lib/sentiment-weather";

export async function GET() {
    try {
        const weather = await getSentimentWeather(24);
        return NextResponse.json(weather);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
