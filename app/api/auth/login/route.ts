import { NextResponse } from "next/server";
import { createSessionToken, sessionCookie } from "@/lib/auth";
import { authenticateManagedUser } from "@/lib/userStore";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");

    const expectedUser = process.env.ADMIN_USERNAME?.trim();
    const expectedPassword = process.env.ADMIN_PASSWORD;
    const authSecret = process.env.AUTH_SECRET;

    const missing = [
      !expectedUser ? "ADMIN_USERNAME" : "",
      !expectedPassword ? "ADMIN_PASSWORD" : "",
      !authSecret ? "AUTH_SECRET" : "",
    ].filter(Boolean);

    if (missing.length) {
      return NextResponse.json(
        {
          error: `Portal login is not configured. Add ${missing.join(
            ", "
          )} in Vercel Environment Variables and redeploy.`,
          code: "LOGIN_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    if (username === expectedUser && password === expectedPassword) {
      const response = NextResponse.json({ ok: true, role: "admin" });
      response.cookies.set(
        sessionCookie.name,
        createSessionToken({
          username,
          displayName: username,
          role: "admin",
          source: "master",
        }),
        sessionCookie.options
      );
      return response;
    }

    let managedUser;
    try {
      managedUser = await authenticateManagedUser(username, password);
    } catch (error) {
      console.error("Managed user authentication unavailable:", error);
      return NextResponse.json(
        {
          error:
            "Managed account sign-in is unavailable until Google Sheets is configured correctly.",
          code: "USER_STORE_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    if (!managedUser) {
      return NextResponse.json(
        { error: "Invalid username or password.", code: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ ok: true, role: managedUser.role });
    response.cookies.set(
      sessionCookie.name,
      createSessionToken({
        username: managedUser.username,
        displayName: managedUser.displayName || managedUser.username,
        role: managedUser.role,
        source: "managed",
      }),
      sessionCookie.options
    );
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Unable to sign in right now. Check the deployment configuration." },
      { status: 500 }
    );
  }
}
