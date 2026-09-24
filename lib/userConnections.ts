import crypto from "node:crypto";

export type UserConnectionConfig = {
  apifyToken: string;
  apifyActorId: string;
  googleSpreadsheetId: string;
  googleSheetTab: string;
  googleServiceAccountJson: string;
};

export type ConnectionSessionIdentity = {
  username: string;
  source: "master" | "managed";
};

export function profileKeyForSession(session: ConnectionSessionIdentity) {
  const username = String(session.username || "").trim().toLowerCase();
  return session.source + ":" + username;
}

export function normalizeSpreadsheetId(value: string) {
  const trimmed = String(value || "").trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || trimmed;
}

export function normalizeGoogleCredentialInput(value: string) {
  const input = String(value || "").trim();
  if (!input) {
    throw new Error("Google service-account JSON is required.");
  }

  let jsonText = input;

  if (!input.startsWith("{")) {
    try {
      jsonText = Buffer.from(input, "base64").toString("utf8");
    } catch {
      throw new Error("Google credentials must be JSON or Base64 JSON.");
    }
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    throw new Error("Google service-account credentials are not valid JSON.");
  }

  if (
    parsed.type !== "service_account" ||
    !String(parsed.client_email || "").trim() ||
    !String(parsed.private_key || "").trim()
  ) {
    throw new Error(
      "Google credentials must be a service-account JSON key with client_email and private_key."
    );
  }

  return {
    json: JSON.stringify(parsed),
    clientEmail: String(parsed.client_email),
  };
}

function encryptionKey(secretValue: string) {
  const secret = String(secretValue || "").trim();
  if (!secret) {
    throw new Error("AUTH_SECRET is required to encrypt user connections.");
  }

  return crypto
    .createHash("sha256")
    .update("leadflow:user-connections:v1:" + secret)
    .digest();
}

export function encryptUserConnectionConfig(
  config: UserConnectionConfig,
  secretValue: string
) {
  const key = encryptionKey(secretValue);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(config), "utf8");
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptUserConnectionConfig(
  encrypted: string,
  secretValue: string
): UserConnectionConfig {
  const [version, ivValue, tagValue, ciphertextValue] = String(
    encrypted || ""
  ).split(".");

  if (
    version !== "v1" ||
    !ivValue ||
    !tagValue ||
    !ciphertextValue
  ) {
    throw new Error("Saved connection settings are invalid.");
  }

  try {
    const key = encryptionKey(secretValue);
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivValue, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");

    const parsed = JSON.parse(plaintext) as UserConnectionConfig;

    if (
      !parsed.apifyToken ||
      !parsed.apifyActorId ||
      !parsed.googleSpreadsheetId ||
      !parsed.googleSheetTab ||
      !parsed.googleServiceAccountJson
    ) {
      throw new Error("Incomplete connection settings.");
    }

    return parsed;
  } catch {
    throw new Error("Saved connection settings could not be decrypted.");
  }
}

export function maskedConnectionStatus(config: UserConnectionConfig | null) {
  if (!config) {
    return {
      configured: false,
      apifyConfigured: false,
      googleConfigured: false,
      googleSpreadsheetId: "",
      googleSheetTab: "Leads",
      apifyActorId: "compass/crawler-google-places",
    };
  }

  return {
    configured: true,
    apifyConfigured: Boolean(config.apifyToken),
    googleConfigured: Boolean(
      config.googleServiceAccountJson && config.googleSpreadsheetId
    ),
    googleSpreadsheetId: config.googleSpreadsheetId,
    googleSheetTab: config.googleSheetTab,
    apifyActorId: config.apifyActorId,
  };
}
