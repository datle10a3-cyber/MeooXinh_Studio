# Project Understanding: Thu Thao Studio

This document summarizes the current architecture, domain flows, API surface, UI structure, and invariants of the project after a read-through of the key source files.

## High-level purpose

Thu Thao Studio is a studio management web app for booking, packages, customers, finance, wallets, invoices, projects, staff, equipment, notifications, media, reports, backup/restore, and an AI assistant.

## Tech stack

- **Framework:** Next.js `16.2.4` with App Router.
- **Runtime/UI:** React `19.2.4`, TypeScript, Tailwind CSS 4.
- **State:** Zustand via `app/store/ui-store.ts`.
- **Database:** PostgreSQL through Prisma 5.
- **Auth:** JWT access token + refresh token cookies, bcrypt password hashing, `jose` JWT signing/verification.
- **AI:** Groq-compatible OpenAI chat API endpoint with local fallback.
- **PWA/push:** `@ducanh2912/next-pwa`, Web Push subscriptions.
- **Media:** Local `/public/uploads` fallback or Cloudinary if configured.

## Important constraint

The local `node_modules/next/dist/docs/` directory does not exist in this worktree because dependencies are not installed. For future Next.js edits, read the local Next docs first once dependencies exist, because this project explicitly warns that its Next.js version may have breaking changes.

## Entry points and routing

- **Root layout:** `app/layout.tsx`.
- **Home shell:** `app/page.tsx` is a client component that dynamically loads major views and switches them by `?view=`.
- **Navigation helper:** `app/utils/studio-navigation.ts` encodes views as `/` or `/?view=<id>&tab=<tab>` and dispatches `studio-view-navigation` events.
- **Global app chrome:** `app/components/layout/app-shell.tsx` owns session loading, navigation, mobile menus, search, notification bell, and user menu.
- **API protection/security headers:** `proxy.ts` protects selected `/api/**` prefixes and adds security headers.

Some modules are separate physical pages instead of root `?view=` views:

- `/booking`
- `/categories`
- `/packages`
- `/completed-bookings`
- `/login`
- `/register`
- `/forgot-password`
- `/offline`

## Main client state

`app/store/ui-store.ts` stores:

- `activeResource`
- `session`
- `darkMode`
- `focusedItemId`
- `transactionIntent`
- `transactionViewIntent`

This state connects search/home/navigation with `ResourceManager`, booking pages, and transaction tabs.

## Domain model map

Prisma schema is in `prisma/schema.prisma`.

Core tenancy and identity:

- `Studio`
- `User`
- `Role`, `Permission`, `RolePermission`
- `RefreshToken`
- `EmailOtp`

Studio operations:

- `Customer`, `CustomerTag`, `CustomerTagMap`
- `Category`
- `Package`
- legacy/current generic `ServicePackage`
- `Booking`, `BookingStaff`
- `Project`, `ProjectMember`

Finance:

- `Wallet`
- `WalletShift`
- `TransactionCategory`
- `Transaction`
- `Invoice`, `InvoiceItem`
- `Payment`

Management/support:

- `Employee`, `WorkLog`
- `Equipment`, `MaintenanceLog`
- `Notification`
- `PushSubscription`
- `AuditLog`
- `AutomationRule`
- `Media`

AI:

- `AiChatMessage`
- `AiMemory`
- `AiAuditLog`
- `AiActionSuggestion`

## Resource configuration system

There are two related configuration layers:

- `app/lib/studio-config.ts`
  - Defines UI-facing `RESOURCE_CONFIG` for generic resources such as customers, services, bookings, projects, invoices, transactions, wallets, employees, equipment, notifications.
  - Contains field labels, field types, table fields, money fields, and workflow hints.

- `app/lib/resources.ts`
  - Defines server-side `RESOURCE_DEFINITIONS`, Prisma model mapping, date/number normalization, and dynamic delegate lookup.

Generic CRUD is implemented in:

- `app/lib/resource-route-handlers.ts`
- `app/api/resources/[resource]/route.ts`

The generic resource UI is:

- `app/components/resources/resource-manager.tsx`

Special resources not fully handled by generic CRUD:

