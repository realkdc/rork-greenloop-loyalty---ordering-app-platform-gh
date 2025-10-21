export type PromoRecord = {
  id: string;
  title?: string;
  body?: string;
  status?: string;
  storeId?: string;
  startsAt?: Date;
  endsAt?: Date;
  deepLinkUrl?: string;
  [key: string]: unknown;
};

type FetchPromosParams = {
  env?: string;
  storeId?: string;
  limit?: number;
};

type PromoApiRecord = {
  id?: string | number;
  title?: string;
  body?: string;
  status?: string;
  storeId?: string;
  startsAt?: string;
  endsAt?: string;
  deepLinkUrl?: string;
  [key: string]: unknown;
};

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizePromoRecord(promo: PromoApiRecord): PromoRecord | null {
  if (!promo || promo.id === undefined || promo.id === null) {
    return null;
  }

  const startsAt = parseDate(promo.startsAt);
  const endsAt = parseDate(promo.endsAt);

  return {
    ...promo,
    id: String(promo.id),
    startsAt,
    endsAt,
  } satisfies PromoRecord;
}

const DEFAULT_ENV = "prod";
const DEFAULT_STORE_ID = "store_123";
const DEFAULT_LIMIT = 5;

export async function fetchPromos({ env = DEFAULT_ENV, storeId = DEFAULT_STORE_ID, limit = DEFAULT_LIMIT }: FetchPromosParams = {}): Promise<PromoRecord[]> {
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL;

  if (!apiBaseUrl) {
    console.warn("[promos] Missing EXPO_PUBLIC_API_URL environment variable");
    return [];
  }

  try {
    const url = new URL(`${apiBaseUrl.replace(/\/$/, "")}/promotions`);
    url.searchParams.set("env", env);
    url.searchParams.set("storeId", storeId);
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.warn("[promos] Failed to fetch promos", { status: response.status, statusText: response.statusText });
      return [];
    }

    const payload: unknown = await response.json();

    if (!Array.isArray(payload)) {
      console.warn("[promos] Unexpected promos payload shape", { payload });
      return [];
    }

    const promos = payload
      .map((item) => normalizePromoRecord(item as PromoApiRecord))
      .filter((item): item is PromoRecord => Boolean(item));

    const shouldLogPromos = typeof __DEV__ === "undefined" || __DEV__;
    if (shouldLogPromos) {
      console.log("promos count", promos.length);
    }

    return promos;
  } catch (error) {
    console.warn("[promos] Error fetching promos", error);
    return [];
  }
}

export async function getPromos(storeId?: string): Promise<PromoRecord[]> {
  const effectiveStoreId = typeof storeId === "string" && storeId.trim().length > 0 ? storeId : DEFAULT_STORE_ID;
  const promos = await fetchPromos({ storeId: effectiveStoreId });

  if (promos.length === 0) {
    return promos;
  }

  return promos.map((promo) => ({
    ...promo,
    storeId: promo.storeId ?? effectiveStoreId,
  }));
}
