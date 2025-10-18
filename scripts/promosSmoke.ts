import { config } from "dotenv";
config({ path: ".env" });

async function main() {
  (globalThis as any).__DEV__ = false;
  const { getPromos } = await import("../src/lib/promos");

  const raw = process.argv[2] ?? "cookeville";
  const storeId = raw === "crossville" ? "crossville" : "cookeville";

  console.log("[promosSmoke] running with env project:", process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID);

  try {
    const items = await getPromos(storeId);
    console.log("[promosSmoke] result", {
      storeId,
      count: items.length,
      promos: items.map((promo) => ({
        id: promo.id,
        title: promo.title,
        storeId: promo.storeId,
        startsAt: promo.startsAt instanceof Date ? promo.startsAt.toISOString() : promo.startsAt,
        endsAt: promo.endsAt instanceof Date ? promo.endsAt.toISOString() : promo.endsAt,
      })),
    });
  } catch (error) {
    console.error("[promosSmoke] failed", error);
    process.exitCode = 1;
  }
}

main();
