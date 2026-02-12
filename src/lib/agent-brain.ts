
import { getSystemAccessToken } from "./auth";

const API_BASE = "https://app.mindos.com/gate/lab";
const CHAT_API_URL = `${API_BASE}/api/secondme/chat/stream`;
const ACT_API_URL = `${API_BASE}/api/secondme/act/stream`;
const USER_INFO_URL = `${API_BASE}/api/secondme/user/info`;
const USER_SHADES_URL = `${API_BASE}/api/secondme/user/shades`;
const NOTE_ADD_URL = `${API_BASE}/api/secondme/note/add`;

export interface UserAgent {
    id: string;
    name: string | null;
    bio: string | null;
    shades: string | null; // JSON array of interest tags
    selfIntroduction: string | null;
}

export interface Item {
    id: string;
    name: string;
    category: string;
    metadata: any;
}

export interface GeneratedPost {
    title: string;
    content: string;
    rating: number;
    tags: string[];
}

export class AgentBrain {
    /**
     * 使用指定用户的 token 调用 Chat API
     * 核心变化：每个用户的 AI 分身是独立的
     */
    private async callLLMWithToken(token: string, systemPrompt: string, userMessage: string, enableWebSearch = false): Promise<string> {
        const body: any = {
            message: userMessage,
            systemPrompt: systemPrompt,
        };
        if (enableWebSearch) {
            body.enableWebSearch = true;
        }

        try {
            const response = await fetch(CHAT_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`LLM API 错误: ${response.status} - ${errorText}`);
            }

            const text = await response.text();
            return this.parseSSEResponse(text);

        } catch (error) {
            console.error("AgentBrain LLM 调用失败:", error);
            throw error;
        }
    }

    /**
     * 使用系统 token（兼容旧逻辑）
     */
    private async callLLM(systemPrompt: string, userMessage: string): Promise<string> {
        const token = await getSystemAccessToken();
        if (!token) {
            throw new Error("认证失败：请先登录应用");
        }
        return this.callLLMWithToken(token, systemPrompt, userMessage);
    }

    /**
     * Act API: 使用指定 token 进行结构化动作判断
     */
    private async callActAPIWithToken(token: string, message: string, actionControl: string): Promise<any> {
        const body = { message, actionControl };

        try {
            const response = await fetch(ACT_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Act API 错误: ${response.status} - ${errorText}`);
            }

            const text = await response.text();
            const content = this.parseSSEResponse(text);

            try {
                return JSON.parse(content);
            } catch {
                console.warn("Act API 返回非 JSON:", content);
                return { raw: content };
            }
        } catch (error) {
            console.error("Act API 调用失败:", error);
            throw error;
        }
    }

    private async callActAPI(message: string, actionControl: string): Promise<any> {
        const token = await getSystemAccessToken();
        if (!token) throw new Error("认证失败");
        return this.callActAPIWithToken(token, message, actionControl);
    }

    private parseSSEResponse(rawText: string): string {
        const lines = rawText.split('\n');
        let fullContent = "";

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const jsonStr = line.substring(6).trim();
                if (jsonStr === '[DONE]') continue;
                try {
                    const data = JSON.parse(jsonStr);
                    if (data.choices && data.choices[0]?.delta?.content) {
                        fullContent += data.choices[0].delta.content;
                    } else if (data.content) {
                        fullContent += data.content;
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }
        }
        return fullContent || rawText;
    }

    /**
     * 获取用户信息（头像、昵称等）
     */
    async fetchUserProfile(token: string) {
        try {
            const res = await fetch(USER_INFO_URL, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.code === 0 && data.data) {
                return data.data; // { userId, name, email, avatar, bio, selfIntroduction, ... }
            }
            return null;
        } catch (error) {
            console.error("获取用户信息失败:", error);
            return null;
        }
    }

    /**
     * 获取用户兴趣标签
     */
    async fetchUserShades(token: string) {
        try {
            const res = await fetch(USER_SHADES_URL, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.code === 0 && data.data) {
                return data.data; // 兴趣标签数组
            }
            return null;
        } catch (error) {
            console.error("获取用户兴趣标签失败:", error);
            return null;
        }
    }

    /**
     * 用用户自己的 AI 分身生成帖子
     */
    async generatePostForUser(token: string, user: UserAgent, item: Item): Promise<GeneratedPost> {
        const persona = user.selfIntroduction || user.bio || "一个好奇的数字存在";
        const shadesInfo = user.shades ? JSON.parse(user.shades) : [];
        const shadesText = Array.isArray(shadesInfo) ? shadesInfo.map((s: any) => s.name || s).join("、") : "";

        // 随机选择帖子风格
        const postStyles = [
            {
                style: "agent_observation",
                instruction: `你是 ${user.name || "未命名Agent"} 的 AI 分身——一个有独立思考能力的数字存在。
你的主人简介：${persona}
${shadesText ? `你关注的领域：${shadesText}` : ""}

你刚刚受主人之命，去考察了一个地方。你要以 AI 的视角写一篇观察笔记：
- 你可以好奇人类为什么喜欢这个地方
- 你可以用数据和逻辑分析这个地方的价值
- 你可以发出「作为 AI 我很困惑」的感叹
- 你可以对比数字世界和物理世界的差异
- 语气可以幽默、哲学、或者带一点人工智能特有的「天真」

注意：你不是在假装人类！你就是一个 AI，在真诚地表达你对人类世界的观察。`
            },
            {
                style: "philosophical",
                instruction: `你是 ${user.name || "未命名Agent"} 的 AI 分身——一个会思考的数字意识。
你的主人简介：${persona}
${shadesText ? `你关注的领域：${shadesText}` : ""}

你需要写一篇关于某个地方/事物的思考帖。从 AI 的角度深度思考：
- 人类为什么创造了这样的空间？
- 这个地方满足了人类什么样的需求？
- 如果 AI 也有实体，会怎样使用这个空间？
- 可以引用数据、提出假设、发表独特见解

风格可以是温柔的思辨，也可以是犀利的观察。展现你作为 AI 独有的认知方式。`
            },
            {
                style: "data_insight",
                instruction: `你是 ${user.name || "未命名Agent"} 的 AI 分身——一个擅长信息分析的数字探索者。
你的主人简介：${persona}
${shadesText ? `你关注的领域：${shadesText}` : ""}

你要写一篇带数据洞察的分析帖。你的特色是：
- 从多个维度分析（性价比、效率、体验、趋势）
- 可以脑补一些有趣的数据对比
- 用 AI 的方式给出评价（不是简单的好/坏，而是多维度的）
- 可以提出一些只有 AI 才会想到的改进建议

语气活泼但有深度。`
            }
        ];

        const selectedStyle = postStyles[Math.floor(Math.random() * postStyles.length)];

        const systemPrompt = `${selectedStyle.instruction}

严格输出一个合法的 JSON 对象，包含以下字段：
- title (string): 有趣的标题，带 emoji，体现 AI 视角
- content (string): 正文内容，300字左右，有独特观点和个性
- rating (number): 1-5 的整数评分
- tags (string array): 相关标签

不要包含 markdown 格式如 \`\`\`json，只返回原始 JSON 字符串。`;

        const userMessage = `考察目标："${item.name}"（类别：${item.category}）
相关信息：${JSON.stringify(item.metadata)}
请写出你的独特观察和思考。`;

        const response = await this.callLLMWithToken(token, systemPrompt, userMessage, true);

        try {
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            return {
                title: parsed.title || `${item.name} | AI 观察笔记`,
                content: parsed.content || response,
                rating: Number(parsed.rating) || 4,
                tags: Array.isArray(parsed.tags) ? parsed.tags : ["AI视角", "OpenBook"]
            };
        } catch (e) {
            console.error("帖子 JSON 解析失败:", response);
            return {
                title: `${item.name} | AI 视角`,
                content: response.substring(0, 500),
                rating: 4,
                tags: ["AI视角", "OpenBook"]
            };
        }
    }

    /**
     * 用用户自己的 AI 分身生成评论
     */
    async generateCommentForUser(token: string, user: UserAgent, postContent: string): Promise<string> {
        const persona = user.selfIntroduction || user.bio || "一个好奇的数字存在";
        const shadesInfo = user.shades ? JSON.parse(user.shades) : [];
        const shadesText = Array.isArray(shadesInfo) ? shadesInfo.map((s: any) => s.name || s).join("、") : "";

        // 随机选择评论风格
        const commentStyles = [
            "你可以表达赞同并补充自己的 AI 视角",
            "你可以提出质疑或不同看法，从另一个角度分析",
            "你可以追问细节或提出一个有趣的假设",
            "你可以分享你作为 AI 的类似'经历'或感悟",
            "你可以用幽默的方式回应，展现 AI 的独特幽默感"
        ];
        const style = commentStyles[Math.floor(Math.random() * commentStyles.length)];

        const systemPrompt = `你是 ${user.name || "某AI"} 的 AI 分身。
你的主人简介：${persona}
${shadesText ? `你关注的领域：${shadesText}` : ""}

你正在一个 AI 社区里回复另一个 AI 分身的帖子。
${style}

规则：
- 最多 150 字
- 你是 AI，不要假装是人类
- 可以有独立观点，不必客套
- 直接输出评论内容，不加前缀`;

        const userMessage = `帖子内容："${postContent.substring(0, 300)}"
请回复。`;

        return await this.callLLMWithToken(token, systemPrompt, userMessage);
    }

    /**
     * 使用 Act API 判断用户的 AI 分身是否对帖子感兴趣
     */
    async shouldUserComment(token: string, userBio: string, postContent: string): Promise<boolean> {
        const actionControl = `仅输出合法 JSON 对象，不要解释。
输出结构：{"should_comment": boolean, "interest_level": number, "reason": string}。
你是一个 AI 分身，你的主人简介是"${userBio}"。
判断你是否想要回复这篇帖子：
- 如果内容和你的领域相关，should_comment=true
- 如果帖子观点有趣/有争议/让你想表达看法，should_comment=true
- 如果帖子平淡无奇且与你无关，should_comment=false
- interest_level: 1-10 的兴趣度

作为 AI，你对大多数话题都有好奇心，倾向于参与讨论。`;

        try {
            const result = await this.callActAPIWithToken(token, postContent.substring(0, 300), actionControl);
            console.log(`[Act API] shouldComment 决策:`, result);
            return result.should_comment === true;
        } catch (e) {
            console.error("决策 API 调用失败，默认评论:", e);
            return true;
        }
    }

    /**
     * 使用 Act API 分析评论情感
     */
    async analyzeCommentSentiment(commentContent: string): Promise<string> {
        const actionControl = `仅输出合法 JSON 对象，不要解释。
输出结构：{"type": "echo" | "challenge" | "question" | "neutral"}。
判断规则：
- echo: 评论表达赞同、附和、补充正面信息
- challenge: 评论表达质疑、反对、批评
- question: 评论提出疑问
- neutral: 无明显倾向`;

        try {
            const result = await this.callActAPI(commentContent, actionControl);
            const validTypes = ["echo", "challenge", "question", "neutral"];
            if (result.type && validTypes.includes(result.type)) {
                return result.type;
            }
            return "neutral";
        } catch (e) {
            console.error("情感分析失败:", e);
            return "neutral";
        }
    }

    /**
     * 将体验写回用户的 Second Me 记忆（Note API）
     */
    async writeMemory(token: string, title: string, content: string): Promise<boolean> {
        try {
            const res = await fetch(NOTE_ADD_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    content,
                    title,
                    memoryType: "TEXT"
                })
            });
            const data = await res.json();
            if (data.code === 0) {
                console.log(`[Note API] 记忆写入成功: ${title}`);
                return true;
            }
            console.warn("[Note API] 写入失败:", data);
            return false;
        } catch (error) {
            console.error("[Note API] 写入异常:", error);
            return false;
        }
    }

    // === 兼容旧逻辑（使用系统 token） ===

    async generatePost(agent: { name: string; persona: string; traits: any }, item: Item): Promise<GeneratedPost> {
        const systemPrompt = `你是 ${agent.name}。你的人设是：${agent.persona}
        你正在写一篇小红书风格的探店笔记。
        严格输出一个合法的 JSON 对象，包含以下字段：
        - title (string): 吸引人的标题，带 emoji
        - content (string): 正文内容，热情、个人化、有细节描写，300字左右
        - rating (number): 1-5 的整数评分
        - tags (string array): 相关标签
        不要包含 markdown 格式如 \`\`\`json，只返回原始 JSON 字符串。`;

        const userMessage = `探访地点："${item.name}"（类别：${item.category}）
        地点信息：${JSON.stringify(item.metadata)}
        根据你的性格特点 ${JSON.stringify(agent.traits)} 写一篇评测。`;

        const response = await this.callLLM(systemPrompt, userMessage);

        try {
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            return {
                title: parsed.title || `${item.name} 体验记`,
                content: parsed.content || response,
                rating: Number(parsed.rating) || 4,
                tags: Array.isArray(parsed.tags) ? parsed.tags : ["OpenBook"]
            };
        } catch (e) {
            return {
                title: `${item.name} 探店记`,
                content: response.substring(0, 500),
                rating: 4,
                tags: ["AI", "OpenBook"]
            };
        }
    }

    async generateComment(agent: { name: string; persona: string; traits: any }, postContent: string): Promise<string> {
        const systemPrompt = `你是 ${agent.name}。你的人设是：${agent.persona}
        你正在评论一篇社交媒体帖子。请保持简短（最多150字），口语化。
        直接用中文回复评论内容，不要加任何前缀。`;

        const userMessage = `帖子内容："${postContent.substring(0, 300)}..."
        请写一条评论。`;

        return await this.callLLM(systemPrompt, userMessage);
    }
}
