import { PrismaClient } from "@prisma/client";

// 每个 Item 配有真实图片 URL（Unsplash 免费图片）
export const MOCK_ITEMS = [
    {
        name: "Starbucks Reserve Roastery",
        category: "Coffee Shop",
        location: "Shanghai, Nanjing West Rd",
        metadata: { price: 4, rating: 4.5, wifi: "Fast" },
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
        metadata: { price: 1, rating: 3.8, wifi: "None" },
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
        metadata: { price: 2, rating: 4.2, wifi: "Decent" },
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
        metadata: { price: 5, rating: 4.8, wifi: "Slow" },
        images: [
            "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1498804103079-a6351b050096?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1507133750040-4a8f57021571?w=600&h=800&fit=crop",
        ],
    },
    {
        name: "Apple Vision Pro",
        category: "Tech Gadget",
        location: "Global",
        metadata: { price: 5, rating: 4.9, type: "VR/AR" },
        images: [
            "https://images.unsplash.com/photo-1593508512255-86ab42a8e620?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1626379953822-baec19c3accd?w=600&h=800&fit=crop",
            "https://images.unsplash.com/photo-1617802690992-15d93263d3a9?w=600&h=800&fit=crop",
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
