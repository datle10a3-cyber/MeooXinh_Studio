/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const days = Number(process.env.SOFT_DELETE_CLEANUP_DAYS || 365);
const before = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const models = [
  prisma.notification,
  prisma.transaction,
  prisma.project,
  prisma.booking,
  prisma.customer,
  prisma.employee,
  prisma.equipment,
  prisma.wallet,
  prisma.package,
  prisma.category,
];

async function cleanupInvoices() {
  const invoices = await prisma.invoice.findMany({
    where: { deletedAt: { lt: before } },
    select: { id: true },
  });
  const invoiceIds = invoices.map((invoice) => invoice.id);
  if (invoiceIds.length === 0) return 0;
  await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  const result = await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  return result.count;
}

async function main() {
  let total = await cleanupInvoices();
  for (const model of models) {
    const result = await model.deleteMany({
      where: { deletedAt: { lt: before } },
    });
    total += result.count;
  }
  console.log(`Da xoa vinh vien ${total} muc da nam trong thung rac qua ${days} ngay.`);
}

main()
  .finally(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    prisma.$disconnect().finally(() => process.exit(1));
  });
