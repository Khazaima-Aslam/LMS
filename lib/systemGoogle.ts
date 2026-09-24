import { google } from "googleapis";

function systemSpreadsheetId() {
  const value =
    process.env.SYSTEM_GOOGLE_SPREADSHEET_ID ||
    process.env.GOOGLE_SPREADSHEET_ID ||
    "";
  const trimmed = value.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || trimmed;
}

function loadSystemCredentials() {
  const base64 =
    process.env.SYSTEM_GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim() ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  const raw =
    process.env.SYSTEM_GOOGLE_SERVICE_ACCOUNT_JSON?.trim() ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();

  if (!base64 && !raw) {
    throw new Error(
      "LeadFlow system storage is not configured. Add SYSTEM_GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 in Vercel."
    );
  }

  try {
    const json = base64
      ? Buffer.from(base64, "base64").toString("utf8")
      : raw!;
    const parsed = JSON.parse(json);
    if (!parsed?.client_email || !parsed?.private_key) {
      throw new Error("missing fields");
    }
    return parsed;
  } catch {
    throw new Error("LeadFlow system Google service-account JSON is invalid.");
  }
}

export function systemStorageConfigured() {
  return Boolean(
    systemSpreadsheetId() &&
      (process.env.SYSTEM_GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 ||
        process.env.SYSTEM_GOOGLE_SERVICE_ACCOUNT_JSON ||
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 ||
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  );
}

export async function systemSheetsContext() {
  const spreadsheetId = systemSpreadsheetId();
  if (!spreadsheetId) {
    throw new Error(
      "LeadFlow system storage is not configured. Add SYSTEM_GOOGLE_SPREADSHEET_ID in Vercel."
    );
  }

  const credentials = loadSystemCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "spreadsheetId",
  });

  return {
    sheets,
    spreadsheetId,
    serviceAccountEmail: String(credentials.client_email || ""),
  };
}
