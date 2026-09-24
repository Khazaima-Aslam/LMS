import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { runApifySearch } from "@/lib/apify";
import { syncLeadsToGoogleSheet } from "@/lib/googleSheets";
import { getSpreadsheetId } from "@/lib/config";

export const maxDuration = 300;

function numberWithin(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export async function POST(request: Request) {
  if (!(await requireApiAuth())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const keywords = Array.isArray(body.keywords)
      ? body.keywords
          .map((x: unknown) => String(x || "").trim())
          .filter(Boolean)
          .slice(0, 10)
      : [];

    if (!keywords.length) {
      return NextResponse.json(
        { ok: false, error: "Add at least one business keyword." },
        { status: 400 }
      );
    }

    const latitude =
      body.latitude === undefined || body.latitude === null || body.latitude === ""
        ? undefined
        : Number(body.latitude);
    const longitude =
      body.longitude === undefined || body.longitude === null || body.longitude === ""
        ? undefined
        : Number(body.longitude);

    const location = String(body.location || "").trim();

    if (
      (!Number.isFinite(latitude) || !Number.isFinite(longitude)) &&
      !location
    ) {
      return NextResponse.json(
        { ok: false, error: "Enter a location or valid coordinates." },
        { status: 400 }
      );
    }

    const leads = await runApifySearch({
      keywords,
      location,
      latitude,
      longitude,
      radiusKm: numberWithin(body.radiusKm, 1, 50, 10),
      maxLeads: Math.round(numberWithin(body.maxLeads, 1, 100, 25)),
      enrich: Boolean(body.enrich),
    });

    const sync = await syncLeadsToGoogleSheet(leads);
    const spreadsheetId = getSpreadsheetId();

    return NextResponse.json({
      ok: true,
      ...sync,
      sheetUrl: spreadsheetId
        ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
        : "",
    });
  } catch (error) {
    console.error("Extraction error:", error);
    const message =
      error instanceof Error ? error.message : "Extraction failed.";

    return NextResponse.json(
      {
        ok: false,
        error:
          message.includes("408") || /timeout/i.test(message)
            ? "The extraction took too long. Try fewer leads or turn off email enrichment, then run again."
            : message,
      },
      { status: 500 }
    );
  }
}
