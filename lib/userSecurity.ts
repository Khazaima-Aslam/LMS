import crypto from "node:crypto";

const USERNAME_PATTERN = /^[a-z0-9._-]{3,50}$/;

export function normalizeManagedUsername(value: string) {
  const username = String(value || "").trim().toLowerCase();

  if (username.length < 3 || username.length > 50) {
    throw new Error("Username must be 3-50 characters.");
  }

  if (!USERNAME_PATTERN.test(username)) {
    throw new Error(
      "Username may contain only letters, numbers, dot, underscore, and hyphen."
    );
  }

  return username;
}

export function validateManagedPassword(value: string) {
  const password = String(value || "");
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  if (password.length > 200) {
    throw new Error("Password is too long.");
  }
  return password;
}

export function hashManagedPassword(passwordValue: string) {
  const password = validateManagedPassword(passwordValue);
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.scryptSync(password, salt, 64).toString("base64url");
  return { salt, hash };
}

export function verifyManagedPassword(
  passwordValue: string,
  salt: string,
  expectedHash: string
) {
  try {
    const password = String(passwordValue || "");
    if (!password || !salt || !expectedHash) return false;

    const actual = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHash, "base64url");
    return (
      actual.length === expected.length &&
      crypto.timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}
