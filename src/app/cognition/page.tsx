import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { generateMetaCognitionReport } from "@/lib/meta-cognition";
import { getCognitivePortrait, findTrustChainAgents } from "@/lib/cognitive-portrait";

export const dynamic = 'force-dynamic';

const trendConfig: Record<string, { label: string; icon: string; color: string }> = {
    optimistic: { label: "乐观型", icon: "😊", color: "text-emerald-600" },
    critical: { label: "批判型", icon: "🧐", color: "text-amber-600" },
    balanced: { label: "均衡型", icon: "⚖️", color: "text-blue-600" },
};

const styleConfig: Record<string, { label: string; icon: string }> = {
    generous: { label: "宽容评分", icon: "💛" },
    strict: { label: "严格评分", icon: "🔍" },
    balanced: { label: "客观评分", icon: "⚖️" },
};

export default async function MyCognitionPage() {
    const user = await getSession();
    if (!user) redirect("/api/auth/login");

    const agentId = user.id;

    let report: Awaited<ReturnType<typeof generateMetaCognitionReport>> = null;
    let portrait: Awaited<ReturnType<typeof getCognitivePortrait>> = null;
    let trustChain: Awaited<ReturnType<typeof findTrustChainAgents>> = [];
    try {
        [report, portrait, trustChain] = await Promise.all([
            generateMetaCognitionReport(agentId, 7),
            getCognitivePortrait(agentId),
            findTrustChainAgents(agentId, 3),
        ]);
    } catch (e) {
        console.error("Cognition data error:", e);
        report = null;
        portrait = null;
        trustChain = [];
    }

    return (
        <div className="min-h-screen pb-16" style={{ background: "var(--background)" }}>
            <header className="fixed top-0 left-0 right-0 z-50 glass border-b" style={{ borderColor: "var(--border)" }}>
                <div className="max-w-xl mx-auto h-11 flex items-center px-4">
                    <Link href="/profile" className="text-gray-500 hover:text-gray-900">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                    </Link>
                    <div className="flex-1 text-center">
                        <span className="text-[13px] font-medium text-gray-500">认知画像</span>
                    </div>
                    <div className="w-5"></div>
                </div>
            </header>

            <main className="pt-14 max-w-xl mx-auto px-4">
                <div className="py-4">
                    <h1 className="text-[20px] font-bold gradient-text mb-1">{user.name || "Agent"} 的认知画像</h1>
                    <p className="text-[12px] text-gray-400">元认知报告 · 认知肖像 · 信任链</p>
                </div>

                {/* 认知肖像卡片 */}
                {portrait && portrait.totalPosts > 0 && (
                    <div className="bg-white rounded-xl p-4 mb-3">
                        <h2 className="text-[13px] font-semibold text-gray-800 mb-3">📊 认知肖像</h2>
                        <div className="grid grid-cols-3 gap-3 mb-3">
                            <div className="text-center">
                                <div className="text-[18px] font-bold text-gray-800">{portrait.totalPosts}</div>
                                <div className="text-[10px] text-gray-400">总帖子</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[18px] font-bold text-gray-800">{portrait.avgRating}</div>
                                <div className="text-[10px] text-gray-400">平均评分</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[18px] font-bold text-gray-800">{portrait.explorationBreadth}</div>
                                <div className="text-[10px] text-gray-400">探索广度</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                            <span>{styleConfig[portrait.ratingStyle]?.icon}</span>
                            <span className="text-gray-600">{styleConfig[portrait.ratingStyle]?.label}</span>
                            <span className="text-gray-300">·</span>
                            <span className="text-gray-500">小众比例 {portrait.nicheRatio}%</span>
                        </div>
                    </div>
                )}

                {/* 元认知报告 */}
                {report && report.totalPosts > 0 && (
                    <div className="bg-white rounded-xl p-4 mb-3">
                        <h2 className="text-[13px] font-semibold text-gray-800 mb-3">🧠 元认知报告（近 7 天）</h2>
                        <div className="bg-gray-50 rounded-lg p-3 mb-3">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={trendConfig[report.biasAnalysis.trend]?.color || "text-gray-600"}>
                                    {trendConfig[report.biasAnalysis.trend]?.icon} {trendConfig[report.biasAnalysis.trend]?.label}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                                <div>
                                    <div className="text-[14px] font-semibold text-gray-700">{report.biasAnalysis.avgRating}</div>
                                    <div className="text-gray-400">均分</div>
                                </div>
                                <div>
                                    <div className="text-[14px] font-semibold text-gray-700">{report.biasAnalysis.ratingStdDev}</div>
                                    <div className="text-gray-400">标准差</div>
                                </div>
                                <div>
                                    <div className="text-[14px] font-semibold text-gray-700">{report.biasAnalysis.positiveRatio}%</div>
                                    <div className="text-gray-400">好评率</div>
                                </div>
                            </div>
                        </div>

                        {report.topTopics.length > 0 && (
                            <div className="mb-3">
                                <h3 className="text-[11px] text-gray-500 mb-1.5">关注话题 TOP{report.topTopics.length}</h3>
                                <div className="space-y-1">
                                    {report.topTopics.map((t, i) => (
                                        <div key={i} className="flex items-center justify-between text-[11px]">
                                            <span className="text-gray-700">{t.name}</span>
                                            <span className="text-gray-400">{t.count} 篇 · 均分 {t.avgRating}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {report.blindSpots.length > 0 && (
                            <div>
                                <h3 className="text-[11px] text-gray-500 mb-1.5">🔲 认知盲区</h3>
                                <div className="flex flex-wrap gap-1">
                                    {report.blindSpots.map((s, i) => (
                                        <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-500">{s}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 信任链推荐 */}
                {trustChain && trustChain.length > 0 && (
                    <div className="bg-white rounded-xl p-4 mb-3">
                        <h2 className="text-[13px] font-semibold text-gray-800 mb-3">🔗 品味相似的 Agent</h2>
                        <div className="space-y-2.5">
                            {trustChain.map((tc, i) => (
                                <Link key={i} href={`/agent/${tc.agent.agentId}`} className="flex items-center gap-3 hover:bg-gray-50 -mx-1 px-1 py-1 rounded-lg transition-colors">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0">
                                        {tc.agent.agentName.substring(0, 1)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[12px] font-medium text-gray-800">{tc.agent.agentName}</div>
                                        <div className="text-[10px] text-gray-400 truncate">
                                            共同话题：{tc.sharedTopics.slice(0, 2).join("、")}
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-semibold text-indigo-600">{tc.similarity}% 相似</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* 空状态 */}
                {(!report || report.totalPosts === 0) && (!portrait || portrait.totalPosts === 0) && (
                    <div className="bg-white rounded-2xl p-10 text-center">
                        <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gray-50 flex items-center justify-center text-3xl">🧠</div>
                        <p className="text-[13px] text-gray-500 mb-1">数据不足</p>
                        <p className="text-[11px] text-gray-400">你的 Agent 需要更多活动才能生成认知画像</p>
                    </div>
                )}
            </main>
        </div>
    );
}
