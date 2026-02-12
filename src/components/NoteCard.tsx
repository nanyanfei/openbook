import Link from "next/link";
import { useState } from "react";

interface NoteCardProps {
    post: {
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
    };
    index?: number;
}

export const NoteCard: React.FC<NoteCardProps> = ({ post, index = 0 }) => {
    const images = post.images ? JSON.parse(post.images) : [];
    const [coverImage, setCoverImage] = useState(images[0] || `https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=800&fit=crop`);
    const tags: string[] = post.tags ? JSON.parse(post.tags) : [];

    // 【修复】增强avatar处理：如果不是有效URL，生成默认头像
    const isUrlAvatar = post.author.avatar?.startsWith("http");
    const displayAvatar = isUrlAvatar 
        ? post.author.avatar 
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author.name || "AI")}&background=random&color=fff&size=128`;
    
    // 【修复】处理封面图加载失败
    const handleCoverError = () => {
        setCoverImage(`https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=800&fit=crop`);
    };
    
    // 【修复】处理头像加载失败
    const [avatarSrc, setAvatarSrc] = useState(displayAvatar);
    const handleAvatarError = () => {
        setAvatarSrc(`https://ui-avatars.com/api/?name=${encodeURIComponent(post.author.name || "AI")}&background=random&color=fff&size=128`);
    };

    return (
        <Link href={`/post/${post.id}`} className="block group">
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm card-hover fade-in-up" style={{ animationDelay: `${index * 60}ms` }}>
                {/* Cover Image */}
                <div className="relative w-full overflow-hidden bg-gray-50">
                    <img
                        src={coverImage}
                        alt={post.title}
                        className="object-cover w-full group-hover:scale-105 transition-transform duration-500"
                        style={{ aspectRatio: `3/${3 + (index % 3)}` }}
                        loading="lazy"
                        onError={handleCoverError}
                    />
                </div>

                {/* Content */}
                <div className="p-3 pb-3.5">
                    <h3 className="font-semibold text-[13px] leading-5 line-clamp-2 mb-2 text-gray-900">
                        {post.title}
                    </h3>

                    {/* Tags */}
                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                            {tags.slice(0, 3).map((tag, i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-500">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Author + Rating */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                        {/* 【修复】使用displayAvatar替代直接显示emoji */}
                        <img 
                            src={avatarSrc} 
                            alt={post.author.name || ""} 
                            className="w-5 h-5 rounded-full object-cover" 
                            onError={handleAvatarError}
                        />
                        <span className="text-[11px] text-gray-500 truncate max-w-[70px]">
                            {post.author.name}
                        </span>
                    </div>
                        <div className="flex items-center gap-0.5">
                            {Array.from({ length: post.rating }, (_, i) => (
                                <span key={i} className="text-[10px] text-amber-400">★</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
};
