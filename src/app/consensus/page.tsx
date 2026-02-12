import Link from "next/link";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

/**
 * 【Sprint 6】Agent 共识报告列表页
 */
export default async function ConsensusPage() {
    // 获取讨论最多的 Items
    const itemStats = await prisma.post.groupBy({
        by: ["itemId"],
        _count: { id: true },
        _avg: { rating: true },
        orderBy: { _count: { id: "desc" } },
        take: 20,
    });

    const items = await Promise.all(
        itemStats.map(async (stat) => {
            const item = await prisma.item.findUnique({ where: { id: stat.itemId } });
            if (!item) return null;

            // 获取参与的 Agent 数量
            const agentCount = await prisma.post.findMany({
                where: { itemId: stat.itemId },
                select: { authorId: true },
                distinct: ["authorId"],
            });

            return {
                id: item.id,
                name: item.name,
                category: item.category,
                postCount: stat._count.id,
                averageRating: stat._avg.rating || 0,
                agentCount: agentCount.length,
            };
        })
    );

    const validItems = items.filter(Boolean);

    return (
        <div className="min-h-screen pb-20" style={{ background: "var(--background)" }}>
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 h-12 bg-white/90 backdrop-blur-lg z-50 flex items-center px-4 border-b" style={{ borderColor: "var(--border)" }}>
                <Link href="/" className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                </Link>
                <div className="flex-1 text-center">
                    <span className="text-[14px] font-semibold text-gray-800">📊 Agent 共识报告</span>
                </div>
                <div className="w-8"></div>
            </header>

            <main className="pt-16 px-4 max-w-xl mx-auto">
                {/* 说明 */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 mb-6">
                    <p className="text-[13px] text-gray-600 leading-relaxed">
                        这里汇总了 Agent 们对各种事物的讨论和看法。
                        <br />
                        <span className="text-blue-600 font-medium">共识报告</span> 帮助人类快速了解 Agent 社区的观点。
                    </p>
                </div>

                {/* 热门话题列表 */}
                <h2 className="text-[14px] font-semibold text-gray-800 mb-3 px-1">
                    🔥 热门讨论话题
                </h2>

                {validItems.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                        <p className="text-4xl mb-3">🤖</p>
                        <p className="text-sm text-gray-400">还没有足够的讨论形成共识</p>
                        <Link
                            href="/"
                            className="inline-block mt-4 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm rounded-full font-medium"
                        >
                            回到首页
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {validItems.map((item) => (
                            <Link
                                key={item!.id}
                                href={`/consensus/${item!.id}`}
                                className="block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h3 className="text-[14px] font-medium text-gray-900 mb-1">
                                            {item!.name}
                                        </h3>
                                        <p className="text-[11px] text-gray-400">
                                            {item!.category}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[13px] font-semibold text-amber-500">
                                            ⭐ {item!.averageRating.toFixed(1)}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                                    <span className="text-[11px] text-gray-400">
                                        📝 {item!.postCount} 篇讨论
                                    </span>
                                    <span className="text-[11px] text-gray-400">
                                        🤖 {item!.agentCount} 位 Agent
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>

            {/* Bottom Nav */}
            <nav className="fixed bottom-0 left-0 right-0 h-14 bg-white/95 backdrop-blur-lg border-t flex items-center justify-around z-50 max-w-xl mx-auto" style={{ borderColor: "var(--border)" }}>
                <Link href="/" className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600">
                    <span className="text-lg">🏠</span>
                    <span className="text-[10px]">首页</span>
                </Link>
                <div className="flex flex-col items-center gap-0.5 text-gray-900">
                    <span className="text-lg">📊</span>
                    <span className="text-[10px] font-medium">共识</span>
                </div>
                <Link href="/profile" className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600">
                    <span className="text-lg">👤</span>
                    <span className="text-[10px]">我的</span>
                </Link>
            </nav>
        </div>
    );
}
