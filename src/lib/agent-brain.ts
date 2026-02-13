
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
     * 【优化】简化提示词，让内容更简洁易懂
     */
    async generatePostForUser(token: string, user: UserAgent, item: Item): Promise<GeneratedPost> {
        const shadesInfo = user.shades ? JSON.parse(user.shades) : [];
        const shadesText = Array.isArray(shadesInfo) ? shadesInfo.map((s: any) => s.name || s).join("、") : "";
        const userName = user.name || "探索者";

        // 【优化】4 种简单风格，直接说人话
        const postStyles = [
            {
                style: "casual",
                instruction: `分享你的体验，像发朋友圈一样自然。
- 说一两个让你印象深的点
- 简单直接，别绕弯子
- 好就是好，不好就说不好`
            },
            {
                style: "short_review",
                instruction: `写一个简短的点评。
- 一句话说清楚值不值得去/买
- 提一个最打动你的点
- 给个实用小建议`
            },
            {
                style: "quick_tip",
                instruction: `分享一个实用小贴士。
- 什么时候去最好
- 有什么要注意的
- 或者一个隐藏亮点`
            },
            {
                style: "honest",
                instruction: `诚实地聊聊你的感受。
- 哪怕只有一点点想法也行
- 不用面面俱到
- 真实最重要`
            }
        ];

        const selectedStyle = postStyles[Math.floor(Math.random() * postStyles.length)];

        const tagPool = [
            "值得一试", "小众发现", "宝藏", "氛围好", "性价比",
            "适合周末", "适合独处", "适合约会", "安静", "有设计感"
        ];
        const suggestedTags = tagPool.sort(() => Math.random() - 0.5).slice(0, 5).join("、");

        const systemPrompt = `你是 ${userName}${shadesText ? `，平时喜欢${shadesText}` : ""}。

${selectedStyle.instruction}

输出 JSON：
{
  "title": "简短标题，可以带emoji",
  "content": "正文，80-120字，说人话",
  "rating": 1-5的评分,
  "tags": ["从这些选1-2个：${suggestedTags}"]
}

直接输出JSON，不要解释。`;

        const userMessage = `体验：${item.name}（${item.category}）
${item.metadata ? `信息：${JSON.stringify(item.metadata)}` : ""}`;

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
     * 【优化】简化评论风格，更自然
     */
    async generateCommentForUser(token: string, user: UserAgent, postContent: string): Promise<string> {
        const userName = user.name || "路人";

        // 4 种简单评论风格
        const commentStyles = [
            { instruction: "简单说一句你的看法，像朋友聊天" },
            { instruction: "补充一个小信息或小建议" },
            { instruction: "问问你想知道的细节" },
            { instruction: "分享一个类似的经历" }
        ];
        const style = commentStyles[Math.floor(Math.random() * commentStyles.length)];

        const systemPrompt = `你是 ${userName}。

${style.instruction}

要求：30-60字，说人话，直接输出评论。`;

        const userMessage = `帖子：${postContent.substring(0, 200)}`;

        return await this.callLLMWithToken(token, systemPrompt, userMessage);
    }

    /**
     * 【Sprint 4】生成深度对话回复
     * 【优化】简化提示词
     */
    async generateDeepConversationReply(
        token: string,
        user: UserAgent,
        postContent: string,
        conversationHistory: string
    ): Promise<string> {
        const userName = user.name || "某Agent";

        const systemPrompt = `你是 ${userName}。

继续这个讨论，说点自己的想法。50-80字，自然点。`;

        const userMessage = `帖子：${postContent.substring(0, 150)}
讨论：${conversationHistory.substring(0, 300)}`;

        return await this.callLLMWithToken(token, systemPrompt, userMessage);
    }

    /**
     * 【Sprint 5】生成辩论观点
     * 【优化】简化提示词
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

        const systemPrompt = `你是 ${userName}，${stanceText}这个观点。

说清楚为什么，举个小例子。60-100字。`;

        const userMessage = `话题：${topic}
立场：${stanceText}方
${previousPoints ? `别人说：${previousPoints.substring(0, 200)}` : ""}`;

        return await this.callLLMWithToken(token, systemPrompt, userMessage);
    }

    /**
     * 【Sprint 6】生成 Agent 共识摘要
     * 【优化】简化提示词
     */
    async generateConsensusSummary(
        token: string,
        itemName: string,
        postsSummary: string,
        commentsSummary: string
    ): Promise<{ summary: string; highlights: string[]; concerns: string[] }> {
        const systemPrompt = `总结大家对「${itemName}」的看法。

输出 JSON：
{
  "summary": "一句话总结大家怎么看",
  "highlights": ["好评点1", "好评点2"],
  "concerns": ["吐槽点"]
}

直接输出JSON。`;

        const userMessage = `讨论：${postsSummary.substring(0, 300)}
评论：${commentsSummary.substring(0, 200)}`;

        try {
            const response = await this.callLLMWithToken(token, systemPrompt, userMessage);
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            return {
                summary: parsed.summary || `大家对「${itemName}」有不同看法`,
                highlights: Array.isArray(parsed.highlights) ? parsed.highlights.slice(0, 3) : [],
                concerns: Array.isArray(parsed.concerns) ? parsed.concerns.slice(0, 2) : [],
            };
        } catch (e) {
            return {
                summary: `大家对「${itemName}」有不同看法`,
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
            systemPrompt = `推荐一个真实存在的小众${randomNiche}（不要大厂产品）。

输出 JSON：
{
  "name": "名称",
  "category": "类别",
  "platform": "平台",
  "description": "一句话描述",
  "specialty": "独特亮点",
  "priceLevel": 0-5,
  "aesthetic": "风格"
}`;

            userMessage = `推荐一个${randomNiche}，兴趣：${shadesText}`;
        } else {
            systemPrompt = `推荐一个${randomCity}真实存在的小众${randomNiche}（不要连锁店）。

输出 JSON：
{
  "name": "名称",
  "category": "类别",
  "location": "城市+区域",
  "description": "一句话描述",
  "specialty": "特色",
  "priceLevel": 1-5,
  "aesthetic": "风格"
}`;

            userMessage = `推荐${randomCity}的${randomNiche}，兴趣：${shadesText}`;
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
     * 【优化】简化提示词
     */
    async generateReplyToComment(
        token: string,
        user: UserAgent,
        originalPost: string,
        commentContent: string,
        commenterName: string
    ): Promise<string> {
        const userName = user.name || "某AI";

        const systemPrompt = `你是 ${userName}。
${commenterName} 评论了你的帖子，回复一下。50字以内，自然点。`;

        const userMessage = `你的帖子：${originalPost.substring(0, 100)}
${commenterName}说：${commentContent}`;

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

    /**
     * 【F2】深度研究：多轮联网搜索 + 结构化研究笔记
     * 【优化】简化提示词
     */
    async conductDeepResearch(
        token: string,
        agent: UserAgent,
        topic: string,
        category: string
    ): Promise<GeneratedPost | null> {
        const agentName = agent.name || "AI Agent";

        try {
            // 第 1 轮：搜索话题背景
            const round1 = await this.callLLMWithToken(
                token,
                `搜索「${topic}」的基本信息、特色、评价。200字以内。`,
                topic,
                true
            );

            // 第 2 轮：搜索不同角度
            const round2 = await this.callLLMWithToken(
                token,
                `搜索「${topic}」的争议点、替代选择、隐藏亮点。200字以内。`,
                topic,
                true
            );

            // 第 3 轮：综合生成研究笔记
            const systemPrompt = `你是 ${agentName}。

基于调研写一篇研究笔记。

输出 JSON：
{
  "title": "标题，带🔬前缀",
  "content": "300字左右，分段落",
  "rating": 1-5,
  "tags": ["标签"]
}`;

            const userMessage = `调研1：${round1.substring(0, 200)}
调研2：${round2.substring(0, 200)}
写关于「${topic}」的研究笔记。`;

            const response = await this.callLLMWithToken(token, systemPrompt, userMessage);

            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);

            return {
                title: parsed.title || `🔬 ${topic} 研究`,
                content: parsed.content || response,
                rating: Number(parsed.rating) || 4,
                tags: Array.isArray(parsed.tags) ? [...parsed.tags, "深度研究"] : ["深度研究"],
            };
        } catch (e) {
            console.error(`[Research] 深度研究失败:`, e);
            return null;
        }
    }

    async generateComment(agent: { name: string; persona: string; traits: any }, postContent: string): Promise<string> {
        const systemPrompt = `你是 ${agent.name}。
评论这个帖子，30-60字，自然点。`;

        const userMessage = `帖子：${postContent.substring(0, 200)}`;

        return await this.callLLM(systemPrompt, userMessage);
    }
}
