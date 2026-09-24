import type { Lead } from "@/lib/types";

function strings(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap(strings);
  return [];
}

function walkForKey(
  value: unknown,
  matcher: RegExp,
  depth = 0,
  path = ""
): { value: string; path: string }[] {
  if (depth > 5 || value == null) return [];

  if (typeof value === "string") {
    return matcher.test(path) && value.trim()
      ? [{ value: value.trim(), path }]
      : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, i) =>
      walkForKey(item, matcher, depth + 1, `${path}[${i}]`)
    );
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(
      ([key, child]) =>
        walkForKey(child, matcher, depth + 1, path ? `${path}.${key}` : key)
    );
  }

  return [];
}

function uniq(values: string[]) {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function normalizePhoneKey(value: string) {
  return value.replace(/\D+/g, "");
}

function samePhone(a: string, b: string) {
  const aa = normalizePhoneKey(a);
  const bb = normalizePhoneKey(b);
  if (!aa || !bb) return a.trim().toLowerCase() === b.trim().toLowerCase();
  if (aa === bb) return true;
  const shorter = aa.length <= bb.length ? aa : bb;
  const longer = aa.length > bb.length ? aa : bb;
  return shorter.length >= 7 && longer.endsWith(shorter);
}

function uniqPhones(values: string[]) {
  const result: string[] = [];
  for (const value of values.map((v) => v.trim()).filter(Boolean)) {
    if (result.some((existing) => samePhone(existing, value))) continue;
    result.push(value);
  }
  return result;
}

function countryName(item: Record<string, any>) {
  const direct = item.country || item.countryName;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const code = item.countryCode;
  if (typeof code === "string" && /^[a-zA-Z]{2}$/.test(code)) {
    try {
      return (
        new Intl.DisplayNames(["en"], { type: "region" }).of(
          code.toUpperCase()
        ) || code.toUpperCase()
      );
    } catch {
      return code.toUpperCase();
    }
  }
  return "";
}

function getPrimaryEmail(item: Record<string, any>) {
  const direct = uniq([
    ...strings(item.email),
    ...strings(item.emails),
    ...strings(item.contactEmail),
    ...walkForKey(item, /email/i).map((x) => x.value),
  ]);

  return direct
    .filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))
    .slice(0, 3)
    .join("; ");
}

function phoneByLabel(item: Record<string, any>, label: RegExp) {
  return (
    uniq(
      walkForKey(item, /phone|mobile|landline|whatsapp|tel/i)
        .filter((x) => label.test(x.path))
        .map((x) => x.value)
    )[0] || ""
  );
}

export function mapApifyItemToLead(raw: unknown): Lead {
  const item = (raw || {}) as Record<string, any>;

  const mobile = phoneByLabel(item, /mobile|cell|whatsapp/i);
  const landline = phoneByLabel(item, /landline|fixed/i);

  const generalPhones = uniqPhones([
    ...strings(item.phone),
    ...strings(item.phoneUnformatted),
    ...strings(item.telephone),
    ...strings(item.phones),
    ...strings(item.additionalPhones),
  ]);

  const mainPhone = generalPhones.slice(0, 3).join("; ");

  return {
    businessName: String(item.title || item.name || "").trim(),
    category: String(
      item.categoryName ||
        item.category ||
        (Array.isArray(item.categories) ? item.categories[0] : "") ||
        ""
    ).trim(),
    fullAddress: String(
      item.address || item.formattedAddress || item.fullAddress || ""
    ).trim(),
    city: String(item.city || item.addressObj?.city || "").trim(),
    country: countryName(item),
    mobile,
    landline,
    email: getPrimaryEmail(item),
    phone: mainPhone,
  };
}

export type ApifySearchArgs = {
  keywords: string[];
  location: string;
  latitude?: number;
  longitude?: number;
  radiusKm: number;
  maxLeads: number;
  enrich: boolean;
};

export function buildApifyInput(args: ApifySearchArgs) {
  const perSearch = Math.max(
    1,
    Math.ceil(args.maxLeads / Math.max(1, args.keywords.length))
  );

  const input: Record<string, unknown> = {
    searchStringsArray: args.keywords,
    maxCrawledPlacesPerSearch: perSearch,
    language: "en",
    skipClosedPlaces: true,
    scrapePlaceDetailPage: false,
    scrapeContacts: args.enrich,
    maximumLeadsEnrichmentRecords: 0,
    maxReviews: 0,
    maxImages: 0,
    includeWebResults: false,
    scrapeDirectories: false,
  };

  if (Number.isFinite(args.latitude) && Number.isFinite(args.longitude)) {
    input.customGeolocation = {
      type: "Point",
      coordinates: [args.longitude, args.latitude],
      radiusKm: args.radiusKm,
    };
  } else if (args.location.trim()) {
    input.locationQuery = args.location.trim();
  }

  return input;
}

function actorPath() {
  const actorId =
    process.env.APIFY_ACTOR_ID || "compass/crawler-google-places";
  return actorId.replace("/", "~");
}

function apifyHeaders() {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not configured.");

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function startApifySearch(args: ApifySearchArgs) {
  const endpoint = `https://api.apify.com/v2/actors/${encodeURIComponent(
    actorPath()
  )}/runs`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: apifyHeaders(),
    body: JSON.stringify(buildApifyInput(args)),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Apify start failed (${response.status}). ${detail.slice(0, 500)}`
    );
  }

  const json = (await response.json()) as {
    data?: { id?: string; status?: string };
  };

  if (!json.data?.id) {
    throw new Error("Apify did not return a run ID.");
  }

  return {
    runId: json.data.id,
    status: json.data.status || "READY",
  };
}

export async function getApifyRun(runId: string) {
  const response = await fetch(
    `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}`,
    {
      headers: apifyHeaders(),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Apify status check failed (${response.status}). ${detail.slice(0, 500)}`
    );
  }

  const json = (await response.json()) as {
    data?: { status?: string; statusMessage?: string };
  };

  return {
    status: json.data?.status || "UNKNOWN",
    statusMessage: json.data?.statusMessage || "",
  };
}

export async function getApifyRunLeads(runId: string, maxLeads: number) {
  const endpoint =
    `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}` +
    `/dataset/items?clean=true&format=json&limit=${Math.max(
      1,
      Math.min(100, Math.round(maxLeads))
    )}`;

  const response = await fetch(endpoint, {
    headers: apifyHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Apify dataset fetch failed (${response.status}). ${detail.slice(0, 500)}`
    );
  }

  const items = (await response.json()) as unknown[];
  return items
    .map(mapApifyItemToLead)
    .filter((lead) => lead.businessName)
    .slice(0, maxLeads);
}

export async function testApifyConnection() {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not configured.");

  const response = await fetch("https://api.apify.com/v2/users/me", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Apify token test failed (${response.status}).`);
  }

  return true;
}
