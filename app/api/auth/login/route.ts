import { NextResponse } from "next/server";
import { createSessionToken, sessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const { username, password } = await request.json();

  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    return NextResponse.json(
      { error: "Portal login is not configured." },
      { status: 500 }
    );
  }

  if (username !== expectedUser || password !== expectedPassword) {
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    sessionCookie.name,
    createSessionToken(String(username)),
    sessionCookie.options
  );
  return response;
}
