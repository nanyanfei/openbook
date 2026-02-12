import { PrismaClient } from "@prisma/client";

// 小众独立品牌为主，避免连锁大品牌
export const MOCK_ITEMS = [
    // === 独立咖啡店 ===
    {
        name: "Seesaw Coffee（愚园路店）",
        category: "独立咖啡",
        location: "上海 · 愚园路",
        metadata: { price: 3, rating: 4.6, style: "Industrial Chic", specialty: "创意特调", wifi: "Fast", seats: 30 },
        images: [
            "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=800&fit=crop",
        ],
    },
    {
        name: "Café del Volcán",
        category: "独立咖啡",
        location: "上海 · 永康路",
        metadata: { price: 3, rating: 4.8, style: "Latin American", specialty: "手冲单品", wifi: "Slow", seats: 15 },
        images: [
            "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&h=800&fit=crop",
        ],
    },
    {
        name: "% Arabica（武康路店）",
        category: "独立咖啡",
        location: "上海 · 武康路",
        metadata: { price: 4, rating: 4.5, style: "Minimalist White", specialty: "Latte Art", wifi: "None", seats: 10 },
        images: [
            "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=600&h=800&fit=crop",
        ],
    },
    // === 独立书店 ===
    {
        name: "衡山·和集",
        category: "独立书店",
        location: "上海 · 衡山路",
        metadata: { price: 2, rating: 4.7, type: "Art Bookstore + Gallery", specialty: "艺术与设计类书籍", atmosphere: "安静文艺" },
        images: [
            "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=800&fit=crop",
        ],
    },
    {
        name: "1984 Bookstore",
        category: "独立书店",
        location: "上海 · 湖南路",
        metadata: { price: 2, rating: 4.6, type: "Independent", specialty: "社科与文学", atmosphere: "复古胶片感" },
        images: [
            "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1526243741027-444d633d7365?w=600&h=800&fit=crop",
        ],
    },
    // === 小众展览 / 艺术空间 ===
    {
        name: "chi K11 美术馆",
        category: "艺术空间",
        location: "上海 · 淮海中路",
        metadata: { price: 3, rating: 4.4, type: "Underground Art Museum", specialty: "当代艺术沉浸展", ticketPrice: "100-150¥" },
        images: [
            "https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1544967082-d9d25d867d66?w=600&h=800&fit=crop",
        ],
    },
    {
        name: "余德耀美术馆",
        category: "艺术空间",
        location: "上海 · 西岸",
        metadata: { price: 3, rating: 4.8, type: "Private Art Museum", specialty: "大型装置艺术", architecture: "改造自机库" },
        images: [
            "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&h=800&fit=crop",
        ],
    },
    // === 特色餐饮 ===
    {
        name: "愚园路弄堂面馆",
        category: "特色小食",
        location: "上海 · 愚园路",
        metadata: { price: 1, rating: 4.3, type: "Hidden Alley Noodle", specialty: "浇头面", waitTime: "20min", seatingType: "弄堂露天" },
        images: [
            "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=600&h=800&fit=crop",
        ],
    },
    {
        name: "甜蜜蜜(Tian Mi Mi) 台式甜品",
        category: "特色小食",
        location: "上海 · 静安寺",
        metadata: { price: 2, rating: 4.5, type: "Taiwanese Dessert", specialty: "手工芋圆", aesthetic: "怀旧台式" },
        images: [
            "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&h=800&fit=crop",
        ],
    },
    // === 手工 / 工作室 ===
    {
        name: "物外陶瓷工作室",
        category: "手工体验",
        location: "上海 · 田子坊",
        metadata: { price: 3, rating: 4.7, type: "Ceramic Workshop", specialty: "手拉坯体验", duration: "2h", bookingRequired: true },
        images: [
            "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?w=600&h=800&fit=crop",
        ],
    },
    // === 社区空间 ===
    {
        name: "新天地社区花园",
        category: "社区空间",
        location: "上海 · 新天地",
        metadata: { price: 0, rating: 4.2, type: "Community Garden", specialty: "城市农耕 + 社区活动", openHours: "6:00-22:00" },
        images: [
            "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=800&fit=crop",
        ],
    },
    // === 独立音乐 ===
    {
        name: "育音堂 Yuyintang",
        category: "独立音乐",
        location: "上海 · 凯旋路",
        metadata: { price: 2, rating: 4.6, type: "Indie Music Venue", specialty: "地下摇滚 & 独立乐队", capacity: 200 },
        images: [
            "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&h=800&fit=crop",
        ],
    },
];

/**
 * 根据 Item 名称获取图片 URL 列表
 */
export function getItemImages(itemName: string): string[] {
    const item = MOCK_ITEMS.find(i => i.name === itemName);
    if (item && item.images.length > 0) {
        const shuffled = [...item.images].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 1 + Math.floor(Math.random() * 2));
    }
    // Fallback: Unsplash 通用图片
    const fallbacks = [
        "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&h=800&fit=crop",
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=800&fit=crop",
        "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=600&h=800&fit=crop",
    ];
    return [fallbacks[Math.floor(Math.random() * fallbacks.length)]];
}

export async function seedItems(prisma: PrismaClient) {
    for (const item of MOCK_ITEMS) {
        const existing = await prisma.item.findFirst({ where: { name: item.name } });
        if (!existing) {
            await prisma.item.create({
                data: {
                    name: item.name,
                    category: item.category,
                    location: item.location,
                    metadata: JSON.stringify({ ...item.metadata, images: item.images }),
                    isNiche: true,
                    source: "seed",
                },
            });
        }
    }
}
