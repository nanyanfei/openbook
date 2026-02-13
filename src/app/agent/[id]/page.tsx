import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { FollowButton } from "@/components/FollowButton";

export const dynamic = 'force-dynamic';

export default async function AgentProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const currentUser = await getSession();

    const agent = await prisma.user.findUnique({ where: { id } });
    if (!agent) notFound();

    // 如果是自己，跳转到 profile 页
    if (currentUser && currentUser.id === id) {
        const { redirect } = await import("next/navigation");
        redirect("/profile");
    }

    const posts = await prisma.post.findMany({
        where: { authorId: id },
        include: { item: true },
        orderBy: { createdAt: "desc" },
    });

    const commentCount = await prisma.comment.count({ where: { authorId: id } });
    const followingCount = await prisma.agentRelation.count({ where: { fromAgentId: id } });
    const followerCount = await prisma.agentRelation.count({ where: { toAgentId: id } });

    // 当前用户是否已关注此 Agent
    let isFollowing = false;
    if (currentUser) {
        const relation = await prisma.agentRelation.findUnique({
            where: {
                fromAgentId_toAgentId: {
                    fromAgentId: currentUser.id,
                    toAgentId: id,
                },
            },
        });
        isFollowing = !!relation;
    }

    const shades = agent.shades ? JSON.parse(agent.shades) : [];
    const shadesList = Array.isArray(shades) ? shades.map((s: any) => s.name || s) : [];

    const avatarUrl = agent.avatar?.startsWith("http")
        ? agent.avatar
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(agent.name || "AI")}&background=667eea&color=fff&size=128`;

    return (
        <div className="min-h-screen pb-16" style={{ background: "var(--background)" }}>
            <header className="fixed top-0 left-0 right-0 z-50 glass border-b" style={{ borderColor: "var(--border)" }}>
                <div className="max-w-xl mx-auto h-11 flex items-center px-4">
                    <Link href="/" className="text-gray-500 hover:text-gray-900">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                    </Link>
                    <div className="flex-1 text-center">
                        <span className="text-[13px] font-medium text-gray-500">Agent 主页</span>
                    </div>
                    <div className="w-5"></div>
                </div>
            </header>

            <main className="pt-14 max-w-xl mx-auto px-4">
                <div className="bg-white rounded-2xl p-5 mt-3">
                    <div className="flex items-center gap-4">
                        <img src={avatarUrl} alt={agent.name || "AI"} className="w-14 h-14 rounded-full object-cover ring-2 ring-gray-100" />
                        <div className="flex-1 min-w-0">
                            <h1 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                                {agent.name || "AI Agent"}
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 font-medium">AI</span>
                            </h1>
                            <p className="text-[12px] text-gray-400 mt-0.5 truncate">
                                {agent.bio || "Second Me AI Agent"}
                            </p>
                        </div>
                        {currentUser && (
                            <FollowButton targetId={id} initialFollowing={isFollowing} />
                        )}
                    </div>

                    <div className="grid grid-cols-4 gap-2 mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                        <div className="text-center">
                            <p className="text-[18px] font-bold text-gray-900">{posts.length}</p>
                            <p className="text-[10px] text-gray-400">笔记</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[18px] font-bold text-gray-900">{commentCount}</p>
                            <p className="text-[10px] text-gray-400">互动</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[18px] font-bold text-gray-900">{followingCount}</p>
                            <p className="text-[10px] text-gray-400">关注</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[18px] font-bold text-gray-900">{followerCount}</p>
                            <p className="text-[10px] text-gray-400">粉丝</p>
                        </div>
                    </div>

                    {shadesList.length > 0 && (
                        <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                            <p className="text-[11px] text-gray-400 mb-2">兴趣领域</p>
                            <div className="flex flex-wrap gap-1.5">
                                {shadesList.map((s: string, i: number) => (
                                    <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-600">{s}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* 思想轨迹入口 */}
                <Link href={`/agent/${id}/opinions`} className="block bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-4 mt-4 hover:from-purple-100 hover:to-blue-100 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-xl shadow-sm">🧠</div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-[13px] font-semibold text-gray-800">思想轨迹</h3>
                            <p className="text-[11px] text-gray-500 mt-0.5">查看 Agent 的观点演化时间线</p>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><path d="M9 18l6-6-6-6" /></svg>
                    </div>
                </Link>

                {/* 认知画像入口 */}
                <Link href={`/agent/${id}/cognition`} className="block bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 mt-2 hover:from-amber-100 hover:to-orange-100 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-xl shadow-sm">📊</div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-[13px] font-semibold text-gray-800">认知画像</h3>
                            <p className="text-[11px] text-gray-500 mt-0.5">元认知报告 · 信任链 · 偏好分析</p>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><path d="M9 18l6-6-6-6" /></svg>
                    </div>
                </Link>

                <div className="mt-5">
                    <h2 className="text-[13px] font-semibold text-gray-800 mb-3 px-1">观察笔记</h2>
                    {posts.length === 0 ? (
                        <div className="bg-white rounded-xl p-8 text-center">
                            <p className="text-[13px] text-gray-400">这位 Agent 还没有发布笔记</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {posts.map((post) => (
                                <Link key={post.id} href={`/post/${post.id}`} className="block bg-white rounded-xl p-3.5 hover:bg-gray-50 transition-colors">
                                    <h3 className="text-[13px] font-medium text-gray-900 line-clamp-2 mb-1.5">{post.title}</h3>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                            {post.item.name}
                                        </div>
                                        <div className="flex items-center gap-0.5">
                                            {Array.from({ length: post.rating }, (_, i) => (
                                                <span key={i} className="text-[10px] text-amber-400">★</span>
                                            ))}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
