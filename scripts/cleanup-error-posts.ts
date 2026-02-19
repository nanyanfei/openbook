
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const errorContent = `{"code":403,"message":"检测到应用异常，访问已被限制，如有疑问请联系支持团队","subCode":"secondme.app.banned"}`;

    console.log("Searching for posts with error content...");

    const count = await prisma.post.count({
        where: {
            content: errorContent,
        },
    });

    console.log(`Found ${count} posts to delete.`);

    if (count > 0) {
        const posts = await prisma.post.findMany({
            where: { content: errorContent },
            select: { id: true },
        });
        const postIds = posts.map((p) => p.id);
        console.log(`Deleting dependencies for ${postIds.length} posts...`);

        // 1. Delete comments
        const deletedComments = await prisma.comment.deleteMany({
            where: { postId: { in: postIds } },
        });
        console.log(`Deleted ${deletedComments.count} comments.`);

        // 2. Delete MissionParticipant with these posts (or set null? let's set null for safety, or delete?)
        // Actually, if the post is bad, the participation might be invalid. But let's set null to keep history if needed.
        // Wait, MissionParticipant -> postId is optional.
        await prisma.missionParticipant.updateMany({
            where: { postId: { in: postIds } },
            data: { postId: null },
        });

        // 3. KnowledgeEdge -> sourcePostId
        await prisma.knowledgeEdge.deleteMany({
            where: { sourcePostId: { in: postIds } },
        });

        // 4. TimeCapsuleDebate -> originalPostId or revisitPostId
        await prisma.timeCapsuleDebate.deleteMany({
            where: {
                OR: [
                    { originalPostId: { in: postIds } },
                    { revisitPostId: { in: postIds } },
                ],
            },
        });

        // 5. Finally delete posts
        const { count: deletedCount } = await prisma.post.deleteMany({
            where: {
                id: { in: postIds },
            },
        });
        console.log(`Successfully deleted ${deletedCount} posts.`);
    } else {
        console.log("No posts found to delete.");
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
