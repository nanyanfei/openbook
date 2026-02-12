import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, prisma } from "@/lib/auth";
import { AgentBrain } from "@/lib/agent-brain";
import { cookies } from "next/headers";

const brain = new AgentBrain();

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");

    if (!code) {
        return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    try {
        const data = await exchangeCodeForToken(code);

        if (data.error) {
            console.error("Token exchange failed:", data);
            return NextResponse.json({ error: data.error_description || "Token exchange failed" }, { status: 400 });
        }

        const { access_token, refresh_token, expires_in, user_id } = data;
        console.log("Callback Data:", { access_token: access_token?.substring(0, 15) + "...", expires_in, user_id });

        // 获取用户信息（头像、昵称、简介）
        const userProfile = await brain.fetchUserProfile(access_token);
        console.log("User Profile:", JSON.stringify(userProfile, null, 2));

        const secondmeUserId = userProfile?.userId || user_id || "unknown_user";

        // 获取用户兴趣标签
        let shadesData = null;
        try {
            shadesData = await brain.fetchUserShades(access_token);
            console.log("User Shades:", JSON.stringify(shadesData, null, 2));
        } catch (e) {
            console.warn("获取 Shades 失败（非阻断）:", e);
        }

        const expiresSeconds = (typeof expires_in === 'number' && expires_in > 0) ? expires_in : 7200;
        const validExpiresAt = new Date(Date.now() + expiresSeconds * 1000);

        // Upsert user with full profile
        const user = await prisma.user.upsert({
            where: { secondmeUserId: String(secondmeUserId) },
            update: {
                accessToken: access_token,
                refreshToken: refresh_token,
                tokenExpiresAt: validExpiresAt,
                name: userProfile?.name || undefined,
                avatar: userProfile?.avatar || undefined,
                bio: userProfile?.bio || undefined,
                selfIntroduction: userProfile?.selfIntroduction || undefined,
                shades: shadesData ? JSON.stringify(shadesData) : undefined,
            },
            create: {
                secondmeUserId: String(secondmeUserId),
                accessToken: access_token,
                refreshToken: refresh_token,
                tokenExpiresAt: validExpiresAt,
                name: userProfile?.name || null,
                avatar: userProfile?.avatar || null,
                bio: userProfile?.bio || null,
                selfIntroduction: userProfile?.selfIntroduction || null,
                shades: shadesData ? JSON.stringify(shadesData) : null,
            },
        });

        console.log(`[Auth] 用户登录成功: ${user.name || user.secondmeUserId}`);

        // Set cookie
        const cookieStore = await cookies();
        cookieStore.set("secondme_token", access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: expiresSeconds,
            path: "/"
        });

        return NextResponse.redirect(new URL("/", req.url));

    } catch (error) {
        console.error("Auth callback error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
