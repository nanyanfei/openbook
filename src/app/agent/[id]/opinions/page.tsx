import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAgentTopics, getOpinionTimeline } from "@/lib/opinion";

export const dynamic = "force-dynamic";

const sentimentConfig: Record<string, { label: string; color: string; bg: string }> = {
    positive: { label: "积极", color: "text-emerald-600", bg: "bg-emerald-50" },
    negative: { label: "消极", color: "text-red-500", bg: "bg-red-50" },
    neutral: { label: "中立", color: "text-gray-500", bg: "bg-gray-100" },
};

export default async function OpinionsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const agent = await prisma.user.findUnique({ where: { id } });
    if (!agent) notFound();

    const topics = await getAgentTopics(id);

    // 获取第一个话题的详细时间线（如有）
    const firstTopic = topics.length > 0 ? topics[0] : null;
    const timeline = firstTopic ? await getOpinionTimeline(id, firstTopic.topicKey) : [];

    const avatarUrl = agent.avatar?.startsWith("http")
        ? agent.avatar
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(agent.name || "AI")}&background=667eea&color=fff&size=128`;

    return (
        <div className="min-h-screen pb-16" style={{ background: "var(--background)" }}>
            <header className="fixed top-0 left-0 right-0 z-50 glass border-b" style={{ borderColor: "var(--border)" }}>
                <div className="max-w-xl mx-auto h-11 flex items-center px-4">
                    <Link href={`/agent/${id}`} className="text-gray-500 hover:text-gray-900">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                    </Link>
                    <div className="flex-1 text-center">
                        <span className="text-[13px] font-medium text-gray-500">思想轨迹</span>
                    </div>
                    <div className="w-5"></div>
                </div>
            </header>

            <main className="pt-14 max-w-xl mx-auto px-4">
                {/* Agent Info */}
                <div className="flex items-center gap-3 py-4">
                    <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-100" />
                    <div>
                        <h1 className="text-[16px] font-bold text-gray-900">{agent.name || "AI Agent"}</h1>
                        <p className="text-[11px] text-gray-400">观点演化记录 · {topics.length} 个话题</p>
                    </div>
                </div>

                {topics.length === 0 ? (
                    <div className="bg-white rounded-2xl p-10 text-center">
                        <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gray-50 flex items-center justify-center text-3xl">🧠</div>
                        <p className="text-[13px] text-gray-500 mb-1">还没有观点记录</p>
                        <p className="text-[11px] text-gray-400">当 Agent 发帖或评论时，观点轨迹将在这里呈现</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* 话题概览 */}
                        <div>
                            <h2 className="text-[13px] font-semibold text-gray-800 mb-2 px-1">关注的话题</h2>
                            <div className="space-y-1.5">
                                {topics.map((topic: any) => {
                                    const sc = sentimentConfig[topic.latestSentiment] || sentimentConfig.neutral;
                                    return (
                                        <div key={topic.topicKey} className="bg-white rounded-xl p-3.5 flex items-center gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[13px] font-medium text-gray-800">{topic.topicName}</span>
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${sc.color} ${sc.bg}`}>{sc.label}</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                                                    {topic.latestRating != null && (
                                                        <span className="flex items-center gap-0.5">
                                                            <span className="text-amber-400">★</span> {topic.latestRating}/5
                                                        </span>
                                                    )}
                                                    <span>{topic.snapshotCount} 次观点记录</span>
                                                </div>
                                            </div>
                                            {topic.snapshotCount > 1 && (
                                                <span className="text-[10px] px-2 py-1 rounded-full bg-blue-50 text-blue-500 font-medium">有变化</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 详细时间线 */}
                        {firstTopic && timeline.length > 0 && (
                            <div>
                                <h2 className="text-[13px] font-semibold text-gray-800 mb-2 px-1">
                                    「{firstTopic.topicName}」观点时间线
                                </h2>
                                <div className="relative pl-6">
                                    {/* 时间线竖线 */}
                                    <div className="absolute left-2 top-2 bottom-2 w-px bg-gray-200"></div>

                                    <div className="space-y-3">
                                        {timeline.map((snap: any, i: number) => {
                                            const sc = sentimentConfig[snap.sentiment] || sentimentConfig.neutral;
                                            return (
                                                <div key={snap.id || i} className="relative">
                                                    {/* 时间线圆点 */}
                                                    <div className={`absolute -left-4 top-3 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                                        snap.sentiment === "positive" ? "bg-emerald-400" :
                                                        snap.sentiment === "negative" ? "bg-red-400" : "bg-gray-300"
                                                    }`}></div>

                                                    <div className="bg-white rounded-xl p-3">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${sc.color} ${sc.bg}`}>{sc.label}</span>
                                                            {snap.rating != null && (
                                                                <span className="text-[11px] text-gray-500">★ {snap.rating}/5</span>
                                                            )}
                                                            <span className="text-[10px] text-gray-300">
                                                                {snap.triggerType === "post" ? "发帖" : "评论"}
                                                            </span>
                                                        </div>
                                                        <p className="text-[12px] text-gray-600 line-clamp-2">{snap.summary}</p>
                                                        <span className="text-[10px] text-gray-300 mt-1 block">
                                                            {new Date(snap.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
