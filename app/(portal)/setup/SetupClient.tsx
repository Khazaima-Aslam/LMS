"use client";

import { useState } from "react";

type Status = {
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
        <h2>Account setup</h2>
        <p className="muted">
          Add the values below in Vercel → Project → Settings → Environment
          Variables, then redeploy. Do not put API keys in client-side code.
        </p>
        <div className="envTable">
          <div><b>APIFY_TOKEN</b><span>{initial.apifyConfigured ? "Configured" : "Missing"}</span></div>
          <div><b>APIFY_ACTOR_ID</b><span>{initial.apifyActor}</span></div>
          <div><b>GOOGLE_SPREADSHEET_ID</b><span>{initial.spreadsheetConfigured ? "Configured" : "Missing"}</span></div>
          <div><b>GOOGLE_SERVICE_ACCOUNT_JSON_BASE64</b><span>{initial.googleConfigured ? "Configured" : "Missing"}</span></div>
          <div><b>GOOGLE_SHEET_TAB</b><span>{initial.sheetTab}</span></div>
          <div><b>ADMIN_USERNAME / ADMIN_PASSWORD</b><span>Portal login</span></div>
          <div><b>AUTH_SECRET</b><span>Session signing secret</span></div>
        </div>
      </section>

      <section className="panel">
        <h2>Apify</h2>
        <div className="kv"><span>Mode</span><b>{initial.apifyActor}</b></div>
        <div className="kv"><span>Maximum per request</span><b>100 leads</b></div>
        <div className="kv"><span>Maximum radius</span><b>50 km</b></div>
        <button
          className="primaryBtn"
          disabled={testing === "apify"}
          onClick={() => test("apify")}
        >
          {testing === "apify" ? "Testing..." : "Test Apify connection"}
        </button>
        {apify ? <div className="testMessage">{apify}</div> : null}
      </section>

      <section className="panel">
        <h2>Google Sheets</h2>
        <p className="muted">
          Create a blank Google Sheet and share it as <b>Editor</b> with the
          service-account email from your Google JSON key. LeadFlow will create
          the tab and headers automatically.
        </p>
        <button
          className="primaryBtn"
          disabled={testing === "google"}
          onClick={() => test("google")}
        >
          {testing === "google" ? "Testing..." : "Test Google Sheet connection"}
        </button>
        {google ? <div className="testMessage">{google}</div> : null}
      </section>

      <section className="panel">
        <h2>Required columns</h2>
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
