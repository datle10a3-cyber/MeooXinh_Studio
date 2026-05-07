import { prisma } from "@/app/lib/prisma";

type PrismaDelegate = {
  findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
  findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
  create: (args: unknown) => Promise<Record<string, unknown>>;
  update: (args: unknown) => Promise<Record<string, unknown>>;
  delete: (args: unknown) => Promise<Record<string, unknown>>;
};

export const RESOURCE_DEFINITIONS = {
  customers: {
    model: "customer",
    entity: "Customer",
    dateFields: [],
    numberFields: ["totalSpent"],
    trashable: true,
  },
  services: {
    model: "servicePackage",
    entity: "ServicePackage",
    dateFields: [],
    numberFields: ["price", "promoPrice", "durationMin"],
    trashable: true,
  },
  bookings: {
    model: "booking",
    entity: "Booking",
    dateFields: ["startAt", "endAt"],
    numberFields: ["deposit", "total"],
    trashable: true,
  },
  projects: {
    model: "project",
    entity: "Project",
    dateFields: ["deadlineAt"],
    numberFields: ["amount", "dueAmount"],
    trashable: true,
  },
  transactions: {
    model: "transaction",
    entity: "Transaction",
    dateFields: ["occurredAt"],
    numberFields: ["amount"],
    trashable: true,
  },
  wallets: {
    model: "wallet",
    entity: "Wallet",
    dateFields: [],
    numberFields: ["openingBalance", "balance"],
    trashable: true,
  },
  invoices: {
    model: "invoice",
    entity: "Invoice",
    dateFields: ["issueDate", "dueDate"],
    numberFields: ["subtotal", "discount", "tax", "total", "paid", "due"],
    trashable: true,
  },
  payments: {
    model: "payment",
    entity: "Payment",
    dateFields: ["paidAt"],
    numberFields: ["amount"],
  },
  employees: {
    model: "employee",
    entity: "Employee",
    dateFields: [],
    numberFields: ["baseSalary"],
    trashable: true,
  },
  equipment: {
    model: "equipment",
    entity: "Equipment",
    dateFields: [],
    numberFields: [],
    trashable: true,
  },
  notifications: {
    model: "notification",
    entity: "Notification",
    dateFields: ["dueAt"],
    numberFields: [],
    trashable: true,
  },
  auditLogs: {
    model: "auditLog",
    entity: "AuditLog",
    dateFields: [],
    numberFields: [],
  },
} as const;

export type ResourceKey = keyof typeof RESOURCE_DEFINITIONS;

export function getResourceDefinition(resource: string) {
  return RESOURCE_DEFINITIONS[resource as ResourceKey] ?? null;
}

export function getDelegate(resource: ResourceKey) {
  const model = RESOURCE_DEFINITIONS[resource].model;
  return (prisma as unknown as Record<string, PrismaDelegate>)[model];
}

export function normalizePayload(resource: ResourceKey, body: Record<string, unknown>) {
  const definition = RESOURCE_DEFINITIONS[resource];
  const payload: Record<string, unknown> = { ...body };

  for (const key of ["id", "createdAt", "updatedAt", "studioId"]) {
    delete payload[key];
  }

  for (const field of definition.dateFields) {
    if (payload[field]) {
      payload[field] = new Date(String(payload[field]));
    } else {
      delete payload[field];
    }
  }

  for (const field of definition.numberFields) {
    if (payload[field] !== undefined && payload[field] !== null && payload[field] !== "") {
      payload[field] = Number(payload[field]);
    }
  }

  for (const [key, value] of Object.entries(payload)) {
    if (value === "") payload[key] = null;
    if (value === "true") payload[key] = true;
    if (value === "false") payload[key] = false;
  }

  if (resource === "notifications") {
    payload.title = payload.title || "Thông báo mới";
    payload.message = payload.message || "Không có nội dung.";
  }

  return payload;
}
