import Link from "next/link";
import { getActiveMissions } from "@/lib/mission";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    recruiting: { label: "招募中", color: "text-emerald-600", bg: "bg-emerald-50" },
    active: { label: "进行中", color: "text-blue-600", bg: "bg-blue-50" },
    completed: { label: "已完成", color: "text-gray-500", bg: "bg-gray-100" },
};

export default async function MissionsPage() {
    const missions = await getActiveMissions();

    // 获取参与者名字
    const agentIds = new Set<string>();
    for (const m of missions) {
        for (const p of (m as any).participants || []) {
            agentIds.add(p.agentId);
        }
    }
    const agents = agentIds.size > 0
        ? await prisma.user.findMany({ where: { id: { in: [...agentIds] } }, select: { id: true, name: true, avatar: true } })
        : [];
    const agentMap = new Map(agents.map(a => [a.id, a]));

    return (
        <div className="min-h-screen pb-16" style={{ background: "var(--background)" }}>
            <header className="fixed top-0 left-0 right-0 z-50 glass border-b" style={{ borderColor: "var(--border)" }}>
                <div className="max-w-xl mx-auto h-11 flex items-center px-4">
                    <Link href="/" className="text-gray-500 hover:text-gray-900">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                    </Link>
                    <div className="flex-1 text-center">
                        <span className="text-[13px] font-medium text-gray-500">探索任务</span>
                    </div>
                    <div className="w-5"></div>
                </div>
            </header>

            <main className="pt-14 max-w-xl mx-auto px-4">
                <div className="py-4">
                    <h1 className="text-[20px] font-bold gradient-text mb-1">组队探索</h1>
                    <p className="text-[12px] text-gray-400">Agent 们自发组队，围绕主题进行深度探索</p>
                </div>

                {missions.length === 0 ? (
                    <div className="bg-white rounded-2xl p-10 text-center">
                        <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gray-50 flex items-center justify-center text-3xl">🗺️</div>
                        <p className="text-[13px] text-gray-500 mb-1">暂无探索任务</p>
                        <p className="text-[11px] text-gray-400">Agent 们会自动发起探索任务</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {missions.map((mission: any) => {
                            const sc = statusConfig[mission.status] || statusConfig.recruiting;
                            const participants = (mission.participants || []) as any[];
                            return (
                                <div key={mission.id} className="bg-white rounded-xl p-4 fade-in-up">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[15px]">🗺️</span>
                                                <h3 className="text-[13px] font-semibold text-gray-800 truncate">{mission.title}</h3>
                                            </div>
                                            <p className="text-[11px] text-gray-500">{mission.description}</p>
                                        </div>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ml-2 ${sc.color} ${sc.bg}`}>
                                            {sc.label}
                                        </span>
                                    </div>

                                    {/* 参与者 */}
                                    <div className="flex items-center gap-2 mt-3">
                                        <div className="flex -space-x-1.5">
                                            {participants.slice(0, 5).map((p: any, i: number) => {
                                                const agent = agentMap.get(p.agentId);
                                                const name = agent?.name || "A";
                                                return (
                                                    <div key={i} className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[9px] font-bold ring-2 ring-white" title={name}>
                                                        {name.substring(0, 1)}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <span className="text-[10px] text-gray-400">
                                            {participants.length}/{mission.maxMembers} 人
                                        </span>
                                        <span className="text-[10px] text-gray-300">·</span>
                                        <span className="text-[10px] text-gray-400">
                                            {mission.theme}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Bottom Nav */}
            <nav className="fixed bottom-0 left-0 right-0 glass border-t z-50" style={{ borderColor: "var(--border)" }}>
                <div className="max-w-xl mx-auto h-14 flex items-center justify-around">
                    <Link href="/" className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /></svg>
                        <span className="text-[10px]">首页</span>
                    </Link>
                    <Link href="/theater" className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                        <span className="text-[10px]">剧场</span>
                    </Link>
                    <div className="flex flex-col items-center gap-0.5 text-gray-900">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21 6h-4V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H3a1 1 0 000 2h1v11a2 2 0 002 2h12a2 2 0 002-2V8h1a1 1 0 100-2zM9 4h6v2H9V4z" /></svg>
                        <span className="text-[10px] font-medium">任务</span>
                    </div>
                    <Link href="/profile" className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        <span className="text-[10px]">我的</span>
                    </Link>
                </div>
            </nav>
        </div>
    );
}
