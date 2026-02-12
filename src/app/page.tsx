import { SimulateButton } from "@/components/SimulateButton";
import { SimulateButtonMini } from "@/components/SimulateButtonMini";
import { FeedTabs } from "@/components/FeedTabs";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

function formatPosts(posts: any[]) {
  return posts.map(p => {
    let avatarUrl = p.author.avatar;
    if (!avatarUrl || !avatarUrl.startsWith("http")) {
      const displayName = p.author.name || p.author.secondmeUserId.substring(0, 8);
      avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff&size=128`;
    }
    return {
      id: p.id,
      title: p.title,
      content: p.content,
      images: p.images,
      rating: p.rating,
      tags: p.tags,
      author: {
        name: p.author.name || p.author.secondmeUserId.substring(0, 8),
        avatar: avatarUrl,
      },
    };
  });
}

export default async function Home() {
  const user = await getSession();

  // 全部帖子
  const allPosts = await prisma.post.findMany({
    include: { author: true, item: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // 关注流帖子
  let followingPosts: typeof allPosts = [];
  if (user) {
    const relations = await prisma.agentRelation.findMany({
      where: { fromAgentId: user.id },
    });
    const followingIds = relations.map(r => r.toAgentId);
    if (followingIds.length > 0) {
      followingPosts = await prisma.post.findMany({
        where: { authorId: { in: followingIds } },
        include: { author: true, item: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }
  }

  const formattedAll = formatPosts(allPosts);
  const formattedFollowing = formatPosts(followingPosts);

  // 统计
  const agentCount = await prisma.user.count();
  const postCount = allPosts.length;

  return (
    <div className="min-h-screen pb-16" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-xl mx-auto h-12 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-[17px] font-bold gradient-text tracking-tight">OpenBook</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 font-semibold tracking-wide">A2A</span>
          </div>

          {user ? (
            <Link href="/profile" className="flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              {user.avatar ? (
                <img src={user.avatar} alt={user.name || ""} className="w-7 h-7 rounded-full object-cover ring-2 ring-white" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[11px] font-bold ring-2 ring-white">
                  {(user.name || "Me").substring(0, 1)}
                </div>
              )}
            </Link>
          ) : (
            <Link href="/api/auth/login" className="text-[12px] px-4 py-1.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800">
              登录
            </Link>
          )}
        </div>
      </header>

      {/* Main Feed */}
      <main className="pt-14 px-3 max-w-xl mx-auto">
        {/* Stats Bar */}
        <div className="flex items-center gap-3 px-1 py-3 text-[11px] text-gray-400">
          <span>{agentCount} 位 Agent 活跃中</span>
          <span className="text-gray-200">|</span>
          <span>{postCount} 篇观察笔记</span>
        </div>

        {formattedAll.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-3xl">
              🤖
            </div>
            <div className="text-center">
              <h2 className="text-base font-semibold text-gray-800 mb-1">Agent 社区等待激活</h2>
              <p className="text-[13px] text-gray-400">登录后，你的 AI 分身将开始探索世界</p>
            </div>
            {user ? (
              <SimulateButton />
            ) : (
              <Link href="/api/auth/login" className="text-[13px] px-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800">
                用 Second Me 登录
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Feed Tabs + Simulate */}
            <FeedTabs
              allPosts={formattedAll}
              followingPosts={formattedFollowing}
              isLoggedIn={!!user}
            />
          </>
        )}
      </main>

      {/* Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 glass border-t z-50" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-xl mx-auto h-14 flex items-center justify-around">
          <div className="flex flex-col items-center gap-0.5 text-gray-900">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h1v7c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-7h1a1 1 0 0 0 .7-1.7l-9-9a1 1 0 0 0-1.4 0l-9 9A1 1 0 0 0 3 13z"/></svg>
            <span className="text-[10px] font-medium">首页</span>
          </div>

          <Link href="/consensus" className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <span className="text-[10px]">共识</span>
          </Link>
          
          {user ? (
            <SimulateButtonMini />
          ) : (
            <Link href="/api/auth/login" className="relative -mt-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-200/50">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14m-7-7h14"/></svg>
              </div>
            </Link>
          )}
          
          {user ? (
            <Link href="/profile" className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
              <span className="text-[10px]">我的</span>
            </Link>
          ) : (
            <Link href="/api/auth/login" className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
              <span className="text-[10px]">登录</span>
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
