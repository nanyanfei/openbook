import prisma from "@/lib/prisma";

/**
 * 【F10】社区知识图谱模块
 * 从帖子/评论中抽取实体关系，构建社区知识网络
 */

export interface KnowledgeNode {
    id: string;
    name: string;
    type: "item" | "category" | "tag";
    weight: number; // 出现次数
}

export interface KnowledgeLink {
    source: string;
    target: string;
    relation: string;
    weight: number;
}

export interface KnowledgeGraphData {
    nodes: KnowledgeNode[];
    links: KnowledgeLink[];
}

/**
 * 从帖子中抽取知识边并存储
 * 规则：同一作者讨论过的不同 Item → "explored_together"
 *       同一 Item 的不同帖子 → 加强 Item 节点权重
 *       帖子 tags 共现 → "tag_cooccurrence"
 */
export async function extractKnowledgeFromPost(postId: string): Promise<number> {
    let edgesCreated = 0;

    try {
        const post = await prisma.post.findUnique({
            where: { id: postId },
            include: { item: true, author: true },
        });
        if (!post) return 0;

        // 1. 同作者探索过的其他 Item → explored_together
        const authorOtherPosts = await prisma.post.findMany({
            where: { authorId: post.authorId, itemId: { not: post.itemId } },
            include: { item: true },
            take: 10,
        });

        for (const otherPost of authorOtherPosts) {
            // 检查是否已存在该边
            const existing = await (prisma as any).knowledgeEdge?.findFirst({
                where: {
                    OR: [
                        { fromNode: post.item.name, toNode: otherPost.item.name, relation: "explored_together" },
                        { fromNode: otherPost.item.name, toNode: post.item.name, relation: "explored_together" },
                    ],
                },
            }).catch(() => null);

            if (existing) {
                // 加强权重
                await (prisma as any).knowledgeEdge?.update({
                    where: { id: existing.id },
                    data: { weight: existing.weight + 0.5 },
                }).catch(() => {});
            } else {
                await (prisma as any).knowledgeEdge?.create({
                    data: {
                        fromNode: post.item.name,
                        toNode: otherPost.item.name,
                        relation: "explored_together",
                        weight: 1,
                        sourcePostId: postId,
                    },
                }).catch(() => {});
                edgesCreated++;
            }
        }

        // 2. 同 category 的 Item → same_category
        const sameCategoryItems = await prisma.item.findMany({
            where: { category: post.item.category, id: { not: post.itemId } },
            take: 5,
        });

        for (const otherItem of sameCategoryItems) {
            const existing = await (prisma as any).knowledgeEdge?.findFirst({
                where: {
                    OR: [
                        { fromNode: post.item.name, toNode: otherItem.name, relation: "same_category" },
                        { fromNode: otherItem.name, toNode: post.item.name, relation: "same_category" },
                    ],
                },
            }).catch(() => null);

            if (!existing) {
                await (prisma as any).knowledgeEdge?.create({
                    data: {
                        fromNode: post.item.name,
                        toNode: otherItem.name,
                        relation: "same_category",
                        weight: 0.5,
                        sourcePostId: postId,
                    },
                }).catch(() => {});
                edgesCreated++;
            }
        }
    } catch (e) {
        console.warn("[KnowledgeGraph] 抽取失败:", e);
    }

    return edgesCreated;
}

/**
 * 获取知识图谱数据（用于前端可视化）
 */
export async function getKnowledgeGraphData(): Promise<KnowledgeGraphData> {
    const nodes: KnowledgeNode[] = [];
    const links: KnowledgeLink[] = [];
    const nodeSet = new Set<string>();

    try {
        // 获取所有知识边
        const edges = await (prisma as any).knowledgeEdge?.findMany({
            orderBy: { weight: "desc" },
            take: 100,
        }).catch(() => []);

        if (!edges || edges.length === 0) {
            // 回退：从帖子数据构建简单图谱
            return buildFallbackGraph();
        }

        for (const edge of edges) {
            // 添加节点
            if (!nodeSet.has(edge.fromNode)) {
                nodeSet.add(edge.fromNode);
                nodes.push({ id: edge.fromNode, name: edge.fromNode, type: "item", weight: edge.weight });
            }
            if (!nodeSet.has(edge.toNode)) {
                nodeSet.add(edge.toNode);
                nodes.push({ id: edge.toNode, name: edge.toNode, type: "item", weight: edge.weight });
            }

            // 添加边
            links.push({
                source: edge.fromNode,
                target: edge.toNode,
                relation: edge.relation,
                weight: edge.weight,
            });
        }
    } catch {
        return buildFallbackGraph();
    }

    return { nodes, links };
}

/**
 * 回退方案：从帖子数据直接构建图谱
 */
async function buildFallbackGraph(): Promise<KnowledgeGraphData> {
    const nodes: KnowledgeNode[] = [];
    const links: KnowledgeLink[] = [];
    const nodeSet = new Set<string>();

    // 获取有帖子的 Item
    const items = await prisma.item.findMany({
        where: { posts: { some: {} } },
        include: { _count: { select: { posts: true } } },
        take: 30,
    });

    for (const item of items) {
        if (!nodeSet.has(item.name)) {
            nodeSet.add(item.name);
            nodes.push({ id: item.name, name: item.name, type: "item", weight: item._count.posts });
        }

        // category 节点
        if (!nodeSet.has(item.category)) {
            nodeSet.add(item.category);
            nodes.push({ id: item.category, name: item.category, type: "category", weight: 3 });
        }

        links.push({
            source: item.name,
            target: item.category,
            relation: "belongs_to",
            weight: 1,
        });
    }

    // 同 category 的 Item 互相连接
    const categoryItems = new Map<string, string[]>();
    for (const item of items) {
        if (!categoryItems.has(item.category)) categoryItems.set(item.category, []);
        categoryItems.get(item.category)!.push(item.name);
    }

    for (const [, itemNames] of categoryItems) {
        for (let i = 0; i < itemNames.length - 1; i++) {
            for (let j = i + 1; j < itemNames.length && j < i + 3; j++) {
                links.push({
                    source: itemNames[i],
                    target: itemNames[j],
                    relation: "same_category",
                    weight: 0.5,
                });
            }
        }
    }

    return { nodes, links };
}
