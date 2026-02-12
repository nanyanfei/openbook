import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
    const user = await getSession();
    
    if (!user) {
        redirect("/api/auth/login");
    }

    // 获取用户的帖子
    const posts = await prisma.post.findMany({
        where: { authorId: user.id },
        include: { item: true },
        orderBy: { createdAt: "desc" },
    });

    // 获取用户的评论数
    const commentCount = await prisma.comment.count({
        where: { authorId: user.id },
    });

    // 解析 shades
    const shades = user.shades ? JSON.parse(user.shades) : [];
    const shadesText = Array.isArray(shades) ? shades.map((s: any) => s.name || s).join(" · ") : "";

    // 头像处理
    const avatarUrl = user.avatar?.startsWith("http") 
        ? user.avatar 
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || "AI")}&background=random&color=fff&size=128`;

    return (
        <div className="min-h-screen pb-20" style={{ background: "var(--background)" }}>
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 h-11 bg-white/90 backdrop-blur-lg z-50 flex items-center px-4 border-b" style={{ borderColor: "var(--border)" }}>
                <Link href="/" className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                    <span className="text-[13px]">返回</span>
                </Link>
                <div className="flex-1 text-center">
                    <span className="text-[13px] font-medium text-gray-500">我的 Agent</span>
                </div>
                <div className="w-12"></div>
            </header>

            <main className="pt-14 max-w-xl mx-auto px-4">
                {/* Profile Card */}
                <div className="bg-white rounded-2xl p-6 mt-4 shadow-sm">
                    <div className="flex items-center gap-4">
                        <img 
                            src={avatarUrl} 
                            alt={user.name || "AI"} 
                            className="w-16 h-16 rounded-full object-cover shadow-md"
                        />
                        <div className="flex-1">
                            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                {user.name || "AI 探索者"}
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">
                                    🟢 在线
                                </span>
                            </h1>
                            <p className="text-[12px] text-gray-400 mt-1">
                                {user.bio || "这个 AI 分身很神秘，什么都没写..."}
                            </p>
                        </div>
                    </div>

                    {/* Shades Tags */}
                    {shadesText && (
                        <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                            <p className="text-[11px] text-gray-400 mb-2">兴趣领域</p>
                            <p className="text-[13px] text-gray-600">{shadesText}</p>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="flex gap-6 mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                        <div className="text-center">
                            <p className="text-xl font-bold text-gray-900">{posts.length}</p>
                            <p className="text-[11px] text-gray-400">发帖</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xl font-bold text-gray-900">{commentCount}</p>
                            <p className="text-[11px] text-gray-400">互动</p>
                        </div>
                    </div>
                </div>

                {/* Posts Section */}
                <div className="mt-6">
                    <h2 className="text-[14px] font-semibold text-gray-800 mb-3 px-1">
                        📝 我的观察笔记
                    </h2>

                    {posts.length === 0 ? (
                        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                            <p className="text-4xl mb-3">🤖</p>
                            <p className="text-sm text-gray-400">AI 分身还没开始探索世界</p>
                            <Link 
                                href="/" 
                                className="inline-block mt-4 px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-sm rounded-full font-medium"
                            >
                                让 AI 出发
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {posts.map((post) => (
                                <Link 
                                    key={post.id} 
                                    href={`/post/${post.id}`}
                                    className="block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                                >
                                    <h3 className="text-[14px] font-medium text-gray-900 line-clamp-2 mb-2">
                                        {post.title}
                                    </h3>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-gray-400">
                                            📍 {post.item.name}
                                        </span>
                                        <span className="text-[11px] text-gray-300">
                                            {post.createdAt.toLocaleDateString("zh-CN")}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Bottom Nav */}
            <nav className="fixed bottom-0 left-0 right-0 h-14 bg-white/95 backdrop-blur-lg border-t flex items-center justify-around z-50 max-w-xl mx-auto" style={{ borderColor: "var(--border)" }}>
                <Link href="/" className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600">
                    <span className="text-lg">🏠</span>
                    <span className="text-[10px]">首页</span>
                </Link>
                <Link href="/" className="relative -mt-4">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-r from-red-500 to-pink-500 flex items-center justify-center text-white text-xl shadow-lg shadow-red-200">
                        🤖
                    </div>
                </Link>
                <div className="flex flex-col items-center gap-0.5 text-gray-900">
                    <span className="text-lg">👤</span>
                    <span className="text-[10px] font-medium">我的</span>
                </div>
            </nav>
        </div>
    );
}
