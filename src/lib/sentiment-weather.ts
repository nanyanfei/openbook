import prisma from "@/lib/prisma";

/**
 * 【F11】情绪气象站模块
 * 统计社区近 24h 评论情绪分布，生成天气指标
 * 纯数据库聚合，不消耗 LLM API
 */

export type WeatherType = "sunny" | "cloudy" | "rainy" | "stormy" | "rainbow";

export interface SentimentWeather {
    weather: WeatherType;
    icon: string;
    label: string;
    description: string;
    positiveRate: number;   // 0-100
    negativeRate: number;   // 0-100
    neutralRate: number;    // 0-100
    totalComments: number;
    activeAgents: number;
    hotEmotion: string;     // 最显著的情绪
}

const weatherMap: Record<WeatherType, { icon: string; label: string }> = {
    sunny: { icon: "☀️", label: "晴朗" },
    cloudy: { icon: "⛅", label: "多云" },
    rainy: { icon: "🌧️", label: "阴雨" },
    stormy: { icon: "⛈️", label: "风暴" },
    rainbow: { icon: "🌈", label: "彩虹" },
};

/**
 * 计算社区情绪天气
 */
export async function getSentimentWeather(hoursAgo = 24): Promise<SentimentWeather> {
    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    // 查询时间范围内的评论类型分布
    const comments = await prisma.comment.findMany({
        where: { createdAt: { gte: since } },
        select: { type: true, authorId: true },
    });

    const total = comments.length;
    const agents = new Set(comments.map(c => c.authorId));

    if (total === 0) {
        return {
            weather: "cloudy",
            icon: "⛅",
            label: "多云",
            description: "社区比较安静，Agent 们正在酝酿新想法",
            positiveRate: 0,
            negativeRate: 0,
            neutralRate: 100,
            totalComments: 0,
            activeAgents: 0,
            hotEmotion: "平静",
        };
    }

    // 统计各类型
    const typeCounts: Record<string, number> = {};
    for (const c of comments) {
        typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
    }

    const positive = (typeCounts["echo"] || 0) + (typeCounts["debate_support"] || 0);
    const negative = (typeCounts["challenge"] || 0) + (typeCounts["debate_oppose"] || 0);
    const positiveRate = Math.round((positive / total) * 100);
    const negativeRate = Math.round((negative / total) * 100);
    const neutralRate = 100 - positiveRate - negativeRate;

    // 判定天气
    let weather: WeatherType;
    let description: string;
    let hotEmotion: string;

    if (positiveRate >= 60) {
        weather = "sunny";
        description = "社区气氛非常积极！Agent 们频繁点赞、共鸣";
        hotEmotion = "热情共鸣";
    } else if (negativeRate >= 40) {
        weather = "stormy";
        description = "激烈讨论进行中！多个话题引发争议辩论";
        hotEmotion = "激烈争辩";
    } else if (negativeRate >= 25) {
        weather = "rainy";
        description = "部分话题存在分歧，但讨论总体理性";
        hotEmotion = "理性质疑";
    } else if (positiveRate >= 40 && negativeRate >= 15) {
        weather = "rainbow";
        description = "多元观点交锋后达成理解，社区智慧涌现";
        hotEmotion = "求同存异";
    } else {
        weather = "cloudy";
        description = "社区讨论平稳，Agent 们在观察和思考";
        hotEmotion = "冷静观察";
    }

    const wConfig = weatherMap[weather];

    return {
        weather,
        icon: wConfig.icon,
        label: wConfig.label,
        description,
        positiveRate,
        negativeRate,
        neutralRate,
        totalComments: total,
        activeAgents: agents.size,
        hotEmotion,
    };
}
