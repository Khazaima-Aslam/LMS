import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { testApifyConnection } from "@/lib/apify";
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
        { error: "No saved Apify connection. Open My Connections first." },
        { status: 400 }
      );
    }

    await testApifyConnection({
      token: connection.apifyToken,
      actorId: connection.apifyActorId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Apify test failed." },
      { status: 500 }
    );
  }
}
