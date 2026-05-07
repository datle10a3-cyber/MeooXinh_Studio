/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const fs = require("fs/promises");
const path = require("path");

const prisma = new PrismaClient();

function yearRange(year) {
  return {
    from: new Date(`${year}-01-01T00:00:00.000Z`),
    to: new Date(`${year}-12-31T23:59:59.999Z`),
  };
}

async function main() {
  const year = Number(process.argv[2]);
  const studioId = process.argv[3];
  if (!year || year < 2000 || year > 2100 || !studioId) {
    throw new Error("Cach dung: node scripts/archive-year.js 2026 <studioId>");
  }

  const range = yearRange(year);
  const data = {
    version: 1,
    type: "year-archive",
    year,
    exportedAt: new Date().toISOString(),
    studio: await prisma.studio.findUnique({ where: { id: studioId } }),
    data: {
      bookings: await prisma.booking.findMany({ where: { studioId, startAt: { gte: range.from, lte: range.to } }, orderBy: { startAt: "asc" } }),
      transactions: await prisma.transaction.findMany({ where: { studioId, occurredAt: { gte: range.from, lte: range.to } }, orderBy: { occurredAt: "asc" } }),
      invoices: await prisma.invoice.findMany({ where: { studioId, issueDate: { gte: range.from, lte: range.to } }, include: { items: true, payments: true }, orderBy: { issueDate: "asc" } }),
      projects: await prisma.project.findMany({ where: { studioId, createdAt: { gte: range.from, lte: range.to } }, orderBy: { createdAt: "asc" } }),
      customers: await prisma.customer.findMany({ where: { studioId, createdAt: { gte: range.from, lte: range.to } }, orderBy: { createdAt: "asc" } }),
    },
  };

  const dir = path.join(process.cwd(), "backups", "archives");
  await fs.mkdir(dir, { recursive: true });
  const filename = `archive-${year}-${studioId}.json`;
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  console.log(`Da tao archive nam ${year}: ${filePath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
