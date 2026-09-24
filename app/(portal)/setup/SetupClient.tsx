"use client";

import { useState } from "react";

type Status = {
  portalConfigured: boolean;
  apifyConfigured: boolean;
  apifyActor: string;
  googleConfigured: boolean;
  spreadsheetConfigured: boolean;
  sheetTab: string;
};

export default function SetupClient({ initial }: { initial: Status }) {
  const [apify, setApify] = useState("");
  const [google, setGoogle] = useState("");
  const [testing, setTesting] = useState("");

  async function test(kind: "apify" | "google") {
    setTesting(kind);
    kind === "apify" ? setApify("") : setGoogle("");

    try {
      const res = await fetch(`/api/test/${kind}`, { method: "POST" });
      const data = await res.json();
      const msg = res.ok
        ? kind === "apify"
          ? "Apify token is valid."
          : `Google Sheets connected. Tab: ${data.tab}. Service account: ${data.serviceAccountEmail || "configured"}`
        : data.error || "Connection test failed.";

      kind === "apify" ? setApify(msg) : setGoogle(msg);
    } catch {
      kind === "apify"
        ? setApify("Connection test failed.")
        : setGoogle("Connection test failed.");
    } finally {
      setTesting("");
    }
  }

  return (
    <>
      <section className="panel">
        <h2>Connection status</h2>
        <p className="muted">
          LeadFlow is installed. This page only shows whether the server-side
          services required for lead extraction are connected.
        </p>
        <div className="envTable">
          <div><b>Portal access</b><span>{initial.portalConfigured ? "Ready" : "Needs setup"}</span></div>
          <div><b>Apify lead provider</b><span>{initial.apifyConfigured ? "Connected" : "Not connected"}</span></div>
          <div><b>Google Sheet destination</b><span>{initial.spreadsheetConfigured ? "Connected" : "Not connected"}</span></div>
          <div><b>Google service account</b><span>{initial.googleConfigured ? "Connected" : "Not connected"}</span></div>
          <div><b>Destination tab</b><span>{initial.sheetTab}</span></div>
        </div>
      </section>

      <section className="panel">
        <h2>Apify</h2>
        <div className="kv"><span>Provider</span><b>{initial.apifyActor}</b></div>
        <div className="kv"><span>Maximum per request</span><b>100 leads</b></div>
        <div className="kv"><span>Maximum radius</span><b>50 km</b></div>
        <button
          className="primaryBtn"
          disabled={!initial.apifyConfigured || testing === "apify"}
          onClick={() => test("apify")}
        >
          {testing === "apify" ? "Testing..." : "Test Apify connection"}
        </button>
        {apify ? <div className="testMessage">{apify}</div> : null}
      </section>

      <section className="panel">
        <h2>Google Sheets</h2>
        <p className="muted">
          When connected, LeadFlow creates the destination tab and headers
          automatically and writes extracted leads directly into the Sheet.
        </p>
        <button
          className="primaryBtn"
          disabled={
            !initial.googleConfigured ||
            !initial.spreadsheetConfigured ||
            testing === "google"
          }
          onClick={() => test("google")}
        >
          {testing === "google" ? "Testing..." : "Test Google Sheet connection"}
        </button>
        {google ? <div className="testMessage">{google}</div> : null}
      </section>

      {!initial.apifyConfigured ||
      !initial.googleConfigured ||
      !initial.spreadsheetConfigured ? (
        <section className="panel setupNotice">
          <h2>One-time server connection still required</h2>
          <p className="muted">
            The portal itself is working. Lead extraction needs the Apify token
            and Google Sheets service credentials to be added securely to the
            Vercel project once. These secrets are intentionally not entered or
            displayed inside the browser dashboard.
          </p>
        </section>
      ) : null}

      <section className="panel">
        <h2>Google Sheet columns</h2>
        <div className="chipRow">
          {[
            "Business Name",
            "Category",
            "Full Address",
            "City",
            "Country",
            "Mobile",
            "Landline",
            "Email",
            "Phone",
          ].map((x) => (
            <span className="smallChip" key={x}>{x}</span>
          ))}
        </div>
      </section>
    </>
  );
}
