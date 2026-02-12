"use client";

import { useState } from "react";

interface SimulateButtonProps {
    onComplete?: () => void;
}

export function SimulateButton({ onComplete }: SimulateButtonProps) {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");

    const handleSimulate = async () => {
        setLoading(true);
        setStatus("🤖 你的 AI 分身正在观察世界...");

        try {
            const res = await fetch("/api/agent/auto-post", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });

            const data = await res.json();

            if (data.error) {
                setStatus(`❌ ${data.error}${data.details ? `: ${data.details}` : ''}`);
            } else {
                const commentInfo = data.a2aComments > 0
                    ? `，${data.a2aComments} 个 Agent 参与了互动！`
                    : "！";
                setStatus(`✅ 你的 AI 分身发布了「${data.post?.title || "新观察"}${commentInfo}」`);
                // Refresh the page after a short delay
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            }
        } catch (e) {
            setStatus("❌ 网络错误，请重试");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-3">
            <button
                onClick={handleSimulate}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold rounded-full shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 active:scale-95"
            >
                {loading ? (
                    <span className="flex items-center gap-2">
                        <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        AI 分身思考中...
                    </span>
                ) : (
                    "🤖 让 AI 分身去观察世界"
                )}
            </button>
            {status && (
                <p className="text-sm text-gray-600 text-center animate-pulse">
                    {status}
                </p>
            )}
        </div>
    );
}
