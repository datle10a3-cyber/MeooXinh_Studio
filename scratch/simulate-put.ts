import { PUT } from "../app/api/bookings/route";
import { prisma } from "../app/lib/prisma";

async function simulatePut() {
  try {
    // Find the real ADMIN user
    const realUser = await prisma.user.findFirst({
      where: { studioId: "cmovbaavt0002spc22cxilrkw" }
    });
    if (!realUser) {
      console.log("No real user found");
      return;
    }

    // Find the "Đat" booking
    const booking = await prisma.booking.findFirst({
      where: { studioId: "cmovbaavt0002spc22cxilrkw", customerName: "Đat" }
    });
    if (!booking) {
      console.log("Booking 'Đat' not found");
      return;
    }

    // We mock the Request object and req.json()
    const payload = {
      id: booking.id,
      customerId: booking.customerId ?? "",
      customerName: booking.customerName,
      imageUrl: booking.imageUrl ?? "",
      packageId: booking.packageId,
      startTime: booking.startTime ? booking.startTime.toISOString() : new Date().toISOString(),
      endTime: booking.endTime ? booking.endTime.toISOString() : "",
      note: booking.note ?? "",
      status: "COMPLETED",
      studioPassword: "dev-mock-pass", // In PUT route we check studioPassword if staff, but mock ADMIN role bypasses it or we bypass it
    };

    console.log("Payload:", payload);

    // Let's mock requireUser to return the real admin user
    // Since Next.js requireUser reads cookies, we will execute the PUT function logic directly!
    // Let's import requireUser or mock it.
    // Actually, we can just run the inner logic of the PUT handler directly in our script!
    
    const user = {
      id: realUser.id,
      studioId: realUser.studioId,
      role: "ADMIN" as const, // admin bypasses verifyStudioEditPassword
      name: realUser.name,
      email: realUser.email,
      avatarUrl: realUser.avatarUrl,
    };

    console.log("Simulating PUT route inner logic...");
    const result = await runPutLogic(payload, user);
    console.log("SUCCESS! Result:", result);

  } catch (err) {
    console.error("CRITICAL RUNTIME ERROR IN PUT:", err);
  } finally {
    await prisma.$disconnect();
  }
}

async function runPutLogic(body: any, user: any) {
  const selectedPackage = await prisma.package.findFirst({
    where: { id: body.packageId, studioId: user.studioId, deletedAt: null },
    include: { category: true },
  });
  if (!selectedPackage) throw new Error("Gói dịch vụ không hợp lệ.");

  const current = await prisma.booking.findFirst({
    where: { id: body.id, studioId: user.studioId, deletedAt: null }
  });
  if (!current) throw new Error("Không tìm thấy booking.");

  const startTime = new Date(body.startTime);
  const endTime = body.endTime ? new Date(body.endTime) : null;
  const finishTime = endTime ?? new Date(startTime.getTime() + 60 * 60 * 1000);
  const status = body.status ? String(body.status) : "PENDING";
  
  const isNewlyCompleting = current.status !== "COMPLETED" && status === "COMPLETED";

  // Mock resolveDiscount and appendBookingNote
  const discountInfo = { total: selectedPackage.price, label: "" };
  const bookingMode = "PERSONAL";
  const nextTotal = body.discountType === undefined ? current.total : discountInfo.total;

  const bookingData = {
    customerId: body.customerId ? String(body.customerId) : null,
    packageId: selectedPackage.id,
    customerName: body.customerName.trim(),
    imageUrl: body.imageUrl ? String(body.imageUrl).trim() : null,
    packageName: selectedPackage.name,
    categoryName: selectedPackage.category.name,
    price: selectedPackage.price,
    startTime,
    endTime: finishTime,
    title: `${body.customerName.trim()} - ${selectedPackage.name}`,
    startAt: startTime,
    endAt: finishTime,
    total: nextTotal,
    status,
    note: body.note ? String(body.note).trim() : null,
  };

  let row: any;
  let invoiceSnapshot = null;

  const { finalizeCompletedBooking } = await import("../app/lib/finance-workflow");

  if (isNewlyCompleting) {
    row = await prisma.booking.update({
      where: { id: body.id },
      data: bookingData,
      include: { package: { include: { category: true } }, customer: true },
    });
    try {
      invoiceSnapshot = await finalizeCompletedBooking(row, user);
    } catch (finalizeError) {
      await prisma.booking.update({
        where: { id: body.id },
        data: { status: current.status },
      }).catch(() => null);
      throw finalizeError;
    }
  } else {
    row = await prisma.booking.update({
      where: { id: body.id },
      data: bookingData,
      include: { package: { include: { category: true } }, customer: true },
    });
  }

  return { ...row, ...(invoiceSnapshot ?? {}) };
}

simulatePut();
