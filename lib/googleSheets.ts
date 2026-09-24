import { google } from "googleapis";
import { normalizeSpreadsheetId } from "@/lib/userConnections";
import { LEAD_HEADERS, type Lead } from "@/lib/types";

export type UserGoogleSheetConfig = {
  serviceAccountJson: string;
  spreadsheetId: string;
  tab?: string;
};

function loadCredentials(jsonValue: string) {
  try {
    const credentials = JSON.parse(String(jsonValue || ""));
    if (!credentials?.client_email || !credentials?.private_key) {
      throw new Error("missing fields");
    }
    return credentials;
  } catch {
    throw new Error("Your saved Google service-account JSON is invalid.");
  }
}

function sheetsClient(config: UserGoogleSheetConfig) {
  const credentials = loadCredentials(config.serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return {
    sheets: google.sheets({ version: "v4", auth }),
    credentials,
  };
}

function quoteSheetName(name: string) {
  return "'" + name.replace(/'/g, "''") + "'";
}

export async function ensureLeadSheet(config: UserGoogleSheetConfig) {
  const spreadsheetId = normalizeSpreadsheetId(config.spreadsheetId);
  const tab = String(config.tab || "Leads").trim() || "Leads";
  if (!spreadsheetId) throw new Error("Your Google Spreadsheet ID is missing.");

  const { sheets, credentials } = sheetsClient(config);
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });

  const exists = (meta.data.sheets || []).some(
    (s) => s.properties?.title === tab
  );

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tab } } }],
      },
    });
  }

  const range = quoteSheetName(tab) + "!A1:I1";
  const header = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const current = header.data.values?.[0] || [];
  const required = [...LEAD_HEADERS];
  const same =
    current.length >= required.length &&
    required.every((h, i) => current[i] === h);

  if (!same) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values: [required] },
    });
  }

  return {
    sheets,
    spreadsheetId,
    tab,
    serviceAccountEmail: String(credentials.client_email || ""),
  };
}

function rowFromLead(lead: Lead) {
  return [
    lead.businessName,
    lead.category,
    lead.fullAddress,
    lead.city,
    lead.country,
    lead.mobile,
    lead.landline,
    lead.email,
    lead.phone,
  ].map((v) => String(v || "").trim());
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function keyForRow(row: string[]) {
  const name = normalize(row[0] || "");
  const address = normalize(row[2] || "");
  const city = normalize(row[3] || "");
  const country = normalize(row[4] || "");
  return name + "|" + (address || city + "|" + country);
}

function mergeBlankOnly(existing: string[], incoming: string[]) {
  return Array.from({ length: LEAD_HEADERS.length }, (_, i) => {
    const oldValue = String(existing[i] || "").trim();
    return oldValue || String(incoming[i] || "").trim();
  });
}

export async function syncLeadsToGoogleSheet(
  leads: Lead[],
  config: UserGoogleSheetConfig
) {
  const { sheets, spreadsheetId, tab } = await ensureLeadSheet(config);
  const dataRange = quoteSheetName(tab) + "!A2:I";

  const existingRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: dataRange,
  });

  const existingRows = (existingRes.data.values || []).map((row) =>
    Array.from({ length: LEAD_HEADERS.length }, (_, i) =>
      String(row[i] || "")
    )
  );

  const existingMap = new Map<
    string,
    { rowNumber: number; row: string[] }
  >();

  existingRows.forEach((row, index) => {
    if (!String(row[0] || "").trim()) return;
    const key = keyForRow(row);
    if (key && !existingMap.has(key)) {
      existingMap.set(key, { rowNumber: index + 2, row });
    }
  });

  const updates: { range: string; values: string[][] }[] = [];
  const newRowsMap = new Map<string, string[]>();
  let unchanged = 0;

  for (const lead of leads) {
    const incoming = rowFromLead(lead);
    const key = keyForRow(incoming);
    if (!key || !incoming[0]) continue;

    const existing = existingMap.get(key);
    if (existing) {
      const merged = mergeBlankOnly(existing.row, incoming);
      const changed = merged.some((v, i) => v !== existing.row[i]);

      if (changed) {
        updates.push({
          range:
            quoteSheetName(tab) +
            "!A" +
            existing.rowNumber +
            ":I" +
            existing.rowNumber,
          values: [merged],
        });
        existing.row = merged;
      } else {
        unchanged += 1;
      }
      continue;
    }

    const pending = newRowsMap.get(key);
    if (pending) {
      newRowsMap.set(key, mergeBlankOnly(pending, incoming));
    } else {
      newRowsMap.set(key, incoming);
    }
  }

  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: updates,
      },
    });
  }

  const newRows = [...newRowsMap.values()];
  if (newRows.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: quoteSheetName(tab) + "!A:I",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: newRows },
    });
  }

  return {
    appended: newRows.length,
    updated: updates.length,
    unchanged,
    processed: leads.length,
  };
}

export async function testGoogleSheetConnection(
  config: UserGoogleSheetConfig
) {
  const info = await ensureLeadSheet(config);
  return {
    ok: true,
    serviceAccountEmail: info.serviceAccountEmail,
    spreadsheetId: info.spreadsheetId,
    tab: info.tab,
  };
}
