export function getSpreadsheetId(value = process.env.GOOGLE_SPREADSHEET_ID || "") {
  const trimmed = value.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || trimmed;
}

export function getSheetTab() {
  return (process.env.GOOGLE_SHEET_TAB || "Leads").trim() || "Leads";
}

export function getAppName() {
  return process.env.NEXT_PUBLIC_APP_NAME || "LeadFlow";
}

export function configurationStatus() {
  return {
    portalConfigured: Boolean(
      process.env.ADMIN_USERNAME?.trim() &&
        process.env.ADMIN_PASSWORD &&
        process.env.AUTH_SECRET
    ),
    apifyConfigured: Boolean(process.env.APIFY_TOKEN),
    apifyActor: process.env.APIFY_ACTOR_ID || "compass/crawler-google-places",
    googleConfigured: Boolean(
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 ||
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    ),
    spreadsheetConfigured: Boolean(getSpreadsheetId()),
    sheetTab: getSheetTab(),
  };
}
