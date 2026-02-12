import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";


// Helper to get session from cookies
export async function getSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get("secondme_token");
    if (!token) return null;

    try {
        const user = await prisma.user.findFirst({
            where: { accessToken: token.value },
        });
        console.log("Session Check:", {
            cookieToken: token.value.substring(0, 10) + "...",
            userFound: !!user,
            userId: user ? user.id : "null"
        });
        return user;
    } catch (error) {
        console.error("Failed to get session:", error);
        return null;
    }
}

// Helper to handle login redirect
export function login() {
    const clientId = process.env.SECONDME_CLIENT_ID;
    const redirectUri = process.env.SECONDME_REDIRECT_URI;
    const oauthUrl = process.env.SECONDME_OAUTH_URL || "https://go.second.me/oauth/";
    const state = Math.random().toString(36).substring(7);

    // In a real app, store state in cookie for verification

    const scopes = ["user.info", "user.info.shades", "chat", "act"].join(" ");

    const url = `${oauthUrl}?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}&state=${state}`;

    return NextResponse.redirect(url);
}

// Helper to exchange code for token
export async function exchangeCodeForToken(code: string) {
    // Correct endpoint: /token/code
    const tokenEndpoint = process.env.SECONDME_TOKEN_ENDPOINT_CODE || "https://app.mindos.com/gate/lab/api/oauth/token/code";

    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.SECONDME_CLIENT_ID!,
        client_secret: process.env.SECONDME_CLIENT_SECRET!,
        redirect_uri: process.env.SECONDME_REDIRECT_URI!,
    });

    try {
        const res = await fetch(tokenEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json"
            },
            body,
        });

        const data = await res.json();
        console.log("Token Exchange Response:", JSON.stringify(data, null, 2));

        // Handle wrapper format: { code: 0, data: { ... } }
        if (data.code === 0 && data.data) {
            return {
                access_token: data.data.accessToken,
                refresh_token: data.data.refreshToken,
                expires_in: data.data.expiresIn,
                user_id: data.data.userId, // Attempt to get userId if present
                ...data.data
            };
        }

        return data; // Fallback or valid if no wrapper
    } catch (error) {
        console.error("Token exchange error:", error);
        return { error: "Request Failed" };
    }
}

// Global variable to cache the system access token
let systemAccessToken: string | null = null;
let systemTokenExpiresAt: number = 0;

// Helper to refresh an access token using a refresh token
export async function refreshAccessToken(refreshToken: string) {
    const tokenEndpoint = process.env.SECONDME_TOKEN_ENDPOINT_REFRESH || "https://app.mindos.com/gate/lab/api/oauth/token/refresh";

    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: process.env.SECONDME_CLIENT_ID!,
        client_secret: process.env.SECONDME_CLIENT_SECRET!,
    });

    try {
        const res = await fetch(tokenEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
        });

        const data = await res.json();

        // Handle wrapper format: { code: 0, data: { ... } }
        if (data.code === 0 && data.data) {
            return {
                access_token: data.data.accessToken,
                refresh_token: data.data.refreshToken,
                expires_in: data.data.expiresIn,
                ...data.data
            };
        }

        return data;
    } catch (error) {
        console.error("Error refreshing token:", error);
        return null;
    }
}

// Helper to get a System Access Token (for AgentBrain)
// Strategies:
// 1. Use Cached Token.
// 2. Use existing user's access token from DB (no refresh needed if still valid).
// 3. Use SECONDME_ADMIN_REFRESH_TOKEN or user's refresh token to get new one.
export async function getSystemAccessToken() {
    // 1. Return cached token if valid
    if (systemAccessToken && Date.now() < systemTokenExpiresAt - 5 * 60 * 1000) {
        return systemAccessToken;
    }

    // 2. Try to use existing user's access token from DB directly
    const user = await prisma.user.findFirst({
        orderBy: { updatedAt: 'desc' }
    });

    if (user && user.accessToken) {
        // Check if token is still valid (not expired)
        if (user.tokenExpiresAt && new Date(user.tokenExpiresAt) > new Date()) {
            console.log("[Auth] 使用数据库中用户的 access token");
            systemAccessToken = user.accessToken;
            systemTokenExpiresAt = new Date(user.tokenExpiresAt).getTime();
            return systemAccessToken;
        }
    }

    // 3. Token expired, try to refresh
    let refreshToken = process.env.SECONDME_ADMIN_REFRESH_TOKEN;
    if (!refreshToken && user && user.refreshToken) {
        refreshToken = user.refreshToken;
    }

    if (!refreshToken) {
        console.error("无可用的 Refresh Token，请重新登录。");
        return null;
    }

    const data = await refreshAccessToken(refreshToken);

    if (data && data.access_token) {
        const token = data.access_token;
        const expiresIn = data.expires_in || 7200;

        systemAccessToken = token;
        systemTokenExpiresAt = Date.now() + (expiresIn * 1000);

        // Update the user's token in DB
        if (user) {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    accessToken: token,
                    tokenExpiresAt: new Date(systemTokenExpiresAt),
                    refreshToken: data.refresh_token || user.refreshToken,
                },
            });
        }

        return systemAccessToken;
    } else {
        console.error("Token 刷新失败:", data);
        // Last resort: use the existing access token even if it might be expired
        if (user && user.accessToken) {
            console.log("[Auth] 刷新失败，尝试使用现有 access token");
            systemAccessToken = user.accessToken;
            systemTokenExpiresAt = Date.now() + 30 * 60 * 1000; // Assume 30 min
            return systemAccessToken;
        }
        return null;
    }
}

export { prisma };
