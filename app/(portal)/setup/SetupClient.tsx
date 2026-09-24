"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type ConnectionStatus = {
  configured: boolean;
  apifyConfigured: boolean;
  googleConfigured: boolean;
  googleSpreadsheetId: string;
  googleSheetTab: string;
  apifyActorId: string;
  googleServiceAccountEmail?: string;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  connection?: ConnectionStatus;
};

const emptyStatus: ConnectionStatus = {
  configured: false,
  apifyConfigured: false,
  googleConfigured: false,
  googleSpreadsheetId: "",
  googleSheetTab: "Leads",
  apifyActorId: "compass/crawler-google-places",
  googleServiceAccountEmail: "",
};

export default function ConnectionsClient() {
  const [status, setStatus] = useState<ConnectionStatus>(emptyStatus);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/connections", { cache: "no-store" });
      const data = (await res.json()) as ApiResponse;

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not load your connections.");
      }

      setStatus(data.connection || emptyStatus);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load your connections."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/connections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apifyToken: form.get("apifyToken"),
          apifyActorId: form.get("apifyActorId"),
          googleSpreadsheetId: form.get("googleSpreadsheetId"),
          googleSheetTab: form.get("googleSheetTab"),
          googleServiceAccountJson: form.get("googleServiceAccountJson"),
        }),
      });

      const data = (await res.json()) as ApiResponse;
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not save your connections.");
      }

      setStatus(data.connection || status);
      setMessage(
        data.message ||
          "Your Apify and Google Sheets connections were saved successfully."
      );

      const tokenInput = e.currentTarget.elements.namedItem(
        "apifyToken"
      ) as HTMLInputElement | null;
      const googleInput = e.currentTarget.elements.namedItem(
        "googleServiceAccountJson"
      ) as HTMLTextAreaElement | null;
      if (tokenInput) tokenInput.value = "";
      if (googleInput) googleInput.value = "";
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save your connections."
      );
    } finally {
      setSaving(false);
    }
  }

  async function clearConnections() {
    if (
      !window.confirm(
        "Remove your saved Apify and Google Sheets connections from LeadFlow?"
      )
    ) {
      return;
    }

    setClearing(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/connections", { method: "DELETE" });
      const data = (await res.json()) as ApiResponse;

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not remove connections.");
      }

      setStatus(emptyStatus);
      setMessage("Your saved connections were removed.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not remove connections."
      );
    } finally {
      setClearing(false);
    }
  }

  if (loading) {
    return <section className="panel">Loading your connection settings...</section>;
  }

  return (
    <>
      <section
        className={
          status.configured ? "statusBanner success" : "statusBanner warning"
        }
      >
        <b>
          {status.configured
            ? "Your lead tools are connected"
            : "Connect your lead tools"}
        </b>
        <span>
          {status.configured
            ? "Search Leads will use your own Apify account and write only to your own Google Sheet."
            : "Add your Apify token and Google Sheet details below. Other users have separate settings."}
        </span>
      </section>

      <section className="connectionGrid">
        <div className="connectionCard">
          <div className="connectionCardTop">
            <div>
              <span className="eyebrow">YOUR PROVIDER</span>
              <h2>Apify</h2>
            </div>
            <span
              className={
                status.apifyConfigured
                  ? "connectionBadge ready"
                  : "connectionBadge missing"
              }
            >
              {status.apifyConfigured ? "Connected" : "Not connected"}
            </span>
          </div>
          <p>
            Actor: <b>{status.apifyActorId}</b>
          </p>
        </div>

        <div className="connectionCard">
          <div className="connectionCardTop">
            <div>
              <span className="eyebrow">YOUR DESTINATION</span>
              <h2>Google Sheets</h2>
            </div>
            <span
              className={
                status.googleConfigured
                  ? "connectionBadge ready"
                  : "connectionBadge missing"
              }
            >
              {status.googleConfigured ? "Connected" : "Not connected"}
            </span>
          </div>
          <p>
            Sheet:{" "}
            <b>
              {status.googleSpreadsheetId
                ? status.googleSpreadsheetId.slice(0, 18) + "..."
                : "Not set"}
            </b>
          </p>
          {status.googleServiceAccountEmail ? (
            <p className="muted connectionEmail">
              {status.googleServiceAccountEmail}
            </p>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <h2>{status.configured ? "Update my connections" : "Connect my account"}</h2>
        <p className="muted">
          Your secret values are encrypted before being stored. After saving,
          LeadFlow never displays your Apify token or Google private key back
          in the browser.
        </p>

        <form className="connectionForm" onSubmit={save}>
          <div className="connectionSection">
            <h3>1. Apify</h3>
            <label>
              Apify API token
              <input
                name="apifyToken"
                type="password"
                autoComplete="off"
                placeholder={
                  status.apifyConfigured
                    ? "Saved — leave blank to keep current token"
                    : "Paste your Apify API token"
                }
              />
            </label>

            <label>
              Apify Actor ID
              <input
                name="apifyActorId"
                defaultValue={status.apifyActorId}
                placeholder="compass/crawler-google-places"
              />
            </label>
          </div>

          <div className="connectionSection">
            <h3>2. Google Sheet</h3>
            <label>
              Google Spreadsheet URL or ID
              <input
                name="googleSpreadsheetId"
                defaultValue={status.googleSpreadsheetId}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                required
              />
            </label>

            <label>
              Destination tab
              <input
                name="googleSheetTab"
                defaultValue={status.googleSheetTab || "Leads"}
                placeholder="Leads"
                required
              />
            </label>

            <label>
              Google service-account JSON
              <textarea
                name="googleServiceAccountJson"
                rows={7}
                placeholder={
                  status.googleConfigured
                    ? "Saved — leave blank to keep current service-account key"
                    : "Paste the complete service-account JSON key here"
                }
              />
            </label>

            <div className="infoBox">
              Share your destination Google Sheet as <b>Editor</b> with the
              service-account email from the JSON key. LeadFlow will create the
              destination tab and headers automatically.
            </div>
          </div>

          <div className="connectionActions">
            <button className="primaryBtn" disabled={saving}>
              {saving ? "Testing & saving..." : "Test & save my connections"}
            </button>

            {status.configured ? (
              <button
                className="dangerBtn"
                type="button"
                disabled={clearing || saving}
                onClick={() => void clearConnections()}
              >
                {clearing ? "Removing..." : "Remove saved connections"}
              </button>
            ) : null}
          </div>
        </form>

        {message ? <div className="testMessage">{message}</div> : null}
        {error ? <div className="errorBox">{error}</div> : null}
      </section>

      <section className="panel">
        <h2>What is private to your account?</h2>
        <div className="privacyGrid">
          <div>
            <b>Your Apify token</b>
            <span>Used only for searches started from your account.</span>
          </div>
          <div>
            <b>Your Google Sheet</b>
            <span>Your extracted leads are written to your selected Sheet.</span>
          </div>
          <div>
            <b>Your Google service account</b>
            <span>Used only server-side to access your selected Sheet.</span>
          </div>
        </div>
      </section>
    </>
  );
}
