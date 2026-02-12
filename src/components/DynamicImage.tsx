"use client";

import { useState, useMemo } from "react";

interface DynamicImageProps {
    config: string; // JSON字符串格式的图片配置
    alt: string;
    className?: string;
    style?: React.CSSProperties;
    index?: number; // 用于生成不同的随机种子
}

// 简单的伪随机数生成器（基于seed），确保SSR和客户端结果一致
function seededRandom(seed: number): number {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

/**
 * 动态图片组件
 * 【优化】根据配置动态生成图片URL，确保每个帖子显示独特的图片
 * - 固定配置：从预设URL中随机选择
 * - 动态配置：使用Unsplash Source API根据关键词实时获取
 */
export const DynamicImage: React.FC<DynamicImageProps> = ({ 
    config, 
    alt, 
    className,
    style,
    index = 0
}) => {
    const [retryCount, setRetryCount] = useState(0);
    // 使用 useState lazy initializer 生成稳定的种子值
    const [seed] = useState(() => Date.now() + index);
    
    const imageUrl = useMemo(() => {
        try {
            const parsed = JSON.parse(config);
            
            if (parsed.type === "fixed" && parsed.urls && parsed.urls.length > 0) {
                // 固定图片：基于 index 和 retryCount 选择，确保相邻帖子不同
                const randomIndex = (index + retryCount) % parsed.urls.length;
                return parsed.urls[randomIndex];
            }
            
            if (parsed.type === "dynamic" && parsed.keywords) {
                // 动态图片：使用seed-based随机数确保稳定性
                const randomSeed = Math.floor(seededRandom(seed + retryCount) * 100000);
                const uniqueId = `${seed}-${randomSeed}-${retryCount}-${index}`;
                const width = parsed.width || 600;
                const height = parsed.height || 800;
                
                return `https://source.unsplash.com/${width}x${height}/?${encodeURIComponent(parsed.keywords)}&sig=${uniqueId}`;
            }
            
            // 配置解析失败时的fallback
            return `https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=800&fit=crop`;
        } catch {
            // JSON解析失败时的fallback
            return `https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=800&fit=crop`;
        }
    }, [config, retryCount, index, seed]);
    
    const handleError = () => {
        if (retryCount < 3) {
            setRetryCount(prev => prev + 1); // 触发重新生成URL
        }
    };
    
    return (
        <img
            src={imageUrl}
            alt={alt}
            className={className}
            style={style}
            loading="lazy"
            onError={handleError}
        />
    );
};

/**
 * 辅助函数：从旧的图片URL数组格式迁移到新的配置格式
 * 用于兼容旧数据
 */
export function migrateImageFormat(imagesJson: string | null): string {
    if (!imagesJson) {
        return JSON.stringify({ 
            type: "dynamic", 
            keywords: "lifestyle,minimal,aesthetic",
            width: 600,
            height: 800
        });
    }
    
    try {
        const parsed = JSON.parse(imagesJson);
        
        // 已经是新格式
        if (parsed.type === "fixed" || parsed.type === "dynamic") {
            return imagesJson;
        }
        
        // 旧格式：URL数组
        if (Array.isArray(parsed) && parsed.length > 0) {
            return JSON.stringify({ type: "fixed", urls: parsed });
        }
        
        // 其他情况，返回动态配置
        return JSON.stringify({ 
            type: "dynamic", 
            keywords: "lifestyle,minimal,aesthetic",
            width: 600,
            height: 800
        });
    } catch {
        // 解析失败，返回动态配置
        return JSON.stringify({ 
            type: "dynamic", 
            keywords: "lifestyle,minimal,aesthetic",
            width: 600,
            height: 800
        });
    }
}
