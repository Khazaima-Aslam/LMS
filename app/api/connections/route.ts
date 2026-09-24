import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import {
  deleteUserConnectionConfig,
  getUserConnectionConfig,
  saveUserConnectionConfig,
} from "@/lib/connectionStore";
import { testApifyConnection } from "@/lib/apify";
import { testGoogleSheetConnection } from "@/lib/googleSheets";
import {
  maskedConnectionStatus,
  normalizeGoogleCredentialInput,
  normalizeSpreadsheetId,
  type UserConnectionConfig,
} from "@/lib/userConnections";

function publicStatus(config: UserConnectionConfig | null) {
  const status = maskedConnectionStatus(config);

  let googleServiceAccountEmail = "";
  if (config?.googleServiceAccountJson) {
    try {
      googleServiceAccountEmail = String(
        JSON.parse(config.googleServiceAccountJson)?.client_email || ""
      );
    } catch {
      googleServiceAccountEmail = "";
    }
  }

  return {
    ...status,
    googleServiceAccountEmail,
  };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed.";
  const status =
    /required|invalid|must be|not configured|permission|403|404/i.test(message)
      ? 400
      : 500;

  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET() {
  const session = await requireApiAuth();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const config = await getUserConnectionConfig(session);
    return NextResponse.json({ ok: true, connection: publicStatus(config) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  const session = await requireApiAuth();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const existing = await getUserConnectionConfig(session);

    const apifyToken =
      String(body?.apifyToken || "").trim() || existing?.apifyToken || "";
    const apifyActorId =
      String(body?.apifyActorId || "").trim() ||
      existing?.apifyActorId ||
      "compass/crawler-google-places";

    const spreadsheetId = normalizeSpreadsheetId(
      String(body?.googleSpreadsheetId || "").trim() ||
        existing?.googleSpreadsheetId ||
        ""
    );

    const googleSheetTab =
      String(body?.googleSheetTab || "").trim() ||
      existing?.googleSheetTab ||
      "Leads";

    let googleServiceAccountJson =
      existing?.googleServiceAccountJson || "";

    const incomingGoogleCredentials = String(
      body?.googleServiceAccountJson || ""
    ).trim();

    if (incomingGoogleCredentials) {
      googleServiceAccountJson = normalizeGoogleCredentialInput(
        incomingGoogleCredentials
      ).json;
    }

    if (!apifyToken) throw new Error("Apify API token is required.");
    if (!spreadsheetId) throw new Error("Google Spreadsheet URL or ID is required.");
    if (!googleServiceAccountJson) {
      throw new Error("Google service-account JSON is required.");
    }

    const config: UserConnectionConfig = {
      apifyToken,
      apifyActorId,
      googleSpreadsheetId: spreadsheetId,
      googleSheetTab,
      googleServiceAccountJson,
    };

    await testApifyConnection({
      token: config.apifyToken,
      actorId: config.apifyActorId,
    });

    const googleTest = await testGoogleSheetConnection({
      serviceAccountJson: config.googleServiceAccountJson,
      spreadsheetId: config.googleSpreadsheetId,
      tab: config.googleSheetTab,
    });

    await saveUserConnectionConfig(session, config);

    return NextResponse.json({
      ok: true,
      connection: {
        ...publicStatus(config),
        googleServiceAccountEmail: googleTest.serviceAccountEmail,
      },
      message: "Your Apify and Google Sheets connections were tested and saved.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  const session = await requireApiAuth();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    await deleteUserConnectionConfig(session);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
