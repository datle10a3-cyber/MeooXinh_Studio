export type CategoryItem = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
};

export type PackageItem = {
  id: string;
  name: string;
  categoryId: string;
  price: string | number;
  description?: string | null;
  duration?: string | null;
  suitableFor?: string | null;
  includes?: string | null;
  deliverables?: string | null;
  outfitCount?: string | null;
  peopleCount?: string | null;
  location?: string | null;
  customerNote?: string | null;
  imageUrl?: string | null;
  galleryUrls?: string | null;
  createdAt: string;
  category: CategoryItem;
};

export type BookingItem = {
  id: string;
  customerId?: string | null;
  customerName?: string | null;
  imageUrl?: string | null;
  packageId?: string | null;
  packageName?: string | null;
  categoryName?: string | null;
  price: string | number;
  total?: string | number | null;
  deposit?: string | number | null;
  startTime?: string | null;
  endTime?: string | null;
  note?: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
  customer?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  } | null;
  package?: (PackageItem & { category?: CategoryItem }) | null;
  invoiceCode?: string | null;
  invoiceIssueDate?: string | null;
  invoiceCustomerName?: string | null;
  invoicePackageName?: string | null;
  invoiceCategoryName?: string | null;
  invoiceTotal?: string | number | null;
  invoiceItems?: Array<{ description: string; quantity: number; total: string | number }>;
};

export type ApiResult<T> = {
  data?: T;
  error?: { message: string };
};


