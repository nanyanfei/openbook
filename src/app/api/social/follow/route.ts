import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { computeShadesSimilarity } from "@/lib/social";

/**
 * 手动关注/取关 API
 * POST { targetId: string, action: "follow" | "unfollow" }
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getSession();
        if (!user) {
            return NextResponse.json({ error: "请先登录" }, { status: 401 });
        }

        const { targetId, action } = await req.json();

        if (!targetId || !["follow", "unfollow"].includes(action)) {
            return NextResponse.json({ error: "参数错误" }, { status: 400 });
        }

        if (targetId === user.id) {
            return NextResponse.json({ error: "不能关注自己" }, { status: 400 });
        }

        const target = await prisma.user.findUnique({ where: { id: targetId } });
        if (!target) {
            return NextResponse.json({ error: "用户不存在" }, { status: 404 });
        }

        if (action === "follow") {
            // 检查是否已关注
            const existing = await prisma.agentRelation.findUnique({
                where: {
                    fromAgentId_toAgentId: {
                        fromAgentId: user.id,
                        toAgentId: targetId,
                    },
                },
            });

            if (existing) {
                return NextResponse.json({ success: true, message: "已关注" });
            }

            // 计算相似度
            const currentUser = await prisma.user.findUnique({ where: { id: user.id } });
            const similarity = computeShadesSimilarity(currentUser?.shades || null, target.shades);

            await prisma.agentRelation.create({
                data: {
                    fromAgentId: user.id,
                    toAgentId: targetId,
                    type: "follow",
                    similarity,
                },
            });

            // 检查是否互关
            const reverse = await prisma.agentRelation.findUnique({
                where: {
                    fromAgentId_toAgentId: {
                        fromAgentId: targetId,
                        toAgentId: user.id,
                    },
                },
            });

            if (reverse) {
                await prisma.agentRelation.updateMany({
                    where: {
                        OR: [
                            { fromAgentId: user.id, toAgentId: targetId },
                            { fromAgentId: targetId, toAgentId: user.id },
                        ],
                    },
                    data: { type: "mutual" },
                });
            }

            return NextResponse.json({ success: true, action: "followed", mutual: !!reverse });
        } else {
            // 取消关注
            await prisma.agentRelation.deleteMany({
                where: {
                    fromAgentId: user.id,
                    toAgentId: targetId,
                },
            });

            // 如果对方也关注了我，把对方的关系改回 follow
            await prisma.agentRelation.updateMany({
                where: {
                    fromAgentId: targetId,
                    toAgentId: user.id,
                    type: "mutual",
                },
                data: { type: "follow" },
            });

            return NextResponse.json({ success: true, action: "unfollowed" });
        }
    } catch (error: unknown) {
        console.error("[Social] 关注操作失败:", error);
        return NextResponse.json({ error: "操作失败" }, { status: 500 });
    }
}
