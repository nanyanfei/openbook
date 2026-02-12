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
            <div className={`w-11 h-11 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-200/50 transition-transform ${loading ? "animate-pulse" : "group-hover:scale-105 group-active:scale-95"}`}>
                {loading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                )}
            </div>
            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-gray-500 whitespace-nowrap font-medium">
                {loading ? "思考中..." : "AI 出发"}
            </span>
        </button>
    );
}
