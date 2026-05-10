/**
 * Recovery script: Create missing project/invoice/transaction for bookings
 * that were COMPLETED but had no finance data due to the auditLog FK bug.
 */
import { finalizeCompletedBooking } from "../app/lib/finance-workflow";
import { prisma } from "../app/lib/prisma";

const ORPHANED_BOOKING_IDS = [
  "cmoy730sm000hg1ra6vppbvgi", // Tiền
  "cmoy72ysv000dg1rawe8v9dno", // Như
  "cmoy72wtw0009g1raqpluni5x", // Tiến
];

async function recover() {
  const realUser = await prisma.user.findFirst({ where: { studioId: "cmovbaavt0002spc22cxilrkw" } });
  if (!realUser) throw new Error("No user found in studio");

  const user = {
    id: realUser.id,
    studioId: realUser.studioId!,
    role: "ADMIN" as const,
    name: realUser.name,
    email: realUser.email,
    avatarUrl: realUser.avatarUrl,
  };

  for (const bookingId of ORPHANED_BOOKING_IDS) {
    console.log(`\n--- Recovering ${bookingId} ---`);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { package: { include: { category: true } }, customer: true },
    });
    if (!booking) { console.log("NOT FOUND, skipping"); continue; }
    console.log(`  Customer: ${booking.customerName}, total: ${booking.total}`);

    // Check if already has project/txn (idempotent)
    const existingProject = await prisma.project.findFirst({ where: { bookingId } });
    const existingTxn = await prisma.transaction.findFirst({
      where: { note: { contains: `BOOKING_DONE:${bookingId}` }, deletedAt: null },
    });
    if (existingProject && existingTxn) {
      console.log("  Already recovered, skipping");
      continue;
    }

    try {
      const result = await finalizeCompletedBooking(booking, user);
      console.log(`  ✅ Recovered: invoice=${result?.invoiceCode}, total=${result?.invoiceTotal}`);
    } catch (err) {
      console.error(`  ❌ Failed:`, err);
    }
  }
  await prisma.$disconnect();
}

recover();
