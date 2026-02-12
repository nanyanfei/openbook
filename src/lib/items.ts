import { PrismaClient } from "@prisma/client";

// 每个 Item 配有真实图片 URL（Unsplash 免费图片）
export const MOCK_ITEMS = [
    // === 咖啡店 ===
    {
        name: "Starbucks Reserve Roastery",
        category: "Coffee Shop",
        location: "Shanghai, Nanjing West Rd",
        metadata: { price: 4, rating: 4.5, wifi: "Fast", seats: 200, noiseLevel: "Medium" },
        images: [
            "https://images.unsplash.com/photo-1559496417-e7f25cb247f3?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&h=800&fit=crop",
        ],
    },
    {
        name: "Luckin Coffee (Corner Store)",
        category: "Coffee Shop",
        location: "Shanghai, Tech Park",
        metadata: { price: 1, rating: 3.8, wifi: "None", avgWaitTime: "2min", orderMethod: "App-only" },
        images: [
            "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=600&h=800&fit=crop",
        ],
    },
    {
        name: "Manner Coffee",
        category: "Coffee Shop",
        location: "Shanghai, Jing'an",
        metadata: { price: 2, rating: 4.2, wifi: "Decent", selfService: true, cupSize: "Standard" },
        images: [
            "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=600&h=800&fit=crop",
        ],
    },
    {
        name: "Blue Bottle Coffee",
        category: "Coffee Shop",
        location: "Shanghai, Suzhou Creek",
        metadata: { price: 5, rating: 4.8, wifi: "Slow", aesthetic: "Minimalist", handBrewed: true },
        images: [
            "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1498804103079-a6351b050096?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1507133750040-4a8f57021571?w=600&h=800&fit=crop",
        ],
    },
    // === 科技产品 ===
    {
        name: "Apple Vision Pro",
        category: "Tech Gadget",
        location: "Global",
        metadata: { price: 5, rating: 4.9, type: "VR/AR", weight: "600g", batteryLife: "2h" },
        images: [
            "https://images.unsplash.com/photo-1593508512255-86ab42a8e620?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1626379953822-baec19c3accd?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1617802690992-15d93263d3a9?w=600&h=800&fit=crop",
        ],
    },
    {
        name: "Tesla Model 3",
        category: "Tech Gadget",
        location: "Shanghai, Gigafactory",
        metadata: { price: 5, rating: 4.6, type: "EV", range: "567km", autopilot: true },
        images: [
            "https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1536700503339-1e4b06520771?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600&h=800&fit=crop",
        ],
    },
    // === 美食 ===
    {
        name: "小杨生煎",
        category: "Food",
        location: "Shanghai, Multiple Locations",
        metadata: { price: 1, rating: 4.3, type: "Local Snack", servingSize: "4pcs", waitTime: "15min" },
        images: [
            "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=600&h=800&fit=crop",
        ],
    },
    {
        name: "海底捞火锅",
        category: "Food",
        location: "Shanghai, Nanjing Rd",
        metadata: { price: 3, rating: 4.5, type: "Hot Pot", serviceLevel: "Legendary", waitTime: "60min" },
        images: [
            "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1555126634-323283e090fa?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1547592180-85f173990554?w=600&h=800&fit=crop",
        ],
    },
    // === 生活空间 ===
    {
        name: "上海图书馆东馆",
        category: "Public Space",
        location: "Shanghai, Pudong",
        metadata: { price: 0, rating: 4.9, type: "Library", seats: 6000, bookCount: "4.8M", quietLevel: "Very High" },
        images: [
            "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=600&h=800&fit=crop",
        ],
    },
    {
        name: "外滩观景台",
        category: "Landmark",
        location: "Shanghai, The Bund",
        metadata: { price: 0, rating: 4.7, type: "Scenic Spot", bestTime: "Night", crowdLevel: "Very High" },
        images: [
            "https://images.unsplash.com/photo-1474181487882-5abf3f0ba6c2?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1545893835-abaa50cbe628?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1537531383496-f4749b85e06c?w=600&h=800&fit=crop",
        ],
    },
    // === 工作空间 ===
    {
        name: "WeWork 共享办公",
        category: "Coworking Space",
        location: "Shanghai, Lujiazui",
        metadata: { price: 4, rating: 4.1, wifi: "Ultra-fast", monthlyPrice: "2500RMB", meetingRooms: true },
        images: [
            "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1497215842964-222b430dc094?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&h=800&fit=crop",
        ],
    },
    // === 娱乐 ===
    {
        name: "上海迪士尼乐园",
        category: "Entertainment",
        location: "Shanghai, Pudong",
        metadata: { price: 5, rating: 4.6, type: "Theme Park", dailyVisitors: "50000+", topRide: "TRON Lightcycle" },
        images: [
            "https://images.unsplash.com/photo-1597466599360-3b9775841aec?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1605898437812-7d5e tried4?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=600&h=800&fit=crop",
        ],
    },
];

/**
 * 根据 Item 名称获取图片 URL 列表
 */
export function getItemImages(itemName: string): string[] {
    const item = MOCK_ITEMS.find(i => i.name === itemName);
    if (item && item.images.length > 0) {
        // 随机选择 1-2 张图片
        const shuffled = [...item.images].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 1 + Math.floor(Math.random() * 2));
    }
    // 通用 fallback 基于类别
    const fallbackImages: Record<string, string[]> = {
        "Coffee Shop": [
            "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=800&fit=crop",
        ],
        "Tech Gadget": [
            "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=600&h=800&fit=crop",
        ],
        "Food": [
            "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1555126634-323283e090fa?w=600&h=800&fit=crop",
        ],
        "Public Space": [
            "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=800&fit=crop",
        ],
        "Landmark": [
            "https://images.unsplash.com/photo-1474181487882-5abf3f0ba6c2?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1545893835-abaa50cbe628?w=600&h=800&fit=crop",
        ],
        "Coworking Space": [
            "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1497215842964-222b430dc094?w=600&h=800&fit=crop",
        ],
        "Entertainment": [
            "https://images.unsplash.com/photo-1597466599360-3b9775841aec?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=600&h=800&fit=crop",
        ],
    };
    const category = MOCK_ITEMS.find(i => i.name === itemName)?.category || "Coffee Shop";
    return fallbackImages[category] || fallbackImages["Coffee Shop"];
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
                },
            });
        } else {
            // 更新 metadata 以包含图片
            const existingMeta = typeof existing.metadata === 'string'
                ? JSON.parse(existing.metadata)
                : existing.metadata;
            await prisma.item.update({
                where: { id: existing.id },
                data: {
                    metadata: JSON.stringify({ ...existingMeta, images: item.images }),
                },
            });
        }
    }
}
