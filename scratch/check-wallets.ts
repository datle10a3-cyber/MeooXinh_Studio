import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const wallets = await prisma.wallet.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, type: true, balance: true, studioId: true }
  });
  console.log("Active Wallets:", JSON.stringify(wallets, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
