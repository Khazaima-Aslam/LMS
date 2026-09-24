export type ManagedRole = "admin" | "user";

export type ManagedUserPrivate = {
  username: string;
  displayName: string;
  role: ManagedRole;
  passwordSalt: string;
  passwordHash: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ManagedUserPublic = Omit<
  ManagedUserPrivate,
  "passwordSalt" | "passwordHash"
>;

export const MANAGED_USER_HEADERS = [
  "Username",
  "Display Name",
  "Role",
  "Password Salt",
  "Password Hash",
  "Active",
  "Created At",
  "Updated At",
] as const;

export function normalizeManagedRole(value: string): ManagedRole {
  const role = String(value || "").trim().toLowerCase();
  if (role !== "admin" && role !== "user") {
    throw new Error("Role must be admin or user.");
  }
  return role;
}

function parseActive(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["true", "1", "yes", "active"].includes(normalized);
}

export function privateUserFromRow(row: unknown[]): ManagedUserPrivate {
  return {
    username: String(row[0] || "").trim(),
    displayName: String(row[1] || "").trim(),
    role: normalizeManagedRole(String(row[2] || "user")),
    passwordSalt: String(row[3] || "").trim(),
    passwordHash: String(row[4] || "").trim(),
    active: parseActive(row[5]),
    createdAt: String(row[6] || "").trim(),
    updatedAt: String(row[7] || "").trim(),
  };
}

export function publicUserFromPrivate(
  user: ManagedUserPrivate
): ManagedUserPublic {
  return {
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function userToRow(user: ManagedUserPrivate) {
  return [
    user.username,
    user.displayName,
    user.role,
    user.passwordSalt,
    user.passwordHash,
    user.active ? "TRUE" : "FALSE",
    user.createdAt,
    user.updatedAt,
  ];
}
