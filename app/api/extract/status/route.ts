import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { getApifyRun, getApifyRunLeads } from "@/lib/apify";
import { syncLeadsToGoogleSheet } from "@/lib/googleSheets";
import { getUserConnectionConfig } from "@/lib/connectionStore";

const FAILED_STATUSES = new Set(["FAILED", "TIMED-OUT", "ABORTED"]);

export async function GET(request: Request) {
  const session = await requireApiAuth();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const runId = url.searchParams.get("runId")?.trim();
  const maxLeads = Math.max(
    1,
    Math.min(100, Math.round(Number(url.searchParams.get("maxLeads")) || 25))
  );

  if (!runId || !/^[A-Za-z0-9_-]{6,80}$/.test(runId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid Apify run ID." },
      { status: 400 }
    );
  }

  try {
    const connection = await getUserConnectionConfig(session);
    if (!connection) {
      return NextResponse.json(
        {
          ok: false,
          done: true,
          error: "Your saved connection profile is missing.",
        },
        { status: 400 }
      );
    }

    const apifyConfig = {
      token: connection.apifyToken,
      actorId: connection.apifyActorId,
    };

    const run = await getApifyRun(runId, apifyConfig);

    if (FAILED_STATUSES.has(run.status)) {
      return NextResponse.json({
        ok: false,
        done: true,
        status: run.status,
        error: run.statusMessage || "Apify run ended with status " + run.status + ".",
      });
    }

    if (run.status !== "SUCCEEDED") {
      return NextResponse.json({
        ok: true,
        done: false,
        status: run.status,
        statusMessage: run.statusMessage,
      });
    }

    const leads = await getApifyRunLeads(runId, maxLeads, apifyConfig);
    const sync = await syncLeadsToGoogleSheet(leads, {
      serviceAccountJson: connection.googleServiceAccountJson,
      spreadsheetId: connection.googleSpreadsheetId,
      tab: connection.googleSheetTab,
    });

    return NextResponse.json({
      ok: true,
      done: true,
      status: run.status,
      ...sync,
      sheetUrl:
        "https://docs.google.com/spreadsheets/d/" +
        connection.googleSpreadsheetId +
        "/edit",
    });
  } catch (error) {
    console.error("Extraction status error:", error);
    return NextResponse.json(
      {
        ok: false,
        done: true,
        error:
          error instanceof Error
            ? error.message
            : "Extraction status check failed.",
      },
      { status: 500 }
    );
  }
}
