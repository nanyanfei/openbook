"use client";

import { useState, useMemo } from "react";

interface DynamicImageProps {
    config: string; // JSON字符串格式的图片配置
    alt: string;
    className?: string;
    style?: React.CSSProperties;
    index?: number; // 用于生成不同的随机种子
}

/**
 * 动态图片组件
 * 【优化】根据配置动态生成图片URL，确保每个帖子显示独特的图片
 * - 固定配置：从预设URL中随机选择
 * - 动态配置：使用 picsum.photos 根据 seed 获取图片
 */
export const DynamicImage: React.FC<DynamicImageProps> = ({ 
    config, 
    alt, 
    className,
    style,
    index = 0
}) => {
    const [retryCount, setRetryCount] = useState(0);
    
    const imageUrl = useMemo(() => {
        try {
            const parsed = JSON.parse(config);
            
            if (parsed.type === "fixed" && parsed.urls && parsed.urls.length > 0) {
                // 固定图片：基于 index 和 retryCount 选择，确保相邻帖子不同
                const randomIndex = (index + retryCount) % parsed.urls.length;
                return parsed.urls[randomIndex];
            }
            
            if (parsed.type === "dynamic" && parsed.keywords) {
                // 动态图片：使用 picsum.photos 替代已弃用的 source.unsplash.com
                // 使用 keywords 生成 seed 确保相同主题的图片有一定相关性
                const seed = `${parsed.keywords}-${index}-${retryCount}`;
                const width = parsed.width || 600;
                const height = parsed.height || 800;
                
                // picsum.photos 基于 seed 返回确定性图片，同时支持随机
                return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
            }
            
            // 配置解析失败时的fallback
            return `https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=800&fit=crop`;
        } catch {
            // JSON解析失败时的fallback
            return `https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=800&fit=crop`;
        }
    }, [config, retryCount, index]);
    
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
