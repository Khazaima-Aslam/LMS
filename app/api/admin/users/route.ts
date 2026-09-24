import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/auth";
import {
  createManagedUser,
  listManagedUsers,
  resetManagedUserPassword,
  updateManagedUser,
} from "@/lib/userStore";
import { normalizeManagedUsername } from "@/lib/userSecurity";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed.";

  if (/already exists/i.test(message)) {
    return NextResponse.json({ ok: false, error: message }, { status: 409 });
  }

  if (
    /username|password|display name|role|not found/i.test(message)
  ) {
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  if (
    /Google service-account|GOOGLE_SPREADSHEET_ID|permission|requested entity/i.test(
      message
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "User account storage is unavailable. Check the Google Sheets setup and service-account permissions.",
      },
      { status: 503 }
    );
  }

  console.error("Admin user API error:", error);
  return NextResponse.json(
    { ok: false, error: "Unable to update user accounts right now." },
    { status: 500 }
  );
}

export async function GET() {
  const session = await requireAdminApiAuth();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  try {
    return NextResponse.json({ ok: true, users: await listManagedUsers() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const session = await requireAdminApiAuth();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const user = await createManagedUser({
      username: String(body?.username || ""),
      displayName: String(body?.displayName || ""),
      role: String(body?.role || "user"),
      password: String(body?.password || ""),
    });
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const session = await requireAdminApiAuth();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const username = normalizeManagedUsername(String(body?.username || ""));

    if (
      session.source === "managed" &&
      username === session.username.toLowerCase() &&
      (body?.active === false || body?.role === "user")
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "You cannot deactivate or remove your own admin role.",
        },
        { status: 400 }
      );
    }

    const user = await updateManagedUser(username, {
      displayName:
        body?.displayName === undefined ? undefined : String(body.displayName),
      role: body?.role === undefined ? undefined : String(body.role),
      active:
        body?.active === undefined ? undefined : Boolean(body.active),
    });

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  const session = await requireAdminApiAuth();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const user = await resetManagedUserPassword(
      String(body?.username || ""),
      String(body?.password || "")
    );
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return errorResponse(error);
  }
}
