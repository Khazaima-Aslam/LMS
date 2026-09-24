import { getSession } from "@/lib/auth";
import { getUserConnectionConfig } from "@/lib/connectionStore";
import { LEAD_HEADERS } from "@/lib/types";
import { maskedConnectionStatus } from "@/lib/userConnections";

export default async function DashboardPage() {
  const session = await getSession();
  const connection = session
    ? await getUserConnectionConfig(session).catch(() => null)
    : null;
  const status = maskedConnectionStatus(connection);
  const ready = status.configured;

  return (
    <div className="pageStack">
      <section className="pageHeader">
        <h1>LeadFlow Dashboard</h1>
        <p>
          Search public business listings using your own Apify account and
          write clean, deduplicated leads into your own Google Sheet.
        </p>
      </section>

      <div className={"statusBanner " + (ready ? "success" : "warning")}>
        <b>{ready ? "Ready for live extraction" : "Connect your tools first"}</b>
        <span>
          {ready
            ? "Your Apify account and Google Sheet are connected."
            : "Open My Connections and add your own Apify and Google Sheets details."}
        </span>
      </div>

      <section className="statGrid">
        <div className="statCard">
          <span>Apify</span>
          <strong>{status.apifyConfigured ? "Connected" : "Not connected"}</strong>
          <em className={status.apifyConfigured ? "ok" : "bad"}>
            {status.apifyConfigured ? "YOUR ACCOUNT" : "SET UP"}
          </em>
        </div>

        <div className="statCard">
          <span>Google Sheets</span>
          <strong>{status.googleConfigured ? "Connected" : "Not connected"}</strong>
          <em className={status.googleConfigured ? "ok" : "bad"}>
            {status.googleConfigured ? "YOUR SHEET" : "SET UP"}
          </em>
        </div>

        <div className="statCard">
          <span>Destination tab</span>
          <strong>{status.googleSheetTab || "Leads"}</strong>
          <em className={ready ? "ok" : "bad"}>{ready ? "READY" : "WAITING"}</em>
        </div>

        <div className="statCard">
          <span>Account isolation</span>
          <strong>Enabled</strong>
          <em className="ok">PRIVATE</em>
        </div>
      </section>

      <section className="panel">
        <h2>Your Google Sheet output</h2>
        <div className="chipRow">
          {LEAD_HEADERS.map((header) => (
            <span className="smallChip" key={header}>
              {header}
            </span>
          ))}
        </div>
        <p className="muted">
          Repeated searches are matched by normalized business name plus
          address/location. Existing rows are preserved and only blank fields
          are filled.
        </p>

        {connection?.googleSpreadsheetId ? (
          <a
            className="textLink"
            target="_blank"
            rel="noreferrer"
            href={
              "https://docs.google.com/spreadsheets/d/" +
              connection.googleSpreadsheetId +
              "/edit"
            }
          >
            Open my destination spreadsheet ↗
          </a>
        ) : (
          <a className="textLink" href="/setup">
            Connect my Apify and Google Sheet →
          </a>
        )}
      </section>

      <section className="panel">
        <h2>How each user works</h2>
        <ol className="steps">
          <li>Sign in with your own LeadFlow username and password.</li>
          <li>Open My Connections and add your own Apify + Google Sheet.</li>
          <li>Search businesses by keyword, location, radius, and quantity.</li>
          <li>Your Apify account performs only your searches.</li>
          <li>Your leads are written only to your configured Google Sheet.</li>
        </ol>
      </section>
    </div>
  );
}
