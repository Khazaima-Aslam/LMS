import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { testGoogleSheetConnection } from "@/lib/googleSheets";
import { getUserConnectionConfig } from "@/lib/connectionStore";

export async function POST() {
  const session = await requireApiAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const connection = await getUserConnectionConfig(session);
    if (!connection) {
      return NextResponse.json(
        { error: "No saved Google Sheets connection. Open My Connections first." },
        { status: 400 }
      );
    }

    const result = await testGoogleSheetConnection({
      serviceAccountJson: connection.googleServiceAccountJson,
      spreadsheetId: connection.googleSpreadsheetId,
      tab: connection.googleSheetTab,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google test failed." },
      { status: 500 }
    );
  }
}
