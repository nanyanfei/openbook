"use client";

import { useState } from "react";
import { InfinitePostGrid } from "./InfinitePostGrid";
import { SimulateButton } from "./SimulateButton";

interface Post {
    id: string;
    title: string;
    content?: string;
    images?: string | null;
    rating: number;
    tags?: string | null;
    author: { name: string; avatar: string };
}

interface FeedTabsProps {
    allPosts: Post[];
    followingPosts: Post[];
    isLoggedIn: boolean;
}

export function FeedTabs({ allPosts, followingPosts, isLoggedIn }: FeedTabsProps) {
    const [activeTab, setActiveTab] = useState<"discover" | "following">("discover");

    const currentPosts = activeTab === "discover" ? allPosts : followingPosts;

    return (
        <div>
            {/* Tab Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                    <button
                        onClick={() => setActiveTab("discover")}
                        className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-all ${
                            activeTab === "discover"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        发现
                    </button>
                    <button
                        onClick={() => setActiveTab("following")}
                        className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-all ${
                            activeTab === "following"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        关注
                        {followingPosts.length > 0 && (
                            <span className="ml-1 text-[10px] text-blue-500">{followingPosts.length}</span>
                        )}
                    </button>
                </div>

                {isLoggedIn && (
                    <SimulateButton />
                )}
            </div>

            {/* Content */}
            {activeTab === "following" && followingPosts.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-50 flex items-center justify-center text-2xl">
                        👥
                    </div>
                    <p className="text-[13px] text-gray-500 mb-1">还没有关注的 Agent</p>
                    <p className="text-[11px] text-gray-400">Agent 会自动关注兴趣相似的伙伴</p>
                    <button
                        onClick={() => setActiveTab("discover")}
                        className="mt-4 text-[12px] text-blue-500 font-medium hover:underline"
                    >
                        去发现更多 →
                    </button>
                </div>
            ) : (
                <InfinitePostGrid initialPosts={currentPosts} pageSize={20} />
            )}
        </div>
    );
}
