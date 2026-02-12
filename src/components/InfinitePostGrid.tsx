"use client";

import { useState, useEffect, useCallback } from "react";
import { MasonryGrid } from "./MasonryGrid";
import { NoteCard } from "./NoteCard";

interface Post {
    id: string;
    title: string;
    content?: string;
    images?: string | null;
    rating: number;
    tags?: string | null;
    author: {
        name: string;
        avatar: string;
    };
}

interface InfinitePostGridProps {
    initialPosts: Post[];
    pageSize?: number;
}

export const InfinitePostGrid: React.FC<InfinitePostGridProps> = ({ 
    initialPosts, 
    pageSize = 20 
}) => {
    // 使用useState的函数式初始值避免useEffect
    const [displayedPosts, setDisplayedPosts] = useState<Post[]>(() => 
        initialPosts.slice(0, pageSize)
    );
    const [hasMore, setHasMore] = useState(() => initialPosts.length > pageSize);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const allPosts = initialPosts;

    // 加载更多帖子
    const loadMore = useCallback(() => {
        if (isLoading || !hasMore) return;
        
        setIsLoading(true);
        
        // 模拟异步加载（实际项目中这里可以调用API）
        setTimeout(() => {
            const nextPage = page + 1;
            const start = (nextPage - 1) * pageSize;
            const end = start + pageSize;
            const newPosts = allPosts.slice(start, end);
            
            if (newPosts.length > 0) {
                setDisplayedPosts(prev => [...prev, ...newPosts]);
                setPage(nextPage);
                setHasMore(end < allPosts.length);
            } else {
                setHasMore(false);
            }
            
            setIsLoading(false);
        }, 300);
    }, [allPosts, page, pageSize, isLoading, hasMore]);

    // 无限滚动：监听滚动事件
    useEffect(() => {
        const handleScroll = () => {
            if (isLoading || !hasMore) return;
            
            const scrollHeight = document.documentElement.scrollHeight;
            const scrollTop = document.documentElement.scrollTop;
            const clientHeight = document.documentElement.clientHeight;
            
            // 距离底部200px时加载更多
            if (scrollTop + clientHeight >= scrollHeight - 200) {
                loadMore();
            }
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [loadMore, isLoading, hasMore]);

    return (
        <div>
            <MasonryGrid columns={2}>
                {displayedPosts.map((post, i) => (
                    <NoteCard key={post.id} post={post} index={i} />
                ))}
            </MasonryGrid>

            {/* 加载状态 */}
            {isLoading && (
                <div className="flex justify-center py-6">
                    <div className="flex items-center gap-2 text-gray-400">
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                        <span className="text-sm">加载中...</span>
                    </div>
                </div>
            )}

            {/* 加载更多按钮（无限滚动失败时的兜底） */}
            {!isLoading && hasMore && (
                <div className="flex justify-center py-6">
                    <button
                        onClick={loadMore}
                        className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full text-sm font-medium transition-colors"
                    >
                        加载更多
                    </button>
                </div>
            )}

            {/* 到底了 */}
            {!hasMore && displayedPosts.length > 0 && (
                <div className="flex justify-center py-8 text-gray-400 text-sm">
                    已经到底了 ~
                </div>
            )}
        </div>
    );
};
