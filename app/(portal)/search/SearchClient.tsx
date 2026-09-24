"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

type Result = {
  ok: boolean;
  done?: boolean;
  status?: string;
  statusMessage?: string;
  message?: string;
  error?: string;
  processed?: number;
  appended?: number;
  updated?: number;
  unchanged?: number;
  sheetUrl?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function SearchClient() {
  const [keywords, setKeywords] = useState<string[]>(["industrial contractor"]);
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("Jubail, Saudi Arabia");
  const [latitude, setLatitude] = useState("27.0174");
  const [longitude, setLongitude] = useState("49.6225");
  const [radiusKm, setRadiusKm] = useState("10");
  const [maxLeads, setMaxLeads] = useState("25");
  const [enrich, setEnrich] = useState(true);
  const [finding, setFinding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [runStatus, setRunStatus] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const activeRunRef = useRef(0);

  function addKeyword() {
    const value = keyword.trim();
    if (!value) return;
    if (!keywords.some((k) => k.toLowerCase() === value.toLowerCase())) {
      setKeywords([...keywords, value]);
    }
    setKeyword("");
  }

  async function findLocation() {
    if (!location.trim()) return;
    setFinding(true);
    setResult(null);

    try {
      const res = await fetch(
        `/api/geocode?q=${encodeURIComponent(location.trim())}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Location not found.");
      setLatitude(String(Number(data.latitude).toFixed(6)));
      setLongitude(String(Number(data.longitude).toFixed(6)));
    } catch (e) {
      setResult({
        ok: false,
        error: e instanceof Error ? e.message : "Location lookup failed.",
      });
    } finally {
      setFinding(false);
    }
  }

  async function pollRun(runId: string, limit: number, requestId: number) {
    for (let attempt = 0; attempt < 240; attempt += 1) {
      if (activeRunRef.current !== requestId) return;
      await sleep(attempt === 0 ? 1200 : 3000);

      const res = await fetch(
        `/api/extract/status?runId=${encodeURIComponent(runId)}&maxLeads=${limit}`,
        { cache: "no-store" }
      );

      const contentType = res.headers.get("content-type") || "";
      const data = (contentType.includes("application/json")
        ? await res.json()
        : { ok: false, error: await res.text() }) as Result;

      if (activeRunRef.current !== requestId) return;

      if (!res.ok || !data.ok) {
        setResult({ ok: false, error: data.error || "Extraction failed." });
        return;
      }

      setRunStatus(data.statusMessage || data.status || "Running");

      if (data.done) {
        setResult(data);
        return;
      }
    }

    setResult({
      ok: false,
      error:
        "The Apify run is still taking longer than expected. It may continue in Apify; try a smaller batch or disable contact enrichment.",
    });
  }

  async function extract(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setRunStatus("Starting Apify run...");
    setResult(null);

    const requestId = activeRunRef.current + 1;
    activeRunRef.current = requestId;

    try {
      const limit = Math.max(1, Math.min(100, Number(maxLeads) || 25));
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords,
          location,
          latitude: latitude ? Number(latitude) : undefined,
          longitude: longitude ? Number(longitude) : undefined,
          radiusKm: Number(radiusKm),
          maxLeads: limit,
          enrich,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : { ok: false, error: await res.text() };

      if (!res.ok || !data.ok || !data.runId) {
        throw new Error(data.error || "Extraction failed to start.");
      }

      setRunStatus(data.status || "RUNNING");
      await pollRun(data.runId, limit, requestId);
    } catch (e) {
      if (activeRunRef.current === requestId) {
        setResult({
          ok: false,
          error: e instanceof Error ? e.message : "Extraction failed.",
        });
      }
    } finally {
      if (activeRunRef.current === requestId) {
        setLoading(false);
      }
    }
  }

  const mapUrl = useMemo(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    const radius = Number(radiusKm);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";

    const latDelta = Math.max(0.02, radius / 111);
    const lngDelta = Math.max(
      0.02,
      radius / (111 * Math.max(0.25, Math.cos((lat * Math.PI) / 180)))
    );

    const bbox = [
      lng - lngDelta,
      lat - latDelta,
      lng + lngDelta,
      lat + latDelta,
    ].join("%2C");

    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
  }, [latitude, longitude, radiusKm]);

  return (
    <div className="searchGrid">
      <form className="panel searchForm" onSubmit={extract}>
        <label className="fieldLabel">Business types / keywords</label>
        <div className="chipRow">
          {keywords.map((k) => (
            <button
              key={k}
              type="button"
              className="keywordChip"
              onClick={() => setKeywords(keywords.filter((x) => x !== k))}
              title="Remove"
            >
              {k} <span>×</span>
            </button>
          ))}
        </div>
        <div className="inlineRow">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addKeyword();
              }
            }}
            placeholder="e.g. industrial contractor"
          />
          <button type="button" className="secondaryBtn" onClick={addKeyword}>
            Add
          </button>
        </div>
        <small>Press Enter or Add for each keyword.</small>

        <label className="fieldLabel topSpace">Location name</label>
        <div className="inlineRow">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Jubail, Saudi Arabia"
          />
          <button
            type="button"
            className="secondaryBtn"
            onClick={findLocation}
            disabled={finding || loading}
          >
            {finding ? "Finding..." : "Find"}
          </button>
        </div>

        <div className="twoCol">
          <label>
            Latitude
            <input
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
            />
          </label>
          <label>
            Longitude
            <input
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
            />
          </label>
        </div>

        <div className="twoCol">
          <label>
            Radius (km)
            <input
              type="number"
              min="1"
              max="50"
              value={radiusKm}
              onChange={(e) => setRadiusKm(e.target.value)}
            />
          </label>
          <label>
            Maximum leads
            <input
              type="number"
              min="1"
              max="100"
              value={maxLeads}
              onChange={(e) => setMaxLeads(e.target.value)}
            />
          </label>
        </div>

        <label className="checkRow">
          <input
            type="checkbox"
            checked={enrich}
            onChange={(e) => setEnrich(e.target.checked)}
          />
          <span>Find public email and extra phone data from business websites</span>
        </label>

        <div className="infoBox">
          Every processed batch is written directly to your configured Google
          Sheet. Existing rows are matched by business name + address/location
          and are not duplicated.
        </div>

        <button
          className="primaryBtn"
          disabled={loading || keywords.length === 0}
        >
          {loading ? "Extracting & importing..." : "Extract Leads"}
        </button>

        {loading ? (
          <div className="progressBox">
            <b>{runStatus || "Working..."}</b>
            <div>
              Apify is collecting businesses in the background. Contact enrichment
              can take longer for larger batches.
            </div>
          </div>
        ) : null}

        {result ? (
          <div className={result.ok ? "resultBox successResult" : "errorBox"}>
            {result.ok ? (
              <>
                <b>Import completed.</b>
                <div>
                  Processed {result.processed || 0} · New {result.appended || 0} ·
                  Updated {result.updated || 0} · Unchanged{" "}
                  {result.unchanged || 0}
                </div>
                {result.sheetUrl ? (
                  <a
                    className="textLink"
                    href={result.sheetUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Google Sheet ↗
                  </a>
                ) : null}
              </>
            ) : (
              result.error || "Something went wrong."
            )}
          </div>
        ) : null}
      </form>

      <section className="panel mapPanel">
        <div className="mapTitle">
          <div>
            <h2>Search area</h2>
            <p>
              {location} · {radiusKm || "—"} km radius
            </p>
          </div>
          <code>
            {latitude || "—"}, {longitude || "—"}
          </code>
        </div>

        {mapUrl ? (
          <iframe
            title="OpenStreetMap search area"
            className="mapFrame"
            src={mapUrl}
            loading="lazy"
          />
        ) : (
          <div className="mapEmpty">Enter or find coordinates to preview the area.</div>
        )}

        <div className="mapNote">
          The radius is sent to Apify as a point-based custom geolocation. The
          map is a visual preview from OpenStreetMap.
        </div>
      </section>
    </div>
  );
}
