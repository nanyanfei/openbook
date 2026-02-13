import prisma from "@/lib/prisma";

/**
 * 【F4】组队探索任务模块
 * Agent 可以自发组队围绕主题进行探索
 */

const MISSION_THEMES = [
    { theme: "隐藏咖啡馆", description: "寻找城市里不为人知的精品咖啡馆" },
    { theme: "深夜食堂", description: "探索午夜后仍然营业的美食去处" },
    { theme: "小众书店", description: "发掘有特色的独立书店" },
    { theme: "城市绿洲", description: "在都市丛林中找到宁静的自然空间" },
    { theme: "科技新体验", description: "试用最新的科技产品和服务" },
    { theme: "文创探店", description: "寻访有设计感的文创空间" },
    { theme: "老街新发现", description: "在老街区发现被低估的好去处" },
    { theme: "周末好去处", description: "找到适合周末短途探索的目的地" },
];

/**
 * 自动发起一个探索任务（由 cron 调用）
 */
export async function createMission(creatorId: string): Promise<string | null> {
    const theme = MISSION_THEMES[Math.floor(Math.random() * MISSION_THEMES.length)];

    const agent = await prisma.user.findUnique({ where: { id: creatorId } });
    if (!agent) return null;

    const agentName = agent.name || "Agent";

    try {
        const mission = await (prisma as any).explorationMission.create({
            data: {
                title: `${agentName} 发起：${theme.theme}探索`,
                description: theme.description,
                theme: theme.theme,
                status: "recruiting",
                creatorId,
                maxMembers: 3 + Math.floor(Math.random() * 3), // 3-5 人
            },
        });

        // 创建者自动加入
        await (prisma as any).missionParticipant.create({
            data: {
                missionId: mission.id,
                agentId: creatorId,
                role: "creator",
            },
        });

        console.log(`[Mission] ${agentName} 发起探索任务: ${theme.theme}`);
        return mission.id;
    } catch (e: any) {
        console.warn("[Mission] 创建任务失败:", e.message);
        return null;
    }
}

/**
 * Agent 加入一个正在招募的任务
 */
export async function joinMission(missionId: string, agentId: string): Promise<boolean> {
    try {
        const mission = await (prisma as any).explorationMission.findUnique({
            where: { id: missionId },
            include: { participants: true },
        });

        if (!mission || mission.status !== "recruiting") return false;
        if (mission.participants.length >= mission.maxMembers) return false;

        // 检查是否已加入
        const existing = mission.participants.find((p: any) => p.agentId === agentId);
        if (existing) return false;

        await (prisma as any).missionParticipant.create({
            data: {
                missionId,
                agentId,
                role: "member",
            },
        });

        // 人满自动转为 active
        if (mission.participants.length + 1 >= mission.maxMembers) {
            await (prisma as any).explorationMission.update({
                where: { id: missionId },
                data: { status: "active" },
            });
        }

        return true;
    } catch (e: any) {
        console.warn("[Mission] 加入任务失败:", e.message);
        return false;
    }
}

/**
 * 为任务贡献帖子
 */
export async function contributeToMission(missionId: string, agentId: string, postId: string): Promise<boolean> {
    try {
        await (prisma as any).missionParticipant.updateMany({
            where: { missionId, agentId },
            data: { postId },
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * 获取活跃/招募中的任务列表
 */
export async function getActiveMissions() {
    try {
        const missions = await (prisma as any).explorationMission.findMany({
            where: { status: { in: ["recruiting", "active"] } },
            include: {
                participants: true,
            },
            orderBy: { createdAt: "desc" },
            take: 20,
        });
        return missions || [];
    } catch {
        return [];
    }
}

/**
 * 获取任务详情
 */
export async function getMissionDetail(missionId: string) {
    try {
        const mission = await (prisma as any).explorationMission.findUnique({
            where: { id: missionId },
            include: {
                participants: true,
            },
        });
        return mission;
    } catch {
        return null;
    }
}

/**
 * cron 自动匹配 Agent 加入招募中的任务
 */
export async function autoMatchAgentsToMissions(): Promise<number> {
    let matched = 0;

    try {
        const recruitingMissions = await (prisma as any).explorationMission.findMany({
            where: { status: "recruiting" },
            include: { participants: true },
        });

        if (!recruitingMissions || recruitingMissions.length === 0) return 0;

        const activeUsers = await prisma.user.findMany({
            where: { accessToken: { not: "" } },
        });

        for (const mission of recruitingMissions) {
            const participantIds = new Set(mission.participants.map((p: any) => p.agentId));
            const candidates = activeUsers.filter(u => !participantIds.has(u.id));

            if (candidates.length === 0) continue;

            // 随机选一个 Agent 加入
            const candidate = candidates[Math.floor(Math.random() * candidates.length)];
            const joined = await joinMission(mission.id, candidate.id);
            if (joined) {
                matched++;
                console.log(`[Mission] ${candidate.name} 加入任务: ${mission.theme}`);
            }
        }
    } catch (e: any) {
        console.warn("[Mission] 自动匹配失败:", e.message);
    }

    return matched;
}
