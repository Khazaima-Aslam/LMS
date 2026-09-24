import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { getApifyRun, getApifyRunLeads } from "@/lib/apify";
import { syncLeadsToGoogleSheet } from "@/lib/googleSheets";
import { getSpreadsheetId } from "@/lib/config";

const FAILED_STATUSES = new Set(["FAILED", "TIMED-OUT", "ABORTED"]);

export async function GET(request: Request) {
  if (!(await requireApiAuth())) {
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
    const run = await getApifyRun(runId);

    if (FAILED_STATUSES.has(run.status)) {
      return NextResponse.json({
        ok: false,
        done: true,
        status: run.status,
        error: run.statusMessage || `Apify run ended with status ${run.status}.`,
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

    const leads = await getApifyRunLeads(runId, maxLeads);
    const sync = await syncLeadsToGoogleSheet(leads);
    const spreadsheetId = getSpreadsheetId();

    return NextResponse.json({
      ok: true,
      done: true,
      status: run.status,
      ...sync,
      sheetUrl: spreadsheetId
        ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
        : "",
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
