import { systemSheetsContext } from "@/lib/systemGoogle";
import {
  decryptUserConnectionConfig,
  encryptUserConnectionConfig,
  profileKeyForSession,
  type ConnectionSessionIdentity,
  type UserConnectionConfig,
} from "@/lib/userConnections";

const CONNECTION_TAB = "_LeadFlowConnections";
const CONNECTION_HEADERS = [
  "Account Key",
  "Username",
  "Source",
  "Encrypted Config",
  "Updated At",
] as const;

function quoteSheetName(name: string) {
  return "'" + name.replace(/'/g, "''") + "'";
}

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured.");
  }
  return secret;
}

async function ensureConnectionSheet() {
  const { sheets, spreadsheetId } = await systemSheetsContext();

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });

  const exists = (meta.data.sheets || []).some(
    (sheet) => sheet.properties?.title === CONNECTION_TAB
  );

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: CONNECTION_TAB,
                hidden: true,
              },
            },
          },
        ],
      },
    });
  }

  const headerRange = quoteSheetName(CONNECTION_TAB) + "!A1:E1";
  const header = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: headerRange,
  });

  const current = header.data.values?.[0] || [];
  const correct = CONNECTION_HEADERS.every(
    (value, index) => current[index] === value
  );

  if (!correct) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: headerRange,
      valueInputOption: "RAW",
      requestBody: { values: [[...CONNECTION_HEADERS]] },
    });
  }

  return { sheets, spreadsheetId };
}

async function readConnectionRows() {
  const { sheets, spreadsheetId } = await ensureConnectionSheet();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: quoteSheetName(CONNECTION_TAB) + "!A2:E",
  });

  const rows = (response.data.values || []).map((row, index) => ({
    rowNumber: index + 2,
    accountKey: String(row?.[0] || "").trim(),
    username: String(row?.[1] || "").trim(),
    source: String(row?.[2] || "").trim(),
    encryptedConfig: String(row?.[3] || "").trim(),
    updatedAt: String(row?.[4] || "").trim(),
  }));

  return { sheets, spreadsheetId, rows };
}

export async function getUserConnectionConfig(
  session: ConnectionSessionIdentity
): Promise<UserConnectionConfig | null> {
  const accountKey = profileKeyForSession(session);
  const { rows } = await readConnectionRows();
  const row = rows.find((item) => item.accountKey === accountKey);

  if (!row?.encryptedConfig) return null;

  return decryptUserConnectionConfig(row.encryptedConfig, authSecret());
}

export async function saveUserConnectionConfig(
  session: ConnectionSessionIdentity,
  config: UserConnectionConfig
) {
  const accountKey = profileKeyForSession(session);
  const context = await readConnectionRows();
  const existing = context.rows.find((item) => item.accountKey === accountKey);
  const encrypted = encryptUserConnectionConfig(config, authSecret());
  const row = [
    accountKey,
    session.username,
    session.source,
    encrypted,
    new Date().toISOString(),
  ];

  if (existing) {
    await context.sheets.spreadsheets.values.update({
      spreadsheetId: context.spreadsheetId,
      range:
        quoteSheetName(CONNECTION_TAB) +
        "!A" +
        existing.rowNumber +
        ":E" +
        existing.rowNumber,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  } else {
    await context.sheets.spreadsheets.values.append({
      spreadsheetId: context.spreadsheetId,
      range: quoteSheetName(CONNECTION_TAB) + "!A:E",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  }

  return config;
}

export async function deleteUserConnectionConfig(
  session: ConnectionSessionIdentity
) {
  const accountKey = profileKeyForSession(session);
  const context = await readConnectionRows();
  const existing = context.rows.find((item) => item.accountKey === accountKey);
  if (!existing) return false;

  await context.sheets.spreadsheets.values.clear({
    spreadsheetId: context.spreadsheetId,
    range:
      quoteSheetName(CONNECTION_TAB) +
      "!A" +
      existing.rowNumber +
      ":E" +
      existing.rowNumber,
  });

  return true;
}
