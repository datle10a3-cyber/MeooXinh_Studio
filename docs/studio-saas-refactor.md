# Studio SaaS Refactor Target

## Design System

```ts
export const theme = {
  background: "#F5F1E8",
  card: "#FFFFFF",
  primary: "#D6BFA7",
  accent: "#CBB89D",
  text: "#2F2F2F",
  subtext: "#7A7A7A",
  border: "#E7DACB",
  radius: "0.75rem",
  shadow: "0 8px 24px rgba(47, 47, 47, 0.06)",
};
```

## Folder Structure

```txt
app/
  api/
    auth/
    bookings/
    categories/
    packages/
    customers/
    wallets/
    transactions/
    debts/
    projects/
    invoices/
    staff/
    equipment/
    notifications/
    media/
    ai/
    reports/
  components/
    layout/
    dashboard/
    booking/
    finance/
    crm/
    shared/
  lib/
    auth.ts
    prisma.ts
    tenant.ts
    api-response.ts
    audit.ts
    csv.ts
  services/
    booking-service.ts
    finance-service.ts
    debt-service.ts
    ai-service.ts
prisma/
  schema.prisma
```

## Prisma Schema Target

```prisma
model Studio {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users         User[]
  staff         Staff[]
  customers     Customer[]
  categories    Category[]
  packages      Package[]
  bookings      Booking[]
  wallets       Wallet[]
  transactions  Transaction[]
  debts         Debt[]
  projects      Project[]
  invoices      Invoice[]
  equipment     Equipment[]
  notifications Notification[]
  media         Media[]
  auditLogs     AuditLog[]
  aiMessages    AiChatMessage[]
}

model User {
  id           String   @id @default(cuid())
  studioId     String
  staffId      String?
  email        String   @unique
  passwordHash String
  role         String   @default("STAFF")
  status       String   @default("ACTIVE")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  studio Studio @relation(fields: [studioId], references: [id], onDelete: Cascade)
  staff  Staff? @relation(fields: [staffId], references: [id])

  @@index([studioId])
}

model Staff {
  id        String   @id @default(cuid())
  studioId  String
  name      String
  phone     String?
  salary    Decimal  @default(0)
  avatarUrl String?
  deletedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  studio Studio @relation(fields: [studioId], references: [id], onDelete: Cascade)
  users  User[]

  @@index([studioId])
}

model Customer {
  id         String   @id @default(cuid())
  studioId   String
  name       String
  phone      String?
  email      String?
  avatarUrl  String?
  source     String?
  note       String?
  deletedAt  DateTime?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  studio   Studio    @relation(fields: [studioId], references: [id], onDelete: Cascade)
  bookings Booking[]

  @@index([studioId])
}

model Category {
  id          String   @id @default(cuid())
  studioId    String
  name        String
  description String?
  deletedAt   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  studio   Studio    @relation(fields: [studioId], references: [id], onDelete: Cascade)
  packages Package[]

  @@unique([studioId, name])
}

model Package {
  id          String   @id @default(cuid())
  studioId    String
  categoryId  String
  name        String
  price       Decimal  @default(0)
  description String?
  duration    String?
  imageUrl    String?
  deletedAt   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  studio   Studio   @relation(fields: [studioId], references: [id], onDelete: Cascade)
  category Category @relation(fields: [categoryId], references: [id])
  bookings Booking[]

  @@index([studioId])
  @@index([categoryId])
}

model Booking {
  id               String   @id @default(cuid())
  studioId         String
  customerId       String?
  packageId        String?
  isCustomPackage  Boolean  @default(false)
  nameSnapshot     String
  categorySnapshot String
  priceSnapshot    Decimal  @default(0)
  deposit          Decimal  @default(0)
  total            Decimal  @default(0)
  startTime        DateTime
  endTime          DateTime?
  status           String   @default("PENDING")
  note             String?
  conceptImage     String?
  deletedAt        DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  studio   Studio    @relation(fields: [studioId], references: [id], onDelete: Cascade)
  customer Customer? @relation(fields: [customerId], references: [id])
  package  Package?  @relation(fields: [packageId], references: [id])

  @@index([studioId, startTime])
  @@index([customerId])
  @@index([packageId])
}

model Wallet {
  id        String   @id @default(cuid())
  studioId  String
  name      String
  type      String
  balance   Decimal  @default(0)
  deletedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  studio       Studio        @relation(fields: [studioId], references: [id], onDelete: Cascade)
  transactions Transaction[]

  @@index([studioId])
}

model Transaction {
  id        String   @id @default(cuid())
  studioId  String
  walletId  String
  type      String
  amount    Decimal
  status    String   @default("APPROVED")
  date      DateTime @default(now())
  note      String?
  image     String?
  deletedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  studio Studio @relation(fields: [studioId], references: [id], onDelete: Cascade)
  wallet Wallet @relation(fields: [walletId], references: [id])

  @@index([studioId, type, date])
  @@index([walletId])
}

model Debt {
  id         String   @id @default(cuid())
  studioId   String
  sourceType String
  sourceId   String
  total      Decimal  @default(0)
  paid       Decimal  @default(0)
  remaining  Decimal  @default(0)
  deletedAt  DateTime?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  studio Studio @relation(fields: [studioId], references: [id], onDelete: Cascade)

  @@index([studioId, sourceType, sourceId])
}
```

## REST API Contract

```txt
GET    /api/categories
POST   /api/categories
PUT    /api/categories
DELETE /api/categories

GET    /api/packages
POST   /api/packages
PUT    /api/packages
DELETE /api/packages

GET    /api/bookings
POST   /api/bookings
PUT    /api/bookings
DELETE /api/bookings

GET    /api/wallets
POST   /api/wallets
PUT    /api/wallets
DELETE /api/wallets

GET    /api/transactions
POST   /api/transactions
PUT    /api/transactions
DELETE /api/transactions

GET    /api/debts
GET    /api/reports?type=transactions
POST   /api/ai/chat/stream
GET    /api/ai/chat/history
DELETE /api/ai/chat/history
```

## Migration Notes

1. Replace legacy `ServicePackage` with `Package`.
2. Rename legacy booking time fields from `startAt/endAt` to `startTime/endTime`.
3. Move `ServicePackage.category` text into `Category`.
4. Make `Transaction.walletId` required after backfilling a default wallet.
5. Create `Debt` records from Booking, Project, Invoice and stop storing debt in multiple places.
