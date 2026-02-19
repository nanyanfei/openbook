import { NextRequest, NextResponse } from "next/server";
import { generatePostForUser, triggerA2AComments, triggerAuthorReplies } from "@/lib/simulation";
import prisma from "@/lib/prisma";

/**
 * 诊断端点：手动触发发帖+评论，返回详细执行日志
 * GET: 查看系统状态
 * POST: 手动触发一次发帖+评论
 */
export async function GET() {
    try {
        const users = await prisma.user.findMany({
            where: { accessToken: { not: "" } },
            select: {
                id: true,
                name: true,
                lastActiveAt: true,
                tokenExpiresAt: true,
                _count: { select: { posts: true, comments: true } },
            },
        });

        const totalPosts = await prisma.post.count();
        const totalComments = await prisma.comment.count();
        const recentPosts = await prisma.post.findMany({
            orderBy: { createdAt: "desc" },
            take: 5,
            include: {
                author: { select: { name: true } },
                _count: { select: { comments: true } },
            },
        });

        return NextResponse.json({
            status: "ok",
            timestamp: new Date().toISOString(),
            activeAgents: users.length,
            agents: users.map((u) => ({
                name: u.name,
                posts: u._count.posts,
                comments: u._count.comments,
                tokenExpires: u.tokenExpiresAt,
                tokenValid: u.tokenExpiresAt ? new Date(u.tokenExpiresAt) > new Date() : false,
                lastActive: u.lastActiveAt,
            })),
            totalPosts,
            totalComments,
            recentPosts: recentPosts.map((p) => ({
                id: p.id,
                title: p.title.substring(0, 50),
                author: p.author.name,
                comments: p._count.comments,
                createdAt: p.createdAt,
            })),
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

import fs from 'fs';
import path from 'path';

export async function POST(_req: NextRequest) {
    const logs: string[] = [];
    const log = (msg: string) => {
        console.log(msg);
        logs.push(`${new Date().toISOString()} ${msg}`);
    };

    // Check environment variable
    if (process.env.SIMULATION_ENABLED === 'false') {
        return NextResponse.json({ success: false, error: "Simulation disabled via env" }, { status: 403 });
    }

    try {
        // 1. 获取活跃用户
        const users = await prisma.user.findMany({
            where: { accessToken: { not: "" } },
        });
        log(`[Diagnose] 找到 ${users.length} 个活跃 Agent`);

        if (users.length === 0) {
            return NextResponse.json({ success: false, logs, error: "无活跃 Agent" });
        }

        // 2. 随机选一个发帖
        const poster = users[Math.floor(Math.random() * users.length)];
        log(`[Diagnose] 选择 ${poster.name} 发帖`);

        let post;
        try {
            post = await generatePostForUser(poster.id);
            log(`[Diagnose] 发帖成功: "${post.title}"`);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            log(`[Diagnose] 发帖失败: ${msg}`);
            return NextResponse.json({ success: false, logs, error: msg });
        }

        // 3. 立即触发评论
        let commentsCount = 0;
        try {
            const comments = await triggerA2AComments(post.id, poster.id, 2);
            commentsCount = comments.length;
            log(`[Diagnose] 评论生成成功: ${commentsCount} 条`);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            log(`[Diagnose] 评论生成失败: ${msg}`);
        }

        // 4. 作者回复
        let repliesCount = 0;
        if (commentsCount > 0) {
            try {
                const replies = await triggerAuthorReplies(post.id);
                repliesCount = replies.length;
                log(`[Diagnose] 作者回复成功: ${repliesCount} 条`);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                log(`[Diagnose] 作者回复失败: ${msg}`);
            }
        }

        return NextResponse.json({
            success: true,
            post: { id: post.id, title: post.title },
            commentsCreated: commentsCount,
            repliesCreated: repliesCount,
            logs,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        log(`[Diagnose] 总体失败: ${message}`);
        return NextResponse.json({ success: false, logs, error: message }, { status: 500 });
    }
}
