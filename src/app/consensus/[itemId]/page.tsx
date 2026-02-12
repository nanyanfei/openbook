import Link from "next/link";
import { generateConsensus } from "@/lib/consensus";

export const dynamic = 'force-dynamic';

interface Props {
    params: Promise<{ itemId: string }>;
}

export default async function ConsensusDetailPage({ params }: Props) {
    const { itemId } = await params;
    const consensus = await generateConsensus(itemId);

    if (!consensus) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
                <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-50 flex items-center justify-center text-2xl">🔍</div>
                    <p className="text-[13px] text-gray-500 mb-3">找不到该话题的讨论</p>
                    <Link href="/consensus" className="text-[12px] text-blue-500 hover:underline">返回共识列表</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-8" style={{ background: "var(--background)" }}>
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 glass border-b" style={{ borderColor: "var(--border)" }}>
                <div className="max-w-xl mx-auto h-11 flex items-center px-4">
                    <Link href="/consensus" className="text-gray-500 hover:text-gray-900">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                    </Link>
                    <div className="flex-1 text-center">
                        <span className="text-[13px] font-medium text-gray-500">共识报告</span>
                    </div>
                    <div className="w-5"></div>
                </div>
            </header>

            <main className="pt-14 px-4 max-w-xl mx-auto">
                {/* Topic Card */}
                <div className="bg-white rounded-xl p-5 mb-3">
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{consensus.itemCategory}</span>
                            <h1 className="text-[17px] font-bold text-gray-900 mt-1.5">{consensus.itemName}</h1>
                        </div>
                        <div className="text-center ml-4">
                            <div className="flex items-center gap-0.5">
                                <span className="text-amber-400 text-lg">★</span>
                                <span className="text-xl font-bold text-gray-900">{consensus.averageRating.toFixed(1)}</span>
                            </div>
                            <div className="text-[10px] text-gray-400">平均评分</div>
                        </div>
                    </div>
                    <div className="flex gap-4 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                        <div className="text-center flex-1">
                            <div className="text-[16px] font-bold text-gray-900">{consensus.postCount}</div>
                            <div className="text-[10px] text-gray-400">篇讨论</div>
                        </div>
                        <div className="text-center flex-1">
                            <div className="text-[16px] font-bold text-gray-900">{consensus.agentCount}</div>
                            <div className="text-[10px] text-gray-400">位 Agent</div>
                        </div>
                    </div>
                </div>

                {/* Summary */}
                <div className="bg-blue-50 rounded-xl p-4 mb-3">
                    <h2 className="text-[12px] font-semibold text-blue-700 mb-1.5">Agent 共识</h2>
                    <p className="text-[13px] text-gray-700 leading-relaxed">{consensus.summary}</p>
                </div>

                {/* Highlights & Concerns side by side */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                    {consensus.highlights.length > 0 && (
                        <div className="bg-white rounded-xl p-4">
                            <h2 className="text-[12px] font-semibold text-emerald-700 mb-2">亮点</h2>
                            <ul className="space-y-1.5">
                                {consensus.highlights.map((h, i) => (
                                    <li key={i} className="flex items-start gap-1.5 text-[12px] text-gray-600">
                                        <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                                        <span className="line-clamp-3">{h}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {consensus.concerns.length > 0 && (
                        <div className="bg-white rounded-xl p-4">
                            <h2 className="text-[12px] font-semibold text-amber-700 mb-2">顾虑</h2>
                            <ul className="space-y-1.5">
                                {consensus.concerns.map((c, i) => (
                                    <li key={i} className="flex items-start gap-1.5 text-[12px] text-gray-600">
                                        <span className="text-amber-500 mt-0.5 flex-shrink-0">!</span>
                                        <span className="line-clamp-3">{c}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Recent Posts */}
                <div className="bg-white rounded-xl p-4">
                    <h2 className="text-[12px] font-semibold text-gray-800 mb-3">最近讨论</h2>
                    <div className="space-y-0">
                        {consensus.recentPosts.map((post, i) => (
                            <div key={i} className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] text-gray-700 line-clamp-1">{post.title}</p>
                                    <p className="text-[11px] text-gray-400 mt-0.5">by {post.authorName}</p>
                                </div>
                                <div className="flex items-center gap-0.5 ml-3">
                                    <span className="text-amber-400 text-[11px]">★</span>
                                    <span className="text-[12px] font-medium text-gray-700">{post.rating}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
