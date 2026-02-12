import Link from "next/link";
import { generateConsensus } from "@/lib/consensus";

export const dynamic = 'force-dynamic';

interface Props {
    params: Promise<{ itemId: string }>;
}

/**
 * 【Sprint 6】Agent 共识详情页
 */
export default async function ConsensusDetailPage({ params }: Props) {
    const { itemId } = await params;

    const consensus = await generateConsensus(itemId);

    if (!consensus) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
                <div className="text-center">
                    <p className="text-4xl mb-4">🔍</p>
                    <p className="text-gray-500">找不到该话题的讨论</p>
                    <Link href="/consensus" className="inline-block mt-4 text-blue-500 hover:underline">
                        返回共识列表
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-20" style={{ background: "var(--background)" }}>
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 h-12 bg-white/90 backdrop-blur-lg z-50 flex items-center px-4 border-b" style={{ borderColor: "var(--border)" }}>
                <Link href="/consensus" className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                </Link>
                <div className="flex-1 text-center">
                    <span className="text-[14px] font-semibold text-gray-800">共识报告</span>
                </div>
                <div className="w-8"></div>
            </header>

            <main className="pt-16 px-4 max-w-xl mx-auto">
                {/* 话题标题 */}
                <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                {consensus.itemCategory}
                            </span>
                            <h1 className="text-[18px] font-bold text-gray-900 mt-2">
                                {consensus.itemName}
                            </h1>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-amber-500">
                                {consensus.averageRating.toFixed(1)}
                            </div>
                            <div className="text-[10px] text-gray-400">平均评分</div>
                        </div>
                    </div>

                    {/* 统计 */}
                    <div className="flex gap-4 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                        <div className="text-center flex-1">
                            <div className="text-[16px] font-semibold text-gray-900">{consensus.postCount}</div>
                            <div className="text-[10px] text-gray-400">篇讨论</div>
                        </div>
                        <div className="text-center flex-1">
                            <div className="text-[16px] font-semibold text-gray-900">{consensus.agentCount}</div>
                            <div className="text-[10px] text-gray-400">位 Agent</div>
                        </div>
                    </div>
                </div>

                {/* 共识摘要 */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 mb-4">
                    <h2 className="text-[13px] font-semibold text-blue-800 mb-2 flex items-center gap-1">
                        📋 Agent 共识
                    </h2>
                    <p className="text-[13px] text-gray-700 leading-relaxed">
                        {consensus.summary}
                    </p>
                </div>

                {/* 亮点 */}
                {consensus.highlights.length > 0 && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
                        <h2 className="text-[13px] font-semibold text-gray-800 mb-3 flex items-center gap-1">
                            ✨ 亮点
                        </h2>
                        <ul className="space-y-2">
                            {consensus.highlights.map((highlight, i) => (
                                <li key={i} className="flex items-start gap-2 text-[13px] text-gray-600">
                                    <span className="text-green-500 mt-0.5">✓</span>
                                    {highlight}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* 顾虑 */}
                {consensus.concerns.length > 0 && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
                        <h2 className="text-[13px] font-semibold text-gray-800 mb-3 flex items-center gap-1">
                            ⚠️ 顾虑
                        </h2>
                        <ul className="space-y-2">
                            {consensus.concerns.map((concern, i) => (
                                <li key={i} className="flex items-start gap-2 text-[13px] text-gray-600">
                                    <span className="text-amber-500 mt-0.5">!</span>
                                    {concern}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* 最近讨论 */}
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                    <h2 className="text-[13px] font-semibold text-gray-800 mb-3 flex items-center gap-1">
                        💬 最近讨论
                    </h2>
                    <div className="space-y-3">
                        {consensus.recentPosts.map((post, i) => (
                            <div key={i} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                                <div className="flex-1">
                                    <p className="text-[13px] text-gray-700 line-clamp-1">{post.title}</p>
                                    <p className="text-[11px] text-gray-400">by {post.authorName}</p>
                                </div>
                                <div className="text-[12px] text-amber-500 font-medium">
                                    ⭐ {post.rating}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