- `Category` via `app/api/categories/route.ts` and `app/components/catalog/category-page.tsx`
- `Package` via `app/api/packages/route.ts` and `app/components/catalog/package-page.tsx`
- `Booking` via `app/api/bookings/route.ts` and `app/components/catalog/booking-page.tsx`
- `Employee/User` via `app/api/users/route.ts` and `app/components/users/user-management.tsx`

## Auth and authorization

Authoritative auth code is in `app/lib/auth.ts`.

Key behavior:

- Login verifies password with bcrypt.
- Access token expires in 15 minutes.
- Refresh token is persisted hashed in `RefreshToken` and stored in an HTTP-only cookie.
- `getCurrentUser()` verifies access token and refresh token; it can refresh access token from a valid refresh token.
- Dev bypass can create a local session only when `AUTH_DEV_BYPASS=true`, not production, and host is `localhost` or `127.0.0.1`.

Role model:

- `ADMIN`: full access including deletes, users, CSV export, finance, media delete.
- `MANAGER`: can create/update most data and view finance.
- `STAFF`: can mutate some operational data but cannot create in generic resources, cannot delete, cannot export CSV, and cannot view finance data in search/AI.

Important helper split:

- Server helpers in `app/lib/auth.ts`: `canCreate`, `canUpdate`, `canWrite`, `verifyStudioEditPassword`.
- Client helpers in `app/types/auth.ts`: `canCreate`, `canMutate`, `canDelete`.

For STAFF edits, many routes require a 6-digit studio password via `verifyStudioEditPassword`.

## API map

Important APIs:

- **Auth:** `/api/auth/login`, `/logout`, `/me`, `/refresh`, `/register`, `/register/otp`, `/password-reset`, `/password-reset/otp`.
- **Generic resources:** `/api/resources/[resource]` supports `GET`, `POST`, `PUT`, `PATCH` restore, `DELETE`.
- **Legacy generic route:** `/api/resource` exists separately.
- **Booking/catalog:** `/api/categories`, `/api/packages`, `/api/bookings`.
- **Finance/reporting:** `/api/dashboard`, `/api/reports`, `/api/wallet-shifts`.
- **Search:** `/api/search` searches across operational tables and hides finance results for STAFF.
- **Media:** `/api/media` upload/list/delete images.
- **Notifications/push:** `/api/notifications`, `/api/push/subscribe`.
- **Users/profile:** `/api/users`, `/api/profile/**`.
- **AI:** `/api/ai/chat`, `/api/ai/chat/stream`, `/api/ai/chat/history`, `/api/ai/actions`, `/api/ai/audit`, `/api/ai/insights`.
- **Backup/system:** `/api/backup`, `/api/backup/import`, `/api/system/health`, `/api/activity`.

Response helpers are in `app/lib/api-response.ts`.

## Core business flows

### Booking creation/update

Main route: `app/api/bookings/route.ts`.

Flow:

1. Require authenticated user.
2. Create allowed only for `ADMIN`/`MANAGER`.
3. Validate `customerName`, `packageId`, and `startTime`.
4. Resolve selected `Package` and `Category` within same `studioId`.
5. Calculate discount and final total.
6. Store denormalized snapshots on `Booking`: `packageName`, `categoryName`, `price`, `title`, `startAt`, `endAt`, `startTime`, `endTime`.
7. If status becomes `COMPLETED`, require an active wallet and open wallet shift.
8. If completed, call `finalizeCompletedBooking()`.
9. Write audit log.

### Completed booking finalization

Authoritative code: `app/lib/finance-workflow.ts`.

`finalizeCompletedBooking()`:

- Upserts a delivered `Project` for the booking.
- Creates or updates a paid `Invoice`.
- Replaces invoice items.
- Creates or updates an approved income `Transaction` marked with `BOOKING_DONE:<bookingId>`.
- Updates wallet balance.
- Updates customer `totalSpent`.
- Recalculates wallet shift snapshots.
- Writes `FINALIZE_BOOKING` audit log.
- Returns invoice snapshot fields used by UI receipt/print logic.

### Transaction/wallet flow

Authoritative code:

- `app/lib/resource-route-handlers.ts`
- `app/lib/finance-workflow.ts`
- `app/api/wallet-shifts/route.ts`

Rules:

