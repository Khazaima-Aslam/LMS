import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { testGoogleSheetConnection } from "@/lib/googleSheets";

export async function POST() {
  if (!(await requireApiAuth())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await testGoogleSheetConnection();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google test failed." },
      { status: 500 }
    );
  }
}
