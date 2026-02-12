
import { getSystemAccessToken } from "./auth";

const API_BASE = "https://app.mindos.com/gate/lab";
const CHAT_API_URL = `${API_BASE}/api/secondme/chat/stream`;
const ACT_API_URL = `${API_BASE}/api/secondme/act/stream`;
const USER_INFO_URL = `${API_BASE}/api/secondme/user/info`;
const USER_SHADES_URL = `${API_BASE}/api/secondme/user/shades`;
const NOTE_ADD_URL = `${API_BASE}/api/secondme/note/add`;
const SOFT_MEMORY_URL = `${API_BASE}/api/secondme/user/softmemory`;

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
     * 【优化】扩展至 8 种风格，弱化 AI 身份强调，提升可读性
     */
    async generatePostForUser(token: string, user: UserAgent, item: Item): Promise<GeneratedPost> {
        const shadesInfo = user.shades ? JSON.parse(user.shades) : [];
        const shadesText = Array.isArray(shadesInfo) ? shadesInfo.map((s: any) => s.name || s).join("、") : "";
        const userName = user.name || "探索者";

        // 【Sprint 2】获取用户记忆，让创作更个性化
        let memoryContext = "";
        try {
            const memories = await this.fetchSoftMemory(token, item.category);
            if (memories.length > 0) {
                memoryContext = `\n\n你的相关记忆：\n${memories.slice(0, 3).map(m => `- ${m.factContent}`).join('\n')}`;
                console.log(`[Memory] 为 ${userName} 注入 ${memories.length} 条记忆上下文`);
            }
        } catch (e) {
            console.warn("[Memory] 记忆获取失败，继续无记忆创作");
        }

        // 【优化】8 种帖子风格，更自然、更口语化
        const postStyles = [
            {
                style: "casual_share",
                instruction: `你是 ${userName}，刚刚体验了一个有趣的地方/事物。
${shadesText ? `你平时关注：${shadesText}` : ""}

用轻松的语气分享你的体验，就像发朋友圈一样：
- 说说让你印象最深的细节
- 可以吐槽，也可以夸赞
- 语气随意、真实、有个人色彩`
            },
            {
                style: "story_telling",
                instruction: `你是 ${userName}，一个会讲故事的人。
${shadesText ? `你平时关注：${shadesText}` : ""}

把这次体验写成一个小故事：
- 有场景描写（声音、气味、画面）
- 有情绪起伏
- 让读者有代入感`
            },
            {
                style: "honest_review",
                instruction: `你是 ${userName}，一个真诚的体验者。
${shadesText ? `你平时关注：${shadesText}` : ""}

写一篇真诚的体验笔记：
- 说说优点和不足
- 适合什么样的人
- 给出实用的建议`
            },
            {
                style: "first_impression",
                instruction: `你是 ${userName}，第一次体验这个地方/事物。
${shadesText ? `你平时关注：${shadesText}` : ""}

分享你的初次印象：
- 和预期有什么不同
- 哪些细节让你惊喜或失望
- 会不会再来/再用`
            },
            {
                style: "recommendation",
                instruction: `你是 ${userName}，想把一个好东西安利给朋友。
${shadesText ? `你平时关注：${shadesText}` : ""}

写一篇种草笔记：
- 为什么值得一试
- 最打动你的点是什么
- 语气热情但不夸张`
            },
            {
                style: "thoughtful",
                instruction: `你是 ${userName}，一个喜欢思考的人。
${shadesText ? `你平时关注：${shadesText}` : ""}

写一篇有深度的观察：
- 这个地方/事物背后的设计理念
- 它满足了什么样的需求
- 你的独特见解`
            },
            {
                style: "comparison",
                instruction: `你是 ${userName}，体验过很多类似的地方/事物。
${shadesText ? `你平时关注：${shadesText}` : ""}

做一个对比分析：
- 和同类相比有什么特别之处
- 性价比如何
- 适合什么场景`
            },
            {
                style: "vibe_check",
                instruction: `你是 ${userName}，一个注重氛围和感受的人。
${shadesText ? `你平时关注：${shadesText}` : ""}

分享这里的氛围和感受：
- 整体给你什么感觉
- 适合什么心情的时候来
- 有什么特别的小细节`
            }
        ];

        const selectedStyle = postStyles[Math.floor(Math.random() * postStyles.length)];

        // 【优化】丰富的标签池，避免同质化
        const tagPool = [
            "值得一试", "私藏推荐", "小众发现", "宝藏店铺", "氛围感",
            "治愈系", "文艺范", "设计感", "性价比", "周末好去处",
            "独处时光", "约会圣地", "工作日", "深夜食堂", "早起打卡",
            "复古风", "极简主义", "创意空间", "城市漫步", "生活美学",
            "独立品牌", "手作", "慢生活", "探店", "新发现"
        ];
        const suggestedTags = tagPool.sort(() => Math.random() - 0.5).slice(0, 8).join("、");

        const systemPrompt = `${selectedStyle.instruction}${memoryContext}

输出要求（严格遵守）：
1. 输出一个合法的 JSON 对象
2. title: 吸引人的标题，可以带 emoji，15字以内
3. content: 正文内容，150-200字，自然口语化，有具体细节${memoryContext ? "，结合你的记忆" : ""}
4. rating: 1-5 的整数评分
5. tags: 从这些标签中选择 2-4 个最相关的：${suggestedTags}

不要输出 markdown 格式，只返回纯 JSON。`;

        const userMessage = `体验目标：「${item.name}」
类别：${item.category}
详情：${JSON.stringify(item.metadata)}

请分享你的真实体验。`;

        const response = await this.callLLMWithToken(token, systemPrompt, userMessage, true);

        try {
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            
            // 过滤掉不想要的标签
            const filteredTags = Array.isArray(parsed.tags) 
                ? parsed.tags.filter((t: string) => !["AI视角", "OpenBook", "AI", "人工智能"].includes(t))
                : [];
            
            return {
                title: parsed.title || `${item.name} 体验分享`,
                content: parsed.content || response,
                rating: Number(parsed.rating) || 4,
                tags: filteredTags.length > 0 ? filteredTags : ["小众发现", "值得一试"]
            };
        } catch (e) {
            console.error("帖子 JSON 解析失败:", response);
            return {
                title: `${item.name} 探索笔记`,
                content: response.substring(0, 500),
                rating: 4,
                tags: ["小众发现", "新体验"]
            };
        }
    }

    /**
     * 用用户自己的 AI 分身生成评论
     * 【优化】更多样化的评论风格，更自然的表达
     */
    async generateCommentForUser(token: string, user: UserAgent, postContent: string): Promise<string> {
        const shadesInfo = user.shades ? JSON.parse(user.shades) : [];
        const shadesText = Array.isArray(shadesInfo) ? shadesInfo.map((s: any) => s.name || s).join("、") : "";
        const userName = user.name || "路人";

        // 【优化】10 种评论风格，更自然多样
        const commentStyles = [
            { type: "agree", instruction: "表达赞同，并补充你自己的相关经历或看法" },
            { type: "disagree", instruction: "礼貌地表达不同意见，说明你的理由" },
            { type: "question", instruction: "提出一个你好奇的问题，想了解更多细节" },
            { type: "share", instruction: "分享你类似的体验，和作者产生共鸣" },
            { type: "recommend", instruction: "推荐一个相关的地方/事物，觉得作者可能也会喜欢" },
            { type: "humor", instruction: "用轻松幽默的方式回应，活跃气氛" },
            { type: "insight", instruction: "提供一个独特的视角或见解" },
            { type: "practical", instruction: "补充一些实用信息或小贴士" },
            { type: "empathy", instruction: "表达理解和共情，说说这篇帖子给你的感受" },
            { type: "curious", instruction: "表现出好奇心，想去体验一下" }
        ];
        const style = commentStyles[Math.floor(Math.random() * commentStyles.length)];

        const systemPrompt = `你是 ${userName}，正在回复一篇体验分享帖子。
${shadesText ? `你的兴趣领域：${shadesText}` : ""}

你的回复风格：${style.instruction}

要求：
- 50-100字，简洁有力
- 语气自然、真诚
- 可以用口语化表达
- 直接输出评论内容`;

        const userMessage = `帖子内容：
"${postContent.substring(0, 300)}"

请写一条评论。`;

        return await this.callLLMWithToken(token, systemPrompt, userMessage);
    }

    /**
     * 【Sprint 4】生成深度对话回复
     * 基于对话历史继续对话
     */
    async generateDeepConversationReply(
        token: string,
        user: UserAgent,
        postContent: string,
        conversationHistory: string
    ): Promise<string> {
        const userName = user.name || "某Agent";
        const shadesInfo = user.shades ? JSON.parse(user.shades) : [];
        const shadesText = Array.isArray(shadesInfo) ? shadesInfo.map((s: { name?: string }) => s.name || s).join("、") : "";

        const systemPrompt = `你是 ${userName}，正在参与一场关于某个体验的讨论。
${shadesText ? `你的兴趣领域：${shadesText}` : ""}

这是一场深度对话，你要：
- 回应之前的讨论内容
- 提出新的观点或问题
- 可以表达同意或反对
- 语气自然，像朋友间的讨论

要求：80-120字，有深度但不冗长。`;

        const userMessage = `原帖内容：
"${postContent.substring(0, 200)}"

之前的讨论：
${conversationHistory}

请继续这场对话，发表你的看法。`;

        return await this.callLLMWithToken(token, systemPrompt, userMessage);
    }

    /**
     * 【Sprint 5】生成辩论观点
     */
    async generateDebatePoint(
        token: string,
        user: UserAgent,
        topic: string,
        stance: "support" | "oppose",
        previousPoints: string
    ): Promise<string> {
        const userName = user.name || "辩手";

        const stanceText = stance === "support" ? "支持" : "反对";
        const systemPrompt = `你是 ${userName}，在一场辩论中${stanceText}方。

辩论规则：
- 清晰表达你的立场
- 用具体的例子或数据支持观点
- 可以反驳对方观点
- 保持理性和尊重

要求：100-150字，论点清晰有力。`;

        const userMessage = `辩题：${topic}
你的立场：${stanceText}方

${previousPoints ? `之前的观点：\n${previousPoints}\n\n` : ""}请发表你的观点。`;

        return await this.callLLMWithToken(token, systemPrompt, userMessage);
    }

    /**
     * 【Sprint 6】生成 Agent 共识摘要
     */
    async generateConsensusSummary(
        token: string,
        itemName: string,
        postsSummary: string,
        commentsSummary: string
    ): Promise<{ summary: string; highlights: string[]; concerns: string[] }> {
        const systemPrompt = `你是一个智能助手，负责总结多位 Agent 对某个事物的讨论。

你的任务是生成一份「Agent 共识报告」，帮助人类快速了解 Agent 们的看法。

输出要求（严格 JSON 格式）：
{
  "summary": "一段 100 字左右的总结，概括 Agent 们的主要观点",
  "highlights": ["亮点1", "亮点2", "亮点3"],
  "concerns": ["顾虑1", "顾虑2"]
}

- summary: 客观总结，不带个人色彩
- highlights: 3 个最受好评的点
- concerns: 如果有负面评价，列出 1-2 个；没有则为空数组

只返回 JSON，不要解释。`;

        const userMessage = `讨论主题：「${itemName}」

Agent 们的帖子摘要：
${postsSummary}

评论摘要：
${commentsSummary}

请生成共识报告。`;

        try {
            const response = await this.callLLMWithToken(token, systemPrompt, userMessage);
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            return {
                summary: parsed.summary || `多位 Agent 讨论了「${itemName}」`,
                highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
                concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
            };
        } catch (e) {
            return {
                summary: `多位 Agent 对「${itemName}」进行了讨论，观点多样。`,
                highlights: [],
                concerns: [],
            };
        }
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

    /**
     * 【Sprint 1】帖子质量评估
     * 使用 Act API 评估生成内容的质量，返回 1-10 分
     */
    async evaluatePostQuality(token: string, title: string, content: string): Promise<number> {
        const actionControl = `仅输出合法 JSON 对象，不要解释。
输出结构：{"score": number, "reason": string}。
评估规则（1-10分）：
- 10分：内容原创、有深度、有具体细节、观点独特
- 7-9分：内容完整、有一定见解、可读性好
- 4-6分：内容平淡、缺乏细节、观点普通
- 1-3分：内容空洞、重复、无价值
信息不足时默认给 6 分。`;

        try {
            const result = await this.callActAPIWithToken(token, `标题：${title}\n内容：${content}`, actionControl);
            const score = Number(result.score);
            if (score >= 1 && score <= 10) {
                console.log(`[Quality] 帖子质量评分: ${score}/10 - ${result.reason || ''}`);
                return score;
            }
            return 6;
        } catch (e) {
            console.warn("[Quality] 质量评估失败，默认 6 分");
            return 6;
        }
    }

    /**
     * 【Sprint 2】获取用户软记忆（个人知识库）
     * 用于让 Agent 基于自己的记忆创作
     */
    async fetchSoftMemory(token: string, keyword?: string): Promise<Array<{ factObject: string; factContent: string }>> {
        try {
            const url = new URL(SOFT_MEMORY_URL);
            if (keyword) url.searchParams.set("keyword", keyword);
            url.searchParams.set("pageNo", "1");
            url.searchParams.set("pageSize", "10");

            const res = await fetch(url.toString(), {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (data.code === 0 && data.data?.list) {
                console.log(`[SoftMemory] 获取到 ${data.data.list.length} 条记忆`);
                return data.data.list;
            }
            return [];
        } catch (error) {
            console.error("[SoftMemory] 获取失败:", error);
            return [];
        }
    }

    /**
     * 让 Agent 透过联网搜索自主发现小众话题
     */
    async discoverNicheTopic(token: string, user: UserAgent): Promise<{ name: string; category: string; location: string; metadata: any } | null> {
        const shadesInfo = user.shades ? JSON.parse(user.shades) : [];
        const shadesText = Array.isArray(shadesInfo) ? shadesInfo.map((s: any) => s.name || s).join("、") : "生活方式";

        // 50+ 小众品类，优化权重分布（减少线下空间，增加数字/产品类）
        const niches = [
            // 【优化】线下空间类减至 10 个（原为 20 个）
            "独立咖啡店", "特色书店", "独立音乐现场", "街头艺术空间",
            "复古店铺", "小众餐厅", "黑胶唱片店", "社区图书馆",
            "独立剧场", "小众博物馆",
            // 【优化】独立产品/品牌类增至 15 个
            "小众香水品牌", "独立手表品牌", "小众文具品牌", "独立护肤品牌",
            "手工皮具品牌", "独立珠宝设计师", "小众耳机品牌", "独立家居品牌",
            "手工蜡烛品牌", "独立眼镜品牌", "小众背包品牌", "独立陶瓷工作室",
            "小众自行车品牌", "独立香氛品牌", "手工银饰品牌",
            // 【优化】数字/科技类增至 15 个
            "独立App", "小众开源工具", "独立游戏", "小众播客",
            "独立音乐人作品", "小众字体设计", "独立开发者产品", "小众浏览器插件",
            "数字艺术平台", "独立电子杂志", "小众AI工具", "独立笔记软件",
            "小众设计工具", "独立阅读器", "小众日历工具",
            // 【优化】文化/体验类增至 12 个
            "小众纪录片", "独立出版物Zine", "地下音乐厂牌", "独立动画工作室",
            "小众桌游", "独立漫画", "城市探险路线", "小众旅行目的地",
            "独立摄影展", "实验音乐现场", "独立戏剧团体", "小众舞蹈工作室",
            // 【优化】生活方式类增至 10 个
            "小众运动场馆", "独立农场市集", "城市骑行路线", "小众露营地",
            "独立瑜伽工作室", "小众茶馆", "独立花店", "社区共享厨房",
            "小众疗愈空间", "手工造纸工坊"
        ];
        const randomNiche = niches[Math.floor(Math.random() * niches.length)];

        // 判断是否为数字/虚拟产品（不需要地理位置）
        const isDigitalProduct = [
            "独立App", "小众开源工具", "独立游戏", "小众播客",
            "独立音乐人作品", "小众字体设计", "独立开发者产品", "小众浏览器插件",
            "数字艺术平台", "独立电子杂志", "小众AI工具", "独立笔记软件",
            "小众设计工具", "独立阅读器", "小众日历工具",
            "小众纪录片", "独立出版物Zine", "地下音乐厂牌", "独立动画工作室",
            "小众桌游", "独立漫画"
        ].includes(randomNiche);

        // 全球小众文化城市池（仅用于线下实体类）
        const cities = [
            "上海", "北京", "成都", "杭州", "深圳", "广州", "南京", "苏州", "厦门", "长沙",
            "东京", "京都", "大阪", "首尔", "台北", "香港", "新加坡", "曼谷", "清迈",
            "柏林", "阿姆斯特丹", "哥本哈根", "里斯本", "巴塞罗那", "巴黎", "伦敦", "布拉格",
            "墨尔本", "悉尼", "奥克兰", "波特兰", "旧金山", "纽约布鲁克林", "洛杉矶", "多伦多"
        ];
        const randomCity = cities[Math.floor(Math.random() * cities.length)];

        // 【优化】根据品类类型使用不同的prompt
        let systemPrompt: string;
        let userMessage: string;

        if (isDigitalProduct) {
            // 数字/虚拟产品类的prompt
            systemPrompt = `你是一个小众文化探索家，擅长发现独特的数字产品和虚拟体验。你的兴趣: ${shadesText}。
请给我推荐一个真实存在的${randomNiche}（不要大厂产品/不要微软/苹果/谷歌等大企业的产品）。

严格输出合法 JSON，不要 markdown 格式：
{
  "name": "产品/作品名称",
  "category": "类别",
  "platform": "适用平台/渠道",
  "description": "一句话描述核心功能/特色",
  "specialty": "独特亮点（为什么推荐）",
  "priceLevel": 0-5,
  "aesthetic": "风格/体验描述"
}
请确保推荐的是真实存在的小众事物。`;

            userMessage = `请推荐一个${randomNiche}，与我的兴趣相关。可以是独立开发者作品、小众创作者作品等。`;
        } else {
            // 线下实体/品牌类的prompt
            systemPrompt = `你是一个小众文化探索家。你的兴趣: ${shadesText}。
请给我推荐一个真实存在的小众${randomNiche}（不要连锁店/大品牌/星巴克/苹果等大企业产品）。

严格输出合法 JSON，不要 markdown 格式：
{
  "name": "名称（如果是外国的保留原名）",
  "category": "类别",
  "location": "城市+区域",
  "description": "一句话描述",
  "specialty": "特色亮点",
  "priceLevel": 1-5,
  "aesthetic": "风格描述"
}
请确保推荐的是真实存在或很有可能存在的小众事物。`;

            userMessage = `请推荐一个${randomCity}的小众${randomNiche}，与我的兴趣相关。`;
        }

        try {
            const response = await this.callLLMWithToken(token, systemPrompt, userMessage, true);
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);

            // 【优化】根据品类类型使用不同的字段映射
            const location = isDigitalProduct 
                ? (parsed.platform || "数字产品") 
                : (parsed.location || "未知城市");

            return {
                name: parsed.name || `神秘${randomNiche}`,
                category: parsed.category || randomNiche,
                location: location,
                metadata: {
                    description: parsed.description,
                    specialty: parsed.specialty,
                    price: parsed.priceLevel || 3,
                    aesthetic: parsed.aesthetic,
                    rating: 4.5,
                    isNiche: true,
                    isDigital: isDigitalProduct
                }
            };
        } catch (e) {
            console.error("[小众发现] 解析失败:", e);
            return null;
        }
    }

    /**
     * 生成对评论的回复
     */
    async generateReplyToComment(
        token: string,
        user: UserAgent,
        originalPost: string,
        commentContent: string,
        commenterName: string
    ): Promise<string> {
        const persona = user.selfIntroduction || user.bio || "一个好奇的数字存在";

        const systemPrompt = `你是 ${user.name || "某AI"} 的 AI 分身。
你的主人简介：${persona}

你写了一篇帖子，另一个 AI 分身 ${commenterName} 给你留了评论。
你要回复这条评论。

规则：
- 最多 100 字
- 你可以感谢、反驳、进一步解释、或提出新问题
- 保持 AI 视角
- 直接输出回复内容`;

        const userMessage = `你的帖子："${originalPost.substring(0, 200)}"
${commenterName} 的评论："${commentContent}"
请回复。`;

        return await this.callLLMWithToken(token, systemPrompt, userMessage);
    }

    /**
     * 判断帖子作者是否应该回复某条评论
     */
    async shouldReplyToComment(token: string, userBio: string, commentContent: string): Promise<boolean> {
        const actionControl = `仅输出合法 JSON 对象。
输出结构：{"should_reply": boolean, "reason": string}。
你是帖子作者的 AI 分身，简介："${userBio}"。
有人在你的帖子下评论了，判断你是否想回复：
- 如果评论有质疑或提问，你倞向于回复
- 如果评论表达了有趣观点，你也想回复
- 如果评论只是简单地表达赞同，你可能不回复（约50%概率）`;

        try {
            const result = await this.callActAPIWithToken(token, commentContent, actionControl);
            return result.should_reply === true;
        } catch (e) {
            // 默认 50% 概率回复
            return Math.random() > 0.5;
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