- Only approved, non-deleted `INCOME`/`EXPENSE` transactions with `walletId` affect wallet balance.
- `INCOME` increments wallet balance.
- `EXPENSE` decrements wallet balance.
- `TRANSFER` currently does not affect wallet balance in `transactionWalletDelta`.
- Updates call `replaceTransactionWalletDelta()` to remove old delta and apply new delta.
- Delete/trash of transactions applies reverse delta.
- Wallet shift snapshots are recalculated after relevant transaction changes.

### Invoice debt

- `recalculateInvoiceDebt(invoiceId)` sets `due = max(total - paid, 0)`.
- If due is zero and total positive, status becomes `PAID`.
- If paid is positive but due remains, status becomes `PARTIALLY_PAID`.

### Dashboard

Route: `app/api/dashboard/route.ts`.

- Requires auth.
- Aggregates income, expense, recent transactions, open invoices, upcoming bookings, wallets.
- Supports chart modes: `day`, `month`, `year`.
- Uses server-side memory cache via `app/lib/api-cache.ts`.
- Cache keys include studio and chart filters.
- Generic resource mutations invalidate `dashboard:` cache prefix.

### Search

Route: `app/api/search/route.ts`.

- Uses raw SQL and `vi_unaccent(...)` for Vietnamese-insensitive search.
- Searches customer, booking, project, package, category, employee, equipment.
- Searches invoices and transactions only if user is not `STAFF`.
- Supports date range and offset/cursor-like pagination.

### Reports

Route: `app/api/reports/route.ts`.

- STAFF denied.
- Produces UTF-16LE TSV/CSV-like downloads for Excel compatibility.
- Supports `all`, `transactions`, `invoices`, `bookings`, `projects`, `wallets`, `customers`, `employees`, `equipment`.
- Batches export up to 50,000 rows.

### Media

Route: `app/api/media/route.ts`; service: `app/lib/media-service.ts`.

- Images only.
- Size limit from `MAX_UPLOAD_MB`, default 12 MB.
- Uploads to Cloudinary if `CLOUDINARY_CLOUD_NAME` exists and credentials are valid; otherwise local `/public/uploads`.
- Local media storage is guarded by deploy safety checks.
- Delete requires ADMIN.

### Notifications and push

Route: `app/api/notifications/route.ts`.

- Generates persisted notifications for upcoming bookings, due invoices, and projects nearing deadline.
- Sends push through `sendStudioPush`.
- Returns normalized items with target resource/path for UI navigation.
- `PATCH` marks notifications as read.

### AI assistant

Routes and libs:

- `app/api/ai/chat/route.ts`
- `app/api/ai/chat/stream/route.ts`
- `app/lib/ai-studio.ts`
- `app/components/ai/ai-assistant-view.tsx`

Behavior:

- Stores user and assistant messages in `AiChatMessage`.
- Builds studio context from DB.
- Uses Groq API if `GROQ_API_KEY` is valid.
- Falls back to local context answer if no valid key or model fails.
- Blocks finance questions for STAFF.
- Can learn preferences into `AiMemory`.
- Can create `AiActionSuggestion` for later approval/rejection.
- Supports up to 3 images in the chat flow.

## UI surface map

### `AppShell`

- Loads session from `sessionStorage` or `/api/auth/me`, with refresh attempt.
- Has dev session fallback for dev bypass host.
- Owns mobile nav groups:
  - Main: Home, Dashboard, AI
  - Booking: Categories, Packages, Booking, Projects
  - Finance: Transactions, Wallets, Invoices, Reports
  - Management: Customers, Users, Completed Bookings, Equipment, Notifications, Trash
- Global search calls `/api/search` with debounce.

### `ModuleHome`

- Fetches `/api/dashboard?chartMode=month` through `cachedFetch`.
- Shows upcoming bookings and recent transactions.
- Quick links to booking, projects, invoices, transactions, customers, wallets, dashboard, AI.

### `DashboardView`

- Calls `/api/dashboard` and `/api/ai/insights`.
- STAFF sees upcoming schedule rather than finance stats.
- Non-staff sees income, expense, profit, debt, revenue chart, CSV link.

### `ResourceManager`

Large generic CRUD UI for resource modules. It handles:

- Dynamic fields from `RESOURCE_CONFIG`.
- Media picker/gallery fields.
- Cursor pagination/progressive list.
- Local filters/search/date filtering.
- Transactions split into income/expense views.
- Wallet shift interactions and receipt/QR helpers.
- Focused item behavior from global search/home.

