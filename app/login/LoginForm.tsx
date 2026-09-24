"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({ configured = true }: { configured?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!configured) return;

    setLoading(true);
    setError("");

    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : { error: await res.text() };

      if (!res.ok) {
        setError(data.error || "Sign in failed.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not reach the login service. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="loginForm">
      <label>
        Username
        <input
          name="username"
          autoComplete="username"
          required
          disabled={!configured || loading}
        />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={!configured || loading}
        />
      </label>
      {error ? <div className="errorBox">{error}</div> : null}
      <button className="primaryBtn full" disabled={loading || !configured}>
        {loading ? "Signing in..." : configured ? "Sign in" : "Setup required"}
      </button>
    </form>
  );
}
