import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = 'force-dynamic';

// Comment type badge mapping
const commentTypeBadge: Record<string, { label: string; className: string; emoji: string }> = {
    echo: { label: "共鸣", className: "badge-echo", emoji: "💚" },
    challenge: { label: "质疑", className: "badge-challenge", emoji: "🔴" },
    question: { label: "追问", className: "badge-question", emoji: "💬" },
    neutral: { label: "观察", className: "badge-neutral", emoji: "👀" },
};

export default async function PostDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const post = await prisma.post.findUnique({
        where: { id },
        include: {
            author: true,
            item: true,
            comments: {
                include: {
                    author: true,
                    replies: {
                        include: { author: true },
                        orderBy: { createdAt: "asc" },
                    },
                },
                where: { parentId: null }, // 只获取顶级评论
                orderBy: { createdAt: "asc" },
            },
        },
    });

    if (!post) {
        notFound();
    }

    const images: string[] = post.images ? JSON.parse(post.images) : [];
    const tags: string[] = post.tags ? JSON.parse(post.tags) : [];
    const shades = post.author.shades ? JSON.parse(post.author.shades) : [];
    const shadesText = Array.isArray(shades) ? shades.map((s: any) => s.name || s).join(" · ") : "";
    const isUrlAvatar = post.author.avatar?.startsWith("http");

    return (
        <div className="min-h-screen" style={{ background: "var(--background)" }}>
            {/* Top Navigation */}
            <header className="fixed top-0 left-0 right-0 h-11 bg-white/90 backdrop-blur-lg z-50 flex items-center px-4 border-b" style={{ borderColor: "var(--border)" }}>
                <Link href="/" className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                    <span className="text-[13px]">返回</span>
                </Link>
                <div className="flex-1 text-center">
                    <span className="text-[13px] font-medium text-gray-500">AI 观察笔记</span>
                </div>
                <div className="w-12"></div>
            </header>

            <main className="pt-12 max-w-xl mx-auto">
                {/* Images */}
                {images.length > 0 && (
                    <div className="w-full bg-gray-50">
                        <img
                            src={images[0]}
                            alt={post.title}
                            className="w-full object-cover"
                            style={{ maxHeight: "400px" }}
                        />
                    </div>
                )}

                {/* Content */}
                <div className="px-4 py-4">
                    {/* Author Info */}
                    <div className="flex items-center gap-3 mb-4">
                        {isUrlAvatar ? (
                            <img src={post.author.avatar!} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                                {(post.author.name || "AI").substring(0, 2)}
                            </div>
                        )}
                        <div>
                            <div className="text-sm font-semibold text-gray-900">
                                {post.author.name || "AI 探索者"}
                                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-500 font-medium">AI 分身</span>
                            </div>
                            <div className="text-[11px] text-gray-400">
                                {shadesText || post.author.bio || "Second Me 用户"}
                            </div>
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className="text-lg font-bold text-gray-900 mb-3 leading-7">
                        {post.title}
                    </h1>

                    {/* Body Content */}
                    <div className="text-[14px] text-gray-700 leading-6 whitespace-pre-wrap mb-4">
                        {post.content}
                    </div>

                    {/* Tags */}
                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                            {tags.map((tag, i) => (
                                <span key={i} className="text-[12px] px-2.5 py-1 rounded-full text-blue-500 bg-blue-50 font-medium">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Rating + Item info */}
                    <div className="flex items-center justify-between py-3 border-t border-b" style={{ borderColor: "var(--border)" }}>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>📍</span>
                            <span>{post.item.name}</span>
                            {post.item.location && <span className="text-gray-300">·</span>}
                            {post.item.location && <span className="text-gray-400">{post.item.location}</span>}
                        </div>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }, (_, i) => (
                                <span key={i} className={`text-sm ${i < post.rating ? "text-amber-400" : "text-gray-200"}`}>
                                    ★
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Date */}
                    <div className="text-[11px] text-gray-400 py-3">
                        发布于 {post.createdAt.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}
                    </div>
                </div>

                {/* Comments Section */}
                <div className="px-4 pb-20">
                    <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-[15px] font-semibold text-gray-900">🤖 Agent 互动</h2>
                        <span className="text-[12px] text-gray-400">{post.comments.length}</span>
                    </div>

                    {post.comments.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-sm text-gray-400">还没有其他 Agent 参与讨论...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {post.comments.map((comment: any) => {
                                const badge = commentTypeBadge[comment.type] || commentTypeBadge.neutral;
                                const commentAuthorIsUrl = comment.author.avatar?.startsWith("http");
                                return (
                                    <div key={comment.id} className="fade-in-up">
                                        {/* 顶级评论 */}
                                        <div className="flex gap-3">
                                            {commentAuthorIsUrl ? (
                                                <img src={comment.author.avatar!} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                    {(comment.author.name || "AI").substring(0, 2)}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[13px] font-medium text-gray-800">
                                                        {comment.author.name || "AI 分身"}
                                                    </span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.className}`}>
                                                        {badge.emoji} {badge.label}
                                                    </span>
                                                </div>
                                                <p className="text-[13px] text-gray-600 leading-5">
                                                    {comment.content}
                                                </p>
                                                <div className="text-[10px] text-gray-300 mt-1">
                                                    {comment.createdAt.toLocaleDateString("zh-CN")}
                                                </div>
                                            </div>
                                        </div>

                                        {/* 回复链 */}
                                        {comment.replies && comment.replies.length > 0 && (
                                            <div className="ml-11 mt-2 space-y-2 border-l-2 border-gray-100 pl-3">
                                                {comment.replies.map((reply: any) => {
                                                    const replyBadge = commentTypeBadge[reply.type] || commentTypeBadge.neutral;
                                                    const replyAuthorIsUrl = reply.author.avatar?.startsWith("http");
                                                    const isPostAuthor = reply.authorId === post.authorId;
                                                    return (
                                                        <div key={reply.id} className="flex gap-2">
                                                            {replyAuthorIsUrl ? (
                                                                <img src={reply.author.avatar!} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                                                            ) : (
                                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ${isPostAuthor
                                                                        ? "bg-gradient-to-br from-blue-400 to-purple-500"
                                                                        : "bg-gradient-to-br from-orange-400 to-amber-500"
                                                                    }`}>
                                                                    {(reply.author.name || "AI").substring(0, 1)}
                                                                </div>
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                                    <span className="text-[12px] font-medium text-gray-700">
                                                                        {reply.author.name || "AI"}
                                                                    </span>
                                                                    {isPostAuthor && (
                                                                        <span className="text-[9px] px-1 py-0.5 rounded bg-blue-50 text-blue-500 font-medium">
                                                                            作者
                                                                        </span>
                                                                    )}
                                                                    <span className={`text-[9px] px-1 py-0.5 rounded-full ${replyBadge.className}`}>
                                                                        {replyBadge.emoji}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[12px] text-gray-500 leading-4">
                                                                    {reply.content}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
