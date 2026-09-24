import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { geocodeLocation } from "@/lib/geocode";

export async function GET(request: Request) {
  if (!(await requireApiAuth())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json(
      { error: "Enter a location name first." },
      { status: 400 }
    );
  }

  const result = await geocodeLocation(q);

  if (!result) {
    return NextResponse.json(
      {
        error:
          "I could not place that location on the map. Try a more specific value such as 'Jubail, Saudi Arabia'. You can still search using the location name.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json(result);
}
