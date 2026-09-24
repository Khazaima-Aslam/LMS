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
  if (depth > 4 || value == null) return [];

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
  return uniq(
    walkForKey(item, /phone|mobile|landline|whatsapp|tel/i)
      .filter((x) => label.test(x.path))
      .map((x) => x.value)
  )[0] || "";
}

export function mapApifyItemToLead(raw: unknown): Lead {
  const item = (raw || {}) as Record<string, any>;

  const mainPhone =
    strings(item.phone)[0] ||
    strings(item.phoneUnformatted)[0] ||
    strings(item.telephone)[0] ||
    "";

  let mobile = phoneByLabel(item, /mobile|cell|whatsapp/i);
  let landline = phoneByLabel(item, /landline|fixed/i);

  if (mobile === mainPhone) mobile = "";
  if (landline === mainPhone) landline = "";

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

export async function runApifySearch(args: {
  keywords: string[];
  location: string;
  latitude?: number;
  longitude?: number;
  radiusKm: number;
  maxLeads: number;
  enrich: boolean;
}) {
  const token = process.env.APIFY_TOKEN;
  const actorId =
    process.env.APIFY_ACTOR_ID || "compass/crawler-google-places";

  if (!token) throw new Error("APIFY_TOKEN is not configured.");

  const actorPath = actorId.replace("/", "~");
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

  if (
    Number.isFinite(args.latitude) &&
    Number.isFinite(args.longitude)
  ) {
    input.customGeolocation = {
      type: "Point",
      coordinates: [args.longitude, args.latitude],
      radiusKm: args.radiusKm,
    };
  } else if (args.location.trim()) {
    input.locationQuery = args.location.trim();
  }

  const endpoint =
    `https://api.apify.com/v2/actors/${encodeURIComponent(actorPath)}` +
    `/run-sync-get-dataset-items?clean=true&format=json`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Apify request failed (${response.status}). ${detail.slice(0, 500)}`
    );
  }

  const items = (await response.json()) as unknown[];
  return items
    .map(mapApifyItemToLead)
    .filter((lead) => lead.businessName)
    .slice(0, args.maxLeads);
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
