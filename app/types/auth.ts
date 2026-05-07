export type CurrentSession = {
  user: {
    id: string;
    studioId: string;
    role: "ADMIN" | "MANAGER" | "STAFF";
    name: string;
    email: string;
    phone?: string | null;
    avatarUrl?: string | null;
  };
  studio: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
};

export function canMutate(session: CurrentSession | null) {
  return session?.user.role === "ADMIN" || session?.user.role === "MANAGER" || session?.user.role === "STAFF";
}

export function canCreate(session: CurrentSession | null) {
  return session?.user.role === "ADMIN" || session?.user.role === "MANAGER";
}

export function canDelete(session: CurrentSession | null) {
  return session?.user.role === "ADMIN";
}
