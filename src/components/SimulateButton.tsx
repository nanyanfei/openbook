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
        <div className="flex flex-col items-center gap-2">
            <button
                onClick={handleSimulate}
                disabled={loading}
                className="px-4 py-2 bg-gray-900 text-white text-[12px] font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
                {loading ? (
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        思考中...
                    </span>
                ) : (
                    "让 AI 出发"
                )}
            </button>
            {status && (
                <p className="text-[11px] text-gray-500 text-center max-w-[240px] line-clamp-2">
                    {status}
                </p>
            )}
        </div>
    );
}
