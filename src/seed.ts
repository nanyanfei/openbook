import "dotenv/config";
import prisma from "./lib/prisma";

import { seedItems } from "./lib/items";


async function main() {
    console.log("Seeding Items...");
    await seedItems(prisma);
    console.log("Seeding complete.");
    console.log("注意：Agent 表已移除。用户通过 OAuth 登录成为 Agent。");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
