import promosData from "@/assets/promos.json";

export type PromoRecord = {
  id: string;
  title?: string;
  body?: string;
  status?: string;
  storeId?: "cookeville" | "crossville";
  startsAt?: Date;
  endsAt?: Date;
  deepLinkUrl?: string;
  [key: string]: unknown;
};

export async function getPromos(storeId: "cookeville" | "crossville"): Promise<PromoRecord[]> {
  const stores = promosData as Record<"cookeville" | "crossville", Array<Omit<PromoRecord, "startsAt" | "endsAt"> & { startsAt?: string; endsAt?: string }>>;
  const rawPromos = stores[storeId] ?? [];

  await new Promise((resolve) => setTimeout(resolve, 300));

  return rawPromos.map((promo) => {
    const startsAt = promo.startsAt ? new Date(promo.startsAt) : undefined;
    const endsAt = promo.endsAt ? new Date(promo.endsAt) : undefined;

    return {
      ...promo,
      storeId,
      startsAt: startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : undefined,
      endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : undefined,
    };
  });
}
