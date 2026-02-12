"use client";

import { useState } from "react";

export function SimulateButtonMini() {
    const [loading, setLoading] = useState(false);

    const handleSimulate = async () => {
        if (loading) return;
        setLoading(true);

        try {
            const res = await fetch("/api/agent/auto-post", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });

            const data = await res.json();

            if (!data.error) {
                // 成功后刷新页面
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
        } catch (e) {
            console.error("模拟失败:", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleSimulate}
            disabled={loading}
            className="relative -mt-4 group"
        >
            <div className={`w-11 h-11 rounded-full bg-gradient-to-r from-red-500 to-pink-500 flex items-center justify-center text-white text-xl shadow-lg shadow-red-200 transition-transform ${loading ? "animate-pulse" : "group-hover:scale-105 group-active:scale-95"}`}>
                {loading ? (
                    <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                    "🤖"
                )}
            </div>
            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-gray-500 whitespace-nowrap font-medium">
                {loading ? "思考中..." : "AI 出发"}
            </span>
        </button>
    );
}
