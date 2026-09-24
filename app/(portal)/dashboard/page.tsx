import { configurationStatus, getSpreadsheetId } from "@/lib/config";
import { LEAD_HEADERS } from "@/lib/types";

export default function DashboardPage() {
  const status = configurationStatus();
  const ready =
    status.apifyConfigured &&
    status.googleConfigured &&
    status.spreadsheetConfigured;

  return (
    <div className="pageStack">
      <section className="pageHeader">
        <h1>LeadFlow Dashboard</h1>
        <p>
          Search public business listings and write clean, deduplicated leads
          directly into Google Sheets.
        </p>
      </section>

      <div className={`statusBanner ${ready ? "success" : "warning"}`}>
        <b>{ready ? "Ready for live extraction" : "Setup required"}</b>
        <span>
          {ready
            ? "Apify and Google Sheets are configured."
            : "Open Setup and complete the missing environment variables."}
        </span>
      </div>

      <section className="statGrid">
        <div className="statCard">
          <span>Provider</span>
          <strong>APIFY</strong>
          <em className={status.apifyConfigured ? "ok" : "bad"}>
            {status.apifyConfigured ? "OK" : "Missing"}
          </em>
        </div>
        <div className="statCard">
          <span>Google credentials</span>
          <strong>{status.googleConfigured ? "Configured" : "Missing"}</strong>
          <em className={status.googleConfigured ? "ok" : "bad"}>
            {status.googleConfigured ? "OK" : "Check"}
          </em>
        </div>
        <div className="statCard">
          <span>Destination Sheet</span>
          <strong>{status.sheetTab}</strong>
          <em className={status.spreadsheetConfigured ? "ok" : "bad"}>
            {status.spreadsheetConfigured ? "OK" : "Missing"}
          </em>
        </div>
        <div className="statCard">
          <span>Enrichment</span>
          <strong>Optional</strong>
          <em className="ok">Available</em>
        </div>
      </section>

      <section className="panel">
        <h2>Google Sheet output</h2>
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
        {getSpreadsheetId() ? (
          <a
            className="textLink"
            target="_blank"
            rel="noreferrer"
            href={`https://docs.google.com/spreadsheets/d/${getSpreadsheetId()}/edit`}
          >
            Open destination spreadsheet ↗
          </a>
        ) : null}
      </section>

      <section className="panel">
        <h2>How this edition works</h2>
        <ol className="steps">
          <li>Select one or more business keywords.</li>
          <li>Enter a city/location and optionally find its coordinates.</li>
          <li>Choose the search radius, result limit, and email enrichment.</li>
          <li>Apify extracts public business listings from Google Maps.</li>
          <li>
            LeadFlow deduplicates the results and appends or enriches rows in
            Google Sheets.
          </li>
        </ol>
      </section>
    </div>
  );
}
