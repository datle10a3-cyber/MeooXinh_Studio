export type ResourceKey =
  | "customers"
  | "services"
  | "bookings"
  | "transactions"
  | "wallets"
  | "projects"
  | "invoices"
  | "employees"
  | "equipment"
  | "notifications";

export type FieldType = "text" | "number" | "textarea" | "select" | "boolean" | "date" | "datetime" | "image" | "gallery";

export type FieldConfig = {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: string[];
};

export type ResourceConfig = {
  label: string;
  shortLabel: string;
  group: "Vận hành" | "Tài chính" | "Khách hàng" | "Tài sản" | "Hệ thống";
  description: string;
  workflowHint: string;
  related: ResourceKey[];
  primaryField: string;
  secondaryField?: string;
  imageField?: string;
  tableFields: string[];
  moneyFields?: string[];
  fields: FieldConfig[];
};

export const RESOURCE_CONFIG: Record<ResourceKey, ResourceConfig> = {
  customers: {
    label: "Khách hàng",
    shortLabel: "khách hàng",
    group: "Khách hàng",
    description: "Lưu hồ sơ khách, ảnh đại diện, nguồn khách và ghi chú chăm sóc.",
    workflowHint: "Bắt đầu ở đây: tạo khách trước, sau đó tạo booking hoặc hóa đơn cho khách.",
    related: ["bookings", "projects", "invoices"],
    primaryField: "name",
    secondaryField: "phone",
    imageField: "avatarUrl",
    tableFields: ["name", "phone", "email", "source", "totalSpent"],
    moneyFields: ["totalSpent"],
    fields: [
      { key: "avatarUrl", label: "Ảnh đại diện", type: "image", placeholder: "Upload hoặc chọn ảnh khách hàng" },
      { key: "galleryUrls", label: "Ảnh phụ", type: "gallery" },
      { key: "name", label: "Tên khách", type: "text", placeholder: "Nguyễn Minh Anh" },
      { key: "phone", label: "Số điện thoại", type: "text", placeholder: "09..." },
      { key: "email", label: "Email", type: "text", placeholder: "khach@example.com" },
      { key: "source", label: "Nguồn khách", type: "text", placeholder: "Facebook, TikTok, giới thiệu..." },
      { key: "totalSpent", label: "Tổng đã chi", type: "number", placeholder: "0" },
      { key: "note", label: "Ghi chú chăm sóc", type: "textarea" },
    ],
  },
  bookings: {
    label: "Booking",
    shortLabel: "booking",
    group: "Vận hành",
    description: "Đặt lịch chụp, phòng, ekip, ảnh concept, tiền cọc và trạng thái.",
    workflowHint: "Sau khi có khách, tạo booking để giữ lịch. Booking hoàn tất sẽ được theo dõi tiếp ở Dự án.",
    related: ["customers", "projects", "employees", "equipment"],
    primaryField: "title",
    secondaryField: "studioRoom",
    imageField: "imageUrl",
    tableFields: ["title", "studioRoom", "startAt", "status", "deposit"],
    moneyFields: ["deposit", "total"],
    fields: [
      { key: "imageUrl", label: "Ảnh concept", type: "image", placeholder: "Upload ảnh concept hoặc moodboard" },
      { key: "galleryUrls", label: "Ảnh phụ", type: "gallery" },
      { key: "title", label: "Tên lịch", type: "text", placeholder: "Chụp cưới khách Minh Anh" },
      { key: "studioRoom", label: "Phòng / chi nhánh", type: "text", placeholder: "Studio A" },
      { key: "startAt", label: "Bắt đầu", type: "datetime" },
      { key: "endAt", label: "Kết thúc", type: "datetime" },
      { key: "status", label: "Trạng thái", type: "select", options: ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] },
      { key: "deposit", label: "Tiền cọc", type: "number", placeholder: "0" },
      { key: "total", label: "Tổng tiền", type: "number", placeholder: "0" },
      { key: "note", label: "Ghi chú ekip", type: "textarea" },
    ],
  },
  projects: {
    label: "Dự án / Job",
    shortLabel: "dự án",
    group: "Vận hành",
    description: "Theo dõi công việc sau booking: tiến độ, deadline, bàn giao và công nợ.",
    workflowHint: "Dùng để quản lý job sau khi khách đã đặt lịch: ai làm, hạn bàn giao, còn nợ bao nhiêu.",
    related: ["bookings", "invoices", "employees", "customers"],
    primaryField: "name",
    secondaryField: "code",
    imageField: "coverUrl",
    tableFields: ["code", "name", "status", "amount", "dueAmount"],
    moneyFields: ["amount", "dueAmount"],
    fields: [
      { key: "coverUrl", label: "Ảnh bìa dự án", type: "image", placeholder: "Upload ảnh đại diện dự án" },
      { key: "galleryUrls", label: "Ảnh phụ", type: "gallery" },
      { key: "code", label: "Mã dự án", type: "text", placeholder: "JOB-001" },
      { key: "name", label: "Tên dự án", type: "text" },
      { key: "status", label: "Trạng thái", type: "select", options: ["PENDING", "IN_PROGRESS", "REVIEW", "DELIVERED", "CANCELLED"] },
      { key: "amount", label: "Tổng giá trị", type: "number", placeholder: "0" },
      { key: "dueAmount", label: "Còn nợ", type: "number", placeholder: "0" },
      { key: "deadlineAt", label: "Hạn bàn giao", type: "date" },
      { key: "folderUrl", label: "Link thư mục file", type: "text" },
      { key: "note", label: "Ghi chú sản xuất", type: "textarea" },
    ],
  },
  invoices: {
    label: "Hóa đơn và công nợ",
    shortLabel: "hóa đơn",
    group: "Tài chính",
    description: "Quản lý hóa đơn, ảnh hóa đơn, đã thu, còn nợ và hạn thanh toán.",
    workflowHint: "Tạo hóa đơn sau booking hoặc dự án, theo dõi phần đã thanh toán và còn nợ.",
    related: ["customers", "projects", "transactions"],
    primaryField: "code",
    secondaryField: "status",
    imageField: "imageUrl",
    tableFields: ["code", "status", "total", "paid", "due"],
    moneyFields: ["subtotal", "discount", "tax", "total", "paid", "due"],
    fields: [
      { key: "imageUrl", label: "Ảnh hóa đơn", type: "image", placeholder: "Upload ảnh hóa đơn hoặc biên nhận" },
      { key: "galleryUrls", label: "Ảnh phụ", type: "gallery" },
      { key: "code", label: "Mã hóa đơn", type: "text", placeholder: "INV-001" },
      { key: "status", label: "Trạng thái", type: "select", options: ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"] },
      { key: "issueDate", label: "Ngày xuất", type: "date" },
      { key: "dueDate", label: "Hạn thanh toán", type: "date" },
      { key: "total", label: "Tổng tiền", type: "number", placeholder: "0" },
      { key: "paid", label: "Đã thanh toán", type: "number", placeholder: "0" },
      { key: "due", label: "Còn nợ", type: "number", placeholder: "0" },
      { key: "pdfUrl", label: "Link PDF", type: "text" },
      { key: "note", label: "Ghi chú hóa đơn", type: "textarea" },
    ],
  },
  transactions: {
    label: "Thu chi",
    shortLabel: "giao dịch",
    group: "Tài chính",
    description: "Ghi nhận khoản thu, khoản chi, ảnh chứng từ và trạng thái duyệt.",
    workflowHint: "Khi khách thanh toán hoặc studio phát sinh chi phí, ghi ở đây để dashboard và ví tiền cập nhật số liệu.",
    related: ["wallets", "invoices"],
    primaryField: "title",
    secondaryField: "walletId",
    imageField: "imageUrl",
    tableFields: ["title", "type", "amount", "walletId", "approvalStatus", "occurredAt"],
    moneyFields: ["amount"],
    fields: [
      { key: "imageUrl", label: "Ảnh minh chứng", type: "image", placeholder: "Upload ảnh hóa đơn hoặc biên lai" },
      { key: "galleryUrls", label: "Ảnh phụ", type: "gallery" },
      { key: "title", label: "Nội dung giao dịch", type: "text", placeholder: "Thu tiền cọc / Chi lương..." },
      { key: "type", label: "Loại giao dịch", type: "select", options: ["INCOME", "EXPENSE", "TRANSFER"] },
      { key: "amount", label: "Số tiền", type: "number", placeholder: "0" },
      { key: "walletId", label: "Ví nhận / ví chi", type: "select", options: [] },
      { key: "approvalStatus", label: "Trạng thái duyệt", type: "select", options: ["DRAFT", "PENDING", "APPROVED", "REJECTED"] },
      { key: "occurredAt", label: "Ngày phát sinh", type: "datetime" },
      { key: "attachmentUrl", label: "Link chứng từ", type: "text" },
      { key: "note", label: "Lý do chi / ghi chú", type: "textarea" },
    ],
  },
  wallets: {
    label: "Ví và quỹ tiền",
    shortLabel: "ví/quỹ",
    group: "Tài chính",
    description: "Theo dõi tiền mặt, ngân hàng, ví điện tử, ảnh minh chứng và số dư.",
    workflowHint: "Dùng để biết tiền đang nằm ở đâu: tiền mặt, ngân hàng, ví điện tử hoặc quỹ nội bộ.",
    related: ["transactions", "invoices"],
    primaryField: "name",
    secondaryField: "type",
    tableFields: ["name", "type", "balance", "isActive"],
    moneyFields: ["openingBalance", "balance"],
    fields: [
      { key: "name", label: "Tên ví / quỹ", type: "text", placeholder: "Tiền mặt, Vietcombank, Momo..." },
      { key: "type", label: "Loại quỹ", type: "text", placeholder: "Tiền mặt / Ngân hàng / Ví điện tử" },
      { key: "bankName", label: "Ngân hàng", type: "text" },
      { key: "accountNo", label: "Số tài khoản", type: "text" },
      { key: "openingBalance", label: "Số dư đầu kỳ", type: "number", placeholder: "0" },
      { key: "balance", label: "Số dư hiện tại", type: "number", placeholder: "0" },
      { key: "isActive", label: "Đang sử dụng", type: "boolean", options: ["true", "false"] },
    ],
  },
  services: {
    label: "Dịch vụ và gói chụp",
    shortLabel: "dịch vụ",
    group: "Vận hành",
    description: "Quản lý gói chụp, bảng giá, ảnh sản phẩm, combo và khuyến mãi.",
    workflowHint: "Tạo gói dịch vụ trước để khi tư vấn khách có bảng giá rõ ràng và đồng bộ.",
    related: ["bookings", "customers"],
    primaryField: "name",
    secondaryField: "category",
    imageField: "imageUrl",
    tableFields: ["name", "category", "price", "promoPrice", "isActive"],
    moneyFields: ["price", "promoPrice"],
    fields: [
      { key: "imageUrl", label: "Ảnh gói dịch vụ", type: "image", placeholder: "Upload ảnh sản phẩm hoặc concept" },
      { key: "galleryUrls", label: "Ảnh phụ", type: "gallery" },
      { key: "name", label: "Tên gói", type: "text", placeholder: "Gói cưới premium" },
      { key: "category", label: "Danh mục", type: "text", placeholder: "Cưới / Concept / Studio" },
      { key: "description", label: "Mô tả quyền lợi", type: "textarea" },
      { key: "price", label: "Giá gốc", type: "number", placeholder: "0" },
      { key: "promoPrice", label: "Giá ưu đãi", type: "number", placeholder: "0" },
      { key: "durationMin", label: "Thời lượng phút", type: "number", placeholder: "120" },
      { key: "isActive", label: "Đang bán", type: "boolean", options: ["true", "false"] },
    ],
  },
  employees: {
    label: "Nhân sự",
    shortLabel: "nhân sự",
    group: "Hệ thống",
    description: "Thông tin nhân viên, ảnh đại diện, chức vụ, lương và lịch làm.",
    workflowHint: "Dùng để phân công ekip cho booking, dự án và theo dõi chi phí nhân sự.",
    related: ["bookings", "projects"],
    primaryField: "name",
    secondaryField: "position",
    imageField: "avatarUrl",
    tableFields: ["name", "position", "salaryType", "baseSalary"],
    moneyFields: ["baseSalary"],
    fields: [
      { key: "avatarUrl", label: "Ảnh nhân sự", type: "image", placeholder: "Upload ảnh nhân viên" },
      { key: "galleryUrls", label: "Ảnh phụ", type: "gallery" },
      { key: "name", label: "Tên nhân viên", type: "text" },
      { key: "phone", label: "Số điện thoại", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "position", label: "Chức vụ", type: "text" },
      { key: "salaryType", label: "Kiểu lương", type: "select", options: ["FIXED", "PER_PROJECT", "HOURLY"] },
      { key: "baseSalary", label: "Lương cơ bản", type: "number", placeholder: "0" },
      { key: "workSchedule", label: "Lịch làm", type: "text" },
      { key: "note", label: "Ghi chú nhân sự", type: "textarea" },
    ],
  },
  equipment: {
    label: "Thiết bị",
    shortLabel: "thiết bị",
    group: "Tài sản",
    description: "Máy ảnh, lens, đèn, ảnh thiết bị, serial và trạng thái bảo trì.",
    workflowHint: "Dùng để biết thiết bị nào đang rảnh, đang dùng hoặc cần bảo trì trước buổi chụp.",
    related: ["bookings", "projects"],
    primaryField: "name",
    secondaryField: "type",
    imageField: "imageUrl",
    tableFields: ["name", "type", "serial", "status"],
    fields: [
      { key: "imageUrl", label: "Ảnh thiết bị", type: "image", placeholder: "Upload ảnh thiết bị" },
      { key: "galleryUrls", label: "Ảnh phụ", type: "gallery" },
      { key: "name", label: "Tên thiết bị", type: "text" },
      { key: "type", label: "Loại thiết bị", type: "text" },
      { key: "serial", label: "Serial", type: "text" },
      { key: "status", label: "Tình trạng", type: "select", options: ["AVAILABLE", "IN_USE", "MAINTENANCE", "BROKEN"] },
      { key: "assignedTo", label: "Đang giao cho", type: "text" },
      { key: "note", label: "Ghi chú thiết bị", type: "textarea" },
    ],
  },
  notifications: {
    label: "Thông báo và nhắc việc",
    shortLabel: "thông báo",
    group: "Hệ thống",
    description: "Nhắc lịch, nhắc thanh toán, ảnh minh chứng và luồng duyệt nội bộ.",
    workflowHint: "Dùng để nhắc việc quan trọng: lịch chụp, thanh toán, công nợ và duyệt chi.",
    related: ["bookings", "invoices", "transactions"],
    primaryField: "title",
    secondaryField: "type",
    imageField: "imageUrl",
    tableFields: ["title", "type", "isRead", "dueAt"],
    fields: [
      { key: "imageUrl", label: "Ảnh đính kèm", type: "image", placeholder: "Upload ảnh minh chứng" },
      { key: "galleryUrls", label: "Ảnh phụ", type: "gallery" },
      { key: "title", label: "Tiêu đề", type: "text" },
      { key: "message", label: "Nội dung", type: "textarea" },
      { key: "type", label: "Loại thông báo", type: "select", options: ["BOOKING", "PAYMENT", "DEBT", "APPROVAL", "SYSTEM"] },
      { key: "isRead", label: "Đã đọc", type: "boolean", options: ["true", "false"] },
      { key: "dueAt", label: "Thời gian nhắc", type: "datetime" },
    ],
  },
};
