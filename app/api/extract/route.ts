import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { startApifySearch } from "@/lib/apify";
import { getUserConnectionConfig } from "@/lib/connectionStore";

function numberWithin(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export async function POST(request: Request) {
  const session = await requireApiAuth();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const connection = await getUserConnectionConfig(session);
    if (!connection) {
      return NextResponse.json(
        {
          ok: false,
          error: "Connect your Apify account and Google Sheet in My Connections first.",
        },
        { status: 400 }
      );
    }

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

    const maxLeads = Math.round(numberWithin(body.maxLeads, 1, 100, 25));

    const run = await startApifySearch(
      {
        keywords,
        location,
        latitude,
        longitude,
        radiusKm: numberWithin(body.radiusKm, 1, 50, 10),
        maxLeads,
        enrich: Boolean(body.enrich),
      },
      {
        token: connection.apifyToken,
        actorId: connection.apifyActorId,
      }
    );

    return NextResponse.json({
      ok: true,
      runId: run.runId,
      status: run.status,
      maxLeads,
    });
  } catch (error) {
    console.error("Extraction start error:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Extraction failed to start.",
      },
      { status: 500 }
    );
  }
}
