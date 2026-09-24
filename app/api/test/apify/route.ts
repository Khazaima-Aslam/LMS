import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { testApifyConnection } from "@/lib/apify";

export async function POST() {
  if (!(await requireApiAuth())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    await testApifyConnection();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Apify test failed." },
      { status: 500 }
    );
  }
}
