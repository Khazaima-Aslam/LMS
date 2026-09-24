export type GeocodeResult = {
  latitude: number;
  longitude: number;
  displayName: string;
  provider: "nominatim" | "photon";
};

function finiteCoordinate(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function parseNominatimResults(input: unknown): GeocodeResult | null {
  if (!Array.isArray(input) || !input[0] || typeof input[0] !== "object") {
    return null;
  }

  const item = input[0] as Record<string, unknown>;
  const latitude = finiteCoordinate(item.lat);
  const longitude = finiteCoordinate(item.lon);

  if (latitude === null || longitude === null) return null;

  return {
    latitude,
    longitude,
    displayName:
      String(item.display_name || "").trim() ||
      String(latitude) + ", " + String(longitude),
    provider: "nominatim",
  };
}

export function parsePhotonResults(input: unknown): GeocodeResult | null {
  if (!input || typeof input !== "object") return null;

  const features = (input as { features?: unknown }).features;
  if (!Array.isArray(features) || !features[0] || typeof features[0] !== "object") {
    return null;
  }

  const feature = features[0] as Record<string, any>;
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const longitude = finiteCoordinate(coordinates[0]);
  const latitude = finiteCoordinate(coordinates[1]);
  if (latitude === null || longitude === null) return null;

  const properties = (feature.properties || {}) as Record<string, unknown>;
  const label = [
    properties.name,
    properties.city,
    properties.county,
    properties.state,
    properties.country,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(", ");

  return {
    latitude,
    longitude,
    displayName: label || String(latitude) + ", " + String(longitude),
    provider: "photon",
  };
}

export function calculateMapBbox(
  latitude: number,
  longitude: number,
  radiusKm: number
) {
  const safeRadius = Math.max(1, Math.min(100, Number(radiusKm) || 10));
  const latDelta = Math.max(0.02, safeRadius / 111);
  const lngDelta = Math.max(
    0.02,
    safeRadius /
      (111 * Math.max(0.25, Math.cos((latitude * Math.PI) / 180)))
  );

  return [
    longitude - lngDelta,
    latitude - latDelta,
    longitude + lngDelta,
    latitude + latDelta,
  ];
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 7000
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function geocodeLocation(
  query: string
): Promise<GeocodeResult | null> {
  const q = String(query || "").trim();
  if (!q) return null;

  const userAgent =
    process.env.GEOCODER_USER_AGENT ||
    "LeadFlow/1.0 (server-side business search location resolver)";

  const nominatimUrl =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=" +
    encodeURIComponent(q);

  const nominatim = await fetchJsonWithTimeout(
    nominatimUrl,
    {
      headers: {
        "User-Agent": userAgent,
        "Accept-Language": "en",
        Accept: "application/json",
      },
    },
    6500
  );

  const parsedNominatim = parseNominatimResults(nominatim);
  if (parsedNominatim) return parsedNominatim;

  const photonUrl =
    "https://photon.komoot.io/api/?limit=1&lang=en&q=" + encodeURIComponent(q);

  const photon = await fetchJsonWithTimeout(
    photonUrl,
    {
      headers: {
        "User-Agent": userAgent,
        Accept: "application/json",
      },
    },
    6500
  );

  return parsePhotonResults(photon);
}
