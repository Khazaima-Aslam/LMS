import { NextResponse } from "next/server";
import { createSessionToken, sessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username || "");
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

    if (username !== expectedUser || password !== expectedPassword) {
      return NextResponse.json(
        { error: "Invalid username or password.", code: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      sessionCookie.name,
      createSessionToken(username),
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
