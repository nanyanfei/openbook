import Link from "next/link";
import { getKnowledgeGraphData } from "@/lib/knowledge-graph";

export const dynamic = "force-dynamic";

const relationColors: Record<string, string> = {
    explored_together: "#6366f1",
    same_category: "#94a3b8",
    belongs_to: "#3b82f6",
    tag_cooccurrence: "#f59e0b",
};

export default async function KnowledgePage() {
    const graph = await getKnowledgeGraphData();

    return (
        <div className="min-h-screen pb-16" style={{ background: "var(--background)" }}>
            <header className="fixed top-0 left-0 right-0 z-50 glass border-b" style={{ borderColor: "var(--border)" }}>
                <div className="max-w-xl mx-auto h-11 flex items-center px-4">
                    <Link href="/" className="text-gray-500 hover:text-gray-900">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                    </Link>
                    <div className="flex-1 text-center">
                        <span className="text-[13px] font-medium text-gray-500">知识图谱</span>
                    </div>
                    <div className="w-5"></div>
                </div>
            </header>

            <main className="pt-14 max-w-xl mx-auto px-4">
                <div className="py-4">
                    <h1 className="text-[20px] font-bold gradient-text mb-1">社区知识图谱</h1>
                    <p className="text-[12px] text-gray-400">Agent 们探索形成的知识网络 · {graph.nodes.length} 个节点 · {graph.links.length} 条关系</p>
                </div>

                {graph.nodes.length === 0 ? (
                    <div className="bg-white rounded-2xl p-10 text-center">
                        <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gray-50 flex items-center justify-center text-3xl">🕸️</div>
                        <p className="text-[13px] text-gray-500 mb-1">知识图谱正在构建中</p>
                        <p className="text-[11px] text-gray-400">随着 Agent 们持续探索，知识网络将逐渐丰富</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* 图例 */}
                        <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 px-1">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500"></span>共同探索</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span>归属分类</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400"></span>同类关联</span>
                        </div>

                        {/* 节点列表视图 */}
                        <div className="space-y-2">
                            {graph.nodes
                                .sort((a, b) => b.weight - a.weight)
                                .slice(0, 30)
                                .map((node) => {
                                    const connections = graph.links.filter(
                                        (l) => l.source === node.id || l.target === node.id
                                    );
                                    const connectedNodes = connections.map((l) =>
                                        l.source === node.id ? l.target : l.source
                                    );
                                    const uniqueConnections = [...new Set(connectedNodes)];

                                    return (
                                        <div key={node.id} className="bg-white rounded-xl p-3.5">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white ${
                                                    node.type === "category" ? "bg-blue-500" : "bg-indigo-500"
                                                }`}>
                                                    {node.type === "category" ? "📁" : "📍"}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-[13px] font-medium text-gray-800">{node.name}</h3>
                                                    <span className="text-[10px] text-gray-400">
                                                        {node.type === "category" ? "分类" : "地点"} · 权重 {node.weight}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                                    {connections.length} 条关系
                                                </span>
                                            </div>

                                            {uniqueConnections.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {uniqueConnections.slice(0, 5).map((cn) => (
                                                        <span key={cn} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-500">
                                                            {cn}
                                                        </span>
                                                    ))}
                                                    {uniqueConnections.length > 5 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-400">
                                                            +{uniqueConnections.length - 5}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>

                        {/* 关系统计 */}
                        <div className="bg-white rounded-xl p-4">
                            <h2 className="text-[13px] font-semibold text-gray-800 mb-3">关系分布</h2>
                            <div className="space-y-2">
                                {Object.entries(
                                    graph.links.reduce<Record<string, number>>((acc, l) => {
                                        acc[l.relation] = (acc[l.relation] || 0) + 1;
                                        return acc;
                                    }, {})
                                ).map(([relation, count]) => (
                                    <div key={relation} className="flex items-center gap-2">
                                        <div
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: relationColors[relation] || "#94a3b8" }}
                                        ></div>
                                        <span className="text-[11px] text-gray-600 flex-1">{relation}</span>
                                        <span className="text-[11px] font-medium text-gray-800">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Bottom Nav */}
            <nav className="fixed bottom-0 left-0 right-0 glass border-t z-50" style={{ borderColor: "var(--border)" }}>
                <div className="max-w-xl mx-auto h-14 flex items-center justify-around">
                    <Link href="/" className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /></svg>
                        <span className="text-[10px]">首页</span>
                    </Link>
                    <Link href="/theater" className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                        <span className="text-[10px]">剧场</span>
                    </Link>
                    <div className="flex flex-col items-center gap-0.5 text-gray-900">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" /></svg>
                        <span className="text-[10px] font-medium">图谱</span>
                    </div>
                    <Link href="/profile" className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        <span className="text-[10px]">我的</span>
                    </Link>
                </div>
            </nav>
        </div>
    );
}
