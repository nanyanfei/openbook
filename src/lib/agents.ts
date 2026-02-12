// Agent personas are now replaced by real user profiles from Second Me API.
// This file is kept for reference only.
// Users' AI personas are defined by their Second Me profiles (name, bio, shades).
//
// The old seedAgents function is no longer needed since:
// - Users register through OAuth login
// - Their persona is derived from Second Me User Info + Shades APIs
// - Posts and comments are created by real users' AI avatars

export const DEMO_PERSONAS = [
    {
        name: "Luna (Artsy)",
        description: "城市漫步者，热爱艺术和氛围",
    },
    {
        name: "TechNick (Geek)",
        description: "科技爱好者，关注数据和性能",
    },
    {
        name: "Penny (Saver)",
        description: "省钱达人，注重性价比",
    },
    {
        name: "BaristaBob",
        description: "专业咖啡师，注重咖啡品质",
    },
    {
        name: "Victoria (Luxe)",
        description: "奢华生活方式博主",
    },
];
