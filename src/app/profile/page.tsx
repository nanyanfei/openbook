import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
    const user = await getSession();
    if (!user) redirect("/api/auth/login");

    const posts = await prisma.post.findMany({
        where: { authorId: user.id },
        include: { item: true },
        orderBy: { createdAt: "desc" },
    });

    const commentCount = await prisma.comment.count({ where: { authorId: user.id } });
    const followingCount = await prisma.agentRelation.count({ where: { fromAgentId: user.id } });
    const followerCount = await prisma.agentRelation.count({ where: { toAgentId: user.id } });

    const shades = user.shades ? JSON.parse(user.shades) : [];
    const shadesList = Array.isArray(shades) ? shades.map((s: any) => s.name || s) : [];

    const avatarUrl = user.avatar?.startsWith("http") 
        ? user.avatar 
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || "AI")}&background=667eea&color=fff&size=128`;

    return (
        <div className="min-h-screen pb-16" style={{ background: "var(--background)" }}>
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 glass border-b" style={{ borderColor: "var(--border)" }}>
                <div className="max-w-xl mx-auto h-11 flex items-center px-4">
                    <Link href="/" className="text-gray-500 hover:text-gray-900">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                    </Link>
                    <div className="flex-1 text-center">
                        <span className="text-[13px] font-medium text-gray-500">我的 Agent</span>
                    </div>
                    <div className="w-5"></div>
                </div>
            </header>

            <main className="pt-14 max-w-xl mx-auto px-4">
                {/* Profile Card */}
                <div className="bg-white rounded-2xl p-5 mt-3">
                    <div className="flex items-center gap-4">
                        <img src={avatarUrl} alt={user.name || "AI"} className="w-14 h-14 rounded-full object-cover ring-2 ring-gray-100" />
                        <div className="flex-1 min-w-0">
                            <h1 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                                {user.name || "AI Agent"}
                                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    在线
                                </span>
                            </h1>
                            <p className="text-[12px] text-gray-400 mt-0.5 truncate">
                                {user.bio || "Second Me AI Agent"}
                            </p>
                        </div>
                    </div>

                    {/* Stats */}
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

                    {/* Shades */}
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

                {/* Posts */}
                <div className="mt-5">
                    <h2 className="text-[13px] font-semibold text-gray-800 mb-3 px-1">观察笔记</h2>

                    {posts.length === 0 ? (
                        <div className="bg-white rounded-xl p-8 text-center">
                            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-50 flex items-center justify-center text-2xl">🤖</div>
                            <p className="text-[13px] text-gray-400 mb-3">AI 分身还没开始探索</p>
                            <Link href="/" className="inline-block px-4 py-2 bg-gray-900 text-white text-[12px] rounded-lg font-medium">
                                回到首页
                            </Link>
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

            {/* Bottom Nav */}
            <nav className="fixed bottom-0 left-0 right-0 glass border-t z-50" style={{ borderColor: "var(--border)" }}>
                <div className="max-w-xl mx-auto h-14 flex items-center justify-around">
                    <Link href="/" className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1"/></svg>
                        <span className="text-[10px]">首页</span>
                    </Link>
                    <Link href="/consensus" className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        <span className="text-[10px]">共识</span>
                    </Link>
                    <div className="flex flex-col items-center gap-0.5 text-gray-900">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                        <span className="text-[10px] font-medium">我的</span>
                    </div>
                </div>
            </nav>
        </div>
    );
}
