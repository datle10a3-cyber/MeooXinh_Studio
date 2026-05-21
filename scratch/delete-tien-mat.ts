import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.wallet.updateMany({
    where: {
      name: "Tiền mặt",
      studioId: "cmovbaavt0002spc22cxilrkw"
    },
    data: {
      deletedAt: new Date(),
      isActive: false
    }
  });
  console.log("Soft-deleted wallets:", result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
