import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";

export async function GET(request: Request) {
  if (!(await requireApiAuth())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Location is required." }, { status: 400 });
  }

  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" +
    encodeURIComponent(q);

  const response = await fetch(url, {
    headers: {
      "User-Agent": process.env.GEOCODER_USER_AGENT || "LeadFlow/1.0",
      "Accept-Language": "en",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Location lookup service is unavailable." },
      { status: 502 }
    );
  }

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  if (!results[0]) {
    return NextResponse.json({ error: "Location not found." }, { status: 404 });
  }

  return NextResponse.json({
    latitude: Number(results[0].lat),
    longitude: Number(results[0].lon),
    displayName: results[0].display_name,
  });
}