### `BookingPage`

Special booking UI with:

- Customer search/pick from CRM and `/api/search`.
- Package/category selection.
- Personal/group booking note conventions.
- Discount calculation.
- Complete booking flow with receipt/invoice snapshot.

### `UserManagement`

ADMIN-only employee + account management:

- Employee info, salary, gallery/avatar.
- Optional linked login account.
- Role/status/password management.
- Soft/hard delete.

### `ProfilePage`

Profile/studio settings:

- User profile update.
- Studio info update for non-STAFF.
- Avatar upload/crop.
- Push subscription management.
- Password and studio password change.
- Login session management.
- Activity log summary.

### `TrashView`

Aggregates soft-deleted generic resources plus categories/packages.

- Restore is available for generic resources through `PATCH /api/resources/[resource]`.
- Categories/packages are listed but not restored by this component.
- Hard delete calls the relevant endpoint with `mode: hard`.
- Groups booking-group trash items by note marker.

### `ReportsView` / `system-overview.tsx`

- CSV export cards.
- System health.
- JSON backup and import/restore flow.
- Import flow creates a safety backup first.

## Invariants to preserve when changing code

- **Tenant scoping:** Every data query/mutation must scope by `studioId` unless intentionally global.
- **Soft delete:** Most operational models use `deletedAt`; normal lists should filter `deletedAt: null`.
- **Role boundaries:** STAFF must not view finance exports/search/AI finance answers.
- **Wallet consistency:** Any create/update/delete/trash of approved income/expense transactions must update wallet balances and wallet shift snapshots.
- **Booking completion consistency:** Completed booking should stay synchronized with project, invoice, invoice item, transaction, customer totalSpent, wallet, and audit log.
- **Cache invalidation:** Mutations affecting dashboard figures should invalidate `dashboard:` cache.
- **Auditability:** Mutating APIs generally call `writeAuditLog`.
- **Session cookies:** Auth cookies are HTTP-only and should not be moved into client-readable storage.
- **Media safety:** Production should use Cloudinary/S3-like storage; local upload fallback is guarded by deploy safety.
- **Search privacy:** Finance search results must stay hidden for STAFF.

## High-risk areas

- `app/components/resources/resource-manager.tsx` is very large and mixes generic CRUD, transaction/wallet behavior, media, receipt rendering, and UI state. Small changes can affect many modules.
- `app/lib/finance-workflow.ts` is critical for money correctness.
- `app/api/bookings/route.ts` denormalizes package/category data and triggers finance side effects on `COMPLETED`.
- `app/lib/resource-route-handlers.ts` powers many CRUD modules; changes there affect all generic resources.
- `app/api/search/route.ts` uses raw SQL with a `vi_unaccent` DB function assumption.
- `app/api/reports/route.ts` uses TSV with UTF-16LE BOM despite `text/csv` content type; this appears intentional for Excel.
- `docs/studio-saas-refactor.md` describes a target/refactor state that does not perfectly match current implementation. Treat it as design direction, not current truth.

## Useful file index

- `package.json`: scripts and dependency versions.
- `next.config.ts`: PWA, image domains, allowed dev origins.
- `proxy.ts`: API auth gate and security headers.
- `prisma/schema.prisma`: database schema.
- `app/lib/auth.ts`: auth/session/roles/studio password.
- `app/lib/prisma.ts`: Prisma singleton.
- `app/lib/resource-route-handlers.ts`: generic CRUD.
- `app/lib/resources.ts`: generic resource server config.
- `app/lib/studio-config.ts`: generic resource UI config.
- `app/lib/finance-workflow.ts`: wallet, invoice debt, booking finalization.
- `app/lib/ai-studio.ts`: AI context, policy, memory, suggestions.
- `app/components/layout/app-shell.tsx`: app chrome/navigation/search/session.
- `app/page.tsx`: root dynamic view router.
- `app/components/resources/resource-manager.tsx`: generic module UI.
- `app/components/catalog/booking-page.tsx`: booking-specific UI.
- `app/components/dashboard/dashboard-view.tsx`: dashboard UI.
- `app/components/dashboard/system-overview.tsx`: reports/backup/system UI.
