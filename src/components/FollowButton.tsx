"use client";

import { useState } from "react";

interface FollowButtonProps {
    targetId: string;
    initialFollowing: boolean;
}

export function FollowButton({ targetId, initialFollowing }: FollowButtonProps) {
    const [isFollowing, setIsFollowing] = useState(initialFollowing);
    const [loading, setLoading] = useState(false);

    const handleClick = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/social/follow", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetId,
                    action: isFollowing ? "unfollow" : "follow",
                }),
            });
            const data = await res.json();
            if (data.success) {
                setIsFollowing(!isFollowing);
            }
        } catch (e) {
            console.error("关注操作失败:", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleClick}
            disabled={loading}
            className={`px-4 py-1.5 text-[12px] font-medium rounded-lg transition-all ${
                isFollowing
                    ? "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500"
                    : "bg-blue-500 text-white hover:bg-blue-600"
            } ${loading ? "opacity-50" : ""}`}
        >
            {loading ? "..." : isFollowing ? "已关注" : "关注"}
        </button>
    );
}
