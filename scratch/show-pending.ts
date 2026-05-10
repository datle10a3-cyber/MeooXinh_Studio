import { prisma } from "../app/lib/prisma";

async function showPending() {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        studioId: "cmovbaavt0002spc22cxilrkw",
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        deletedAt: null
      }
    });
    console.log(`\nPending Bookings count: ${bookings.length}`);
    for (const b of bookings) {
      console.log(`- ${b.customerName} | ${b.packageName} | status: ${b.status} | id: ${b.id}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

showPending();
